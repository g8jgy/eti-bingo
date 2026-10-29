// Builds poc/ETI Bingo POC.html: the whole app in one offline file for hands-on testing.
// The game server (api/game.js + lib/*) runs inside the page with an in-memory store, the host
// screen and phone(s) are the real pages loaded into iframes, and bot players fill the room.
// Usage: node tools/build-poc.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const strip = (s) => s.replace(/^import .*$/gm, '').replace(/^export default /gm, '').replace(/^export /gm, '');
const must = (s, a, b) => { if (!s.includes(a)) throw new Error('build-poc: pattern not found: ' + a.slice(0, 60)); return s.replace(a, b); };

// ---------------------------------------------------------------- in-page server
const memStore = `
const backend = 'memory';
const mem = { s: {}, h: {} };
async function exec(cmds) {
  const m = mem;
  return cmds.map(([cmd, ...a]) => {
    switch (cmd.toUpperCase()) {
      case 'GET': return m.s[a[0]] ?? null;
      case 'MGET': return a.map((k) => m.s[k] ?? null);
      case 'SET': {
        const nx = a.slice(2).map((x) => String(x).toUpperCase()).includes('NX');
        if (nx && a[0] in m.s) return null;
        m.s[a[0]] = String(a[1]); return 'OK';
      }
      case 'DEL': { let n = 0; for (const k of a) { if (k in m.s) { delete m.s[k]; n++; } if (k in m.h) { delete m.h[k]; n++; } } return n; }
      case 'HGET': return m.h[a[0]]?.[a[1]] ?? null;
      case 'HSET': { const h = (m.h[a[0]] ||= {}); for (let i = 1; i < a.length; i += 2) h[a[i]] = String(a[i + 1]); return 1; }
      case 'HDEL': { const h = m.h[a[0]] || {}; let n = 0; for (const f of a.slice(1)) if (f in h) { delete h[f]; n++; } return n; }
      case 'HGETALL': { const h = m.h[a[0]] || {}; return Object.entries(h).flat(); }
      case 'HLEN': return Object.keys(m.h[a[0]] || {}).length;
      default: throw new Error('memstore: unsupported ' + cmd);
    }
  });
}
function hashToObj(flat) {
  const o = {};
  for (let i = 0; i < (flat || []).length; i += 2) o[flat[i]] = flat[i + 1];
  return o;
}
const process = { env: {} };
const crypto = { randomBytes: (n) => ({ toString: () => {
  const b = window.crypto.getRandomValues(new Uint8Array(n));
  return btoa(String.fromCharCode(...b)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
} }) };
`;

const server = `(() => {
${memStore}
${strip(read('lib/content.js'))}
${strip(read('lib/engine.js'))}
${strip(read('api/game.js'))}
window.BINGO = {
  SQUARES, GOALS, toGo,
  async call(op, body, hostKey) {
    let status = 200, out = null;
    const res = { setHeader() {}, status(c) { status = c; return res; }, json(o) { out = o; return res; } };
    const req = { method: body === undefined ? 'GET' : 'POST', query: { op }, headers: hostKey ? { 'x-host-key': hostKey } : {}, body: body ?? {} };
    await handler(req, res);
    return { status, json: JSON.parse(JSON.stringify(out)) };
  },
};
})();`;

// ---------------------------------------------------------------- client pages as srcdoc
let common = read('public/assets/common.js');
common = common.replace(/export async function api\([\s\S]*?\n}\n/, `
let __seq = 0; const __wait = new Map();
addEventListener('message', (e) => { const d = e.data; if (d && d.__bingo === 'reply' && __wait.has(d.id)) { __wait.get(d.id)(d); __wait.delete(d.id); } });
export async function api(op, body, hostKey) {
  const id = ++__seq;
  const r = await new Promise((res) => { __wait.set(id, res); parent.postMessage({ __bingo: 'call', id, op, body, hostKey }, '*'); });
  if (r.status >= 400) { const e = new Error((r.json && r.json.error) || 'Request failed (' + r.status + ')'); e.status = r.status; throw e; }
  return r.json;
}
`);
if (!common.includes('__bingo')) throw new Error('build-poc: api() not replaced');
common = strip(common);

// Each frame gets its own throwaway localStorage, so every phone starts at the join screen.
const lsShim = (seed) => `const localStorage = (() => { const m = new Map(Object.entries(${JSON.stringify(seed)})); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();`;

const css = read('public/assets/brand.css');
function page(htmlFile, jsFile, seed, fix = (s) => s) {
  let html = read(htmlFile);
  html = must(html, '<link rel="stylesheet" href="/assets/brand.css">', `<style>\n${css}\n</style>`);
  const js = fix(strip(read(jsFile)));
  html = must(html, `<script type="module" src="/${jsFile.replace('public/', '')}"></script>`,
    `<script type="module">\n${lsShim(seed)}\n${common}\n${js}\n</script>`);
  return html;
}

const hostPage = page('public/host.html', 'public/assets/host.js', { 'etibingo:hostkey': 'eti-host' }, (js) => {
  js = must(js, "const playUrl = location.origin + '/';", "const playUrl = 'POC: join on the phone panel';");
  js = must(js, '<a href="/review" target="_blank">Review all squares</a> &middot; <a href="/tents" target="_blank">Print join QR cards</a> &middot; <a href="/host?stage=1" target="_blank">Stage-only view</a>',
    'The squares review, table tents and stage-only view are in the full app.');
  return js;
});
const playerPage = page('public/index.html', 'public/assets/player.js', {});

const json = (s) => JSON.stringify(s).replace(/<\//g, '<\\/');

// ---------------------------------------------------------------- shell page
const shell = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ETI Bingo POC</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
<style>
  :root { --navy: #00358A; --deep: #001F52; --amber: #FFA000; --ink: #1d2433; --muted: #5d6b82; --line: #d9e0ec; --bg: #eef2f8; }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body { font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--ink); display: grid; grid-template-rows: auto auto 1fr; overflow: hidden; }
  header { background: var(--navy); color: #fff; display: flex; align-items: center; gap: 18px; padding: 10px 18px; flex-wrap: wrap; }
  header h1 { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 26px; letter-spacing: .5px; line-height: 1; }
  header h1 span { color: var(--amber); }
  header .tag { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #c9d4e8; border: 1px solid rgba(255,255,255,.35); border-radius: 99px; padding: 3px 9px; }
  .ctl { margin-left: auto; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; font-size: 13px; }
  .ctl label { display: flex; gap: 6px; align-items: center; color: #c9d4e8; }
  .ctl select, .ctl button { font: inherit; font-weight: 600; border-radius: 8px; border: 1px solid rgba(255,255,255,.4); background: rgba(255,255,255,.1); color: #fff; padding: 6px 10px; cursor: pointer; }
  .ctl select option { color: var(--ink); }
  .ctl button.amber { background: var(--amber); border-color: var(--amber); color: #2b1d00; }
  .steps { display: flex; gap: 22px; padding: 8px 18px; background: #fff; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--muted); flex-wrap: wrap; }
  .steps b { color: var(--navy); }
  .steps .bots { margin-left: auto; color: var(--navy); font-weight: 600; }
  main { display: flex; gap: 16px; padding: 14px 18px; min-height: 0; }
  .pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  .pane h2 { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); font-weight: 700; display: flex; gap: 8px; align-items: center; }
  .pane h2 button { font: inherit; font-size: 10px; letter-spacing: 1px; border: 1px solid var(--line); background: #fff; border-radius: 6px; padding: 2px 6px; cursor: pointer; color: var(--muted); }
  .hostpane { flex: 1; min-width: 0; }
  .hostbox { flex: 1; min-height: 0; display: grid; place-items: center; }
  #host { width: 100%; aspect-ratio: 16 / 9; max-height: 100%; border: 0; border-radius: 10px; background: #001F52; box-shadow: 0 8px 30px rgba(0,31,82,.25); }
  .phones { display: flex; gap: 14px; min-height: 0; flex: 1; max-height: 820px; }
  .phone { width: 410px; flex: 0 0 auto; border: 10px solid #111; border-radius: 34px; overflow: hidden; background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,.2); }
  .phone iframe { width: 100%; height: 100%; border: 0; display: block; }
  @media (max-width: 1100px) { body { overflow: auto; } main { flex-direction: column; } .hostpane, .hostbox { flex: none; display: block; } .phones { flex: none; height: 760px; } #host { max-height: none; } }
</style>
</head>
<body>
<header>
  <h1>ETI <span>Bingo</span></h1>
  <span class="tag">Proof of concept &middot; runs offline</span>
  <div class="ctl">
    <label>Bots <select id="botCount"><option value="0">None</option><option value="10">10</option><option value="30" selected>30</option><option value="69">69</option></select></label>
    <label>Bot speed <select id="botSpeed"><option value="1.8">Slow</option><option value="1" selected>Normal</option><option value="0.5">Fast</option></select></label>
    <button id="addPhone">+ Phone</button>
    <button id="restart" class="amber">Start over</button>
  </div>
</header>
<div class="steps">
  <span><b>1.</b> Join on the phone</span>
  <span><b>2.</b> Press <b>Draw</b> on the big screen (or D)</span>
  <span><b>3.</b> Tap squares that glow</span>
  <span><b>4.</b> Line complete? Hit <b>BINGO</b></span>
  <span class="bots" id="botStatus"></span>
</div>
<main>
  <section class="pane hostpane"><h2>Big screen (host laptop)</h2><div class="hostbox"><iframe id="host" title="Host screen"></iframe></div></section>
  <section class="pane"><h2>Phones <button id="dropPhone" hidden>Remove last</button></h2><div class="phones" id="phones"></div></section>
</main>

<script>
${server}

const HOST_HTML = ${json(hostPage)};
const PLAYER_HTML = ${json(playerPage)};
const $ = (s) => document.querySelector(s);

// Route API calls from the frames to the in-page server.
addEventListener('message', async (e) => {
  const d = e.data;
  if (!d || d.__bingo !== 'call') return;
  const r = await BINGO.call(d.op, d.body, d.hostKey);
  e.source.postMessage({ __bingo: 'reply', id: d.id, status: r.status, json: r.json }, '*');
});

$('#host').srcdoc = HOST_HTML;
function addPhone() {
  const box = document.createElement('div');
  box.className = 'phone';
  box.innerHTML = '<iframe title="Phone"></iframe>';
  box.firstChild.srcdoc = PLAYER_HTML;
  $('#phones').appendChild(box);
  sizePhones();
}
function sizePhones() {
  const n = $('#phones').children.length;
  $('#addPhone').disabled = n >= 3;
  $('#dropPhone').hidden = n < 2;
}
$('#addPhone').onclick = addPhone;
$('#dropPhone').onclick = () => { $('#phones').lastChild.remove(); sizePhones(); };
$('#restart').onclick = () => location.reload();
addPhone();

// ---------------------------------------------------------------- bot players
const FIRST = ['Avery','Blake','Casey','Dana','Eli','Frankie','Gray','Harper','Indy','Jamie','Kai','Logan','Morgan','Noel','Oakley','Parker','Quinn','Reese','Sage','Taylor','Uma','Vic','Wren','Xan','Yael','Zion','Ari','Bailey','Cam','Drew','Emery','Finley','Hayden','Jordan','Kendall'];
const bots = [];
let speed = 1;
const rand = (a, b) => a + Math.random() * (b - a);
const host = (op, body = {}) => BINGO.call(op, body, 'eti-host');

async function setBots(n) {
  while (bots.length > n) { const b = bots.pop(); b.gone = true; await host('host-kick', { pid: b.pid }); }
  while (bots.length < n) {
    const i = bots.length;
    const name = FIRST[i % FIRST.length] + ' ' + String.fromCharCode(65 + ((i * 7) % 26)) + '. (bot)';
    const r = await BINGO.call('join', { name });
    if (r.status !== 200) break;
    bots.push({ pid: r.json.pid, token: r.json.token, round: r.json.player.round, cells: r.json.player.cells, marked: new Set(), pending: new Set(),
      react: rand(3, 12), miss: Math.random() * 0.25, won: 0, claiming: false });
  }
  status();
}
function status() {
  $('#botStatus').textContent = bots.length ? bots.length + ' bot players are in the game' : 'No bots: just you';
}

async function tick() {
  const S = (await BINGO.call('state')).json;
  for (const b of bots) {
    if (b.gone) continue;
    for (const sq of S.called) {
      const cell = b.cells.indexOf(sq);
      if (cell < 0 || b.marked.has(cell) || b.pending.has(cell)) continue;
      b.pending.add(cell);
      const late = Math.random() < b.miss ? rand(15, 45) : 0;
      setTimeout(async () => {
        if (b.gone || !b.pending.has(cell)) return;
        const r = await BINGO.call('mark', { pid: b.pid, token: b.token, cell });
        if (r.status === 200) b.marked.add(cell);
        b.pending.delete(cell);
      }, (b.react * rand(0.5, 1.5) + late) * 1000 * speed);
    }
    if (b.round !== S.round) {
      b.round = S.round;
      const r = await BINGO.call('me', { pid: b.pid, token: b.token });
      if (r.status === 200) { b.cells = r.json.player.cells; b.marked = new Set(r.json.player.marks); b.pending = new Set(); }
      continue;
    }
    const st = S.st[b.pid];
    if (!b.won && !b.claiming && !S.wins[S.round] && st && st[1] === 0) {
      b.claiming = true;
      setTimeout(async () => {
        if (b.gone) return;
        const r = await BINGO.call('claim', { pid: b.pid, token: b.token });
        if (r.status === 200) b.won = r.json.won;
        b.claiming = false;
      }, rand(2, 7) * 1000 * speed);
    }
  }
}
setInterval(tick, 500);
$('#botCount').onchange = (e) => setBots(+e.target.value);
$('#botSpeed').onchange = (e) => { speed = +e.target.value; };
setBots(30);
</script>
</body>
</html>
`;

const out = path.join(root, 'poc', 'ETI Bingo POC.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, shell);
console.log('wrote', out, Math.round(shell.length / 1024) + ' KB');
