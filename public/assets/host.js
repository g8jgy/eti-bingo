import { api, syncClock, now, LOGO, esc, $, qrSvg, confetti } from './common.js';

const params = new URLSearchParams(location.search);
const stageOnly = params.get('stage') === '1';
let hostKey = localStorage.getItem('etibingo:hostkey') || '';
let S = null, view = 'auto', stageKey = '', muted = localStorage.getItem('etibingo:mute') === '1';
let seenWins = null, winnerUp = false, auto = false, autoSecs = 15, autoBusy = false;
const playUrl = location.origin + '/';

$('#logo').innerHTML = LOGO;

// ---------------------------------------------------------------- sound (Web Audio, no files)
let ac = null;
function tone(freq, dur = 0.12, type = 'sine', gain = 0.12, when = 0) {
  if (muted) return;
  try {
    ac = ac || new AudioContext();
    const t = ac.currentTime + when;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* audio blocked */ }
}
const sfx = {
  tick: () => tone(1400, 0.03, 'square', 0.04),
  land: () => { tone(523, 0.18, 'triangle', 0.18); tone(784, 0.3, 'triangle', 0.18, 0.12); },
  bingo: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, i * 0.13)),
};

// ---------------------------------------------------------------- helpers
function flash(text, ms = 3200) {
  const m = $('#msg');
  m.textContent = text; m.classList.add('show');
  clearTimeout(flash.h); flash.h = setTimeout(() => m.classList.remove('show'), ms);
}
async function host(op, body = {}) {
  try {
    const r = await api(op, body, hostKey);
    poll();
    return r;
  } catch (e) {
    if (e.status === 401) { askKey(e.message); }
    else flash(e.message);
    throw e;
  }
}
function modal(html, wire) {
  $('#panel').innerHTML = html;
  $('#modal').classList.add('show');
  wire && wire($('#panel'));
}
function closeModal() { $('#modal').classList.remove('show'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

function askKey(err = '') {
  modal(`<h2>Host sign-in</h2><p>Enter the host key to run the game from this screen.</p>
    <input id="hk" type="password" placeholder="Host key" value="">
    <p style="color:var(--bad);margin-top:8px">${esc(err)}</p>
    <div class="row"><button class="primary" id="hkGo">Continue</button></div>`, (p) => {
    const go = async () => {
      hostKey = $('#hk', p).value.trim();
      try { await api('host-check', {}, hostKey); localStorage.setItem('etibingo:hostkey', hostKey); closeModal(); renderDock(); }
      catch (e) { askKey(e.message); }
    };
    $('#hkGo', p).addEventListener('click', go);
    $('#hk', p).addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    $('#hk', p).focus();
  });
}

// ---------------------------------------------------------------- stage
function phase() {
  const d = S && S.current;
  if (view === 'lobby' || !d) return 'lobby';
  if (view === 'board') return 'board';
  if (now() < d.at || !d.label) return 'spin';
  return 'called';
}

function recentCalls(n) {
  return S.called.slice(-n - 1, -1).reverse().map((sq) => S.labels[sq]);
}

function renderStage() {
  const p = phase();
  const d = S.current;
  const key = [p, d ? d.id : '', p === 'lobby' ? S.players : '', p === 'board' ? JSON.stringify(S.top) : '', p === 'called' ? d.onCards + '/' + S.players : ''].join('|');
  if (key === stageKey) return tickStage(p);
  const prev = stageKey.split('|');
  stageKey = key;
  const st = $('#stage');
  if (p === 'lobby') {
    st.innerHTML = `<div class="lobby">
      <div class="qr">${window.qrcode ? qrSvg(playUrl) : ''}</div>
      <div><div class="eyebrow">Scan to get your card</div>
        <h2>Your card.<br><span>Your squares.</span></h2>
        <div class="url">${esc(playUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</div>
        <div class="count">${S.players} <small>PLAYERS IN</small></div>
        <div class="names" id="names"></div></div></div>`;
    loadNames();
  } else if (p === 'board') {
    st.innerHTML = `<div class="board"><div class="eyebrow">Round ${S.round} &middot; ${esc(S.goalLabel)}</div><h2>Leaderboard</h2>
      <ol>${S.top.map((r, i) => `<li><span class="r">${i + 1}</span><span class="n">${esc(r.name)}<small>Table ${r.table}</small></span>
        <span class="togo">${r.won ? 'Won R' + r.won : r.toGo === 0 ? 'BINGO' : r.toGo + ' to go'}</span></li>`).join('')}</ol></div>`;
  } else if (p === 'spin') {
    st.innerHTML = `<div class="spin"><div class="eyebrow">Draw ${d.n}</div><div class="reel" id="reel">&nbsp;</div></div>`;
  } else {
    const fresh = prev[0] === 'spin' && prev[1] === d.id;
    if (fresh) sfx.land();
    const recent = recentCalls(5);
    st.innerHTML = `<div class="callview">
      <div class="eyebrow">Draw ${d.n} &middot; Just called</div>
      <div class="bigcall ${fresh ? 'land' : ''}">${esc(d.label)}</div>
      <div class="caption">${esc(d.caption || '')}</div>
      <div class="oncards"><b>${d.onCards}</b> of ${S.players} cards have it. Tap it to mark it!</div>
      ${recent.length ? `<div class="recent"><span>Earlier</span>${recent.map((l) => `<i>${esc(l)}</i>`).join('')}</div>` : ''}
    </div>`;
  }
  tickStage(p);
}

let reelI = 0, reelSlow = 0;
function tickStage(p) {
  const d = S.current;
  if (p !== 'spin') return;
  const left = d.at - now();
  const r = $('#reel');
  reelSlow++;
  const every = left > 2000 ? 1 : left > 1000 ? 2 : 4;
  if (r && reelSlow % every === 0) {
    reelI = (reelI + 1) % S.labels.length;
    r.textContent = S.labels[reelI];
    sfx.tick();
  }
}

async function loadNames() {
  if (!hostKey) return;
  try {
    const r = await api('host-players', {}, hostKey);
    const el = $('#names');
    if (el) el.innerHTML = r.players.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => `<span>${esc(p.name)}</span>`).join('');
  } catch { /* ignore */ }
}

function renderChrome() {
  $('#pills').innerHTML = `
    <span class="pill amber">Round ${S.round} &middot; ${esc(S.goalLabel)}</span>
    <span class="pill">${S.players} players</span>
    <span class="pill">${S.drawCount} drawn</span>`;
  const now_ = S.current ? S.current.sq : null;
  const called = new Set(S.called);
  $('#called').innerHTML = S.tiles.map((l, i) => `<div class="${i === now_ ? 'now' : called.has(i) ? 'on' : ''}">${esc(l)}</div>`).join('');
  $('#calledN').textContent = `${S.called.length}/${S.labels.length}`;
  $('#goalS').textContent = S.goalLabel;
  $('#lb').innerHTML = S.top.slice(0, 6).map((r, i) => `<li><span class="r">${i + 1}</span><span class="n">${esc(r.name)}<small>T${r.table}</small></span><span class="g ${r.toGo === 1 && !r.won ? 'one' : ''}">${r.won ? 'Won R' + r.won : r.toGo === 0 ? 'BINGO' : r.toGo + ' to go'}</span></li>`).join('')
    || '<li style="grid-template-columns:1fr;color:#9fb2d4">Waiting for players</li>';
}

function checkWins() {
  const wins = S.wins || {};
  if (seenWins === null) { seenWins = new Set(Object.entries(wins).map(([r, w]) => `${r}:${w.id}`)); return; }
  for (const [r, w] of Object.entries(wins)) {
    const k = `${r}:${w.id}`;
    if (seenWins.has(k)) continue;
    seenWins.add(k);
    showWinner(r, w);
  }
}
function showWinner(r, w) {
  const el = $('#winner');
  el.innerHTML = `<div class="eyebrow">Round ${r} &middot; ${esc(({ 1: 'Any line', 2: 'Two lines', 3: 'Full card' })[r])}</div>
    <div class="big">BINGO!</div><div class="who">${esc(w.name)}</div><div class="meta">Table ${w.table}</div>
    <div class="hintx">Click or press Enter to continue</div>`;
  el.classList.add('show'); winnerUp = true;
  if (auto) { auto = false; flash('Auto-draw paused for the winner'); }
  confetti(document.body, 180);
  sfx.bingo();
}
$('#winner').addEventListener('click', () => { $('#winner').classList.remove('show'); winnerUp = false; });

// ---------------------------------------------------------------- dock
function renderDock() {
  const dock = $('#dock');
  if (stageOnly) { dock.classList.add('hide'); return; }
  document.body.classList.toggle('docked', !dock.classList.contains('hide'));
  const spinning = S && S.current && now() < S.current.at;
  dock.innerHTML = `
    <button class="primary" data-a="draw" ${spinning ? 'disabled' : ''}>Draw<kbd>D</kbd></button>
    <button data-a="autoToggle" class="${auto ? 'on' : ''}">Auto-draw ${auto ? 'on' : 'off'}<kbd>A</kbd></button>
    <select id="autoSel" title="Auto-draw pace">${[10, 15, 20, 30].map((s) => `<option value="${s}" ${autoSecs === s ? 'selected' : ''}>every ${s}s</option>`).join('')}</select>
    <button data-a="undo">Undo draw</button>
    <span class="sep"></span>
    <button data-a="auto" class="${view === 'auto' ? 'on' : ''}">Game<kbd>G</kbd></button>
    <button data-a="board" class="${view === 'board' ? 'on' : ''}">Leaderboard<kbd>L</kbd></button>
    <button data-a="lobby" class="${view === 'lobby' ? 'on' : ''}">Join QR<kbd>Q</kbd></button>
    <span class="sep"></span>
    ${[1, 2, 3].map((r) => `<button data-a="round" data-r="${r}" class="${S && S.round === r ? 'on' : ''}">R${r}</button>`).join('')}
    <button data-a="crown">Crown leader</button>
    <button data-a="free">Free square</button>
    <span class="sep"></span>
    <button data-a="more">More</button>
    <button data-a="mute">${muted ? 'Sound off' : 'Sound on'}</button>
    <button data-a="hide" title="Hide dock (H)">Hide<kbd>H</kbd></button>`;
  $('#autoSel').addEventListener('change', (e) => { autoSecs = parseInt(e.target.value, 10); flash(`Auto-draw every ${autoSecs} seconds`); });
}
let dockSig = '';
function maybeDock() {
  const spinning = S && S.current && now() < S.current.at;
  const sig = `${spinning}:${view}:${S && S.round}:${auto}:${autoSecs}:${muted}`;
  if (sig !== dockSig) { dockSig = sig; renderDock(); }
}

const actions = {
  draw: () => host('host-draw', {}).then(() => { view = 'auto'; }),
  autoToggle: () => { auto = !auto; flash(auto ? `Auto-draw on, every ${autoSecs} seconds` : 'Auto-draw off'); },
  undo: () => modal(`<h2>Undo the last draw?</h2><p>Puts <b>${esc((S.current && S.current.label) || 'it')}</b> back in the bag. Anyone who already marked it keeps the mark.</p>
    <div class="row"><button class="primary" id="ok">Undo draw</button><button id="no">Cancel</button></div>`, (p) => {
    $('#no', p).onclick = closeModal;
    $('#ok', p).onclick = async () => { closeModal(); const r = await host('host-undo'); flash(`${r.undone} is back in the bag`); };
  }),
  auto: () => { view = 'auto'; },
  board: () => { view = view === 'board' ? 'auto' : 'board'; },
  lobby: () => { view = view === 'lobby' ? 'auto' : 'lobby'; },
  round: (b) => {
    const r = parseInt(b.dataset.r, 10);
    if (S.round === r) return;
    modal(`<h2>Start Round ${r}?</h2><p>The goal becomes <b>${({ 1: 'Any line', 2: 'Two lines', 3: 'Full card' })[r]}</b>. Anyone who already has it can press BINGO right away. Previous winners cannot win again.</p>
      <div class="row"><button class="primary" id="ok">Start Round ${r}</button><button id="no">Cancel</button></div>`, (p) => {
      $('#no', p).onclick = closeModal;
      $('#ok', p).onclick = async () => { closeModal(); const res = await host('host-round', { round: r }); if (res.autoWinner) flash(`${res.autoWinner.name} already had it!`); };
    });
  },
  crown: () => modal(`<h2>Crown the leader?</h2><p>Awards Round ${S.round} to the top eligible player on the leaderboard right now (use it if nobody claims before time runs out). Leader: <b>${esc((S.top.find((r) => !r.won) || {}).name || 'nobody yet')}</b>.</p>
    <div class="row"><button class="primary" id="ok">Crown them</button><button id="no">Cancel</button></div>`, (p) => {
    $('#no', p).onclick = closeModal;
    $('#ok', p).onclick = async () => { closeModal(); await host('host-crown'); };
  }),
  free: () => {
    const sel = new Set();
    modal(`<h2>Award a free square</h2><p>Everyone at the selected tables can mark any open square on their card.</p>
      <input id="fl" placeholder="What for? (e.g. Jeopardy winners)" maxlength="40">
      <div class="tablegrid" style="margin-top:10px">${Array.from({ length: S.tables }, (_, i) => `<button data-t="${i + 1}">Table ${i + 1}</button>`).join('')}</div>
      <div class="row"><button class="primary" id="ok">Award</button><button id="no">Cancel</button></div>`, (p) => {
      p.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { const t = +b.dataset.t; sel.has(t) ? sel.delete(t) : sel.add(t); b.classList.toggle('sel'); }));
      $('#no', p).onclick = closeModal;
      $('#ok', p).onclick = async () => { closeModal(); await host('host-free', { tables: [...sel], label: $('#fl', p).value }); flash(`Free square sent to table${sel.size > 1 ? 's' : ''} ${[...sel].join(', ')}`); };
    });
  },
  more: () => openMore(),
  mute: () => { muted = !muted; localStorage.setItem('etibingo:mute', muted ? '1' : '0'); },
  hide: () => { $('#dock').classList.toggle('hide'); document.body.classList.toggle('docked', !$('#dock').classList.contains('hide')); },
};
$('#dock').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-a]');
  if (!b || b.disabled) return;
  if (ac && ac.state === 'suspended') ac.resume();
  Promise.resolve(actions[b.dataset.a](b)).catch(() => {}).finally(() => { dockSig = ''; stageKey = ''; });
});

async function openMore() {
  let players = [];
  try { players = (await api('host-players', {}, hostKey)).players; } catch (e) { flash(e.message); }
  modal(`<h2>Game settings</h2>
    <div class="row"><a href="/review" target="_blank">Review all questions</a> &middot; <a href="/tents?tables=${S.tables}" target="_blank">Print table QR tents</a> &middot; <a href="/host?stage=1" target="_blank">Stage-only view</a></div>
    <div class="row">Tables: <input id="tabs" type="number" min="1" max="30" value="${S.tables}" style="width:80px"><button id="saveTabs">Save</button></div>
    <div class="row">Winners: ${[1, 2, 3].map((r) => S.wins[r] ? `<button class="danger" data-clear="${r}">Clear R${r}: ${esc(S.wins[r].name)}</button>` : `<span style="color:var(--muted)">R${r}: none</span>`).join(' ')}</div>
    <h2 style="font-size:20px;margin-top:14px">Players (${players.length})</h2>
    <table><tr><th>#</th><th>Name</th><th>Table</th><th>Marked</th><th>To go</th><th></th></tr>
    ${players.map((p) => `<tr><td>${p.rank}</td><td>${esc(p.name)}</td><td>${p.table}</td><td>${p.marks}</td><td>${p.toGo}</td><td><button class="danger" data-kick="${p.id}">Remove</button></td></tr>`).join('')}</table>
    <h2 style="font-size:20px;margin-top:18px;color:var(--bad)">Reset game</h2>
    <p>Deletes every card, answer and winner. Type RESET to confirm.</p>
    <div class="row"><input id="rs" placeholder="RESET" style="width:140px"><button class="danger" id="doReset">Reset everything</button></div>
    <div class="row"><button id="no">Close</button><button id="signout">Sign out of host</button></div>`, (p) => {
    $('#no', p).onclick = closeModal;
    $('#saveTabs', p).onclick = () => host('host-settings', { tables: $('#tabs', p).value }).then(() => flash('Saved'));
    p.querySelectorAll('[data-kick]').forEach((b) => (b.onclick = () => host('host-kick', { pid: b.dataset.kick }).then(openMore)));
    p.querySelectorAll('[data-clear]').forEach((b) => (b.onclick = () => host('host-clear-win', { round: b.dataset.clear }).then(() => { seenWins = null; openMore(); })));
    $('#doReset', p).onclick = () => host('host-reset', { confirm: $('#rs', p).value.trim() }).then(() => { seenWins = null; closeModal(); flash('Game reset'); });
    $('#signout', p).onclick = () => { localStorage.removeItem('etibingo:hostkey'); hostKey = ''; closeModal(); askKey(); };
  });
}

document.addEventListener('keydown', (e) => {
  if ($('#modal').classList.contains('show') || e.target.matches('input, select, textarea')) return;
  if (winnerUp && (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ')) { $('#winner').classList.remove('show'); winnerUp = false; return; }
  if (stageOnly) return;
  const map = { d: 'draw', a: 'autoToggle', g: 'auto', l: 'board', q: 'lobby', h: 'hide', m: 'mute' };
  const a = map[e.key.toLowerCase()];
  if (!a) return;
  const b = $(`#dock button[data-a="${a}"]`);
  if (b && b.disabled) return;
  if (a === 'hide') { actions.hide(); return; }
  Promise.resolve(actions[a](b)).catch(() => {}).finally(() => { dockSig = ''; stageKey = ''; });
});

// ---------------------------------------------------------------- loop
let busy = false;
async function poll() {
  if (busy) return;
  busy = true;
  try {
    const s = await api('state');
    syncClock(s.now, 5);
    S = s;
    renderChrome(); checkWins(); renderStage(); maybeDock();
  } catch (e) { flash('Connection problem: ' + e.message, 2000); }
  finally { busy = false; }
}
setInterval(poll, 1000);
setInterval(() => { if (S) { renderStage(); maybeDock(); } }, 90);
setInterval(() => { if (S && phase() === 'lobby') loadNames(); }, 5000);
// Auto-draw: next square once the last one has been up for autoSecs.
setInterval(async () => {
  if (!auto || autoBusy || !S || winnerUp || !hostKey) return;
  if (S.left === 0) { auto = false; flash('Every square has been called'); return; }
  const d = S.current;
  if (d && now() < d.at + autoSecs * 1000) return;
  autoBusy = true;
  try { await host('host-draw', {}); } catch { auto = false; } finally { autoBusy = false; }
}, 500);
if (!hostKey && !stageOnly) askKey();
poll();
