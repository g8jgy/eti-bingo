// ETI Bingo API: one Vercel function, operations selected with ?op=
// Public:  state (GET, CDN-cached ~1s), join, me, mark, claim, free
// Host:    host-* operations, require the x-host-key header to match HOST_KEY.
//
// Classic bingo: the host draws a square, players tap it on their card if they have it,
// and the first player to press BINGO with the round's pattern complete wins.

import crypto from 'node:crypto';
import { exec, hashToObj, backend } from '../lib/store.js';
import { SQUARES } from '../lib/content.js';
import { GOALS, makeCells, toGo, standings, shuffle, CENTER } from '../lib/engine.js';

const P = process.env.BINGO_PREFIX || 'etibingo:q4-2026';
const K = { game: P + ':game', players: P + ':players', sums: P + ':sums', win: (r) => P + ':win:' + r };
const FAST = process.env.BINGO_FAST === '1' && backend === 'memory'; // load-test mode, local only
const SPIN_MS = FAST ? 100 : 3500; // host spin animation before the square is revealed
const HOST_KEY = process.env.HOST_KEY || (backend === 'memory' ? 'eti-host' : null);

const newGame = () => ({ v: 1, status: 'lobby', round: 1, tables: 10, draws: [], freebies: [], created: Date.now() });

class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = (msg, code = 400) => { throw new HttpError(code, msg); };
const id = (n) => crypto.randomBytes(n).toString('base64url');
const parse = (s) => (s ? JSON.parse(s) : null);

async function loadGame() {
  const [g] = await exec([['GET', K.game]]);
  return parse(g) || newGame();
}
async function saveGame(game) {
  game.v = (game.v || 0) + 1;
  await exec([['SET', K.game, JSON.stringify(game)]]);
}
const summary = (p) => ({ id: p.id, n: p.n, t: p.t, k: p.cells, m: p.m, w: p.w, lm: p.lm || 0 });
async function savePlayer(p) {
  await exec([['HSET', K.players, p.id, JSON.stringify(p)], ['HSET', K.sums, p.id, JSON.stringify(summary(p))]]);
}
async function authPlayer(body) {
  const [raw] = await exec([['HGET', K.players, String(body.pid || '')]]);
  const p = parse(raw);
  if (!p || p.tok !== body.token) bad('Card not found. Rejoin from the QR code.', 401);
  return p;
}
const publicPlayer = (p) => ({ id: p.id, name: p.n, table: p.t, cells: p.cells, marks: p.m, free: p.free, won: p.w });

// Squares that have been revealed (the newest draw is hidden while the host screen spins).
const calledSet = (game, now) => new Set(game.draws.filter((d) => now >= d.at).map((d) => d.sq));

// ------------------------------------------------------------ public state
async function state() {
  const now = Date.now();
  const [g, sumsFlat, w1, w2, w3] = await exec([['GET', K.game], ['HGETALL', K.sums], ['GET', K.win(1)], ['GET', K.win(2)], ['GET', K.win(3)]]);
  const game = parse(g) || newGame();
  const sums = Object.values(hashToObj(sumsFlat)).map(parse);
  const goal = GOALS[game.round] || GOALS[1];
  const rows = standings(sums, goal.key);
  const byId = Object.fromEntries(sums.map((s) => [s.id, s]));

  const last = game.draws[game.draws.length - 1] || null;
  let current = null;
  if (last) {
    const live = now >= last.at;
    current = {
      id: last.id, n: last.n, at: last.at, sq: live ? last.sq : null,
      label: live ? SQUARES[last.sq].label : null, caption: live ? SQUARES[last.sq].caption : null,
      onCards: live ? sums.filter((s) => (s.k || []).includes(last.sq)).length : null,
    };
  }
  const wins = {};
  [w1, w2, w3].forEach((raw, i) => {
    const w = parse(raw);
    if (!w) return;
    const s = byId[w.id];
    wins[i + 1] = { id: w.id, name: s ? s.n : 'Player', table: s ? s.t : null, at: w.at };
  });
  const called = game.draws.filter((d) => now >= d.at).map((d) => d.sq);
  return {
    now, v: game.v, status: game.status, round: game.round, goal: goal.key, goalLabel: goal.label,
    tables: game.tables, drawCount: called.length, called, left: SQUARES.length - called.length,
    current, freebies: game.freebies, wins, players: sums.length,
    top: rows.slice(0, 10).map((r) => ({ id: r.id, name: r.name, table: r.table, toGo: r.toGo, marks: r.marks, won: r.won })),
    st: Object.fromEntries(rows.map((r) => [r.id, [r.rank, r.toGo, r.marks]])),
    labels: SQUARES.map((s) => s.label),
    tiles: SQUARES.map((s) => s.tile),
  };
}

// ------------------------------------------------------------ player ops
async function join(body) {
  const game = await loadGame();
  const name = String(body.name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
  const table = parseInt(body.table, 10);
  if (name.length < 2) bad('Please enter your name.');
  if (!(table >= 1 && table <= game.tables)) bad('Pick your table number.');
  const pid = id(8);
  const p = { id: pid, tok: id(18), n: name, t: table, cells: makeCells(pid + ':' + P, SQUARES.length), m: [], free: {}, w: 0, at: Date.now() };
  await savePlayer(p);
  return { pid, token: p.tok, player: publicPlayer(p), now: Date.now() };
}

async function me(body) {
  const p = await authPlayer(body);
  return { player: publicPlayer(p), now: Date.now() };
}

// Mark one cell. Only squares that have been called can be marked.
async function mark(body) {
  const now = Date.now();
  const [g, raw] = await exec([['GET', K.game], ['HGET', K.players, String(body.pid || '')]]);
  const game = parse(g) || newGame();
  const p = parse(raw);
  if (!p || p.tok !== body.token) bad('Card not found. Rejoin from the QR code.', 401);
  const cell = parseInt(body.cell, 10);
  if (!(cell >= 0 && cell < 25) || cell === CENTER) bad('Pick a square.');
  if (!calledSet(game, now).has(p.cells[cell])) bad("That square hasn't been called yet.", 409);
  if (!p.m.includes(cell)) { p.m.push(cell); p.lm = now; await savePlayer(p); }
  return { player: publicPlayer(p) };
}

// Press BINGO. Wins the current round if the pattern is complete and nobody beat you to it.
async function claim(body) {
  const now = Date.now();
  const game = await loadGame();
  const p = await authPlayer(body);
  const goal = GOALS[game.round];
  if (p.w) bad(`You already won Round ${p.w}. Let someone else have a turn!`, 409);
  if (toGo(goal.key, p.m) > 0) bad(`Not yet! You need ${goal.label.toLowerCase()} for Round ${game.round}.`, 409);
  const [ok] = await exec([['SET', K.win(game.round), JSON.stringify({ id: p.id, at: now }), 'NX']]);
  if (ok !== 'OK') bad('So close! Someone called BINGO first this round.', 409);
  p.w = game.round;
  await savePlayer(p);
  return { won: game.round, player: publicPlayer(p) };
}

async function free(body) {
  const game = await loadGame();
  const p = await authPlayer(body);
  const f = game.freebies.find((x) => x.id === body.freeId);
  if (!f || !f.tables.includes(p.t)) bad('No free square for your table.', 409);
  if (p.free[f.id] != null) bad('You already used this free square.', 409);
  const cell = parseInt(body.cell, 10);
  if (!(cell >= 0 && cell < 25) || cell === CENTER || p.m.includes(cell)) bad('Pick an open square.');
  p.m.push(cell);
  p.free[f.id] = cell;
  p.lm = Date.now();
  await savePlayer(p);
  return { player: publicPlayer(p) };
}

// ------------------------------------------------------------ host ops
async function loadAll() {
  const [g, sumsFlat] = await exec([['GET', K.game], ['HGETALL', K.sums]]);
  return { game: parse(g) || newGame(), sums: Object.values(hashToObj(sumsFlat)).map(parse) };
}

async function hostDraw() {
  const now = Date.now();
  const game = await loadGame();
  const last = game.draws[game.draws.length - 1];
  if (last && now < last.at) bad('Still drawing.', 409);
  const drawn = new Set(game.draws.map((x) => x.sq));
  const fresh = [...SQUARES.keys()].filter((i) => !drawn.has(i));
  if (!fresh.length) bad('Every square has been called.', 409);
  const sq = shuffle(fresh)[0];
  const d = { id: 'd' + (game.draws.length + 1) + '-' + id(3), n: game.draws.length + 1, sq, at: now + SPIN_MS };
  game.draws.push(d);
  game.status = 'live';
  await saveGame(game);
  return { draw: { id: d.id, n: d.n, at: d.at } };
}

async function hostUndo() {
  const game = await loadGame();
  const d = game.draws.pop();
  if (!d) bad('Nothing to undo.');
  await saveGame(game);
  return { undone: SQUARES[d.sq].label, note: 'Players who already marked it keep the mark.' };
}

async function crown(game, sums, round) {
  const [existing] = await exec([['GET', K.win(round)]]);
  if (existing) return null;
  const rows = standings(sums.filter((s) => !s.w), GOALS[round].key);
  const best = rows[0];
  if (!best) return null;
  const [raw] = await exec([['HGET', K.players, best.id]]);
  const p = parse(raw);
  const [ok] = await exec([['SET', K.win(round), JSON.stringify({ id: p.id, at: Date.now(), crowned: true }), 'NX']]);
  if (ok !== 'OK') return null;
  p.w = round;
  await savePlayer(p);
  return { id: p.id, name: p.n, table: p.t };
}

async function hostRound(body) {
  const round = parseInt(body.round, 10);
  if (!GOALS[round]) bad('Round must be 1, 2 or 3.');
  const game = await loadGame();
  game.round = round;
  await saveGame(game);
  return { round };
}

async function hostCrown() {
  const { game, sums } = await loadAll();
  const w = await crown(game, sums, game.round);
  if (!w) bad('This round already has a winner, or nobody is eligible.', 409);
  return { winner: w };
}

async function hostClearWin(body) {
  const round = parseInt(body.round, 10);
  const [raw] = await exec([['GET', K.win(round)]]);
  const w = parse(raw);
  if (!w) bad('No winner recorded for that round.');
  const [praw] = await exec([['HGET', K.players, w.id]]);
  const p = parse(praw);
  await exec([['DEL', K.win(round)]]);
  if (p) { p.w = 0; await savePlayer(p); }
  return { cleared: round };
}

async function hostFree(body) {
  const game = await loadGame();
  const tables = [...new Set((body.tables || []).map((t) => parseInt(t, 10)).filter((t) => t >= 1 && t <= game.tables))];
  if (!tables.length) bad('Pick at least one table.');
  const f = { id: 'f' + (game.freebies.length + 1), tables, at: Date.now(), label: String(body.label || '').slice(0, 40) };
  game.freebies.push(f);
  await saveGame(game);
  return { freebie: f };
}

async function hostSettings(body) {
  const game = await loadGame();
  if (body.tables != null) game.tables = Math.max(1, Math.min(30, parseInt(body.tables, 10) || 10));
  if (body.status && ['lobby', 'live', 'ended'].includes(body.status)) game.status = body.status;
  await saveGame(game);
  return { tables: game.tables, status: game.status };
}

async function hostKick(body) {
  await exec([['HDEL', K.players, String(body.pid)], ['HDEL', K.sums, String(body.pid)]]);
  return { removed: body.pid };
}

async function hostReset(body) {
  if (body.confirm !== 'RESET') bad('Type RESET to confirm.');
  const keep = await loadGame();
  await exec([['DEL', K.game, K.players, K.sums, K.win(1), K.win(2), K.win(3)]]);
  const g = newGame();
  g.tables = keep.tables; g.v = (keep.v || 0) + 1;
  await exec([['SET', K.game, JSON.stringify(g)]]);
  return { reset: true };
}

async function hostPlayers() {
  const { game, sums } = await loadAll();
  return { players: standings(sums, GOALS[game.round].key) };
}

const HOST = {
  'host-draw': hostDraw, 'host-undo': hostUndo, 'host-round': hostRound, 'host-crown': hostCrown,
  'host-clear-win': hostClearWin, 'host-free': hostFree, 'host-settings': hostSettings, 'host-kick': hostKick,
  'host-reset': hostReset, 'host-players': hostPlayers,
  'host-content': async () => ({ squares: SQUARES }),
  'host-check': async () => ({ ok: true, backend }),
};
const PLAYER = { join, me, mark, claim, free };

export default async function handler(req, res) {
  const op = String((req.query && req.query.op) || '');
  try {
    if (op === 'state') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('CDN-Cache-Control', 'max-age=1');
      res.setHeader('Vercel-CDN-Cache-Control', 'max-age=1');
      return res.status(200).json(await state());
    }
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') bad('Use POST.', 405);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (HOST[op]) {
      if (!HOST_KEY) bad('HOST_KEY is not configured on the server.', 500);
      if (req.headers['x-host-key'] !== HOST_KEY) bad('Wrong host key.', 401);
      return res.status(200).json(await HOST[op](body));
    }
    if (PLAYER[op]) return res.status(200).json(await PLAYER[op](body));
    bad('Unknown operation.', 404);
  } catch (e) {
    const code = e instanceof HttpError ? e.code : 500;
    if (code === 500) console.error(e);
    res.status(code).json({ error: e.message || 'Server error' });
  }
}
