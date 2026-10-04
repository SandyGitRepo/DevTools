/**
 * Server security tests (requirements §5, OWASP Top 10 2021) against real server processes.
 * Writes a JSON report and a human-readable request/response transcript as evidence.
 *
 *   node tests/e2e/security.mjs --out=<dir>      (set QPDF_PATH to include the PDF API cases)
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = path.resolve(args.out || 'test-evidence/security');
fs.mkdirSync(OUT, { recursive: true });
const transcript = [];
const results = [];
const log = (s) => transcript.push(s);

function check(id, owasp, title, ok, detail) {
  results.push({ id, owasp, title, ok: !!ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${id} ${title}${ok ? '' : ` — ${detail}`}`);
}

/** Raw HTTP request (no URL normalisation, so traversal payloads reach the server untouched). */
function raw(port, method, rawPath, { headers = {}, body, tls = false, tlsOpts = {} } = {}) {
  return new Promise((resolve) => {
    const lib = tls ? https : http;
    const req = lib.request({ host: '127.0.0.1', port, method, path: rawPath, headers, agent: false, rejectUnauthorized: false, ...tlsOpts }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        log(`\n> ${method} ${rawPath}${Object.keys(headers).length ? `\n> ${JSON.stringify(headers)}` : ''}\n< ${res.statusCode}\n${Object.entries(res.headers).map(([k, v]) => `< ${k}: ${v}`).join('\n')}\n< [${buf.length} bytes] ${buf.subarray(0, 160).toString('latin1').replace(/\s+/g, ' ')}`);
        resolve({ status: res.statusCode, headers: res.headers, body: buf });
      });
    });
    req.on('error', (e) => {
      log(`\n> ${method} ${rawPath}\n< ERROR ${e.code || e.message}`);
      resolve({ status: 0, error: e.code || e.message, headers: {}, body: Buffer.alloc(0) });
    });
    if (body) req.write(body);
    req.end();
  });
}

function startNode(port, env = {}) {
  const lines = [];
  const p = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => lines.push(...d.toString().split('\n').filter(Boolean)));
  p.stderr.on('data', (d) => lines.push(...d.toString().split('\n').filter(Boolean)));
  return { p, lines };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const frame = (opts, pdf) => {
  const j = Buffer.from(JSON.stringify(opts));
  const h = Buffer.alloc(4);
  h.writeUInt32BE(j.length);
  return Buffer.concat([h, j, pdf]);
};

async function samplePdf() {
  const d = await PDFDocument.create();
  for (let i = 0; i < 3; i++) d.addPage([300, 300]);
  return Buffer.from(await d.save());
}

const PORT = 8201;
log(`# Security transcript — ${new Date().toISOString()}\n# Node ${process.version} · ${os.platform()} ${os.release()}`);

// ------------------------------------------------------------------ Node server, plain HTTP
const s1 = startNode(PORT);
await wait(1500);
log('\n## Security headers');
const home = await raw(PORT, 'GET', '/');
const h = home.headers;
const csp = h['content-security-policy'] || '';
check('SEC-H1', 'A05', 'Content-Security-Policy present and strict', /default-src 'self'/.test(csp) && /object-src 'none'/.test(csp) && /frame-ancestors 'none'/.test(csp) && !/unsafe-eval'/.test(csp.replace("'wasm-unsafe-eval'", '')) && /script-src 'self' 'wasm-unsafe-eval'/.test(csp), csp);
check('SEC-H2', 'A05', 'X-Frame-Options: DENY', h['x-frame-options'] === 'DENY', h['x-frame-options']);
check('SEC-H3', 'A05', 'X-Content-Type-Options: nosniff', h['x-content-type-options'] === 'nosniff', h['x-content-type-options']);
check('SEC-H4', 'A05', 'Referrer-Policy: no-referrer', h['referrer-policy'] === 'no-referrer', h['referrer-policy']);
check('SEC-H5', 'A05', 'Permissions-Policy denies camera/microphone/geolocation', /camera=\(\)/.test(h['permissions-policy'] || '') && /microphone=\(\)/.test(h['permissions-policy'] || ''), h['permissions-policy']);
check('SEC-H6', 'A05', 'Cross-Origin-Opener/Resource-Policy same-origin', h['cross-origin-opener-policy'] === 'same-origin' && h['cross-origin-resource-policy'] === 'same-origin', `${h['cross-origin-opener-policy']} / ${h['cross-origin-resource-policy']}`);
check('SEC-H7', 'A07', 'No cookies set', !h['set-cookie'], h['set-cookie']);
check('SEC-H8', 'A05', 'No server/technology banner', !h['x-powered-by'] && !h['server'], `${h['server'] ?? ''} ${h['x-powered-by'] ?? ''}`);
check('SEC-H9', 'A02', 'No HSTS over plain HTTP (only sent with TLS)', !h['strict-transport-security'], h['strict-transport-security']);
const asset = fs.readdirSync('dist/assets').find((f) => f.endsWith('.wasm'));
const a = await raw(PORT, 'GET', `/assets/${asset}`);
check('SEC-H10', 'A05', 'Static assets carry the same headers, correct MIME, immutable cache', a.headers['content-security-policy'] === csp && a.headers['content-type'] === 'application/wasm' && /immutable/.test(a.headers['cache-control']), `${a.headers['content-type']} · ${a.headers['cache-control']}`);
const nf = await raw(PORT, 'GET', '/does-not-exist');
check('SEC-H11', 'A05', '404 page carries headers and no stack trace', nf.status === 404 && nf.headers['content-security-policy'] && !/at .*\.mjs|Error:/.test(nf.body.toString()), nf.status);

log('\n## Path traversal (A01)');
const traversal = [
  '/../package.json',
  '/..%2f..%2fpackage.json',
  '/%2e%2e/%2e%2e/server/server.mjs',
  '/%252e%252e/%252e%252e/package.json',
  '/assets/../../package.json',
  '/..\\server\\server.mjs',
  '/%5c..%5cserver%5cserver.mjs',
  '/....//....//package.json',
  '/index.html%00.js',
  '/%2e%2e%5c%2e%2e%5cpackage.json',
  '//etc/passwd',
  '/C:/Windows/win.ini',
];
for (const t of traversal) {
  const r = await raw(PORT, 'GET', t);
  const leaked = /"devDependencies"|createServer|\[fonts\]|root:x:0/.test(r.body.toString());
  check(`SEC-T${traversal.indexOf(t) + 1}`, 'A01', `Traversal blocked: ${t}`, !leaked && [400, 404].includes(r.status), `status ${r.status}${leaked ? ' LEAKED CONTENT' : ''}`);
}

log('\n## HTTP methods and malformed requests');
for (const m of ['POST', 'PUT', 'DELETE', 'PATCH', 'TRACE', 'OPTIONS']) {
  const r = await raw(PORT, m, '/');
  check(`SEC-M-${m}`, 'A05', `${m} / rejected with 405`, r.status === 405, r.status);
}
const bad = await raw(PORT, 'GET', '/%E0%A4%A');
check('SEC-M-ENC', 'A05', 'Malformed percent-encoding → generic 400, no stack trace', bad.status === 400 && !/at |Error/.test(bad.body.toString()), bad.status);

log('\n## API surface');
const health = await raw(PORT, 'GET', '/api/health');
check('SEC-A1', 'A05', 'Health endpoint reports status only (no versions of OS/Node/paths)', health.status === 200 && !/node|win32|linux|[A-Z]:\\/i.test(health.body.toString().replace(/"qpdf":"[\d.]+"/, '')), health.body.toString());
check('SEC-A2', 'A01', 'No CORS headers (same-origin only)', !health.headers['access-control-allow-origin'], health.headers['access-control-allow-origin']);
const unknown = await raw(PORT, 'GET', '/api/admin');
check('SEC-A3', 'A01', 'Unknown API route → 404', unknown.status === 404, unknown.status);

if (process.env.QPDF_PATH) {
  log('\n## PDF API abuse cases (SEC-1, A03, A04)');
  const pdf = await samplePdf();
  const tmpBefore = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('dtk-')).length;
  const post = (op, body, headers = {}) => raw(PORT, 'POST', `/api/pdf/${op}`, { body, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': body.length, ...headers } });
  const big = await raw(PORT, 'POST', '/api/pdf/compress', { headers: { 'Content-Length': String(200 * 1024 * 1024) } });
  check('SEC-P1', 'A04', 'Oversized upload (declared 200 MB) rejected with 413 before reading', big.status === 413 || big.status === 0, `status ${big.status}`);
  const notPdf = await post('compress', frame({}, Buffer.from('MZ\x90\x00 this is an exe')));
  check('SEC-P2', 'A04', 'Non-PDF (bad magic bytes) → 415', notPdf.status === 415, notPdf.status);
  const malformed = await post('compress', Buffer.from([0xff, 0xff, 0xff, 0xff, 1, 2, 3]));
  check('SEC-P3', 'A04', 'Malformed frame → 400', malformed.status === 400, malformed.status);
  const inj = await post('protect', frame({ userPassword: 'a\n--decrypt\n--show-npages' }, pdf));
  check('SEC-P4', 'A03', 'Argument injection via newline in password refused', inj.status === 400, `${inj.status} ${inj.body}`);
  const dash = await post('protect', frame({ userPassword: '--help' }, pdf));
  check('SEC-P5', 'A03', 'Password that looks like an option is treated as a password', dash.status === 200 && dash.body.subarray(0, 5).toString() === '%PDF-' && dash.body.includes('/Encrypt'), dash.status);
  const prot = await post('protect', frame({ userPassword: 'S3cretPW!-evidence', allowPrint: false }, pdf));
  check('SEC-P6', 'A02', 'Protect returns an AES-encrypted PDF', prot.status === 200 && prot.body.includes('/Encrypt'), prot.status);
  const qpdf = spawnSync(process.env.QPDF_PATH, ['--show-encryption', '--password=S3cretPW!-evidence', '-'], { input: prot.body });
  const encInfo = qpdf.stdout?.toString() || '';
  const qpdfFile = path.join(OUT, 'protected-sample.pdf');
  fs.writeFileSync(qpdfFile, prot.body);
  const show = spawnSync(process.env.QPDF_PATH, ['--show-encryption', '--password=S3cretPW!-evidence', qpdfFile], { encoding: 'utf8' });
  log(`\n$ qpdf --show-encryption protected-sample.pdf\n${show.stdout || encInfo}`);
  check('SEC-P7', 'A02', 'Encryption is AES-256 (V5/R6) with printing disallowed', /AESv3|AES-256|R = 6/i.test(show.stdout) && /print[^\n]*: not allowed/i.test(show.stdout), (show.stdout || '').split('\n').slice(0, 4).join(' | '));
  const wrong = await post('unlock', frame({ password: 'nope' }, prot.body));
  check('SEC-P8', 'A07', 'Unlock with wrong password → 400 "Wrong password"', wrong.status === 400 && /Wrong password/.test(wrong.body), wrong.status);
  const again = await post('protect', frame({ userPassword: 'x1' }, prot.body));
  check('SEC-P9', 'A04', 'Re-protecting an encrypted PDF refused', again.status === 400, again.status);
  const xo = await post('compress', frame({}, pdf), { Origin: 'http://evil.example' });
  check('SEC-P10', 'A01', 'Cross-origin POST refused (403)', xo.status === 403, xo.status);
  const get = await raw(PORT, 'GET', '/api/pdf/protect');
  check('SEC-P11', 'A05', 'GET on a POST endpoint → 405', get.status === 405, get.status);
  const op = await post('shell', frame({}, pdf));
  check('SEC-P12', 'A01', 'Unknown PDF operation → 404', op.status === 404, op.status);
  await wait(300);
  const tmpAfter = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('dtk-')).length;
  check('SEC-P13', 'A04', 'No temporary files left behind after jobs', tmpAfter === tmpBefore, `before ${tmpBefore}, after ${tmpAfter}`);
} else {
  check('SEC-P0', 'A04', 'PDF API abuse cases (skipped: QPDF_PATH not set)', true, 'skipped');
}

log('\n## Logging (A09)');
await raw(PORT, 'GET', '/api/health?token=SECRET-QUERY-VALUE');
await raw(PORT, 'GET', '/missing-file-name-evidence.pdf');
await wait(300);
const logText = s1.lines.join('\n');
fs.writeFileSync(path.join(OUT, 'server-log-sample.txt'), logText);
const jsonLines = s1.lines.filter((l) => l.startsWith('{'));
check('SEC-L1', 'A09', 'Log lines are structured JSON metadata', jsonLines.length > 0 && jsonLines.every((l) => ['ts', 'method', 'path', 'status', 'ms', 'ip'].every((k) => k in JSON.parse(l))), `${jsonLines.length} lines`);
check('SEC-L2', 'A09', 'Logs never contain query strings, passwords or request bodies', !/SECRET-QUERY-VALUE|S3cretPW|--decrypt|%PDF/.test(logText), 'searched for token, password and PDF body markers');
s1.p.kill();

log('\n## Rate limiting (SEC-2)');
const s2 = startNode(PORT + 1);
await wait(1200);
let firstLimited = 0;
for (let i = 1; i <= 32; i++) {
  const r = await raw(PORT + 1, 'POST', '/api/pdf/compress', { body: Buffer.from('x'), headers: { 'Content-Length': 1 } });
  if (r.status === 429 && !firstLimited) {
    firstLimited = i;
    check('SEC-R2', 'A04', '429 carries Retry-After', r.headers['retry-after'] === '60', r.headers['retry-after']);
  }
}
check('SEC-R1', 'A04', '31st API request within a minute is rate-limited (limit 30/min/IP)', firstLimited === 31, `first 429 at request ${firstLimited}`);
s2.p.kill();

log('\n## IP allow-list (A01)');
const s3 = startNode(PORT + 2, { ALLOW_CIDRS: '10.0.0.0/8' });
await wait(1200);
const denied = await raw(PORT + 2, 'GET', '/');
check('SEC-I1', 'A01', 'Client outside ALLOW_CIDRS gets 403', denied.status === 403 && /restricted/i.test(denied.body.toString()), denied.status);
s3.p.kill();
const s3b = startNode(PORT + 3, { ALLOW_CIDRS: '127.0.0.0/8,::1/128' });
await wait(1200);
const allowed = await raw(PORT + 3, 'GET', '/');
check('SEC-I2', 'A01', 'Client inside ALLOW_CIDRS is served', allowed.status === 200, allowed.status);
s3b.p.kill();

log('\n## TLS (A02)');
const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dtk-tls-'));
const ossl = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(certDir, 'k.pem'), '-out', path.join(certDir, 'c.pem'), '-days', '1', '-subj', '/CN=localhost'], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
if (ossl.status === 0) {
  const s4 = startNode(PORT + 4, { TLS_CERT: path.join(certDir, 'c.pem'), TLS_KEY: path.join(certDir, 'k.pem') });
  await wait(1500);
  const t12 = await raw(PORT + 4, 'GET', '/', { tls: true, tlsOpts: { minVersion: 'TLSv1.2' } });
  check('SEC-TLS1', 'A02', 'HTTPS works with TLS 1.2+', t12.status === 200, t12.status || t12.error);
  check('SEC-TLS2', 'A02', 'HSTS sent over HTTPS', /max-age=31536000/.test(t12.headers['strict-transport-security'] || ''), t12.headers['strict-transport-security']);
  const t11 = await raw(PORT + 4, 'GET', '/', { tls: true, tlsOpts: { maxVersion: 'TLSv1.1', minVersion: 'TLSv1' } });
  check('SEC-TLS3', 'A02', 'TLS 1.0/1.1 refused', t11.status === 0, t11.error || t11.status);
  s4.p.kill();
} else {
  check('SEC-TLS0', 'A02', 'TLS tests (skipped: openssl unavailable)', true, 'skipped');
}
fs.rmSync(certDir, { recursive: true, force: true });

log('\n## Python fallback server');
const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['--version'], { encoding: 'utf8' });
if (py.status === 0) {
  const pp = spawn(process.platform === 'win32' ? 'python' : 'python3', ['server/serve.py'], { env: { ...process.env, PORT: String(PORT + 5) }, stdio: 'ignore' });
  await wait(2000);
  const ph = await raw(PORT + 5, 'GET', '/');
  check('SEC-PY1', 'A05', 'Python server sends the same CSP and security headers', ph.headers['content-security-policy'] === csp && ph.headers['x-frame-options'] === 'DENY' && ph.headers['x-content-type-options'] === 'nosniff', ph.status);
  const pt = await raw(PORT + 5, 'GET', '/../server/serve.py');
  check('SEC-PY2', 'A01', 'Python server blocks traversal', pt.status === 404 && !/http\.server/.test(pt.body.toString()), pt.status);
  const pl = await raw(PORT + 5, 'GET', '/assets/');
  check('SEC-PY3', 'A01', 'Python server never lists directories', pl.status === 404, pl.status);
  const pp2 = await raw(PORT + 5, 'POST', '/');
  check('SEC-PY4', 'A05', 'Python server rejects POST', pp2.status === 405 || pp2.status === 501, pp2.status);
  pp.kill();
}

fs.writeFileSync(path.join(OUT, 'security-transcript.txt'), transcript.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'security-results.json'), JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} security checks passed`);
process.exit(failed.length ? 1 : 0);
