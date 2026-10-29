// Load test: N simulated players play a full game against a running server.
// Start a fast local server first:  BINGO_FAST=1 BINGO_PREFIX=sim node dev-server.mjs 8796
// Then:                              node tools/sim-players.mjs http://localhost:8796 70 0.75
const BASE = process.argv[2] || 'http://localhost:8796';
const N = parseInt(process.argv[3] || '70', 10);
const ACC = parseFloat(process.argv[4] || '0.75');
const KEY = process.env.HOST_KEY || 'eti-host';
const SECS = 2;

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

const { squares } = await call('host-content', {}, true);
await call('host-reset', { confirm: 'RESET' }, true);
await call('host-settings', { seconds: SECS, tables: 10 }, true);

const first = ['Ana', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida', 'Jo', 'Kai', 'Lu', 'Max', 'Ned', 'Oz'];
const players = await Promise.all(Array.from({ length: N }, (_, i) =>
  call('join', { name: `${first[i % first.length]} Test${i + 1}`, table: (i % 10) + 1 }).then((r) => ({ ...r, table: (i % 10) + 1 }))));
const cards = new Set(players.map((p) => p.player.cells.join(',')));
console.log(`joined ${players.length} players, ${cards.size} unique cards`);

// a couple of bad inputs must be rejected cleanly
for (const [op, body, want] of [['join', { name: 'x', table: 1 }, 400], ['join', { name: 'Real Name', table: 99 }, 400], ['answer', { pid: 'nope', token: 'x' }, 401], ['host-draw', {}, 401]]) {
  try { await fetch(`${BASE}/api/game?op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-host-key': 'wrong' }, body: JSON.stringify(body) }).then(async (r) => { if (r.status !== want) stats.errors.push(`${op} expected ${want} got ${r.status}`); }); } catch (e) { stats.errors.push(e.message); }
}

const winsAt = {};
let round = 1, freeGiven = false;
for (let n = 1; n <= 60; n++) {
  const second = n > squares.length;
  let draw;
  try { draw = (await call('host-draw', { second }, true)).draw; } catch (e) { console.log('draw stopped:', e.message); break; }
  let s = await call('state');
  while (Date.now() + (s.now - Date.now()) < s.current.at || !s.current.q) { await sleep(60); s = await call('state'); }
  const sq = squares[s.current.sq];
  const q = sq.qs.find((x) => x.q === s.current.q);
  const right = s.current.options.indexOf(q.options[q.a]);
  await Promise.all(players.map(async (p) => {
    await sleep(Math.random() * SECS * 700);
    const choice = Math.random() < ACC ? right : (right + 1 + Math.floor(Math.random() * 3)) % 4;
    try { await call('answer', { pid: p.pid, token: p.token, drawId: draw.id, choice }); } catch (e) { stats.errors.push(e.message); }
  }));
  // double answer must be refused
  try { await call('answer', { pid: players[0].pid, token: players[0].token, drawId: draw.id, choice: 0 }); stats.errors.push('double answer accepted'); } catch { /* expected */ }
  await sleep(Math.max(0, s.current.closes - s.now) + 150);
  s = await call('state');
  if (!s.reveal || s.reveal.id !== draw.id) stats.errors.push(`no reveal for draw ${n}`);
  if (n === 1 && s.reveal) console.log(`draw 1 reveal: ${s.reveal.correct}/${s.reveal.answered} correct`);

  if (n === 4 && !freeGiven) { // Jeopardy winners: tables 3 and 7 get a free square
    freeGiven = true;
    const { freebie } = await call('host-free', { tables: [3, 7], label: 'Jeopardy' }, true);
    const lucky = players.filter((p) => p.table === 3 || p.table === 7);
    for (const p of lucky) {
      const me = (await call('me', { pid: p.pid, token: p.token })).player;
      const open = me.cells.findIndex((c, i) => c !== -1 && !me.marks.includes(i));
      await call('free', { pid: p.pid, token: p.token, freeId: freebie.id, cell: open });
    }
    try { await call('free', { pid: players[0].pid, token: players[0].token, freeId: freebie.id, cell: 0 }); stats.errors.push('table 1 used a table 3/7 freebie'); } catch { /* expected */ }
    console.log(`free square claimed by ${lucky.length} players at tables 3 and 7`);
  }

  for (const [r, w] of Object.entries(s.wins)) {
    if (winsAt[r]) continue;
    winsAt[r] = n;
    console.log(`ROUND ${r} won on draw ${n}${second ? ' (second chance)' : ''} by ${w.name} (table ${w.table}); leader board top: ${s.top.slice(0, 3).map((t) => `${t.name} ${t.toGo} to go`).join(', ')}`);
  }
  if (winsAt[round] && round < 3) { round++; const r = await call('host-round', { round }, true); console.log(`-> round ${round}${r.autoWinner ? ` auto-won by ${r.autoWinner.name}` : ''}`); }
  if (winsAt[3]) break;
}
if (!winsAt[3]) {
  const c = await call('host-crown', {}, true);
  console.log(`crowned round 3 leader: ${c.winner.name}`);
}
const s = await call('state');
const winners = Object.values(s.wins).map((w) => w.id);
if (new Set(winners).size !== winners.length) stats.errors.push('same player won twice');
console.log(`draws: ${s.drawCount}, wins: ${JSON.stringify(winsAt)}, players: ${s.players}`);
console.log(`calls: ${stats.calls}, slowest: ${stats.maxMs} ms, largest state payload: ${(stats.stateBytes / 1024).toFixed(1)} KB`);
console.log(stats.errors.length ? `ERRORS (${stats.errors.length}):\n  ` + [...new Set(stats.errors)].slice(0, 15).join('\n  ') : 'no errors');
