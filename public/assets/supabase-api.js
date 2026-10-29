// Supabase backend for the hosted (GitHub Pages) build. Speaks the same api(op, body, hostKey) contract
// as /api/game, calling the bingo_* functions from supabase/setup.sql and filling in what the
// database leaves to the client (labels, captions, round pools, goals).
import { SQUARES, roundPool } from './content.js';
import { GOALS, ROUNDS } from './engine.js';

const PLAYER_OPS = {
  state: ['bingo_state', () => ({})],
  join: ['bingo_join', (b) => ({ p_name: b.name })],
  me: ['bingo_me', (b) => ({ p_pid: b.pid, p_tok: b.token })],
  mark: ['bingo_mark', (b) => ({ p_pid: b.pid, p_tok: b.token, p_cell: b.cell })],
  claim: ['bingo_claim', (b) => ({ p_pid: b.pid, p_tok: b.token })],
};

export function supabaseApi({ supabaseUrl, supabaseKey }) {
  const base = supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/';
  const headers = { apikey: supabaseKey, 'Content-Type': 'application/json' };
  if (supabaseKey.startsWith('eyJ')) headers.Authorization = 'Bearer ' + supabaseKey; // legacy anon JWT

  async function rpc(fn, args) {
    const r = await fetch(base + fn, { method: 'POST', headers, body: JSON.stringify(args), cache: 'no-store' });
    let j = null;
    try { j = await r.json(); } catch { /* empty */ }
    if (!r.ok) {
      const e = new Error((j && j.message) || `Request failed (${r.status})`);
      e.status = j && j.hint === 'auth' ? 401 : r.status >= 500 ? r.status : 409;
      throw e;
    }
    return j;
  }

  function withContent(s) {
    const goal = GOALS[s.round] || GOALS[1];
    s.goal = goal.key;
    s.goalLabel = goal.label;
    s.goals = Object.fromEntries(ROUNDS.map((r) => [r, { key: GOALS[r].key, label: GOALS[r].label }]));
    s.pool = roundPool(s.round);
    s.labels = SQUARES.map((q) => q.label);
    s.tiles = SQUARES.map((q) => q.tile);
    if (s.current && s.current.sq != null) {
      s.current.label = SQUARES[s.current.sq].label;
      s.current.caption = SQUARES[s.current.sq].caption;
    } else if (s.current) {
      s.current.label = null;
      s.current.caption = null;
    }
    return s;
  }

  return async function api(op, body = {}, hostKey) {
    if (PLAYER_OPS[op]) {
      const [fn, args] = PLAYER_OPS[op];
      const out = await rpc(fn, args(body || {}));
      return op === 'state' ? withContent(out) : out;
    }
    if (op === 'host-content') return { squares: SQUARES, rounds: Object.fromEntries(ROUNDS.map((r) => [r, roundPool(r)])) };
    if (op.startsWith('host-')) {
      const out = await rpc('bingo_host', { p_key: hostKey || '', p_op: op.slice(5), p_args: body || {} });
      if (op === 'host-undo' && typeof out.undone === 'number') out.undone = SQUARES[out.undone].label;
      return out;
    }
    const e = new Error('Unknown operation.');
    e.status = 404;
    throw e;
  };
}
