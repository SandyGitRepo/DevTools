#!/usr/bin/env node
/**
 * DevToolkit standalone server — zero npm dependencies (Node 18+ built-ins only).
 *
 * Serves the built SPA (dist/) with the security headers from requirements section 5, plus a
 * small /api surface for the server-side PDF tools (Phase 2). It never stores request bodies,
 * never sets cookies and logs operational metadata only (A09).
 *
 * Configuration (environment variables):
 *   HOST          Interface to bind. Default 127.0.0.1 (this machine only). Use 0.0.0.0 to serve the LAN.
 *   PORT          Default 8080.
 *   TLS_CERT      Path to a PEM certificate — enables HTTPS (TLS 1.2+) and HSTS.
 *   TLS_KEY       Path to the matching PEM private key.
 *   ALLOW_CIDRS   Optional comma-separated allow-list, e.g. "10.0.0.0/8,192.168.0.0/16,127.0.0.1/32" (A01).
 *   LOG_STATIC    "1" to also log static file requests (default: API and errors only).
 *   DIST_DIR      Override the directory to serve. Default ../dist relative to this file.
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createPdfService, HttpError } from './pdf-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.DIST_DIR || path.join(__dirname, '..', 'dist'));
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8080);
const TLS = process.env.TLS_CERT && process.env.TLS_KEY;
const LOG_STATIC = process.env.LOG_STATIC === '1';

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`[devtoolkit] No build found at ${ROOT}. Run "npm run build" first (release zips already include it).`);
  process.exit(1);
}

// ---------- Security headers (A02, A03, A05, A07) ----------
const CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' permits compiling WebAssembly (hash-wasm, Java parser); it does NOT allow JS eval.
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  // Monaco and Framer Motion set inline style attributes; no inline <script> is ever allowed.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const BASE_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
  ...(TLS ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.pem': 'text/plain; charset=utf-8',
};

// ---------- IP allow-list (A01) ----------
function parseCidr(c) {
  const [addr, bitsStr] = c.trim().split('/');
  const v = net.isIP(addr);
  if (!v) throw new Error(`Invalid ALLOW_CIDRS entry: ${c}`);
  const bits = bitsStr === undefined ? (v === 4 ? 32 : 128) : Number(bitsStr);
  return { v, bits, bytes: ipBytes(addr) };
}
function ipBytes(ip) {
  if (net.isIPv4(ip)) return Uint8Array.from(ip.split('.').map(Number));
  // Expand IPv6
  const [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t] : h;
  const out = new Uint8Array(16);
  groups.forEach((g, i) => {
    const n = parseInt(g || '0', 16);
    out[i * 2] = n >> 8;
    out[i * 2 + 1] = n & 255;
  });
  return out;
}
function inCidr(ip, cidr) {
  const b = ipBytes(ip);
  if (b.length !== cidr.bytes.length) return false;
  let bits = cidr.bits;
  for (let i = 0; i < b.length && bits > 0; i++, bits -= 8) {
    const mask = bits >= 8 ? 255 : (255 << (8 - bits)) & 255;
    if ((b[i] & mask) !== (cidr.bytes[i] & mask)) return false;
  }
  return true;
}
const ALLOW = process.env.ALLOW_CIDRS ? process.env.ALLOW_CIDRS.split(',').filter(Boolean).map(parseCidr) : null;
const clientIp = (req) => (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
const allowed = (ip) => !ALLOW || ALLOW.some((c) => inCidr(ip, c));

// ---------- Rate limiting for /api (SEC-2): 30 requests / minute / IP ----------
const RATE = { limit: 30, windowMs: 60_000 };
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE.limit;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) if (!arr.some((t) => now - t < RATE.windowMs)) hits.delete(ip);
}, 60_000).unref();

// ---------- Logging: metadata only, never bodies, filenames or query strings (A09) ----------
function log(req, status, started, bytes) {
  const entry = {
    ts: new Date().toISOString(),
    method: req.method,
    path: (req.url || '').split('?')[0].slice(0, 200),
    status,
    ms: Date.now() - started,
    bytes,
    ip: clientIp(req),
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Length': buf.length, ...headers });
  res.end(buf);
  return buf.length;
}

const errorPage = (status, msg) =>
  `<!doctype html><meta charset="utf-8"><title>${status}</title><body style="font-family:sans-serif;background:#001A33;color:#E8F1FA;display:grid;place-items:center;height:100vh;margin:0"><div><h1 style="color:#F37021">${status}</h1><p>${msg}</p></div>`;

// ---------- API (server-side tools land here in Phase 2) ----------
const pdfService = createPdfService(__dirname);

async function handleApi(req, res, ip) {
  const p = req.url.split('?')[0];
  const json = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (p === '/api/health' && req.method === 'GET') {
    return send(res, 200, JSON.stringify({ status: 'ok', pdfService: pdfService.available, qpdf: pdfService.version }), json);
  }
  if (rateLimited(ip)) return send(res, 429, JSON.stringify({ error: 'Too many requests — limit is 30 per minute' }), { ...json, 'Retry-After': '60' });
  // CORS is not enabled: browsers only allow same-origin calls (A01). Reject cross-site form posts outright.
  const origin = req.headers.origin;
  if (origin && origin !== `${TLS ? 'https' : 'http'}://${req.headers.host}`)
    return send(res, 403, JSON.stringify({ error: 'Cross-origin requests are not allowed' }), json);
  const m = p.match(/^\/api\/pdf\/([a-z]+)$/);
  if (m) {
    try {
      const r = await pdfService.handle(req, m[1]);
      return send(res, r.status, r.body, r.headers);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      // Refused uploads may still be streaming: close the connection instead of draining the body
      const closing = status === 413 ? { Connection: 'close' } : {};
      const bytes = send(res, status, JSON.stringify({ error: e instanceof HttpError ? e.message : 'Something went wrong' }), { ...json, ...closing });
      if (status === 413) res.on('finish', () => req.socket.destroy());
      return bytes;
    }
  }
  return send(res, 404, JSON.stringify({ error: 'Not found' }), json);
}

// ---------- Static files ----------
function handleStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return send(res, 405, errorPage(405, 'Method not allowed'), { 'Content-Type': 'text/html; charset=utf-8', Allow: 'GET, HEAD' });
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    return send(res, 400, errorPage(400, 'Bad request'), { 'Content-Type': 'text/html; charset=utf-8' });
  }
  if (urlPath.includes('\0')) return send(res, 400, errorPage(400, 'Bad request'), { 'Content-Type': 'text/html; charset=utf-8' });
  // Resolve inside ROOT only — blocks ../ traversal (A01)
  let file = path.resolve(ROOT, '.' + path.posix.normalize('/' + urlPath));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 404, errorPage(404, 'Not found'), { 'Content-Type': 'text/html; charset=utf-8' });
  let stat = fs.statSync(file, { throwIfNoEntry: false });
  if (stat?.isDirectory()) {
    file = path.join(file, 'index.html');
    stat = fs.statSync(file, { throwIfNoEntry: false });
  }
  if (!stat?.isFile()) {
    // SPA uses hash routing, so unknown paths are genuine 404s
    return send(res, 404, errorPage(404, 'Not found'), { 'Content-Type': 'text/html; charset=utf-8' });
  }
  const ext = path.extname(file).toLowerCase();
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const immutable = rel.startsWith('assets/') && /-[A-Za-z0-9_-]{8,}\./.test(rel);
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...(rel === 'sw.js' ? { 'Service-Worker-Allowed': '/' } : {}),
  };
  res.writeHead(200, { ...BASE_HEADERS, ...headers });
  if (req.method === 'HEAD') {
    res.end();
    return 0;
  }
  fs.createReadStream(file).pipe(res);
  return stat.size;
}

async function handler(req, res) {
  const started = Date.now();
  const ip = clientIp(req);
  req.setTimeout(60_000); // SEC-2
  let status;
  let bytes = 0;
  try {
    if (!allowed(ip)) {
      status = 403;
      bytes = send(res, 403, errorPage(403, 'Access is restricted to allowed networks.'), { 'Content-Type': 'text/html; charset=utf-8' });
    } else if ((req.url || '').startsWith('/api/')) {
      bytes = await handleApi(req, res, ip);
      status = res.statusCode;
    } else {
      bytes = handleStatic(req, res);
      status = res.statusCode;
    }
  } catch {
    // Generic error, no stack traces to the client (A05)
    status = 500;
    if (!res.headersSent) bytes = send(res, 500, errorPage(500, 'Something went wrong.'), { 'Content-Type': 'text/html; charset=utf-8' });
    else res.destroy();
  }
  if (LOG_STATIC || status >= 400 || (req.url || '').startsWith('/api/')) log(req, status, started, bytes);
}

const server = TLS
  ? https.createServer({ cert: fs.readFileSync(process.env.TLS_CERT), key: fs.readFileSync(process.env.TLS_KEY), minVersion: 'TLSv1.2' }, handler)
  : http.createServer(handler);
server.headersTimeout = 60_000;
server.requestTimeout = 60_000;

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `[devtoolkit] Port ${PORT} is already in use. Set PORT to another value.` : `[devtoolkit] ${e.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const scheme = TLS ? 'https' : 'http';
  const shown = HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST;
  console.log(`\n  DevToolkit is running →  ${scheme}://${shown}:${PORT}/\n`);
  if (HOST === '0.0.0.0' || HOST === '::') {
    const ifaces = Object.values(os.networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal);
    for (const i of ifaces) console.log(`  On your network:          ${scheme}://${i.address}:${PORT}/`);
  } else {
    console.log('  (Only this computer can connect. Set HOST=0.0.0.0 to share it on your network.)');
  }
  if (ALLOW) console.log(`  IP allow-list active: ${process.env.ALLOW_CIDRS}`);
  console.log(
    pdfService.available
      ? `  PDF service: qpdf ${pdfService.version}`
      : '  PDF service: off (install qpdf 11.7+ or set QPDF_PATH to enable PDF protect/compress)',
  );
  console.log('  Press Ctrl+C to stop.\n');
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
