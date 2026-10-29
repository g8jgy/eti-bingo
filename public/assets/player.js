import { api, syncClock, LOGO, esc, $, confetti } from './common.js';

const LS = 'etibingo:';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(LS + k)) ?? d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch { /* private mode */ } };

let cred = load('cred', null);   // { pid, token }
let S = null;                    // last public state
let me = null;                   // my card
let lastV = null;
let lastDraw = load('lastDraw', null);
let seenWins = load('wins', {});
let stampCell = null;
let pending = new Set();         // cells being marked right now
const LETTERS = ['B', 'I', 'N', 'G', 'O'];
const app = $('#app');

// --- pattern check (mirrors lib/engine.js) ---
const LINES = (() => {
  const L = [];
  for (let r = 0; r < 5; r++) L.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) L.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  L.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return L;
})();
function toGo(goal, marks) {
  const set = new Set(marks); set.add(12);
  const miss = (cells) => cells.reduce((n, i) => n + (set.has(i) ? 0 : 1), 0);
  if (goal === 'blackout') return 25 - set.size;
  if (goal === 'line') return Math.min(...LINES.map(miss));
  let best = 99;
  for (let i = 0; i < LINES.length; i++) for (let j = i + 1; j < LINES.length; j++) best = Math.min(best, miss([...new Set([...LINES[i], ...LINES[j]])]));
  return best;
}

function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), ms);
}
const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* unsupported */ } };

// ---------------------------------------------------------------- join
function renderJoin(errMsg = '') {
  app.innerHTML = `
    <form class="join" id="joinForm" autocomplete="off">
      <div class="mark">${LOGO}</div>
      <div class="eyebrow">ETI Q4 Townhall &middot; Nov 18</div>
      <h1>ETI <span>Bingo</span></h1>
      <p class="sub">Get your card, tap each square when it's called, and hit BINGO first to win.</p>
      <label for="nm">Your name</label>
      <input id="nm" name="name" maxlength="32" placeholder="First and last name" value="${esc(load('name', ''))}" required>
      <button class="btn" id="go" type="submit">Get my card</button>
      <div class="err" id="err">${esc(errMsg)}</div>
      <p class="fine">One card per person. Keep this page open on your phone.</p>
    </form>`;
  $('#bingo').classList.remove('show');
  $('#joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#go');
    btn.disabled = true;
    try {
      const name = $('#nm').value.trim();
      const r = await api('join', { name });
      syncClock(r.now, 1);
      cred = { pid: r.pid, token: r.token };
      keep('cred', cred); keep('name', name);
      me = r.player;
      lastDraw = S && S.current ? S.current.id : null; keep('lastDraw', lastDraw);
      renderMain();
    } catch (err) {
      $('#err').textContent = err.message;
      btn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------- main view
function renderMain() {
  if (!me || !S) return;
  app.innerHTML = `
    <header class="top">
      <div class="mark">${LOGO}</div>
      <div><h1>ETI <span>Bingo</span></h1><div class="who">${esc(me.name)}</div></div>
      <div class="chip" id="chip"></div>
    </header>
    <div class="sunrule"></div>
    <main class="wrap">
      <div class="called" id="called"></div>
      <div class="status" id="status"></div>
      <div class="card">
        <div class="letters">${LETTERS.map((l) => `<div>${l}</div>`).join('')}</div>
        <div class="grid" id="grid"></div>
      </div>
      <p class="hint" id="hint"></p>
    </main>`;
  $('#grid').addEventListener('click', onTile);
  renderAll();
}

const calledSet = () => new Set(S.called);

function renderCalled() {
  const el = $('#called');
  if (!el) return;
  const d = S.current;
  if (!d) { el.innerHTML = `<div><small>Waiting for the first draw</small><b>Keep this page open</b></div>`; return; }
  if (!d.label) { el.innerHTML = `<div><small>Draw ${d.n}</small><b>Drawing&hellip;</b></div>`; return; }
  const cell = me.cells.indexOf(d.sq);
  const status = cell < 0 ? `<span class="no">Not on<br>your card</span>`
    : me.marks.includes(cell) ? `<span class="yes">Marked</span>` : `<span class="yes">On your card!<br>Tap it</span>`;
  el.innerHTML = `<div><small>Just called &middot; Draw ${d.n}</small><b>${esc(d.label)}</b></div>${status}`;
}

function renderStatus() {
  if (!$('#status')) return;
  $('#chip').textContent = `R${S.round} · ${S.goalLabel}`;
  const st = S.st[me.id];
  const left = toGo(S.goal, me.marks);
  const won = me.won ? `<div class="stat hot"><b>Winner</b><small>Round ${me.won}</small></div>` : `<div class="stat ${left <= 1 ? 'hot' : ''}"><b>${left}</b><small>to go</small></div>`;
  $('#status').innerHTML = `${won}
    <div class="stat"><b>#${st ? st[0] : '-'}</b><small>of ${S.players}</small></div>
    <div class="stat"><b>${me.marks.length}<span style="font-size:15px;color:var(--muted)">/24</span></b><small>marked</small></div>`;
  $('#hint').textContent = S.left === 0 ? 'Every square has been called.' : `${S.drawCount} called · ${S.left} still in the bag`;

  const winner = S.wins[S.round];
  const ready = !me.won && !winner && left === 0;
  $('#bingo').classList.toggle('show', ready);
}

function renderCard() {
  const grid = $('#grid');
  if (!grid) return;
  const called = calledSet();
  const marks = new Set(me.marks);
  const sig = [...marks].sort().join(',') + '|' + S.called.join(',') + '|' + stampCell;
  if (sig === renderCard.sig && grid.childElementCount) return; // don't swap tiles under a finger
  renderCard.sig = sig;
  grid.innerHTML = me.cells.map((sq, i) => {
    if (sq === -1) return `<div class="tile free" aria-label="Free square"><div class="mark">${LOGO}</div></div>`;
    const cls = ['tile'];
    if (marks.has(i)) cls.push('marked');
    else if (called.has(sq)) cls.push('ready');
    if (stampCell === i) cls.push('stamp');
    return `<div class="${cls.join(' ')}" data-cell="${i}" role="button">${esc(S.tiles[sq])}</div>`;
  }).join('');
  stampCell = null;
}

function renderAll() { renderCalled(); renderStatus(); renderCard(); }

async function onTile(e) {
  const tile = e.target.closest('.tile');
  if (!tile || tile.classList.contains('free') || tile.classList.contains('marked')) return;
  const cell = parseInt(tile.dataset.cell, 10);
  if (tile.classList.contains('ready')) return markCell(cell);
  toast(`<b>${esc(S.labels[me.cells[cell]])}</b> hasn't been called yet.`, 2200);
}

async function markCell(cell) {
  if (pending.has(cell)) return;
  pending.add(cell);
  me.marks = [...me.marks, cell]; stampCell = cell; buzz(25);
  renderAll();
  try {
    const r = await api('mark', { ...cred, cell });
    me = r.player;
  } catch (err) {
    me.marks = me.marks.filter((c) => c !== cell);
    toast(esc(err.message));
    renderAll();
  } finally { pending.delete(cell); }
}

$('#bingo').addEventListener('click', async () => {
  const b = $('#bingo');
  b.disabled = true;
  try {
    const r = await api('claim', cred);
    me = r.player;
    showMyWin(r.won);
  } catch (err) { toast(esc(err.message), 4500); }
  finally { b.disabled = false; renderStatus(); }
});

// ---------------------------------------------------------------- wins
function showMyWin(round) {
  seenWins[`${round}:${me.id}`] = true; keep('wins', seenWins);
  const win = $('#win');
  win.innerHTML = `<div class="mark" style="width:72px;height:72px;background:#fff;border-radius:16px;padding:7px;margin-bottom:16px">${LOGO}</div>
    <h2>BINGO!</h2><p>You won <b>Round ${round}</b>. Head to the front to claim your prize.</p>
    <button class="btn" id="winOk">Back to my card</button>`;
  win.classList.add('show');
  confetti(document.body);
  buzz([80, 60, 80, 60, 200]);
  $('#winOk').addEventListener('click', () => win.classList.remove('show'));
}

function checkWins() {
  for (const [r, w] of Object.entries(S.wins || {})) {
    const k = `${r}:${w.id}`;
    if (seenWins[k]) continue;
    seenWins[k] = true; keep('wins', seenWins);
    if (me && w.id === me.id) showMyWin(r);
    else toast(`<b>BINGO!</b> ${esc(w.name)} won Round ${r}.`, 6000);
  }
}

function checkNewDraw() {
  const d = S.current;
  if (!d || !d.label || d.id === lastDraw) return;
  lastDraw = d.id; keep('lastDraw', lastDraw);
  const el = $('#called');
  if (el) { el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh'); }
  if (me.cells.includes(d.sq)) buzz([40, 50, 40]);
}

// ---------------------------------------------------------------- data loop
async function refreshMe() {
  if (!cred) return;
  try {
    const r = await api('me', cred);
    syncClock(r.now, 1);
    const local = new Set(me ? me.marks : []);
    me = r.player;
    for (const c of pending) if (local.has(c) && !me.marks.includes(c)) me.marks.push(c);
  } catch (err) {
    if (err.status === 401) { cred = null; keep('cred', null); me = null; renderJoin('Your card was reset. Please join again.'); }
  }
}

let polling = false;
async function poll() {
  if (polling) return;
  polling = true;
  try {
    const s = await api('state');
    syncClock(s.now, 5);
    const first = !S;
    S = s;
    if (!cred) { if (first || !$('#joinForm')) renderJoin(); return; }
    if (!me || s.v !== lastV) { lastV = s.v; await refreshMe(); if (!me) return; }
    if (!$('#grid')) renderMain();
    if (first) for (const [r, w] of Object.entries(S.wins || {})) if (w.id !== me.id) seenWins[`${r}:${w.id}`] = true;
    checkNewDraw(); renderAll(); checkWins();
  } catch {
    if (!S) app.innerHTML = `<div class="join"><h1>ETI <span>Bingo</span></h1><p class="sub">Can't reach the game right now. Retrying&hellip;</p></div>`;
  } finally { polling = false; }
}

setInterval(poll, 1500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
poll();
