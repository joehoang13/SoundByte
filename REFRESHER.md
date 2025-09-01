# SoundByte — Project Refresher

Generated: 2025-08-26T21:14:42.990Z

## Workspaces

- Name: soundbyte-monorepo
- Workspaces: frontend, backend

## Backend

- package: backend | scripts: dev, start, lint, build
- Models: GameSession, PlayerStats, Snippet, Users
- .env.example: present

## Frontend

- package: frontend | scripts: dev, build, lint, preview
- Vite proxy:
  - /api → http://localhost:3001
- App routes: /, /login, /signup, /gamescreen, /endscreen, \*

## Goals

- No docs/GOALS.md found. Run with `--init-goals` to scaffold a template.

## Next integration steps (proposal)

- BE: implement game session API:
  - POST /api/gs/start { mode } → { sessionId, round, snippet, expiresAt }
  - POST /api/gs/guess { sessionId, round, answer } → { correct, score, nextRound? }
  - POST /api/gs/reveal { sessionId, round } → { snippetUrl, answer }
- FE: wire store for session state and round flow; call above endpoints from GameScreen.
