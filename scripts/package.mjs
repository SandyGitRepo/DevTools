#!/usr/bin/env node
/**
 * Builds the distributable zip: release/devtoolkit-<version>.zip
 *
 * The zip is self-contained — unzip anywhere and run start.bat (Windows) or start.sh (macOS/Linux).
 * It needs only Node.js 18+ or Python 3.8+ on the target machine; no npm install, no internet.
 * Also writes a SHA-256 checksum file next to the zip (A08: verify before deploying).
 *
 * Optional: QPDF_BUNDLE_DIR=<unzipped qpdf release> bundles qpdf (Apache-2.0) as bin/qpdf so the
 * server-side PDF tools work out of the box (the server finds it automatically).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { zipSync } from 'fflate';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const name = `devtoolkit-${pkg.version}`;

if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('No build found. Run "npm run build" first (or "npm run release").');
  process.exit(1);
}

const include = [
  'dist',
  'server/server.mjs',
  'server/pdf-api.mjs',
  'server/serve.py',
  'start.bat',
  'start.sh',
  'README.md',
  'LICENSES.md',
  'docs',
  'deploy',
  'Dockerfile.release',
];

const files = {};
function add(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return;
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(abs)) add(path.posix.join(rel.split(path.sep).join('/'), entry));
  } else {
    const isExec = rel.endsWith('.sh') || rel.endsWith('.py') || rel.endsWith('.mjs');
    // Zip entry name; Dockerfile.release ships as plain Dockerfile inside the release
    const entry = rel === 'Dockerfile.release' ? 'Dockerfile' : rel;
    files[`${name}/${entry}`] = [
      fs.readFileSync(abs),
      { level: /\.(png|woff2?|wasm|zip|gz)$/.test(rel) ? 0 : 9, os: 3, attrs: (isExec ? 0o755 : 0o644) << 16 },
    ];
  }
}
include.forEach(add);

const qpdfDir = process.env.QPDF_BUNDLE_DIR;
if (qpdfDir) {
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs)) {
      const a = path.join(abs, entry);
      const r = `${rel}/${entry}`;
      if (fs.statSync(a).isDirectory()) walk(a, r);
      else if (!/\.(h|hh|a|lib|pc|cmake)$/i.test(entry)) files[`${name}/${r}`] = [fs.readFileSync(a), { level: 9, os: 3, attrs: 0o755 << 16 }];
    }
  };
  // Accept either the release folder or its bin/ parent
  const base = fs.existsSync(path.join(qpdfDir, 'bin')) ? qpdfDir : path.dirname(qpdfDir);
  for (const sub of ['bin', 'share', 'doc', 'licenses']) if (fs.existsSync(path.join(base, sub))) walk(path.join(base, sub), `bin/qpdf/${sub}`);
  console.log(`  Bundled qpdf from ${base}`);
}

const zip = zipSync(files);
const outDir = path.join(root, 'release');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${name}.zip`);
fs.writeFileSync(out, zip);
const sha = crypto.createHash('sha256').update(zip).digest('hex');
fs.writeFileSync(`${out}.sha256`, `${sha}  ${name}.zip\n`);

console.log(`\n  Created ${path.relative(root, out)}  (${(zip.length / 1048576).toFixed(1)} MB, ${Object.keys(files).length} files)`);
console.log(`  SHA-256 ${sha}\n`);
