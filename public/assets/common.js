// Shared helpers for the player card, host screen and print pages.
export const API = '/api/game';

export async function api(op, body, hostKey) {
  const opts = body === undefined
    ? { method: 'GET', cache: 'no-store' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json', ...(hostKey ? { 'x-host-key': hostKey } : {}) }, body: JSON.stringify(body) };
  const r = await fetch(`${API}?op=${op}`, opts);
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  if (!r.ok) { const e = new Error(j.error || `Request failed (${r.status})`); e.status = r.status; throw e; }
  return j;
}

// Server clock offset; uncached responses (join/me) are trusted over cached state.
let offset = 0, offsetQuality = 99;
export function syncClock(serverNow, quality) {
  if (typeof serverNow !== 'number') return;
  if (quality <= offsetQuality) { offset = serverNow - Date.now(); offsetQuality = quality; }
}
export const now = () => Date.now() + offset;

export const LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="#F5A100"><polygon points="45.5,12 54.5,12 54.5,35 50,31 45.5,35"/><rect x="45.5" y="12" width="9" height="21" transform="rotate(-45 50 55)"/><rect x="45.5" y="12" width="9" height="21" transform="rotate(45 50 55)"/><rect x="45.5" y="12" width="9" height="21" transform="rotate(-90 50 55)"/><rect x="45.5" y="12" width="9" height="21" transform="rotate(90 50 55)"/></g><path d="M24 91 V64 L50 35 L76 64 V91 H67 V68 L50 49 L33 68 V82 H46 V71 H60 V91 Z" fill="#0B3D91"/></svg>`;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, el = document) => el.querySelector(sel);

// QR code as an SVG string (needs qrcode-generator on window).
export function qrSvg(text, { dark = '#0B3D91', light = '#ffffff', margin = 2 } = {}) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), size = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}

export function confetti(container, count = 120) {
  const colors = ['#FFA000', '#F5A100', '#00358A', '#ffffff', '#4F8BE8'];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.8 + 's';
    p.style.animationDuration = 2.4 + Math.random() * 1.8 + 's';
    p.style.setProperty('--drift', (Math.random() * 2 - 1) * 120 + 'px');
    p.style.setProperty('--spin', (Math.random() * 2 - 1) * 900 + 'deg');
    frag.appendChild(p);
  }
  container.appendChild(frag);
  setTimeout(() => container.querySelectorAll('.confetti').forEach((x) => x.remove()), 5200);
}
