// Local stand-in for a Supabase project: runs supabase/setup.sql in PGlite (Postgres in WASM) and
// answers PostgREST-style RPC calls (POST /rest/v1/rpc/<fn>), and serves public/ like GitHub Pages
// would, under /eti-bingo/, with assets/config.js pointing at this shim.
// Usage (from tools/supa-test): node shim.mjs [port]   host key: eti-host
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { SQL } from '../build-supabase-sql.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pub = path.join(root, 'public');
const port = parseInt(process.argv[2] || '8797', 10);
const BASE = '/eti-bingo/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

const db = new PGlite();
await db.exec(`create role anon; create role authenticated;`);
await db.exec(SQL);
await db.exec(`update bingo.config set value = to_jsonb('eti-host'::text) where key = 'host_key';`);
if (process.env.SPIN_MS) await db.exec(`update bingo.config set value = '${parseInt(process.env.SPIN_MS, 10)}'::jsonb where key = 'spin_ms';`);
console.log('setup.sql applied');

// Run each RPC as the anon role, like the Supabase API does for a publishable key.
let queue = Promise.resolve();
function rpc(fn, args) {
  const run = async () => {
    if (!/^bingo_[a-z]+$/.test(fn)) return { status: 404, body: { message: 'not found' } };
    const keys = Object.keys(args);
    const named = keys.map((k, i) => `${k.replace(/[^a-z_]/g, '')} => $${i + 1}`).join(', ');
    const vals = keys.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
    try {
      await db.exec('set role anon');
      const r = await db.query(`select public.${fn}(${named})::text as r`, vals);
      return { status: 200, body: r.rows[0].r };
    } catch (e) {
      return { status: 400, body: { code: e.code, message: e.message, hint: e.hint || null } };
    } finally {
      await db.exec('reset role');
    }
  };
  const p = queue.then(run);
  queue = p.catch(() => {});
  return p;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
  if (m) {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }); return res.end(); }
    let raw = '';
    for await (const c of req) raw += c;
    if (!req.headers.apikey) { res.writeHead(401); return res.end('{"message":"No API key found in request"}'); }
    const out = await rpc(m[1], raw ? JSON.parse(raw) : {});
    res.writeHead(out.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(typeof out.body === 'string' ? out.body : JSON.stringify(out.body));
  }
  if (url.pathname === BASE + 'assets/config.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end(`window.BINGO_CONFIG = { supabaseUrl: 'http://localhost:${port}', supabaseKey: 'sb_publishable_localtest' };`);
  }
  if (!url.pathname.startsWith(BASE)) { res.writeHead(302, { Location: BASE }); return res.end(); }
  let p = decodeURIComponent(url.pathname.slice(BASE.length - 1));
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(pub, p);
  // content.js and engine.js are copied into assets/ by the Pages workflow; serve them from lib/ here
  if (p === '/assets/content.js' || p === '/assets/engine.js') file = path.join(root, 'lib', path.basename(p));
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html'; // GitHub Pages serves /review as review.html
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Supabase shim on http://localhost:${port}${BASE}  (host key eti-host)`));
