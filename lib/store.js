// Storage adapter. In production: Upstash Redis over its REST API (env vars set by the
// Vercel Marketplace integration). Locally: an in-memory Redis stand-in saved to .data/.
// Both expose exec([[CMD, ...args], ...]) returning results in Upstash REST format.

import fs from 'node:fs';
import path from 'node:path';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function upstashExec(cmds) {
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds.map((c) => c.map(String))),
  });
  if (!r.ok) throw new Error('store ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new Error('store: ' + x.error);
    return x.result;
  });
}

// ---- local stand-in ----
const FILE = path.join(process.cwd(), '.data', (process.env.BINGO_PREFIX || 'dev').replace(/[^a-z0-9-]/gi, '_') + '.json');
let mem = null;
function load() {
  if (mem) return mem;
  try { mem = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { mem = { s: {}, h: {} }; }
  return mem;
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(mem));
  }, 150);
}
function memExec(cmds) {
  const m = load();
  let dirty = false;
  const res = cmds.map(([cmd, ...a]) => {
    switch (cmd.toUpperCase()) {
      case 'GET': return m.s[a[0]] ?? null;
      case 'MGET': return a.map((k) => m.s[k] ?? null);
      case 'SET': {
        const nx = a.slice(2).map((x) => String(x).toUpperCase()).includes('NX');
        if (nx && a[0] in m.s) return null;
        m.s[a[0]] = String(a[1]); dirty = true; return 'OK';
      }
      case 'DEL': { let n = 0; for (const k of a) { if (k in m.s) { delete m.s[k]; n++; } if (k in m.h) { delete m.h[k]; n++; } } dirty = true; return n; }
      case 'HGET': return m.h[a[0]]?.[a[1]] ?? null;
      case 'HSET': { const h = (m.h[a[0]] ||= {}); for (let i = 1; i < a.length; i += 2) h[a[i]] = String(a[i + 1]); dirty = true; return 1; }
      case 'HDEL': { const h = m.h[a[0]] || {}; let n = 0; for (const f of a.slice(1)) if (f in h) { delete h[f]; n++; } dirty = true; return n; }
      case 'HGETALL': { const h = m.h[a[0]] || {}; return Object.entries(h).flat(); }
      case 'HLEN': return Object.keys(m.h[a[0]] || {}).length;
      default: throw new Error('memstore: unsupported ' + cmd);
    }
  });
  if (dirty) save();
  return res;
}

export const backend = URL_ && TOKEN ? 'upstash' : 'memory';
export async function exec(cmds) {
  return backend === 'upstash' ? upstashExec(cmds) : memExec(cmds);
}

export function hashToObj(flat) {
  const o = {};
  for (let i = 0; i < (flat || []).length; i += 2) o[flat[i]] = flat[i + 1];
  return o;
}
