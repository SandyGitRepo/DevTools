#!/usr/bin/env node
/**
 * Runs every quality gate from requirements §8 and keeps the evidence:
 *   test-evidence/<timestamp>/  logs · JUnit XML · coverage HTML · screenshots · JSON results ·
 *                               security transcript · SBOM · release verification · REPORT.md
 *
 *   node scripts/test-all.mjs            (set QPDF_PATH to include the server-side PDF API tests)
 */
import { spawnSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { unzipSync } from 'fflate';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
process.chdir(root);
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const OUT = path.join(root, 'test-evidence', stamp);
fs.mkdirSync(OUT, { recursive: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gates = [];

// eslint-disable-next-line no-control-regex -- ESC starts the ANSI colour codes we strip from tool output
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function run(name, file, cmd, cmdArgs, opts = {}) {
  const t0 = Date.now();
  process.stdout.write(`▶ ${name} … `);
  const r = spawnSync(cmd, cmdArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', ...opts.env },
  });
  const out = stripAnsi(`$ ${cmd} ${cmdArgs.join(' ')}\n# exit ${r.status} · ${((Date.now() - t0) / 1000).toFixed(1)} s\n\n${r.stdout ?? ''}${r.stderr ?? ''}`);
  fs.writeFileSync(path.join(OUT, file), out);
  const ok = opts.allowFail ? true : r.status === 0;
  console.log(`${r.status === 0 ? 'PASS' : opts.allowFail ? 'INFO' : 'FAIL'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  return { ok, status: r.status, out, ms: Date.now() - t0 };
}

function gate(id, title, ok, evidence, detail = '') {
  gates.push({ id, title, ok, evidence, detail });
}

// ---------------------------------------------------------------- environment
const sh = (c, a) => spawnSync(c, a, { encoding: 'utf8', shell: process.platform === 'win32' }).stdout?.trim() ?? '';
const env = {
  when: new Date().toISOString(),
  os: `${os.type()} ${os.release()} (${os.arch()})`,
  cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
  memoryGB: +(os.totalmem() / 1073741824).toFixed(1),
  node: process.version,
  npm: sh(npm, ['-v']),
  python: sh(process.platform === 'win32' ? 'python' : 'python3', ['--version']),
  git: {
    commit: sh('git', ['rev-parse', '--short', 'HEAD']),
    branch: sh('git', ['branch', '--show-current']),
    uncommittedFiles: sh('git', ['status', '--porcelain']).split('\n').filter(Boolean).length,
  },
  qpdf: process.env.QPDF_PATH ? sh(process.env.QPDF_PATH, ['--version']).split('\n')[0] : 'not configured (QPDF_PATH unset)',
  version: JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
};
fs.writeFileSync(path.join(OUT, '00-environment.json'), JSON.stringify(env, null, 2));
console.log(`Evidence folder: ${path.relative(root, OUT)}\n`);

// ---------------------------------------------------------------- static analysis
const lint = run('Lint (ESLint, incl. no-eval rules)', '01-lint.log', npx, ['eslint', '.']);
gate('G1', 'Lint — ESLint incl. no-eval / no-new-func', lint.ok, '01-lint.log');
const types = run('Type-check (TypeScript strict)', '02-typecheck.log', npx, ['tsc', '--noEmit', '-p', '.']);
gate('G2', 'Type-check — TypeScript strict mode', types.ok, '02-typecheck.log');

// ---------------------------------------------------------------- unit, KAT, property, fuzz + coverage
fs.mkdirSync(path.join(OUT, 'unit'), { recursive: true });
const unit = run('Unit + known-answer + property + fuzz tests with coverage', '03-unit-tests.log', npx, [
  'vitest',
  'run',
  '--reporter=default',
  '--reporter=junit',
  `--outputFile.junit=${path.join(OUT, 'unit', 'junit.xml')}`,
  '--coverage.enabled=true',
  '--coverage.provider=v8',
  '--coverage.include=src/lib/**',
  '--coverage.reporter=text',
  '--coverage.reporter=html',
  '--coverage.reporter=json-summary',
  `--coverage.reportsDirectory=${path.join(OUT, 'unit', 'coverage')}`,
]);
const testsLine = unit.out.match(/Tests\s+(\d+) passed(?: \((\d+)\))?/);
let coverage = null;
try {
  coverage = JSON.parse(fs.readFileSync(path.join(OUT, 'unit', 'coverage', 'coverage-summary.json'), 'utf8'));
} catch {
  /* coverage missing */
}
const covPct = coverage?.total?.lines?.pct;
gate(
  'G3',
  'Unit, known-answer (NIST/RFC), property-based (1,000 cases) and fuzz tests',
  unit.ok,
  '03-unit-tests.log · unit/junit.xml',
  testsLine ? `${testsLine[1]} tests passed` : '',
);
const dirPct = (prefix) => {
  if (!coverage) return null;
  let total = 0;
  let covered = 0;
  for (const [file, v] of Object.entries(coverage)) {
    if (file !== 'total' && file.replace(/\\/g, '/').includes(prefix)) {
      total += v.lines.total;
      covered += v.lines.covered;
    }
  }
  return total ? +((covered / total) * 100).toFixed(1) : null;
};
const covCrypto = dirPct('src/lib/crypto/');
const covPdf = dirPct('src/lib/pdf/');
gate(
  'G4',
  'Line coverage of logic (src/lib) ≥ 85 %',
  covPct >= 85,
  'unit/coverage/index.html',
  `${covPct ?? '?'} % overall · crypto ${covCrypto ?? '?'} % · pdf ${covPdf ?? '?'} % (target 100 % for crypto and PDF)`,
);

// ---------------------------------------------------------------- supply chain
const lic = run('Licence allow-list', '04-licences.log', 'node', ['scripts/check-licenses.mjs']);
fs.copyFileSync('LICENSES.md', path.join(OUT, '04-LICENSES.md'));
gate(
  'G5',
  'Licence allow-list (MIT/Apache/BSD/ISC…) for production dependencies',
  lic.ok,
  '04-licences.log · 04-LICENSES.md',
  lic.out.match(/(\d+) production packages/)?.[0] ?? '',
);
const audit = run('npm audit (production)', '05-npm-audit.log', npm, ['audit', '--omit=dev', '--audit-level=high'], { allowFail: true });
const auditJson = spawnSync(npm, ['audit', '--omit=dev', '--json'], { encoding: 'utf8', shell: process.platform === 'win32' }).stdout;
fs.writeFileSync(path.join(OUT, '05-npm-audit.json'), auditJson);
let vulns = {};
try {
  vulns = JSON.parse(auditJson).metadata.vulnerabilities;
} catch {
  /* ignore */
}
gate(
  'G6',
  'Dependency audit — 0 High/Critical',
  (vulns.high ?? 0) + (vulns.critical ?? 0) === 0 && audit.status !== null,
  '05-npm-audit.log · 05-npm-audit.json',
  JSON.stringify(vulns),
);
const sbom = run(
  'SBOM (CycloneDX)',
  '06-sbom.log',
  npx,
  ['--yes', '@cyclonedx/cyclonedx-npm', '--omit', 'dev', '--output-file', path.join(OUT, '06-sbom.cdx.json')],
  { allowFail: true },
);
gate(
  'G7',
  'SBOM generated (CycloneDX JSON)',
  fs.existsSync(path.join(OUT, '06-sbom.cdx.json')),
  '06-sbom.cdx.json',
  sbom.status === 0 ? '' : 'generator unavailable (needs network for npx)',
);

// ---------------------------------------------------------------- build
const build = run('Production build', '07-build.log', npm, ['run', 'build']);
const assets = fs.existsSync('dist/assets')
  ? fs
      .readdirSync('dist/assets')
      .map((f) => {
        const b = fs.readFileSync(path.join('dist/assets', f));
        return {
          file: f,
          kb: +(b.length / 1024).toFixed(1),
          gzipKb: /\.(js|css|svg|json)$/.test(f) ? +(zlib.gzipSync(b, { level: 9 }).length / 1024).toFixed(1) : null,
        };
      })
      .sort((a, b) => b.kb - a.kb)
  : [];
fs.writeFileSync(path.join(OUT, '07-bundle-sizes.json'), JSON.stringify(assets, null, 2));
const entry = fs.readFileSync('dist/index.html', 'utf8').match(/assets\/(index-[^"]+\.js)/)?.[1];
const entryGz = assets.find((a) => a.file === entry)?.gzipKb;
gate('G8', 'Production build succeeds', build.ok, '07-build.log · 07-bundle-sizes.json', `entry bundle ${entryGz ?? '?'} KB gzip · ${assets.length} assets`);

// ---------------------------------------------------------------- browser tests
for (const browser of ['msedge', 'chrome']) {
  const dir = path.join(OUT, `e2e-${browser}`);
  fs.mkdirSync(dir, { recursive: true });
  const r = run(`End-to-end: all tools + accessibility in ${browser}`, `08-e2e-${browser}.log`, 'node', [
    'tests/e2e/smoke.mjs',
    `--browser=${browser}`,
    `--shots=${dir}`,
    `--report=${path.join(dir, 'results.json')}`,
    `--port=${browser === 'msedge' ? 8401 : 8402}`,
  ]);
  let rep = null;
  try {
    rep = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));
  } catch {
    /* no report */
  }
  const passed = rep?.tools.filter((t) => t.ok).length ?? 0;
  const total = rep?.tools.length ?? 0;
  gate(
    `G9-${browser}`,
    `End-to-end in ${browser === 'msedge' ? 'Microsoft Edge' : 'Google Chrome'} ${rep?.version ?? ''} under production CSP`,
    r.ok,
    `08-e2e-${browser}.log · e2e-${browser}/`,
    `${passed}/${total} tools · first load ${rep?.firstLoadMs ?? '?'} ms`,
  );
  const serious = rep?.a11y.flatMap((a) => a.violations.filter((v) => ['serious', 'critical'].includes(v.impact))).length ?? -1;
  const minor = rep?.a11y.flatMap((a) => a.violations.filter((v) => !['serious', 'critical'].includes(v.impact))).length ?? 0;
  gate(
    `G10-${browser}`,
    `Accessibility (axe-core, WCAG 2.1 A/AA) — 0 serious/critical (${browser})`,
    serious === 0,
    `e2e-${browser}/results.json`,
    `${rep?.a11y.length ?? 0} scans · ${serious} serious/critical · ${minor} moderate/minor`,
  );
}

// ---------------------------------------------------------------- security
fs.mkdirSync(path.join(OUT, 'security'), { recursive: true });
const sec = run('Security (OWASP controls on real servers)', '09-security.log', 'node', ['tests/e2e/security.mjs', `--out=${path.join(OUT, 'security')}`]);
let secRes = [];
try {
  secRes = JSON.parse(fs.readFileSync(path.join(OUT, 'security', 'security-results.json'), 'utf8')).results;
} catch {
  /* none */
}
gate(
  'G11',
  'Security — headers, traversal, methods, PDF API abuse, rate limit, allow-list, TLS, logging',
  sec.ok,
  '09-security.log · security/',
  `${secRes.filter((r) => r.ok).length}/${secRes.length} checks`,
);

// ---------------------------------------------------------------- non-functional
fs.mkdirSync(path.join(OUT, 'nonfunctional'), { recursive: true });
const nf = run('Non-functional (performance, large files, offline, memory)', '10-nonfunctional.log', 'node', [
  'tests/e2e/nonfunctional.mjs',
  `--out=${path.join(OUT, 'nonfunctional')}`,
]);
let nfRes = [];
try {
  nfRes = JSON.parse(fs.readFileSync(path.join(OUT, 'nonfunctional', 'nonfunctional-results.json'), 'utf8')).results;
} catch {
  /* none */
}
gate(
  'G12',
  'Non-functional — NFR-1 load/format budgets, 10 MB text, 100 MB PDF, NFR-3 offline, memory',
  nf.ok,
  '10-nonfunctional.log · nonfunctional/',
  `${nfRes.filter((r) => r.ok).length}/${nfRes.length} checks`,
);

// ---------------------------------------------------------------- release package
const relLog = [];
const pkg = run('Package release zip', '11-package.log', 'node', ['scripts/package.mjs']);
let relOk = pkg.ok;
const zipPath = `release/devtoolkit-${env.version}.zip`;
if (pkg.ok) {
  const zip = fs.readFileSync(zipPath);
  const sha = crypto.createHash('sha256').update(zip).digest('hex');
  const recorded = fs.readFileSync(`${zipPath}.sha256`, 'utf8').split(/\s+/)[0];
  relLog.push(`SHA-256 computed ${sha}`, `SHA-256 recorded ${recorded}`, `checksum ${sha === recorded ? 'MATCHES' : 'MISMATCH'}`);
  relOk &&= sha === recorded;
  const files = unzipSync(new Uint8Array(zip));
  const names = Object.keys(files);
  const must = ['dist/index.html', 'server/server.mjs', 'server/pdf-api.mjs', 'server/serve.py', 'start.bat', 'start.sh', 'README.md', 'LICENSE', 'Dockerfile'];
  for (const m of must) {
    const ok = names.some((n) => n.endsWith(`/${m}`));
    relLog.push(`${ok ? 'present' : 'MISSING'}  ${m}`);
    relOk &&= ok;
  }
  const forbidden = names.filter((n) => /node_modules|\.env|SandeepEducation|test-evidence|\.git\//.test(n));
  relLog.push(`forbidden content: ${forbidden.length ? forbidden.join(', ') : 'none'}`);
  relOk &&= forbidden.length === 0;
  // Extract and run it like a recipient would
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dtk-release-'));
  for (const [n, data] of Object.entries(files)) {
    const p = path.join(tmp, n);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
  }
  const dir = path.join(tmp, `devtoolkit-${env.version}`);
  const probe = async (label, cmd, a, port) => {
    const child = spawn(cmd, a, { cwd: dir, env: { ...process.env, PORT: String(port), QPDF_PATH: '' }, stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      const html = await res.text();
      const ok = res.status === 200 && /<div id="root">/.test(html) && !!res.headers.get('content-security-policy');
      relLog.push(`${label}: GET / → ${res.status}, CSP ${res.headers.get('content-security-policy') ? 'present' : 'missing'} → ${ok ? 'OK' : 'FAIL'}`);
      relOk &&= ok;
    } catch (e) {
      relLog.push(`${label}: FAILED (${e.message})`);
      relOk = false;
    } finally {
      child.kill();
    }
  };
  await probe('Node server from unzipped release', process.execPath, ['server/server.mjs'], 8451);
  await probe('Python server from unzipped release', process.platform === 'win32' ? 'python' : 'python3', ['server/serve.py'], 8452);
  fs.rmSync(tmp, { recursive: true, force: true });
  relLog.push(`zip size ${(zip.length / 1048576).toFixed(1)} MB · ${names.length} files`);
}
fs.writeFileSync(path.join(OUT, '12-release-verification.log'), relLog.join('\n') + '\n');
gate('G13', 'Release zip — checksum, contents, runs on Node and Python after unzip', relOk, '11-package.log · 12-release-verification.log');

// ---------------------------------------------------------------- report
const pass = gates.filter((g) => g.ok).length;
const rel = (p) =>
  p
    .split(' · ')
    .map((x) => `[${x}](${x.replace(/ /g, '%20')})`)
    .join(' · ');
const lines = [];
lines.push(`# DevToolkit — Test Evidence Report`, '');
lines.push(
  `**Run:** ${env.when} · **Version:** ${env.version} · **Commit:** ${env.git.commit}${env.git.uncommittedFiles ? ` (+${env.git.uncommittedFiles} uncommitted files)` : ''}`,
  '',
);
lines.push(
  `**Result: ${pass === gates.length ? '✅ ALL GATES PASSED' : `❌ ${gates.length - pass} GATE(S) FAILED`}** — ${pass}/${gates.length} quality gates (requirements §8)`,
  '',
);
lines.push('| Gate | Check | Result | Detail | Evidence |', '| --- | --- | --- | --- | --- |');
for (const g of gates) lines.push(`| ${g.id} | ${g.title} | ${g.ok ? '✅ PASS' : '❌ FAIL'} | ${g.detail || ''} | ${rel(g.evidence)} |`);
lines.push('', '## Environment', '', '| Item | Value |', '| --- | --- |');
for (const [k, v] of Object.entries(env))
  lines.push(
    `| ${k} | ${
      typeof v === 'object'
        ? Object.entries(v)
            .map(([a, b]) => `${a}: ${b}`)
            .join(', ')
        : v
    } |`,
  );

if (coverage) {
  lines.push('', '## Coverage by module (src/lib, lines)', '', '| Module | Lines |', '| --- | --- |');
  for (const m of ['bytes', 'pem', 'errors', 'detect', 'formatters/', 'encoding/', 'crypto/', 'pdf/', 'convert/', 'utils/', 'units/', 'cheatsheets/']) {
    const p = dirPct(`src/lib/${m}`);
    if (p !== null) lines.push(`| ${m.replace(/\/$/, '')} | ${p} % |`);
  }
  lines.push(
    `| **total** | **${covPct} %** |`,
    '',
    'UI components are exercised by the end-to-end suite (every tool, both browsers) rather than unit coverage.',
  );
}
for (const browser of ['msedge', 'chrome']) {
  try {
    const rep = JSON.parse(fs.readFileSync(path.join(OUT, `e2e-${browser}`, 'results.json'), 'utf8'));
    lines.push(
      '',
      `## End-to-end — ${browser} ${rep.version}`,
      '',
      `First load ${rep.firstLoadMs} ms · service worker active: ${rep.serviceWorker}`,
      '',
      '| Tool | Result | Time | Screenshot |',
      '| --- | --- | --- | --- |',
    );
    for (const t of rep.tools)
      lines.push(`| ${t.id} | ${t.ok ? '✅' : `❌ ${t.error}`} | ${t.ms} ms | ${t.screenshot ? `[png](e2e-${browser}/${t.screenshot})` : ''} |`);
    lines.push('', '| Accessibility scan | Serious/critical | Moderate/minor |', '| --- | --- | --- |');
    for (const a of rep.a11y)
      lines.push(
        `| ${a.theme} /${a.route} | ${a.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).length} | ${
          a.violations
            .filter((v) => !['serious', 'critical'].includes(v.impact))
            .map((v) => `${v.id} (${v.impact})`)
            .join(', ') || 0
        } |`,
      );
  } catch {
    /* skip */
  }
}
if (secRes.length) {
  lines.push('', '## Security checks', '', '| ID | OWASP | Check | Result | Observed |', '| --- | --- | --- | --- | --- |');
  for (const r of secRes)
    lines.push(
      `| ${r.id} | ${r.owasp} | ${r.title.replace(/\|/g, '\\|')} | ${r.ok ? '✅' : '❌'} | ${String(r.detail ?? '')
        .replace(/\|/g, '\\|')
        .slice(0, 140)} |`,
    );
  lines.push('', 'Full request/response transcript: [security/security-transcript.txt](security/security-transcript.txt)');
}
if (nfRes.length) {
  lines.push('', '## Non-functional checks', '', '| ID | Requirement | Check | Result | Measured | Target |', '| --- | --- | --- | --- | --- | --- |');
  for (const r of nfRes) lines.push(`| ${r.id} | ${r.requirement} | ${r.title} | ${r.ok ? '✅' : '❌'} | ${r.measured} | ${r.target ?? ''} |`);
}
lines.push('', '## Release verification', '', '```', ...relLog, '```');
if (fs.existsSync(path.join(root, 'test-evidence', 'DEFECTS.md'))) lines.push('', 'Defects found and fixed during testing: [../DEFECTS.md](../DEFECTS.md)');
fs.writeFileSync(path.join(OUT, 'REPORT.md'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ env, gates }, null, 2));

console.log(`\n${pass}/${gates.length} gates passed · report: ${path.relative(root, path.join(OUT, 'REPORT.md'))}`);
process.exit(pass === gates.length ? 0 : 1);
