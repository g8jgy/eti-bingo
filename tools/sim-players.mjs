// Load test: N simulated players play a full game against a running server.
// Start a fast local server first:  BINGO_FAST=1 BINGO_PREFIX=sim node dev-server.mjs 8796
// Then:                              node tools/sim-players.mjs http://localhost:8796 70 0.9
// ATTN = chance a player taps a called square on the draw it was called (otherwise they catch up later).
const BASE = process.argv[2] || 'http://localhost:8796';
const N = parseInt(process.argv[3] || '70', 10);
const ATTN = parseFloat(process.argv[4] || '0.9');
const KEY = process.env.HOST_KEY || 'eti-host';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { calls: 0, errors: [], maxMs: 0, stateBytes: 0 };
async function call(op, body, host) {
  const t0 = Date.now();
  stats.calls++;
  const r = await fetch(`${BASE}/api/game?op=${op}`, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(host ? { 'x-host-key': KEY } : {}) }, body: JSON.stringify(body),
  });
  const txt = await r.text();
  stats.maxMs = Math.max(stats.maxMs, Date.now() - t0);
  if (op === 'state') stats.stateBytes = Math.max(stats.stateBytes, txt.length);
  const j = JSON.parse(txt);
  if (!r.ok) { const e = new Error(`${op}: ${j.error}`); e.status = r.status; throw e; }
  return j;
}
const LINES = [];
for (let r = 0; r < 5; r++) LINES.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
for (let c = 0; c < 5; c++) LINES.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
const done = (goal, marks) => {
  const s = new Set(marks); s.add(12);
  const full = LINES.filter((l) => l.every((i) => s.has(i))).length;
  return goal === 'line' ? full >= 1 : goal === 'twoLines' ? full >= 2 : s.size === 25;
};

await call('host-reset', { confirm: 'RESET' }, true);
await call('host-settings', { tables: 10 }, true);

const first = ['Ana', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida', 'Jo', 'Kai', 'Lu', 'Max', 'Ned', 'Oz'];
const players = await Promise.all(Array.from({ length: N }, (_, i) =>
  call('join', { name: `${first[i % first.length]} Test${i + 1}`, table: (i % 10) + 1 }).then((r) => ({ pid: r.pid, token: r.token, table: (i % 10) + 1, cells: r.player.cells, marks: [], won: 0 }))));
console.log(`joined ${players.length} players, ${new Set(players.map((p) => p.cells.join(','))).size} unique cards`);

// rules that must hold
try { await call('mark', { pid: players[0].pid, token: players[0].token, cell: 0 }); stats.errors.push('marked an uncalled square'); } catch (e) { if (e.status !== 409) stats.errors.push('uncalled mark: ' + e.message); }
try { await call('claim', { pid: players[0].pid, token: players[0].token }); stats.errors.push('claimed with an empty card'); } catch (e) { if (e.status !== 409) stats.errors.push('empty claim: ' + e.message); }
try { await call('host-draw', {}); stats.errors.push('draw without host key'); } catch { /* expected */ }

const winsAt = {};
let round = 1;
const goals = { 1: 'line', 2: 'twoLines', 3: 'blackout' };
for (let n = 1; n <= 36; n++) {
  await call('host-draw', {}, true);
  let s = await call('state');
  while (!s.current.label) { await sleep(40); s = await call('state'); }
  const called = new Set(s.called);
  await Promise.all(players.map(async (p) => {
    // attentive players tap now; everyone else catches up on missed squares a draw or two later
    const todo = p.cells.map((sq, i) => [sq, i]).filter(([sq, i]) => sq !== -1 && called.has(sq) && !p.marks.includes(i))
      .filter(([sq]) => sq !== s.current.sq || Math.random() < ATTN);
    for (const [, i] of todo) {
      try { await call('mark', { pid: p.pid, token: p.token, cell: i }); p.marks.push(i); } catch (e) { stats.errors.push(e.message); }
    }
    if (n === 5 && (p.table === 3 || p.table === 7)) { /* free square handled below */ }
  }));

  if (n === 5) { // Jeopardy winners: tables 3 and 7 get a free square
    const { freebie } = await call('host-free', { tables: [3, 7], label: 'Jeopardy' }, true);
    const lucky = players.filter((p) => p.table === 3 || p.table === 7);
    for (const p of lucky) {
      const open = p.cells.findIndex((sq, i) => sq !== -1 && !p.marks.includes(i) && !called.has(sq));
      await call('free', { pid: p.pid, token: p.token, freeId: freebie.id, cell: open });
      p.marks.push(open);
    }
    try { await call('free', { pid: players[0].pid, token: players[0].token, freeId: freebie.id, cell: 0 }); stats.errors.push('table 1 used a table 3/7 freebie'); } catch { /* expected */ }
    console.log(`free square used by ${lucky.length} players at tables 3 and 7`);
  }

  // everyone who can press BINGO does, at the same moment
  const ready = players.filter((p) => !p.won && done(goals[round], p.marks));
  if (ready.length) {
    const results = await Promise.allSettled(ready.map((p) => call('claim', { pid: p.pid, token: p.token })));
    const winners = results.filter((r) => r.status === 'fulfilled');
    if (winners.length !== 1) stats.errors.push(`round ${round}: ${winners.length} winners from ${ready.length} simultaneous claims`);
    results.forEach((r, i) => { if (r.status === 'fulfilled') ready[i].won = round; });
    s = await call('state');
    const w = s.wins[round];
    winsAt[round] = n;
    console.log(`ROUND ${round} (${goals[round]}) won on draw ${n} by ${w.name} (table ${w.table}); ${ready.length} pressed BINGO at once`);
    if (round < 3) { round++; await call('host-round', { round }, true); }
    else break;
  }
}
// a past winner cannot win again
const pastWinner = players.find((p) => p.won);
try { await call('claim', { pid: pastWinner.pid, token: pastWinner.token }); stats.errors.push('past winner claimed again'); } catch { /* expected */ }

const s = await call('state');
console.log(`draws: ${s.drawCount}, wins at draws: ${JSON.stringify(winsAt)}, players: ${s.players}`);
console.log(`calls: ${stats.calls}, slowest: ${stats.maxMs} ms, largest state payload: ${(stats.stateBytes / 1024).toFixed(1)} KB`);
console.log(stats.errors.length ? `ERRORS (${stats.errors.length}):\n  ` + [...new Set(stats.errors)].slice(0, 15).join('\n  ') : 'no errors');
