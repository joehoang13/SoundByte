#!/usr/bin/env python3
# file: tools/project_snapshot.py
"""Project Snapshot

A cross-platform CLI tool to scan a project directory and emit a concise, readable
hierarchical snapshot (tree) plus optional JSON. Designed for pasting into chat.

Usage examples:
  python tools/project_snapshot.py .
  python tools/project_snapshot.py ~/repo --max-depth 5 --out snapshot.txt
  python tools/project_snapshot.py . --json snapshot.json --exclude "*.log" --exclude dist
  python tools/project_snapshot.py . --include-hidden --no-gitignore

Notes:
- .gitignore parsing is an approximation (glob-style via fnmatch on relpaths).
- Defaults prune heavy/common folders to keep output compact.
- No external dependencies; Python 3.8+.
"""
from __future__ import annotations

import argparse
import dataclasses
import fnmatch
import json
import os
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


# ------------------------------- Models ------------------------------------
@dataclass
class TreeNode:
    """Directory tree node with minimal metadata.

    Children is empty for files. Size for directories is aggregate size of files
    within the subtree (best-effort; skips unreadable entries).
    """
    name: str
    relpath: str
    is_dir: bool
    size: int = 0
    children: List["TreeNode"] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "relpath": self.relpath,
            "type": "dir" if self.is_dir else "file",
            "size": self.size,
            "children": [c.to_dict() for c in self.children] if self.is_dir else [],
        }


@dataclass
class SnapshotStats:
    total_files: int = 0
    total_dirs: int = 0
    total_bytes: int = 0
    by_extension: Counter = field(default_factory=Counter)
    warnings: List[str] = field(default_factory=list)
    pruned_entries: int = 0

    def to_dict(self) -> Dict:
        return {
            "total_files": self.total_files,
            "total_dirs": self.total_dirs,
            "total_bytes": self.total_bytes,
            "by_extension": dict(self.by_extension.most_common()),
            "warnings": self.warnings,
            "pruned_entries": self.pruned_entries,
        }


# ------------------------------ Ignore Rules --------------------------------
DEFAULT_EXCLUDES = [
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    "*.pyc",
    "*.pyo",
    "*.log",
    "*.tmp",
    ".DS_Store",
    "Thumbs.db",
]


def load_gitignore(root: Path) -> List[str]:
    """Return gitignore-like patterns from the root .gitignore if present.

    Why approximate: implementing full Git semantics adds complexity & deps, so we
    match patterns against both the basename and the relpath using fnmatch.
    """
    p = root / ".gitignore"
    if not p.exists():
        return []
    try:
        lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception as exc:  # rare perms issues
        return [f"# failed to read .gitignore: {exc}"]

    patterns: List[str] = []
    for line in lines:
        s = line.strip()
        if not s or s.startswith("#"):  # comments/blank
            continue
        # Basic normalization; keep trailing slash to hint directory pattern.
        patterns.append(s)
    return patterns


@dataclass
class IgnoreMatcher:
    root: Path
    patterns: List[str]
    include_hidden: bool

    def _match_any(self, relpath: str, name: str, is_dir: bool) -> bool:
        # Prefer directory-only ignores when pattern ends with '/'.
        for pat in self.patterns:
            dir_only = pat.endswith("/")
            cleaned = pat[:-1] if dir_only else pat
            if dir_only and not is_dir:
                continue
            if fnmatch.fnmatch(name, cleaned):
                return True
            if fnmatch.fnmatch(relpath, cleaned):
                return True
            # Anchor-like behavior: patterns starting with '/'
            if cleaned.startswith('/'):
                if fnmatch.fnmatch('/' + relpath, cleaned):
                    return True
        return False

    def is_ignored(self, p: Path, is_dir: bool) -> bool:
        rel = p.relative_to(self.root).as_posix()
        name = p.name
        if not self.include_hidden and name.startswith('.') and name not in {'.', '..'}:
            return True
        return self._match_any(rel, name, is_dir)


# ------------------------------- Traversal ----------------------------------
LANG_BY_EXT = {
    # minimal mapping; extend as needed
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".jsx": "JavaScript",
    ".json": "JSON",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".toml": "TOML",
    ".md": "Markdown",
    ".rb": "Ruby",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".c": "C",
    ".h": "C/C++ Header",
    ".cpp": "C++",
    ".hpp": "C++ Header",
    ".cs": "C#",
    ".php": "PHP",
    ".swift": "Swift",
    ".scala": "Scala",
    ".sh": "Shell",
    ".bat": "Batch",
    ".ps1": "PowerShell",
    ".sql": "SQL",
    ".html": "HTML",
    ".css": "CSS",
}


def ext_name(path: Path) -> str:
    return path.suffix.lower()


def format_bytes(n: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(n)
    for u in units:
        if size < 1024.0 or u == units[-1]:
            return f"{size:.1f} {u}"
        size /= 1024.0
    return f"{n} B"


def walk_tree(
    root: Path,
    matcher: IgnoreMatcher,
    max_depth: int,
    max_entries_per_dir: int,
    follow_symlinks: bool,
    stats: SnapshotStats,
    _depth: int = 0,
) -> TreeNode:
    """Recursive directory walk returning a TreeNode for root.

    Why scandir: yields dir entries with type info cheaply (perf on large trees).
    """
    node = TreeNode(name=root.name or str(root), relpath="." if _depth == 0 else root.relative_to(matcher.root).as_posix(), is_dir=True)

    try:
        entries = list(os.scandir(root))
    except PermissionError as exc:
        stats.warnings.append(f"permission denied: {root} ({exc})")
        return node
    except FileNotFoundError as exc:
        stats.warnings.append(f"not found: {root} ({exc})")
        return node
    except OSError as exc:
        stats.warnings.append(f"os error: {root} ({exc})")
        return node

    # Sort: dirs first, then files; alpha by name.
    dirs: List[os.DirEntry] = []
    files: List[os.DirEntry] = []
    for e in entries:
        try:
            is_dir = e.is_dir(follow_symlinks=follow_symlinks)
        except OSError:
            # Broken symlink or race; skip with warning, but do not fail traversal.
            stats.warnings.append(f"unreadable entry: {Path(e.path)}")
            continue
        p = Path(e.path)
        if matcher.is_ignored(p, is_dir=is_dir):
            continue
        if is_dir:
            dirs.append(e)
        else:
            files.append(e)

    dirs.sort(key=lambda d: d.name.lower())
    files.sort(key=lambda f: f.name.lower())

    # Apply per-dir cap to avoid huge dumps.
    pruned = 0
    limited_children: List[os.DirEntry] = []
    for e in dirs + files:
        if max_entries_per_dir > 0 and len(limited_children) >= max_entries_per_dir:
            pruned += 1
            continue
        limited_children.append(e)

    if pruned:
        stats.pruned_entries += pruned
        stats.warnings.append(f"pruned {pruned} entrie(s) in {root}")

    # Recurse into children.
    for e in limited_children:
        p = Path(e.path)
        try:
            is_dir = e.is_dir(follow_symlinks=follow_symlinks)
        except OSError:
            stats.warnings.append(f"unreadable entry: {p}")
            continue

        if is_dir:
            stats.total_dirs += 1
            child: TreeNode
            if _depth + 1 < max_depth:
                child = walk_tree(
                    p,
                    matcher=matcher,
                    max_depth=max_depth,
                    max_entries_per_dir=max_entries_per_dir,
                    follow_symlinks=follow_symlinks,
                    stats=stats,
                    _depth=_depth + 1,
                )
            else:
                # Depth limit reached: represent the directory without children.
                child = TreeNode(name=p.name, relpath=p.relative_to(matcher.root).as_posix(), is_dir=True)
            node.children.append(child)
            node.size += child.size
        else:
            stats.total_files += 1
            try:
                size = p.stat().st_size
            except OSError:
                size = 0
                stats.warnings.append(f"size unavailable: {p}")
            node.children.append(TreeNode(name=p.name, relpath=p.relative_to(matcher.root).as_posix(), is_dir=False, size=size))
            node.size += size
            stats.total_bytes += size
            stats.by_extension[ext_name(p) or "<noext>"] += 1

    return node


# ------------------------------ Rendering -----------------------------------
TREE_BRANCH = "├── "
TREE_LAST = "└── "
TREE_PIPE = "│   "
TREE_SPACE = "    "


def render_tree_text(root: TreeNode, stats: SnapshotStats, title: str) -> str:
    lines: List[str] = []

    # Summary header first for quick context when pasted.
    ts = time.strftime("%Y-%m-%d %H:%M:%S %Z", time.localtime())
    top_langs = ", ".join(
        f"{k or '<noext>'}: {v}" for k, v in stats.by_extension.most_common(8)
    ) or "n/a"
    lines.append(f"# Project Snapshot: {title}")
    lines.append(f"# Generated: {ts}")
    lines.append(
        f"# Totals: {stats.total_dirs} dirs, {stats.total_files} files, {format_bytes(stats.total_bytes)}"
    )
    lines.append(f"# Top by extension: {top_langs}")
    if stats.pruned_entries:
        lines.append(f"# Note: pruned {stats.pruned_entries} entries (per-dir cap)")
    if stats.warnings:
        lines.append("# Warnings:")
        for w in stats.warnings[:8]:
            lines.append(f"#  - {w}")
        if len(stats.warnings) > 8:
            lines.append(f"#  - ... {len(stats.warnings) - 8} more")
    lines.append("")

    # Tree rendering.
    def _walk(n: TreeNode, prefix: str = "") -> None:
        if not n.children:
            return
        total = len(n.children)
        for i, child in enumerate(n.children):
            last = i == total - 1
            connector = TREE_LAST if last else TREE_BRANCH
            if child.is_dir:
                lines.append(f"{prefix}{connector}{child.name}/")
                _walk(child, prefix + (TREE_SPACE if last else TREE_PIPE))
            else:
                lines.append(f"{prefix}{connector}{child.name} ({format_bytes(child.size)})")

    # Root line
    lines.append(f"{root.name or str(root.relpath)}/")
    _walk(root)

    return "\n".join(lines)


# ------------------------------- CLI ----------------------------------------

def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Scan a project directory and emit a readable snapshot (tree) and optional JSON.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("root", nargs="?", default=".", help="root directory to scan")
    p.add_argument("--max-depth", type=int, default=6, help="maximum depth to traverse")
    p.add_argument(
        "--max-entries-per-dir",
        type=int,
        default=200,
        help="cap number of entries per directory to keep output manageable; 0 = unlimited",
    )
    p.add_argument("--include-hidden", action="store_true", help="include dotfiles and dotfolders")
    p.add_argument("--follow-symlinks", action="store_true", help="follow symlinks (use with care)")
    p.add_argument("--no-gitignore", action="store_true", help="do not read .gitignore from root")
    p.add_argument(
        "--exclude",
        action="append",
        default=[],
        metavar="PATTERN",
        help="extra glob patterns to exclude (can be repeated)",
    )
    p.add_argument("--out", help="write text snapshot to file instead of stdout")
    p.add_argument("--json", dest="json_out", help="write JSON snapshot to file")
    return p


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)

    root = Path(args.root).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        print(f"error: root not found or not a directory: {root}", file=sys.stderr)
        return 2

    gitignore_patterns: List[str] = []
    if not args.no_gitignore:
        gitignore_patterns = load_gitignore(root)

    patterns: List[str] = list(DEFAULT_EXCLUDES) + list(args.exclude or [])
    if gitignore_patterns:
        patterns.extend([p for p in gitignore_patterns if not p.startswith("#")])

    matcher = IgnoreMatcher(root=root, patterns=patterns, include_hidden=args.include_hidden)
    stats = SnapshotStats()

    # Walk & build tree.
    tree = walk_tree(
        root,
        matcher=matcher,
        max_depth=max(1, args.max_depth),
        max_entries_per_dir=max(0, args.max_entries_per_dir),
        follow_symlinks=bool(args.follow_symlinks),
        stats=stats,
    )

    text = render_tree_text(tree, stats, title=str(root))

    if args.out:
        try:
            Path(args.out).write_text(text, encoding="utf-8")
        except Exception as exc:
            print(f"error: failed writing text snapshot: {exc}", file=sys.stderr)
            return 3
    else:
        print(text)

    if args.json_out:
        try:
            payload = {
                "root": str(root),
                "generated_at": int(time.time()),
                "tree": tree.to_dict(),
                "stats": stats.to_dict(),
                "exclude_patterns": patterns,
                "config": {
                    "max_depth": int(args.max_depth),
                    "max_entries_per_dir": int(args.max_entries_per_dir),
                    "include_hidden": bool(args.include_hidden),
                    "follow_symlinks": bool(args.follow_symlinks),
                },
            }
            Path(args.json_out).write_text(json.dumps(payload, indent=2), encoding="utf-8")
        except Exception as exc:
            print(f"error: failed writing JSON snapshot: {exc}", file=sys.stderr)
            return 4

    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
