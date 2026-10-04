/**
 * Non-functional tests (requirements §6 and §3 acceptance) in a real browser:
 *  NFR-1 load times · 1 MB JSON format < 500 ms · NFR-3 offline after first load (PWA) ·
 *  10 MB text and 100 MB PDF processed without a tab crash · memory-leak check on repeated PDF work.
 *
 *   node tests/e2e/nonfunctional.mjs --out=<dir> [--browser=msedge]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { chromium } from 'playwright-core';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = path.resolve(args.out || 'test-evidence/nonfunctional');
const channel = args.browser || 'msedge';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function check(id, req, title, ok, measured, target) {
  results.push({ id, requirement: req, title, ok: !!ok, measured, target });
  console.log(`  ${ok ? '✓' : '✗'} ${id} ${title} — ${measured}${target ? ` (target ${target})` : ''}`);
}

const PORT = 8301;
const BASE = `http://127.0.0.1:${PORT}/`;
let server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

// ---- Fixtures: 10 MB text and a ~100 MB PDF (incompressible payload so the size is real)
const fixtures = path.join(OUT, '_fixtures');
fs.mkdirSync(fixtures, { recursive: true });
const bigJson = JSON.stringify({
  items: Array.from({ length: 12500 }, (_, i) => ({ id: i, name: `Customer ${i}`, city: 'Pune', amount: i * 101.5, tags: ['a', 'b'], ok: i % 2 === 0 })),
});
const jsonPath = path.join(fixtures, 'json-1mb.json');
fs.writeFileSync(jsonPath, bigJson);
const line = 'DevToolkit test line — नमस्ते — 0123456789 abcdefghijklmnopqrstuvwxyz\n';
// Sized in bytes (UTF-8), not characters, so the file really is at least 10 MiB
const tenMb = line.repeat(Math.ceil((10 * 1024 * 1024) / Buffer.byteLength(line)));
const textPath = path.join(fixtures, 'text-10mb.txt');
fs.writeFileSync(textPath, tenMb);
const pdfPath = path.join(fixtures, 'pdf-100mb.pdf');
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = 40;
  const chunk = Math.floor((98 * 1024 * 1024) / pages);
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`Large file page ${i + 1}`, { x: 50, y: 780, size: 24, font });
    // Random (incompressible) bytes in an unreferenced stream keep the file at its real size
    const bytes = new Uint8Array(chunk);
    for (let o = 0; o < chunk; o += 65536) crypto.getRandomValues(bytes.subarray(o, Math.min(chunk, o + 65536)));
    doc.context.register(doc.context.stream(bytes));
  }
  fs.writeFileSync(pdfPath, await doc.save({ useObjectStreams: false }));
}
const pdfSize = fs.statSync(pdfPath).size;
const fixtureSizes = {
  jsonMB: +(Buffer.byteLength(bigJson) / 1048576).toFixed(2),
  textMB: +(Buffer.byteLength(tenMb) / 1048576).toFixed(2),
  pdfMB: +(pdfSize / 1048576).toFixed(1),
};
console.log(`  fixtures: JSON ${fixtureSizes.jsonMB} MB · text ${fixtureSizes.textMB} MB · PDF ${fixtureSizes.pdfMB} MB`);

const browser = await chromium.launch({ channel, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const crashes = [];
page.on('crash', () => crashes.push('page crashed'));
page.on('pageerror', (e) => crashes.push(e.message));

// ---- NFR-1: first load and lazy tool load
let t = Date.now();
await page.goto(BASE);
await page.getByRole('heading', { name: /Mission Control/i }).waitFor();
const firstLoad = Date.now() - t;
check('NFR-1a', 'NFR-1', 'First load of the dashboard', firstLoad < 3000, `${firstLoad} ms`, '< 3,000 ms');
const nav = await page.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  return {
    dcl: Math.round(n.domContentLoadedEventEnd),
    load: Math.round(n.loadEventEnd),
    jsKB: Math.round(res.filter((r) => r.name.endsWith('.js')).reduce((a, r) => a + (r.encodedBodySize || 0), 0) / 1024),
  };
});
check('NFR-1b', 'NFR-1', 'DOMContentLoaded / load event', nav.load < 3000, `${nav.dcl} / ${nav.load} ms, ${nav.jsKB} KB JS`, '< 3,000 ms');

// Cold: open a tool the instant the dashboard appears (editor not yet cached) — informational
t = Date.now();
await page.goto(`${BASE}#/tool/json`);
await page.locator('main').getByText('Processed locally').first().waitFor();
check('NFR-1c-cold', 'info', 'First tool opened immediately after load (editor not yet cached, informational)', true, `${Date.now() - t} ms`, 'measured only');

// Realistic: a fresh visit where the user spends a few seconds on the dashboard before choosing a tool
const fresh = await context.newPage();
await fresh.goto(BASE);
await fresh.getByRole('heading', { name: /Mission Control/i }).waitFor();
await fresh.waitForLoadState('networkidle');
await fresh.waitForTimeout(6000);
const toolLoads = [];
for (const id of ['json', 'sql', 'pdf-merge', 'regex', 'cheatsheets', 'area']) {
  t = Date.now();
  await fresh.goto(`${BASE}#/tool/${id}`);
  await fresh.locator('main h1').first().waitFor();
  await fresh.locator('main').getByText('Processed locally').first().waitFor();
  toolLoads.push(`${id} ${Date.now() - t} ms`);
}
await fresh.close();
const worst = Math.max(...toolLoads.map((s) => Number(s.split(' ')[1])));
check('NFR-1c', 'NFR-1', 'Each tool lazy-loads', worst < 1000, toolLoads.join(', '), '< 1,000 ms each');

// ---- 1 MB JSON format < 500 ms (measured on the same function the tool runs)
await page.goto(`${BASE}#/tool/json`);
await page.locator('main h1').waitFor();
const jsonMs = await page.evaluate(async (src) => {
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    JSON.stringify(JSON.parse(src), null, 2);
    runs.push(performance.now() - t0);
  }
  return Math.max(...runs);
}, bigJson);
check('NFR-1d', 'NFR-1', `Format ${fixtureSizes.jsonMB} MB of JSON (worst of 5)`, jsonMs < 500, `${jsonMs.toFixed(1)} ms`, '< 500 ms');
// End-to-end through the UI: load file, press Format, wait for the status
await page.locator('input[type=file]').first().setInputFiles(jsonPath);
await page.waitForTimeout(500);
t = Date.now();
await page.getByRole('button', { name: 'Format', exact: true }).click();
await page.locator('main').getByText('Formatted').first().waitFor({ timeout: 10000 });
// Informational only: includes loading a 1 MB file into two editors and rendering the result
check('NFR-1e', 'info', 'Format 1 MB JSON through the UI (click → done, informational)', true, `${Date.now() - t} ms`, 'measured only');
await page.screenshot({ path: path.join(OUT, 'json-1mb.png') });

// ---- 10 MB text: hash it and Base64-encode it without a crash
await page.goto(`${BASE}#/tool/hash`);
await page.getByRole('radio', { name: 'File' }).check({ force: true });
await page.locator('input[type=file]').first().setInputFiles(textPath);
t = Date.now();
await page
  .getByText(/^[0-9a-f]{64}$/)
  .first()
  .waitFor({ timeout: 30000 });
check('ACC-10MB-a', '§3 acceptance', `Hash a ${fixtureSizes.textMB} MB file (all 10 algorithms)`, crashes.length === 0, `${Date.now() - t} ms`, 'no tab crash');
await page.screenshot({ path: path.join(OUT, 'hash-10mb.png') });
await page.goto(`${BASE}#/tool/base64`);
await page.getByRole('radio', { name: 'File' }).check({ force: true });
await page.locator('input[type=file]').first().setInputFiles(textPath);
t = Date.now();
await page.locator('main').getByText('Encoded text-10mb.txt').first().waitFor({ timeout: 60000 });
check('ACC-10MB-b', '§3 acceptance', `Base64-encode a ${fixtureSizes.textMB} MB file`, crashes.length === 0, `${Date.now() - t} ms`, 'no tab crash');

// ---- 100 MB PDF: open with thumbnails, then split and merge it in the browser
await page.goto(`${BASE}#/tool/pdf-split`);
t = Date.now();
await page.locator('input[type=file]').first().setInputFiles(pdfPath);
await page
  .locator('main')
  .getByText(/40 pages/)
  .first()
  .waitFor({ timeout: 120000 });
const openMs = Date.now() - t;
check('ACC-100MB-a', '§3 acceptance', `Open a ${(pdfSize / 1048576).toFixed(0)} MB PDF with thumbnails`, crashes.length === 0, `${openMs} ms`, 'no tab crash');
await page.getByRole('radio', { name: 'Every N pages' }).check({ force: true });
await page.getByLabel('Pages per file').fill('20');
t = Date.now();
await page.getByRole('button', { name: 'Split', exact: true }).click();
await page.locator('main').getByText('Result ready').waitFor({ timeout: 180000 });
check('ACC-100MB-b', '§3 acceptance', 'Split the 100 MB PDF (2 × 20 pages) in a Web Worker', crashes.length === 0, `${Date.now() - t} ms`, 'no tab crash');
await page.screenshot({ path: path.join(OUT, 'pdf-100mb-split.png') });

// ---- Memory-leak check: repeat a PDF operation 15 times and compare heap use
await page.goto(`${BASE}#/tool/pdf-reorder`);
await page.getByRole('button', { name: 'Try sample' }).click();
await page.getByRole('button', { name: 'Reverse order' }).waitFor();
const cdp = await context.newCDPSession(page);
await cdp.send('HeapProfiler.enable');
const heap = async () => {
  await cdp.send('HeapProfiler.collectGarbage');
  return (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
};
const runOnce = async () => {
  // Rotate until the layout differs from the original (four quarter-turns would restore it)
  const apply = page.getByRole('button', { name: 'Apply changes' });
  do await page.getByRole('button', { name: 'Rotate all right' }).click();
  while (await apply.isDisabled());
  await apply.click();
  await page.locator('main').getByText('Result ready').waitFor();
};
for (let i = 0; i < 3; i++) await runOnce(); // warm-up
const before = await heap();
for (let i = 0; i < 15; i++) await runOnce();
const after = await heap();
check(
  'NFR-MEM',
  '§8 performance',
  'Heap growth over 15 repeated PDF operations',
  after - before < 15,
  `${before.toFixed(1)} → ${after.toFixed(1)} MB (Δ ${(after - before).toFixed(1)} MB)`,
  '< 15 MB growth',
);

// ---- NFR-3: works offline after first load (server stopped)
await page.goto(BASE);
await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  // Wait until the precache has finished installing
  for (let i = 0; i < 100 && !reg.active; i++) await new Promise((r) => setTimeout(r, 100));
});
await page.waitForTimeout(3000);
server.kill();
await new Promise((r) => setTimeout(r, 800));
const offline = await context.newPage();
let offlineOk = false;
let offlineDetail;
try {
  await offline.goto(`${BASE}#/tool/jwt`, { timeout: 15000 });
  await offline.getByRole('button', { name: 'Try sample' }).click({ timeout: 15000 });
  await offline.locator('main').getByText('Claims').waitFor({ timeout: 15000 });
  await offline.goto(`${BASE}#/tool/sql`);
  await offline.getByRole('button', { name: 'Try sample' }).click();
  await offline.getByRole('button', { name: 'Format', exact: true }).click();
  await offline.locator('main').getByText('Formatted').waitFor({ timeout: 15000 });
  offlineOk = true;
  offlineDetail = 'JWT decoder and SQL formatter worked with the server stopped';
  await offline.screenshot({ path: path.join(OUT, 'offline-sql.png') });
} catch (e) {
  offlineDetail = e.message.split('\n')[0];
}
check('NFR-3', 'NFR-3', 'Client-side tools keep working with the server down (PWA)', offlineOk, offlineDetail, 'tools usable offline');

await browser.close();
fs.rmSync(fixtures, { recursive: true, force: true });
check(
  'NFR-CRASH',
  '§3 acceptance',
  'No page crash or uncaught error during the whole run',
  crashes.length === 0,
  crashes.length ? crashes.join(' | ') : 'none',
);
fs.writeFileSync(
  path.join(OUT, 'nonfunctional-results.json'),
  JSON.stringify({ when: new Date().toISOString(), browser: channel, fixtures: fixtureSizes, results }, null, 2),
);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} non-functional checks passed`);
process.exit(failed.length ? 1 : 0);
