import { api, syncClock, now, LOGO, esc, $, confetti } from './common.js';

const LS = 'etibingo:';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(LS + k)) ?? d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch { /* private mode */ } };

let cred = load('cred', null);       // { pid, token }
let S = null;                        // last public state
let me = null;                       // my player record
let lastV = null, lastReveal = null;
let localAns = load('ans', {});      // drawId -> choice (survives reloads)
let dismissed = {};                  // drawId -> true
let sawQuestion = {};                // drawId -> true (only show results for questions I saw)
let seenWins = load('wins', {});
let stampCell = null;
let pick = null;                     // selected cell for a free square
let sheetKey = '';
const LETTERS = ['B', 'I', 'N', 'G', 'O'];
const K = ['A', 'B', 'C', 'D'];

const app = $('#app'), sheet = $('#sheet'), scrim = $('#scrim');

function toast(msg, ms = 4200) {
  const t = $('#toast');
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------------------------------------------------------------- join
function renderJoin(errMsg = '') {
  const tables = (S && S.tables) || 10;
  const preset = parseInt(new URLSearchParams(location.search).get('t'), 10);
  const lastName = load('name', '');
  app.innerHTML = `
    <form class="join" id="joinForm" autocomplete="off">
      <div class="mark">${LOGO}</div>
      <div class="eyebrow">ETI Q4 Townhall &middot; Nov 18</div>
      <h1>ETI <span>Bingo</span></h1>
      <p class="sub">Your own card, live all day. Answer each challenge to mark your square.</p>
      <label for="nm">Your name</label>
      <input id="nm" name="name" maxlength="32" placeholder="First and last name" value="${esc(lastName)}" required>
      <label for="tb">Your table</label>
      <select id="tb" name="table" required>
        <option value="">Pick your table</option>
        ${Array.from({ length: tables }, (_, i) => `<option value="${i + 1}" ${preset === i + 1 ? 'selected' : ''}>Table ${i + 1}</option>`).join('')}
      </select>
      <button class="btn" id="go" type="submit">Get my card</button>
      <div class="err" id="err">${esc(errMsg)}</div>
      <p class="fine">One card per person. Keep this page open on your phone.</p>
    </form>`;
  $('#joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#go');
    btn.disabled = true;
    try {
      const name = $('#nm').value.trim();
      const r = await api('join', { name, table: $('#tb').value });
      syncClock(r.now, 1);
      cred = { pid: r.pid, token: r.token };
      keep('cred', cred); keep('name', name);
      me = r.player;
      renderMain();
      poll();
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
      <div><h1>ETI <span>Bingo</span></h1><div class="who">${esc(me.name)} &middot; Table ${me.table}</div></div>
      <div class="chip" id="chip"></div>
    </header>
    <div class="sunrule"></div>
    <main class="wrap">
      <div class="status" id="status"></div>
      <div class="card">
        <div class="letters">${LETTERS.map((l) => `<div>${l}</div>`).join('')}</div>
        <div class="grid" id="grid"></div>
      </div>
      <div id="banner"></div>
      <p class="hint" id="hint"></p>
    </main>`;
  $('#grid').addEventListener('click', onTile);
  renderStatus(); renderCard();
}

function activeFreebie() {
  if (!S || !me) return null;
  return S.freebies.find((f) => f.tables.includes(me.table) && (me.free || {})[f.id] == null) || null;
}

function renderStatus() {
  if (!$('#status')) return;
  $('#chip').textContent = `R${S.round} · ${S.goalLabel}`;
  const st = S.st[me.id];
  const toGo = st ? st[1] : '-';
  const rank = st ? st[0] : '-';
  const marks = me.marks.length;
  const won = me.won ? `<div class="stat hot"><b>Winner</b><small>Round ${me.won}</small></div>` : `<div class="stat ${toGo === 1 ? 'hot' : ''}"><b>${toGo}</b><small>to go</small></div>`;
  $('#status').innerHTML = `${won}
    <div class="stat"><b>#${rank}</b><small>of ${S.players}</small></div>
    <div class="stat"><b>${marks}<span style="font-size:16px;color:var(--muted)">/24</span></b><small>marked</small></div>`;
  const f = activeFreebie();
  $('#banner').innerHTML = f
    ? `<div class="banner"><b>Your table won a free square!</b> Tap any open square, then tap it again to mark it.</div>`
    : '';
  const d = S.current;
  $('#hint').textContent = !d ? 'Waiting for the first draw. Keep this page open.'
    : S.left === 0 ? 'Every square has been drawn. Watch for second-chance draws.'
    : `${S.drawCount} drawn so far · ${S.left} squares left in the bag`;
}

function renderCard() {
  const grid = $('#grid');
  if (!grid) return;
  const d = S.current;
  const t = now();
  const open = d && t < d.closes ? d : null;
  const called = new Set(S.called);
  const marks = new Set(me.marks);
  const f = activeFreebie();
  grid.innerHTML = me.cells.map((sq, i) => {
    if (sq === -1) return `<div class="tile free" aria-label="Free square"><div class="mark">${LOGO}</div></div>`;
    const cls = ['tile'];
    if (marks.has(i)) cls.push('marked');
    else if (open && open.sq === sq) cls.push('live');
    else if (called.has(sq)) cls.push('missed');
    if (f && !marks.has(i)) { cls.push('pick'); if (pick === i) cls.push('sel'); }
    if (stampCell === i) cls.push('stamp');
    return `<div class="${cls.join(' ')}" data-cell="${i}">${esc(S.tiles[sq])}</div>`;
  }).join('');
  stampCell = null;
}

async function onTile(e) {
  const tile = e.target.closest('.tile.pick');
  if (!tile) return;
  const f = activeFreebie();
  const cell = parseInt(tile.dataset.cell, 10);
  if (!f) return;
  if (pick !== cell) { pick = cell; renderCard(); return; }
  try {
    const r = await api('free', { ...cred, freeId: f.id, cell });
    me = r.player; pick = null; stampCell = cell;
    toast(`<b>${esc(S.labels[me.cells[cell]])}</b> is marked. Nice work, Table ${me.table}!`);
    renderStatus(); renderCard();
  } catch (err) { toast(esc(err.message)); }
}

// ---------------------------------------------------------------- challenge sheet
function myChoice(d) {
  if (localAns[d.id] != null) return localAns[d.id];
  const a = me && me.answers && me.answers[d.id];
  return a ? a.c : null;
}

function sheetState() {
  const d = S && S.current;
  if (!d || !me || dismissed[d.id]) return null;
  const t = now();
  if (t < d.at) return { kind: 'drawing', d };
  if (t < d.closes) { sawQuestion[d.id] = true; return { kind: 'question', d, choice: myChoice(d) }; }
  if (!sawQuestion[d.id] && myChoice(d) == null) return null; // joined after it closed
  if (S.reveal && S.reveal.id === d.id) return { kind: 'result', d, choice: myChoice(d), reveal: S.reveal };
  return { kind: 'waiting', d, choice: myChoice(d) };
}

function renderSheet() {
  const s = sheetState();
  const key = s ? `${s.kind}:${s.d.id}:${s.choice}:${s.d.options ? 1 : 0}` : '';
  if (key !== sheetKey) {
    sheetKey = key;
    if (!s) { sheet.classList.remove('show'); scrim.classList.remove('show'); return; }
    sheet.innerHTML = sheetHtml(s);
    sheet.classList.add('show'); scrim.classList.add('show');
    sheet.querySelectorAll('.opt[data-i]').forEach((b) => b.addEventListener('click', () => choose(s.d, parseInt(b.dataset.i, 10))));
    const c = sheet.querySelector('.close');
    if (c) c.addEventListener('click', () => { dismissed[s.d.id] = true; renderSheet(); });
    if (s.kind === 'result') onResult(s);
  }
  if (s && (s.kind === 'question')) tickTimer(s.d);
  if (s && s.kind === 'drawing') spinReel();
}

const head = (d) => `<div class="grab"></div><div class="sq"><span class="lbl">${esc(d.label)}</span><span class="tag">Draw ${d.n}</span>${d.second ? '<span class="tag second">Second chance</span>' : ''}</div>`;

function sheetHtml(s) {
  const d = s.d;
  if (s.kind === 'drawing') {
    return `<div class="grab"></div><div class="drawing"><div class="reel" id="reel">ETI Bingo</div><p>Drawing a square&hellip;</p></div>`;
  }
  const opts = (d.options || []).map((o, i) => {
    let cls = 'opt';
    if (s.kind === 'result') {
      if (i === s.reveal.answer) cls += ' right';
      else if (i === s.choice) cls += ' wrong';
      else cls += ' dim';
    } else if (s.choice != null) cls += i === s.choice ? ' chosen' : ' dim';
    const clickable = s.kind === 'question' && s.choice == null;
    return `<button class="${cls}" ${clickable ? `data-i="${i}"` : 'disabled'}><span class="k">${K[i]}</span><span>${esc(o)}</span></button>`;
  }).join('');
  if (s.kind === 'question') {
    return `${head(d)}
      <div class="timer" id="timer"><i></i></div><div class="secs" id="secs"></div>
      <div class="q">${esc(d.q)}</div>
      <div class="opts">${opts}</div>
      ${s.choice != null ? `<div class="lock">Locked in: ${K[s.choice]}. Answer revealed when time is up.</div>` : ''}`;
  }
  if (s.kind === 'waiting') {
    return `${head(d)}<div class="result"><h2>Time's up!</h2><p>Revealing the answer&hellip;</p></div><div class="opts">${opts}</div>`;
  }
  const ok = s.choice === s.reveal.answer;
  const res = s.choice == null
    ? `<div class="result bad"><h2>No answer</h2><p>Missed squares can come back in a second-chance draw.</p></div>`
    : ok
      ? `<div class="result good"><h2>Correct!</h2><p><b>${esc(d.label)}</b> is marked on your card.</p></div>`
      : `<div class="result bad"><h2>Not this time</h2><p>Watch for a second-chance draw on <b>${esc(d.label)}</b>.</p></div>`;
  return `${head(d)}${res}<div class="opts">${opts}</div>
    <div class="fact">${esc(s.reveal.fact)}</div>
    <div style="text-align:center;color:var(--muted);font-size:13px;margin-top:10px">${s.reveal.correct} of ${s.reveal.answered} got it right</div>
    <button class="close">Back to my card</button>`;
}

async function choose(d, i) {
  if (localAns[d.id] != null) return;
  localAns[d.id] = i; keep('ans', localAns);
  renderSheet();
  try {
    await api('answer', { ...cred, drawId: d.id, choice: i });
    if (navigator.vibrate) navigator.vibrate(30);
  } catch (err) {
    if (!/already/.test(err.message)) { delete localAns[d.id]; keep('ans', localAns); }
    toast(esc(err.message));
    sheetKey = ''; renderSheet();
  }
}

function tickTimer(d) {
  const el = $('#timer i'), secs = $('#secs');
  if (!el) return;
  const total = d.closes - d.at, left = Math.max(0, d.closes - now());
  el.style.transform = `scaleX(${left / total})`;
  $('#timer').classList.toggle('low', left < 10000);
  secs.textContent = `${Math.ceil(left / 1000)}s`;
}

let reelIdx = 0;
function spinReel() {
  const r = $('#reel');
  if (!r || !S) return;
  reelIdx = (reelIdx + 1) % S.labels.length;
  r.textContent = S.labels[reelIdx];
}

async function onResult(s) {
  if (lastReveal === s.d.id) return;
  lastReveal = s.d.id;
  await refreshMe();
  if (s.choice === s.reveal.answer) {
    stampCell = me.cells.indexOf(s.d.sq);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  }
  renderStatus(); renderCard();
  setTimeout(() => { if (sheetKey.startsWith('result:' + s.d.id)) { dismissed[s.d.id] = true; renderSheet(); } }, 12000);
}

// ---------------------------------------------------------------- wins
function checkWins() {
  for (const [r, w] of Object.entries(S.wins || {})) {
    const k = `${r}:${w.id}`;
    if (seenWins[k]) continue;
    seenWins[k] = true; keep('wins', seenWins);
    if (me && w.id === me.id) {
      const win = $('#win');
      win.innerHTML = `<div class="mark" style="width:72px;height:72px;background:#fff;border-radius:16px;padding:7px;margin-bottom:16px">${LOGO}</div>
        <h2>BINGO!</h2><p>You won <b>Round ${r}</b>. Head to the front to claim your prize.</p>
        <button class="btn" id="winOk">Back to my card</button>`;
      win.classList.add('show');
      confetti(document.body);
      if (navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 200]);
      $('#winOk').addEventListener('click', () => win.classList.remove('show'));
      refreshMe().then(() => { renderStatus(); });
    } else {
      toast(`<b>BINGO!</b> ${esc(w.name)} (Table ${w.table}) won Round ${r}.`, 6000);
    }
  }
}

// ---------------------------------------------------------------- data loop
async function refreshMe() {
  if (!cred) return;
  try {
    const r = await api('me', cred);
    syncClock(r.now, 1);
    me = r.player;
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
    if (first) { for (const [r, w] of Object.entries(S.wins || {})) if (w.id !== me.id) seenWins[`${r}:${w.id}`] = true; }
    renderStatus(); renderCard(); renderSheet(); checkWins();
  } catch (err) {
    if (!S) app.innerHTML = `<div class="join"><h1>ETI <span>Bingo</span></h1><p class="sub">Can't reach the game right now. Retrying&hellip;</p></div>`;
  } finally { polling = false; }
}

function frame() {
  if (S && me) {
    const before = sheetKey;
    renderSheet();
    // a draw just opened or closed: refresh tile highlight
    if (sheetKey !== before) renderCard();
  }
}

setInterval(poll, 1500);
setInterval(frame, 120);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
poll();
