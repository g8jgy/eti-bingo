// ETI Bingo API: one Vercel function, operations selected with ?op=
// Public:  state (GET, CDN-cached ~1s), join, me, answer, free
// Host:    host-* operations, require the x-host-key header to match HOST_KEY.

import crypto from 'node:crypto';
import { exec, hashToObj, backend } from '../lib/store.js';
import { SQUARES } from '../lib/content.js';
import { GOALS, makeCells, toGo, standings, shuffle, CENTER } from '../lib/engine.js';

const P = process.env.BINGO_PREFIX || 'etibingo:q4-2026';
const K = { game: P + ':game', players: P + ':players', sums: P + ':sums', win: (r) => P + ':win:' + r };
const FAST = process.env.BINGO_FAST === '1' && backend === 'memory'; // load-test mode, local only
const SPIN_MS = FAST ? 200 : 3800; // host spin animation before the question appears
const MIN_SECS = FAST ? 1 : 10;
const GRACE_MS = 1500;     // network grace after the timer hits zero
const HOST_KEY = process.env.HOST_KEY || (backend === 'memory' ? 'eti-host' : null);

const newGame = () => ({ v: 1, status: 'lobby', round: 1, seconds: 60, tables: 10, draws: [], freebies: [], created: Date.now() });

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
const summary = (p) => ({ id: p.id, n: p.n, t: p.t, k: p.cells, m: p.m, c: p.c, ms: p.ms, w: p.w, a: p.lastA || null, ok: !!p.lastOk });
async function savePlayer(p) {
  await exec([['HSET', K.players, p.id, JSON.stringify(p)], ['HSET', K.sums, p.id, JSON.stringify(summary(p))]]);
}
async function authPlayer(body) {
  const [raw] = await exec([['HGET', K.players, String(body.pid || '')]]);
  const p = parse(raw);
  if (!p || p.tok !== body.token) bad('Card not found. Rejoin from the QR code.', 401);
  return p;
}
const publicPlayer = (p) => ({ id: p.id, name: p.n, table: p.t, cells: p.cells, marks: p.m, answers: p.ans, free: p.free, correct: p.c, won: p.w });

const currentDraw = (game) => game.draws[game.draws.length - 1] || null;
const question = (d) => SQUARES[d.sq].qs[d.qi];
const correctIndex = (d) => d.order.indexOf(question(d).a);

// Award a round if this player now satisfies it. First correct answer wins (SET NX).
async function maybeWin(game, p, now, drawId) {
  if (p.w) return false;
  const goal = GOALS[game.round];
  if (!goal || toGo(goal.key, p.m) > 0) return false;
  const [ok] = await exec([['SET', K.win(game.round), JSON.stringify({ id: p.id, at: now, draw: drawId || null }), 'NX']]);
  if (ok === 'OK') { p.w = game.round; return true; }
  return false;
}

// ------------------------------------------------------------ public state
async function state() {
  const now = Date.now();
  const [g, sumsFlat, w1, w2, w3] = await exec([['GET', K.game], ['HGETALL', K.sums], ['GET', K.win(1)], ['GET', K.win(2)], ['GET', K.win(3)]]);
  const game = parse(g) || newGame();
  const sums = Object.values(hashToObj(sumsFlat)).map(parse);
  const goal = GOALS[game.round] || GOALS[1];
  const rows = standings(sums, goal.key);
  const names = Object.fromEntries(sums.map((s) => [s.id, s]));

  const d = currentDraw(game);
  let current = null, reveal = null;
  if (d) {
    const q = question(d);
    const live = now >= d.at;
    current = {
      id: d.id, n: d.n, sq: d.sq, label: SQUARES[d.sq].label, second: d.second, at: d.at, closes: d.closes,
      q: live ? q.q : null, options: live ? d.order.map((i) => q.options[i]) : null,
      answered: sums.filter((s) => s.a === d.id).length,
    };
    if (now >= d.closes) {
      const answered = sums.filter((s) => s.a === d.id);
      reveal = { id: d.id, answer: correctIndex(d), fact: q.fact, answered: answered.length, correct: answered.filter((s) => s.ok).length };
    }
  }
  const wins = {};
  [w1, w2, w3].forEach((raw, i) => {
    const w = parse(raw);
    if (!w) return;
    // Hold a win back until the challenge that produced it is revealed.
    const wd = w.draw && game.draws.find((x) => x.id === w.draw);
    if (wd && now < wd.closes) return;
    const s = names[w.id];
    wins[i + 1] = { id: w.id, name: s ? s.n : 'Player', table: s ? s.t : null, at: w.at };
  });

  const called = [...new Set(game.draws.map((x) => x.sq))];
  return {
    now, v: game.v, status: game.status, round: game.round, goal: goal.key, goalLabel: goal.label,
    seconds: game.seconds, tables: game.tables, drawCount: game.draws.length,
    called, left: SQUARES.length - called.length,
    current, reveal, freebies: game.freebies, wins, players: sums.length,
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
  const p = { id: pid, tok: id(18), n: name, t: table, cells: makeCells(pid + ':' + P, SQUARES.length), m: [], ans: {}, free: {}, c: 0, ms: 0, w: 0, at: Date.now() };
  await savePlayer(p);
  return { pid, token: p.tok, player: publicPlayer(p), now: Date.now() };
}

async function me(body) {
  const p = await authPlayer(body);
  return { player: publicPlayer(p), now: Date.now() };
}

async function answer(body) {
  const now = Date.now();
  const [g, raw] = await exec([['GET', K.game], ['HGET', K.players, String(body.pid || '')]]);
  const game = parse(g) || newGame();
  const p = parse(raw);
  if (!p || p.tok !== body.token) bad('Card not found. Rejoin from the QR code.', 401);
  const d = currentDraw(game);
  if (!d || d.id !== body.drawId) bad('That challenge is over.', 409);
  if (now < d.at) bad('Not open yet.', 409);
  if (now > d.closes + GRACE_MS) bad("Time's up!", 409);
  if (p.ans[d.id]) bad('You already locked in an answer.', 409);
  const choice = parseInt(body.choice, 10);
  if (!(choice >= 0 && choice < 4)) bad('Pick an answer.');

  const ok = d.order[choice] === question(d).a;
  const ms = Math.max(0, now - d.at);
  p.ans[d.id] = { c: choice, ok, ms };
  p.lastA = d.id; p.lastOk = ok;
  if (ok) {
    p.c += 1; p.ms += ms;
    const cell = p.cells.indexOf(d.sq);
    if (cell >= 0 && !p.m.includes(cell)) p.m.push(cell);
    await maybeWin(game, p, now, d.id);
  }
  await savePlayer(p);
  return { locked: true, choice };
}

async function free(body) {
  const now = Date.now();
  const game = await loadGame();
  const p = await authPlayer(body);
  const f = game.freebies.find((x) => x.id === body.freeId);
  if (!f || !f.tables.includes(p.t)) bad('No free square for your table.', 409);
  if (p.free[f.id] != null) bad('You already used this free square.', 409);
  const cell = parseInt(body.cell, 10);
  if (!(cell >= 0 && cell < 25) || cell === CENTER || p.m.includes(cell)) bad('Pick an open square.');
  p.m.push(cell);
  p.free[f.id] = cell;
  await maybeWin(game, p, now, null);
  await savePlayer(p);
  return { player: publicPlayer(p) };
}

// ------------------------------------------------------------ host ops
async function loadAll() {
  const [g, sumsFlat] = await exec([['GET', K.game], ['HGETALL', K.sums]]);
  return { game: parse(g) || newGame(), sums: Object.values(hashToObj(sumsFlat)).map(parse) };
}

async function hostDraw(body) {
  const now = Date.now();
  const { game, sums } = await loadAll();
  const last = currentDraw(game);
  if (last && now < last.closes) bad('The current challenge is still open.', 409);
  const drawn = new Set(game.draws.map((x) => x.sq));
  const fresh = [...SQUARES.keys()].filter((i) => !drawn.has(i));
  let sq, second = false;
  if (!body.second && fresh.length) {
    sq = fresh[Math.floor(Math.random() * fresh.length)];
  } else {
    // Second chance: the drawn square the most players are still missing.
    const missing = [...drawn].map((s) => ({ s, n: sums.filter((p) => !(p.m || []).includes((p.k || []).indexOf(s))).length }))
      .filter((x) => x.n > 0);
    if (!missing.length) bad(fresh.length ? 'Nobody has missed a square yet.' : 'Every square is marked on every card!', 409);
    const max = Math.max(...missing.map((x) => x.n));
    const pool = missing.filter((x) => x.n === max);
    sq = pool[Math.floor(Math.random() * pool.length)].s;
    second = true;
  }
  const prior = game.draws.filter((x) => x.sq === sq).length;
  const seconds = Math.max(MIN_SECS, Math.min(120, parseInt(body.seconds, 10) || game.seconds));
  const at = now + SPIN_MS;
  const d = { id: 'd' + (game.draws.length + 1) + '-' + id(3), n: game.draws.length + 1, sq, qi: prior % 2, order: shuffle([0, 1, 2, 3]), at, closes: at + seconds * 1000, second };
  game.draws.push(d);
  game.status = 'live';
  await saveGame(game);
  return { draw: { id: d.id, sq, label: SQUARES[sq].label, second } };
}

async function hostClose() {
  const game = await loadGame();
  const d = currentDraw(game);
  if (!d) bad('Nothing to close.');
  const now = Date.now();
  if (now < d.closes) { d.closes = Math.max(now, d.at); await saveGame(game); }
  return { closed: d.id };
}

// Award the round to the best eligible player on the board (end of the blackout race,
// or a round goal that someone had already reached before the round started).
async function crown(game, sums, round, onlyIfComplete) {
  const [existing] = await exec([['GET', K.win(round)]]);
  if (existing) return null;
  const goal = GOALS[round];
  const rows = standings(sums.filter((s) => !s.w), goal.key);
  const best = rows[0];
  if (!best || (onlyIfComplete && best.toGo > 0)) return null;
  const [raw] = await exec([['HGET', K.players, best.id]]);
  const p = parse(raw);
  const [ok] = await exec([['SET', K.win(round), JSON.stringify({ id: p.id, at: Date.now(), draw: null }), 'NX']]);
  if (ok !== 'OK') return null;
  p.w = round;
  await savePlayer(p);
  return { id: p.id, name: p.n, table: p.t };
}

async function hostRound(body) {
  const round = parseInt(body.round, 10);
  if (!GOALS[round]) bad('Round must be 1, 2 or 3.');
  const { game, sums } = await loadAll();
  game.round = round;
  await saveGame(game);
  const auto = await crown(game, sums, round, true);
  return { round, autoWinner: auto };
}

async function hostCrown() {
  const { game, sums } = await loadAll();
  const w = await crown(game, sums, game.round, false);
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
  const cmds = [['DEL', K.win(round)]];
  await exec(cmds);
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
  if (body.seconds != null) game.seconds = Math.max(MIN_SECS, Math.min(120, parseInt(body.seconds, 10) || 60));
  if (body.tables != null) game.tables = Math.max(1, Math.min(30, parseInt(body.tables, 10) || 10));
  if (body.status && ['lobby', 'live', 'ended'].includes(body.status)) game.status = body.status;
  await saveGame(game);
  return { seconds: game.seconds, tables: game.tables, status: game.status };
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
  g.seconds = keep.seconds; g.tables = keep.tables; g.v = (keep.v || 0) + 1;
  await exec([['SET', K.game, JSON.stringify(g)]]);
  return { reset: true };
}

async function hostPlayers() {
  const { game, sums } = await loadAll();
  const goal = GOALS[game.round];
  return { players: standings(sums, goal.key) };
}

const HOST = {
  'host-draw': hostDraw, 'host-close': hostClose, 'host-round': hostRound, 'host-crown': hostCrown,
  'host-clear-win': hostClearWin, 'host-free': hostFree, 'host-settings': hostSettings, 'host-kick': hostKick,
  'host-reset': hostReset, 'host-players': hostPlayers,
  'host-content': async () => ({ squares: SQUARES }),
  'host-check': async () => ({ ok: true, backend }),
};
const PLAYER = { join, me, answer, free };

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
