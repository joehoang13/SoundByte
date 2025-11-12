// frontend/src/components/SharedProgressBar.tsx
import React, { useMemo } from 'react';

export type MultiProgress = {
  totalRounds: number;
  players: Record<
    string,
    {
      username: string;
      score: number;
      correctCount: number;
      currentRound: number; // 0-based
      answeredThisRound: boolean;
    }
  >;
};

type Props = {
  progress: MultiProgress | null | undefined;
  myUserId?: string;
  height?: number; // progress bar height (px)
  avatarSize?: number; // icon diameter (px)
  className?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// Deterministic pastel-ish color per userId (or username as fallback)
function colorForId(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const sat = 75; // %
  const lgt = 60; // %
  return `hsl(${hue} ${sat}% ${lgt}%)`;
}

const SharedProgressBar: React.FC<Props> = ({
  progress,
  myUserId,
  height = 10,
  avatarSize = 22,
  className = '',
}) => {
  const { entries, total } = useMemo(() => {
    const totalRounds = progress?.totalRounds ?? 1;
    const safeTotal = Math.max(1, totalRounds);
    const ents = progress ? Object.entries(progress.players) : [];
    return { entries: ents, total: safeTotal };
  }, [progress]);

  // Nothing to render yet
  if (!progress || entries.length === 0) {
    return (
      <div
        className={`w-full rounded-full mb-4 overflow-hidden ${className}`}
        style={{ height, backgroundColor: 'rgba(255,255,255,0.12)' }}
      />
    );
  }

  const trackBg = 'rgba(255,255,255,0.12)';

  return (
    <div className={`w-full mb-4 ${className}`}>
      {/* Track */}
      <div
        className="relative rounded-full overflow-hidden"
        style={{ height, backgroundColor: trackBg }}
      >
        {/* Ghost fill to keep the track “alive” */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: '100%', background: 'transparent' }}
        />

        {/* Avatars */}
        <div className="absolute inset-0">
          <div className="relative h-full w-full">
            {entries.map(([uid, p]) => {
              // Percent progress through rounds; advance +1 if they’ve concluded this round
              const rawPct = (p.currentRound + (p.answeredThisRound ? 1 : 0)) / total;
              const pct = clamp(rawPct, 0, 1);

              const leftStyle = {
                left: `calc(${pct * 100}% )`,
                transform: 'translateX(-50%)',
              } as React.CSSProperties;

              const isMe = myUserId && String(uid) === String(myUserId);
              const bg = colorForId(uid || p.username || 'seed');
              const ring = isMe
                ? '0 0 0 2px rgba(255,255,255,0.95)'
                : '0 0 0 1px rgba(255,255,255,0.55)';
              const halo = isMe
                ? '0 0 10px rgba(15,193,233,0.6)'
                : '0 0 6px rgba(255,255,255,0.25)';

              const initial = (p.username?.[0] || 'P').toUpperCase();

              return (
                <div key={uid} className="absolute top-1/2 -translate-y-1/2" style={leftStyle}>
                  <div
                    className="flex items-center justify-center rounded-full select-none"
                    title={p.username}
                    style={{
                      width: avatarSize,
                      height: avatarSize,
                      background: bg,
                      color: 'rgba(0,0,0,0.75)',
                      fontSize: Math.max(10, Math.floor(avatarSize * 0.55)),
                      fontWeight: 800,
                      boxShadow: `${ring}, ${halo}`,
                      paddingLeft: 0,
                    }}
                  >
                    {initial}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedProgressBar;
