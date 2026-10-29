# ETI Bingo

Live bingo for the ETI Q4 Townhall (Wed Nov 18, 2026). One card per person on their phone,
host draws with timed challenges on the projector, live leaderboard.

## How the game works

- Every card holds the same 24 squares (2026 launches, GDI brands, ETI, 2027 goals) in a
  unique order, with the yETI free square in the center. Every draw matters to everyone.
- The host draws a square. Phones get a multiple-choice challenge (60 seconds by default).
  A correct answer marks that square. The answer is revealed on the big screen and phones.
- Missed squares come back through **Second chance** draws with a different question.
- **Free square**: the host awards it to tables (for example Jeopardy winners). Everyone at
  those tables taps any open square to mark it.
- Rounds (tuned by simulating 70 players at 75% accuracy):
  | Round | Goal | Expected first winner |
  |---|---|---|
  | 1 | Any line | around draw 7 to 9 |
  | 2 | Two lines | around draw 14 |
  | 3 | Blackout race | usually needs second chances; host ends it with **Crown leader** |
- First correct answer that completes the goal wins. One prize per person: past winners keep
  playing but can't win again. Starting a round awards it right away if someone already qualifies.

## Pages

| Path | Who | What |
|---|---|---|
| `/` | Players | Join (name + table) and play. `/?t=4` presets table 4. |
| `/host` | Host laptop | Stage + control dock. Keys: D draw, S second chance, E end timer, L leaderboard, Q join QR, G game, H hide dock, M mute. |
| `/host?stage=1` | Projector (optional) | Stage only, no controls. |
| `/review` | Host | Every question with the answer, printable. Needs the host key. |
| `/tents?tables=10` | Host | Printable table cards with a QR per table. |

## Run locally

```bash
node dev-server.mjs 8795
```

Host key in local mode is `eti-host`. Data is kept in `.data/dev.json`.

Load test (separate fast server, 70 players):

```bash
BINGO_FAST=1 BINGO_PREFIX=sim node dev-server.mjs 8796
node tools/sim-players.mjs http://localhost:8796 70 0.75
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
about one function call per second. Answers write only the player's own record.
