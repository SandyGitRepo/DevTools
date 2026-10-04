#!/usr/bin/env node
/** Copies pdf.js runtime assets (CMaps, standard fonts, WASM decoders, ICC profiles) into public/pdfjs so they are self-hosted. */
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('node_modules/pdfjs-dist');
const dest = path.resolve('public/pdfjs');
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const from = path.join(src, dir);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, dir), { recursive: true });
}
console.log('pdf.js assets copied to public/pdfjs');
