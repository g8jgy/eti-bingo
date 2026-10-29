# ETI Bingo

Live bingo for the ETI Q4 Townhall (Wed Nov 18, 2026). One card per person on their phone,
host draws on the projector, players tap to mark, live leaderboard.

## How the game works

- 43 squares: 22 projects and 21 ETI-life classics like "Did you enter your hours?". Each round plays 36 (all projects + 14 classics, rotating 7 per round) and deals everyone a fresh card. Each card gets 24 of them in
  its own order, with the yETI free square in the center.
- The host draws a square. It shows big on the projector with a one-line caption, and glows on
  every phone that has it. Players tap it to mark it. Only called squares can be marked.
- When a card completes the round's pattern, a BINGO button appears on that phone. The first
  press wins (checked on the server). One prize per person.
- **Auto-draw** calls the next square every 10 to 30 seconds and pauses when someone wins.
- Rounds (simulated with 70 players):
  | Round | Goal | First winner around |
  |---|---|---|
  | 1 | Any line | draw 6 to 11 |
  | 2 | Two lines | draw 15 to 17 |
  | 3 | Full card | draw 33 to 34 |
- **Crown leader** awards the round to whoever is closest if time runs out.

## Pages

| Path | Who | What |
|---|---|---|
| `/` | Players | Join with your name and play. Everyone plays against everyone. |
| `/host` | Host laptop | Stage + control dock. Keys: D draw, A auto-draw, L leaderboard, Q join QR, G game, H hide dock, M mute. |
| `/host?stage=1` | Projector (optional) | Stage only, no controls. |
| `/review` | Host | All 36 squares with tile text and captions, printable. Needs the host key. |
| `/tents?count=10` | Host | Printable join QR cards, two per page, one per table. |

## Offline POC (one HTML file)

`poc/ETI Bingo POC.html` is the whole game in one file: double-click to open it in Edge or Chrome.
The host screen and a phone sit side by side, bot players fill the room, and nothing is saved
(Start over = reload). It needs internet only for fonts. Rebuild after code changes:

```bash
node tools/build-poc.mjs
```

## Run locally

```bash
node dev-server.mjs 8795
```

Host key in local mode is `eti-host`. Data is kept in `.data/dev.json`.

Load test (separate fast server, 70 players):

```bash
BINGO_FAST=1 BINGO_PREFIX=sim node dev-server.mjs 8796
node tools/sim-players.mjs http://localhost:8796 70 0.9
```

## Deploy (Vercel + Upstash Redis, both free tiers)

1. Push this folder to a private GitHub repo under jgyoerger1 (set repo-local
   `user.email` to the jgyoerger1 noreply address or Vercel blocks the deploy).
2. Vercel: Add New Project, import the repo, framework preset **Other**, no build command.
3. Vercel project, Storage tab: add **Upstash for Redis** (Marketplace, free plan) and connect it
   to the project. It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
4. Project settings, Environment Variables: add `HOST_KEY` (a passphrase only the hosts know).
5. Redeploy. Open `/host`, enter the key, press Q for the join QR.

Before the event: open `/host`, More, **Reset game** to clear test cards.

Load: phones poll a state endpoint the Vercel CDN caches for one second, so 70 phones cost
about one function call per second. A tap writes only the player's own record.
