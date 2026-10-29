// Local stand-in for Vercel: serves public/ and routes /api/game to the same handler.
// Usage: node dev-server.mjs [port]   (host key in local mode: eti-host)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/game.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(root, 'public');
const port = parseInt(process.argv[2] || process.env.PORT || '8795', 10);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/game') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    req.query = Object.fromEntries(url.searchParams);
    req.body = raw ? JSON.parse(raw) : {};
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
    return handler(req, res);
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  if (!path.extname(p)) p += '.html'; // cleanUrls, like vercel.json
  const file = path.join(pub, p);
  if (!file.startsWith(pub) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`ETI Bingo dev server on http://localhost:${port}  (host: /host, key eti-host)`));
