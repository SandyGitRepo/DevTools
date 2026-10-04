/**
 * Browser smoke test: loads every implemented tool in a real Chromium-based browser served by
 * server/server.mjs (so the production CSP is enforced), runs each tool's sample + primary action,
 * and fails on console errors, CSP violations, error alerts or failed expectations.
 *
 *   node tests/e2e/smoke.mjs [--browser=msedge|chrome] [--shots=<dir>]
 * Requires a build (npm run build). Uses an installed Edge/Chrome; downloads nothing.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright-core';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const channel = args.browser || 'msedge';
const shots = args.shots;
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}/`;

// Tools and what a successful sample run should show.
const TOOLS = {
  json: { expect: /Formatted/ },
  sql: { expect: /Formatted/ },
  java: { expect: /syntax OK/, timeout: 20000 },
  javascript: { expect: /Formatted/ },
  'html-css': { expect: /Formatted/ },
  xml: { expect: /Formatted/ },
  'yaml-md': { expect: /Formatted/ },
  diff: { expect: /semantic change/ },
  base64: { expect: /Encoded/ },
  url: { expect: /Encoded/ },
  'html-entities': { expect: /Encoded/ },
  'base-n': { expect: /Encoded/ },
  unicode: { expect: /Escaped/ },
  jwt: { expect: /Signature VALID/, action: 'Verify' },
  cert: { expect: /Decoded 1 block/, noAction: true },
  gzip: { expect: /→/ },
  hash: { expect: /Match/, noAction: true },
  hmac: { expect: /Signature matches/, noAction: true },
  'password-hash': { expect: /Generated in/, timeout: 20000 },
  aes: { expect: /Encrypted/, timeout: 15000 },
  rsa: { expect: /Encrypted with the public key/, action: 'Encrypt', timeout: 20000 },
  keygen: { expect: /BEGIN PUBLIC KEY/, action: 'Generate key pair', noSample: true, timeout: 20000 },
  'file-encrypt': { noSample: true, noAction: true },

  // ---- Phase 2: PDF tools (samples are generated in the browser) ----
  'pdf-merge': { action: /^Merge \d+ PDFs$/, expect: /Result ready/, timeout: 20000 },
  'pdf-split': { action: 'Split', expect: /Result ready/, timeout: 20000 },
  'pdf-delete': { steps: pick('Pages to delete', '2, 4', /^Delete 2 pages$/), expect: /Result ready/, timeout: 20000 },
  'pdf-extract': { steps: pick('Pages to extract', '1-3', /^Extract 3 pages$/), expect: /Result ready/, timeout: 20000 },
  'pdf-reorder': { steps: clicks('Reverse order', 'Apply changes'), expect: /Result ready/, timeout: 20000 },
  'pdf-insert': { action: 'Insert', expect: /Result ready/, timeout: 20000 },
  'pdf-image': { action: 'Convert to PNG', expect: /Rendered 3 page/, timeout: 30000 },
  'pdf-watermark': { action: 'Apply', expect: /Result ready/, timeout: 20000 },
  'pdf-metadata': { action: 'Strip all metadata', expect: /Result ready/, timeout: 20000 },
  'pdf-protect': process.env.QPDF_PATH
    ? { server: true, steps: protectSteps, expect: /Protected with AES-256/, timeout: 30000 }
    : { server: true, noSample: true, noAction: true, expect: /not available/ },
  'pdf-compress': process.env.QPDF_PATH
    ? { server: true, action: 'Compress', expect: /smaller|well compressed/, timeout: 30000 }
    : { server: true, noSample: true, noAction: true, expect: /not available/ },

  // ---- Phase 2: data converters ----
  'csv-json': { expect: /4 rows/ },
  'json-yaml-xml': { expect: /Converted JSON → YAML/ },
  excel: { noAction: true, expect: /3 rows × 6 columns/, timeout: 15000 },
  'json-code': { expect: /Generated/, timeout: 30000 },
  'sql-insert': { expect: /3 row\(s\) → INSERT/ },

  // ---- Phase 3: utilities, units, cheat sheets ----
  regex: { noAction: true, expect: /4 matches/ },
  timestamp: { noAction: true, expect: /2026-10-10T10:56:40\+05:30/ },
  cron: { noAction: true, expect: /Monday through Friday/ },
  'text-tools': { action: 'snake_case', expect: /UTF-8 bytes/ },
  'number-base': { noAction: true, expect: /DEADBEEF/ },
  qr: { noSample: true, noAction: true, steps: async (page) => page.locator('img[alt="Generated QR code"]').waitFor({ timeout: 10000 }) },
  colour: { noAction: true, expect: /: 1$/ },
  masker: { noAction: true, expect: /items masked/ },
  'test-data': { noAction: true, expect: /Generated 25 test records/, timeout: 15000 },
  length: { noAction: true, expect: /5′ 8″/ },
  height: { noAction: true, steps: inputEquals('#h-cm', '172.72') },
  area: { noAction: true, steps: inputEquals('#unit-sqft', '2400') },
  'carpet-area': { noAction: true, expect: /Carpet is/ },
  'other-units': { noAction: true, steps: inputEquals('#unit-f', '98.6') },
  cheatsheets: { noSample: true, noAction: true, steps: cheatSheetSteps },
};

function inputEquals(selector, value) {
  return async (page) => {
    const el = page.locator(selector);
    await el.waitFor({ timeout: 8000 });
    for (let i = 0; i < 20 && (await el.inputValue()) !== value; i++) await page.waitForTimeout(100);
    const v = await el.inputValue();
    if (v !== value) throw new Error(`${selector} is "${v}", expected "${value}"`);
  };
}

async function cheatSheetSteps(page) {
  await page.getByLabel('Search cheat sheets').fill('rebase');
  await page
    .getByRole('status')
    .filter({ hasText: /result.* in .* ms/ })
    .waitFor();
  await page.getByRole('option', { name: /^Rebase/ }).click();
  await page.locator('section#git--rebase').waitFor();
  await page.getByRole('button', { name: 'SQL (Oracle + PostgreSQL)' }).click();
  await page
    .getByRole('button', { name: /Try this sql snippet/ })
    .first()
    .click();
  await page.getByRole('heading', { name: 'SQL Formatter' }).waitFor();
  await page
    .getByText(/[1-9]\d* chars/)
    .first()
    .waitFor();
}

function pick(label, ranges, button) {
  return async (page) => {
    await page.getByLabel(label).fill(ranges);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('button', { name: button }).click();
  };
}
function clicks(...names) {
  return async (page) => {
    for (const n of names) {
      const b = page.getByRole('button', { name: n, exact: true });
      await b.waitFor({ timeout: 10000 });
      await b.click();
    }
  };
}
async function protectSteps(page) {
  await page.getByLabel('Open password', { exact: true }).fill('demo-pass-123');
  await page.getByLabel('Confirm open password').fill('demo-pass-123');
  await page.getByRole('button', { name: 'Protect PDF' }).click();
}

const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({ channel, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
await context.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

if (shots) mkdirSync(shots, { recursive: true });
const failures = [];
const t0 = Date.now();

await page.goto(BASE);
await page.getByRole('heading', { name: /Mission Control/i }).waitFor();
const firstLoad = Date.now() - t0;
if (shots) await page.screenshot({ path: path.join(shots, 'home.png') });

// Command palette
await page.keyboard.press('Control+k');
await page.getByRole('combobox').fill('jwt');
await page.keyboard.press('Enter');
await page.getByRole('heading', { name: 'JWT Decoder' }).waitFor();

for (const [id, spec] of Object.entries(TOOLS)) {
  const before = consoleErrors.length;
  try {
    await page.goto(`${BASE}#/tool/${id}`);
    await page.locator('h1').first().waitFor({ timeout: 10000 });
    await page
      .locator('main')
      .getByText(spec.server ? 'Processed on internal server' : 'Processed locally')
      .first()
      .waitFor({ timeout: 5000 });
    if (!spec.noSample) await page.getByRole('button', { name: 'Try sample' }).click();
    if (spec.steps) await spec.steps(page);
    else if (!spec.noAction) {
      const btn = spec.action
        ? page.getByRole('button', { name: spec.action, exact: typeof spec.action === 'string' })
        : page.locator('main button.hud-btn-accent:not([disabled])').first();
      await btn.waitFor({ timeout: 8000 });
      await page.waitForTimeout(300);
      await btn.click();
    }
    if (spec.expect)
      await page
        .locator('main')
        .getByText(spec.expect)
        .first()
        .waitFor({ timeout: spec.timeout ?? 8000 });
    const alerts = await page.locator('main [role=alert]').allInnerTexts();
    if (alerts.length) throw new Error(`alert: ${alerts.join(' | ')}`);
    const csp = await page.evaluate(() => window.__csp.splice(0));
    if (csp.length) throw new Error(`CSP violation: ${csp.join(', ')}`);
    if (consoleErrors.length > before) throw new Error(`console: ${consoleErrors.slice(before).join(' | ')}`);
    if (shots) await page.screenshot({ path: path.join(shots, `${id}.png`) });
    console.log(`  ✓ ${id}`);
  } catch (e) {
    failures.push(`${id}: ${e.message.split('\n')[0]}`);
    console.log(`  ✗ ${id} — ${e.message.split('\n')[0]}`);
    if (shots) await page.screenshot({ path: path.join(shots, `FAIL-${id}.png`) });
  }
}

// Light theme + narrow (tablet) layout
await page.goto(`${BASE}#/tool/json`);
await page.getByRole('button', { name: /Switch to light mode/ }).click();
await page.setViewportSize({ width: 768, height: 1000 });
if (shots) await page.screenshot({ path: path.join(shots, 'json-light-768.png') });

// Offline: service worker should serve the app with the server stopped (NFR-3)
const swReady = await page.evaluate(async () => !!(await navigator.serviceWorker?.ready.then((r) => r.active).catch(() => null)));

// ---- Accessibility (section 8: axe-core, 0 serious/critical) ----
// axe is injected as a script, so this pass uses its own context with CSP bypassed.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const a11yContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, bypassCSP: true });
const a11yPage = await a11yContext.newPage();
const a11yIssues = [];
const A11Y_ROUTES = ['', 'tool/json', 'tool/regex', 'tool/pdf-reorder', 'tool/area', 'tool/masker', 'tool/cheatsheets', 'module/pdf', 'about'];
for (const theme of ['dark', 'light']) {
  for (const route of A11Y_ROUTES) {
    await a11yPage.goto(`${BASE}#/${route}`);
    if (theme === 'light') await a11yPage.evaluate(() => localStorage.setItem('devtoolkit.prefs.v1', JSON.stringify({ theme: 'light' })));
    if (theme === 'light') await a11yPage.reload();
    await a11yPage.locator('main h1, main h2').first().waitFor({ timeout: 10000 });
    const sample = a11yPage.getByRole('button', { name: 'Try sample' });
    if (await sample.count()) await sample.click();
    await a11yPage.waitForTimeout(800);
    await a11yPage.addScriptTag({ content: axeSource });
    const res = await a11yPage.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      return r.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          sample: v.nodes[0]?.target?.join(' '),
          summary: v.nodes[0]?.failureSummary?.split('\n')[1]?.trim(),
        }));
    });
    for (const v of res) a11yIssues.push(`${theme} /${route || 'home'}: ${v.id} (${v.impact}, ${v.nodes}×) e.g. ${v.sample} — ${v.summary ?? ''}`);
    console.log(`  ${res.length ? '✗' : '✓'} a11y ${theme} /${route || 'home'}${res.length ? ` — ${res.length} issue type(s)` : ''}`);
  }
}
await a11yContext.close();
if (a11yIssues.length) failures.push(...a11yIssues.map((i) => `a11y ${i}`));

await browser.close();
server.kill();

console.log(`\nFirst load: ${firstLoad} ms · service worker active: ${swReady}`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`All ${Object.keys(TOOLS).length} tools passed; accessibility clean (WCAG 2.1 AA, serious/critical).`);
