/**
 * Server-side PDF service (FR-P10 protect/unlock, FR-P11 compress) using qpdf (Apache-2.0).
 * Zero npm dependencies. Security controls:
 *  - SEC-1: %PDF magic check, 100 MB body cap (rejected before reading), 2,000-page cap.
 *  - A03:  qpdf is spawned with an argument array — never a shell. Passwords are passed in an
 *          @args file (mode 0600) so they never appear in the process list.
 *  - A04:  each job runs in a private temp directory that is deleted in a `finally` block;
 *          nothing is kept after the response. Jobs time out after 55 s; at most N run at once.
 *  - A09:  callers log metadata only; this module never logs content, filenames or passwords.
 *
 * Request body framing (application/octet-stream):
 *   [4-byte big-endian JSON length][JSON options][PDF bytes]
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAX_PDF = 100 * 1024 * 1024;
const MAX_OPTIONS = 16 * 1024;
const MAX_PAGES = 2000;
const JOB_TIMEOUT_MS = 55_000;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function findQpdf(serverDir) {
  const candidates = [
    process.env.QPDF_PATH,
    path.join(serverDir, '..', 'bin', 'qpdf', 'bin', process.platform === 'win32' ? 'qpdf.exe' : 'qpdf'),
    'qpdf',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      const r = spawnSync(c, ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
      const m = r.status === 0 && r.stdout.match(/qpdf version (\d+)\.(\d+)\.(\d+)/);
      if (m) {
        const [maj, min] = [Number(m[1]), Number(m[2])];
        // Named --user-password/--owner-password syntax needs 11.7+
        if (maj > 11 || (maj === 11 && min >= 7)) return { path: c, version: `${m[1]}.${m[2]}.${m[3]}` };
        console.warn(`[devtoolkit] qpdf ${m[1]}.${m[2]} found at ${c}, but 11.7 or newer is required — PDF protect/compress disabled`);
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Reads the whole body with a hard cap; rejects early using Content-Length when possible. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > limit) {
      // Do not read the body at all; the caller replies 413 and closes the connection
      reject(new HttpError(413, 'File is larger than the 100 MB limit'));
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'File is larger than the 100 MB limit'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => reject(new HttpError(400, 'Upload interrupted')));
  });
}

function parseFrame(body) {
  if (body.length < 4) throw new HttpError(400, 'Malformed request');
  const jsonLen = body.readUInt32BE(0);
  if (jsonLen > MAX_OPTIONS || 4 + jsonLen > body.length) throw new HttpError(400, 'Malformed request');
  let options;
  try {
    options = JSON.parse(body.subarray(4, 4 + jsonLen).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Malformed options');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new HttpError(400, 'Malformed options');
  const pdf = body.subarray(4 + jsonLen);
  if (!pdf.subarray(0, 1024).toString('latin1').includes('%PDF-')) throw new HttpError(415, 'The file is not a PDF');
  if (pdf.length > MAX_PDF) throw new HttpError(413, 'File is larger than the 100 MB limit');
  return { options, pdf };
}

function checkPassword(v, label, required) {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `${label} is required`);
    return '';
  }
  if (typeof v !== 'string' || v.length > 128 || /[\r\n\0]/.test(v)) throw new HttpError(400, `${label} must be 1–128 characters on a single line`);
  return v;
}

export function createPdfService(serverDir) {
  const qpdf = findQpdf(serverDir);
  const maxConcurrent = Math.max(1, Number(process.env.PDF_CONCURRENCY || 2));
  let running = 0;
  const queue = [];

  const acquire = () =>
    new Promise((resolve, reject) => {
      if (running < maxConcurrent) {
        running++;
        resolve();
      } else if (queue.length >= 20) reject(new HttpError(503, 'The PDF service is busy — try again in a moment'));
      else queue.push(resolve);
    });
  const release = () => {
    const next = queue.shift();
    if (next) next();
    else running--;
  };

  /** Runs qpdf with all arguments in a private @args file. Resolves with { code, stdout, stderr }. */
  function runQpdf(dir, args) {
    const argsFile = path.join(dir, `args-${crypto.randomBytes(6).toString('hex')}.txt`);
    fs.writeFileSync(argsFile, args.join('\n') + '\n', { mode: 0o600 });
    return new Promise((resolve) => {
      const child = spawn(qpdf.path, [`@${argsFile}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d).length > 65536 && (stdout = stdout.slice(-65536)));
      child.stderr.on('data', (d) => (stderr += d).length > 65536 && (stderr = stderr.slice(-65536)));
      const timer = setTimeout(() => child.kill('SIGKILL'), JOB_TIMEOUT_MS);
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        fs.rmSync(argsFile, { force: true });
        resolve({ code: signal ? -1 : code, stdout, stderr });
      });
      child.on('error', () => {
        clearTimeout(timer);
        resolve({ code: -2, stdout, stderr });
      });
    });
  }

  const fail = (r, fallback) => {
    if (r.code === -1) throw new HttpError(504, 'Processing took too long and was stopped');
    if (/invalid password/i.test(r.stderr)) throw new HttpError(400, 'Wrong password');
    // Never echo qpdf output: it can contain temp paths
    throw new HttpError(422, fallback);
  };

  async function runJob(op, options, pdf) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dtk-'));
    try {
      const input = path.join(dir, 'in.pdf');
      const output = path.join(dir, 'out.pdf');
      fs.writeFileSync(input, pdf, { mode: 0o600 });
      const password = op === 'unlock' ? checkPassword(options.password, 'Password', true) : '';
      const pwArgs = password ? [`--password=${password}`] : [];

      const enc = await runQpdf(dir, ['--is-encrypted', input]);
      const encrypted = enc.code === 0;
      if (op === 'unlock' && !encrypted) throw new HttpError(400, 'This PDF is not password-protected');
      if (op !== 'unlock' && encrypted) throw new HttpError(400, 'This PDF is already password-protected — unlock it first');

      const pages = await runQpdf(dir, [...pwArgs, '--show-npages', input]);
      if (pages.code !== 0 && pages.code !== 3) fail(pages, 'The PDF could not be read — it may be damaged');
      const n = Number(pages.stdout.trim());
      if (n > MAX_PAGES) throw new HttpError(413, `The PDF has ${n} pages; the limit is ${MAX_PAGES}`);

      let args;
      if (op === 'protect') {
        const user = checkPassword(options.userPassword, 'Open password', true);
        // A random owner password still enforces the permission flags
        const owner = checkPassword(options.ownerPassword, 'Permissions password', false) || crypto.randomBytes(18).toString('base64url');
        args = [
          '--encrypt',
          `--user-password=${user}`,
          `--owner-password=${owner}`,
          '--bits=256',
          `--print=${options.allowPrint === false ? 'none' : 'full'}`,
          `--extract=${options.allowCopy === false ? 'n' : 'y'}`,
          `--modify=${options.allowModify === false ? 'none' : 'all'}`,
          '--',
          input,
          output,
        ];
      } else if (op === 'unlock') {
        args = [...pwArgs, '--decrypt', input, output];
      } else {
        args = [
          '--object-streams=generate',
          '--compress-streams=y',
          '--recompress-flate',
          '--compression-level=9',
          '--remove-unreferenced-resources=yes',
          '--optimize-images',
          input,
          output,
        ];
      }
      const r = await runQpdf(dir, args);
      if (r.code !== 0 && r.code !== 3) fail(r, 'qpdf could not process this PDF');
      const out = fs.readFileSync(output);
      return { out, pages: n };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  return {
    available: !!qpdf,
    version: qpdf?.version ?? null,
    /** Handles POST /api/pdf/<op>; returns { status, body, headers }. */
    async handle(req, op) {
      if (!qpdf) throw new HttpError(503, 'The PDF service is not available on this server (qpdf is not installed)');
      if (!['protect', 'unlock', 'compress'].includes(op)) throw new HttpError(404, 'Not found');
      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
      const body = await readBody(req, MAX_PDF + MAX_OPTIONS + 4);
      const { options, pdf } = parseFrame(body);
      await acquire();
      try {
        const { out, pages } = await runJob(op, options, pdf);
        const headers = { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'X-Original-Size': String(pdf.length), 'X-Pages': String(pages) };
        if (op === 'compress' && out.length >= pdf.length) {
          return { status: 200, body: pdf, headers: { ...headers, 'X-No-Gain': '1' } };
        }
        return { status: 200, body: out, headers };
      } finally {
        release();
      }
    },
  };
}
