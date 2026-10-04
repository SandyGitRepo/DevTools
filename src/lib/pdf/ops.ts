/**
 * PDF operations on top of pdf-lib (MIT). Pure functions over bytes: no DOM, so they run in a
 * Web Worker in the app and directly in Node for unit tests. Every output passes through
 * sanitize() (SEC-3: no JavaScript, no embedded files, no launch actions).
 */
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  StandardFonts,
  rgb,
  degrees,
  PageSizes,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  type PDFPage,
} from 'pdf-lib';
import { zipSync } from 'fflate';
import { parseRanges } from './ranges';

export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_PDF_PAGES = 2000;

export class PdfError extends Error {}

/** SEC-1: magic bytes and size. A PDF must start with %PDF (we allow a small junk prefix like many readers). */
export function assertPdf(bytes: Uint8Array, name = 'File') {
  if (bytes.length > MAX_PDF_BYTES) throw new PdfError(`${name} is larger than the 100 MB limit`);
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (!head.includes('%PDF-')) throw new PdfError(`${name} is not a PDF (it does not start with %PDF)`);
}

export async function loadPdf(bytes: Uint8Array, name = 'File'): Promise<PDFDocument> {
  assertPdf(bytes, name);
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/encrypt/i.test(msg)) throw new PdfError(`${name} is password-protected. Use “Protect / Unlock PDF” to remove the password first.`, { cause: e });
    throw new PdfError(`${name} could not be read — it may be damaged (${msg.split('\n')[0]})`, { cause: e });
  }
  if (doc.getPageCount() > MAX_PDF_PAGES) throw new PdfError(`${name} has ${doc.getPageCount()} pages; the limit is ${MAX_PDF_PAGES}`);
  return doc;
}

const ACTION_KEYS = ['AA', 'OpenAction'];

function isDangerousAction(action: unknown): boolean {
  if (!(action instanceof PDFDict)) return false;
  const s = action.get(PDFName.of('S'));
  return s instanceof PDFName && ['/JavaScript', '/Launch', '/ImportData', '/SubmitForm', '/RichMediaExecute'].includes(s.asString());
}

/** Removes document- and page-level scripts, launch actions and embedded files (SEC-3). Returns what was removed. */
export function sanitize(doc: PDFDocument): string[] {
  const removed: string[] = [];
  const catalog = doc.catalog;
  for (const k of ACTION_KEYS) {
    if (catalog.has(PDFName.of(k))) {
      catalog.delete(PDFName.of(k));
      removed.push(`document ${k}`);
    }
  }
  const names = catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  if (names) {
    for (const k of ['JavaScript', 'EmbeddedFiles']) {
      if (names.has(PDFName.of(k))) {
        names.delete(PDFName.of(k));
        removed.push(k === 'JavaScript' ? 'document JavaScript' : 'embedded files');
      }
    }
  }
  const acro = catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (acro?.has(PDFName.of('XFA'))) {
    acro.delete(PDFName.of('XFA'));
    removed.push('XFA form scripts');
  }
  doc.getPages().forEach((page, i) => {
    if (page.node.has(PDFName.of('AA'))) {
      page.node.delete(PDFName.of('AA'));
      removed.push(`page ${i + 1} actions`);
    }
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annots) return;
    for (let a = annots.size() - 1; a >= 0; a--) {
      const annot = annots.lookupMaybe(a, PDFDict);
      if (!annot) continue;
      const subtype = annot.get(PDFName.of('Subtype'));
      if (subtype instanceof PDFName && subtype.asString() === '/FileAttachment') {
        annots.remove(a);
        removed.push(`page ${i + 1} file attachment`);
        continue;
      }
      if (isDangerousAction(annot.lookup(PDFName.of('A')))) {
        annot.delete(PDFName.of('A'));
        removed.push(`page ${i + 1} link script`);
      }
      if (annot.has(PDFName.of('AA'))) annot.delete(PDFName.of('AA'));
    }
  });
  return removed;
}

async function save(doc: PDFDocument): Promise<Uint8Array> {
  sanitize(doc);
  doc.setProducer('DevToolkit');
  return doc.save({ useObjectStreams: true });
}

// ---------------------------------------------------------------- operations

export interface PageSpec {
  /** Zero-based index in the source document. */
  index: number;
  /** Extra rotation in degrees (0, 90, 180, 270) added to the page's own rotation. */
  rotate?: number;
}

/** Builds a new document from selected pages in the given order (delete, reorder, rotate, extract — FR-P3/P5/P6). */
export async function organize(bytes: Uint8Array, pages: PageSpec[]): Promise<Uint8Array> {
  if (!pages.length) throw new PdfError('The result would have no pages');
  const src = await loadPdf(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    src,
    pages.map((p) => p.index),
  );
  copied.forEach((page, i) => {
    const extra = pages[i].rotate ?? 0;
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    out.addPage(page);
  });
  copyInfo(src, out);
  return save(out);
}

/** FR-P1: merge whole documents in order. */
export async function merge(files: { name: string; bytes: Uint8Array }[]): Promise<Uint8Array> {
  if (files.length < 2) throw new PdfError('Add at least two PDFs to merge');
  if (files.length > 50) throw new PdfError('You can merge up to 50 PDFs at a time');
  const out = await PDFDocument.create();
  let total = 0;
  for (const f of files) {
    const src = await loadPdf(f.bytes, f.name);
    total += src.getPageCount();
    if (total > MAX_PDF_PAGES) throw new PdfError(`The merged PDF would exceed ${MAX_PDF_PAGES} pages`);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return save(out);
}

export type SplitMode = { kind: 'ranges'; ranges: string } | { kind: 'every'; n: number } | { kind: 'single' };

/** FR-P2: returns one output per group. Ranges mode: each comma-separated part becomes one file. */
export async function split(bytes: Uint8Array, mode: SplitMode, baseName = 'document'): Promise<{ name: string; bytes: Uint8Array }[]> {
  const src = await loadPdf(bytes);
  const count = src.getPageCount();
  let groups: number[][];
  if (mode.kind === 'single') groups = src.getPageIndices().map((i) => [i]);
  else if (mode.kind === 'every') {
    if (!Number.isInteger(mode.n) || mode.n < 1) throw new PdfError('“Every N pages” needs a whole number of at least 1');
    groups = [];
    for (let i = 0; i < count; i += mode.n) groups.push(Array.from({ length: Math.min(mode.n, count - i) }, (_, k) => i + k));
  } else {
    groups = mode.ranges
      .split(/[,;]+/)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => parseRanges(r, count));
    if (!groups.length) throw new PdfError('Enter ranges such as 1-3, 4-6, 7-');
  }
  const outputs: { name: string; bytes: Uint8Array }[] = [];
  for (const g of groups) {
    const out = await PDFDocument.create();
    (await out.copyPages(src, g)).forEach((p) => out.addPage(p));
    const label = g.length === 1 ? `p${g[0] + 1}` : `p${g[0] + 1}-${g[g.length - 1] + 1}`;
    outputs.push({ name: `${baseName}_${label}.pdf`, bytes: await save(out) });
  }
  return outputs;
}

export function zipFiles(files: { name: string; bytes: Uint8Array }[]): Uint8Array {
  return zipSync(Object.fromEntries(files.map((f) => [f.name, [f.bytes, { level: 0 }]])));
}

export type PageSize = 'A4' | 'Letter' | 'Legal' | 'fit';
export type Orientation = 'portrait' | 'landscape' | 'auto';

function pageDims(size: Exclude<PageSize, 'fit'>, orientation: Orientation, imgW: number, imgH: number): [number, number] {
  const [w, h] = PageSizes[size];
  const landscape = orientation === 'landscape' || (orientation === 'auto' && imgW > imgH);
  return landscape ? [h, w] : [w, h];
}

export interface ImageInput {
  bytes: Uint8Array;
  type: 'png' | 'jpg';
}

function detectImage(bytes: Uint8Array): 'png' | 'jpg' {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  throw new PdfError('Only JPG and PNG images are supported');
}

async function drawImagePage(doc: PDFDocument, bytes: Uint8Array, size: PageSize, orientation: Orientation, marginPt: number, at?: number) {
  const kind = detectImage(bytes);
  const img = kind === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const [pw, ph] = size === 'fit' ? [img.width + 2 * marginPt, img.height + 2 * marginPt] : pageDims(size, orientation, img.width, img.height);
  const page = at === undefined ? doc.addPage([pw, ph]) : doc.insertPage(at, [pw, ph]);
  const boxW = pw - 2 * marginPt;
  const boxH = ph - 2 * marginPt;
  const scale = Math.min(boxW / img.width, boxH / img.height, size === 'fit' ? 1 : Infinity);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
}

/** FR-P7: images to PDF, one image per page. */
export async function imagesToPdf(images: Uint8Array[], size: PageSize, orientation: Orientation, marginMm: number): Promise<Uint8Array> {
  if (!images.length) throw new PdfError('Add at least one image');
  const doc = await PDFDocument.create();
  for (const img of images) await drawImagePage(doc, img, size, orientation, (marginMm * 72) / 25.4);
  return save(doc);
}

export type InsertSource = { kind: 'blank'; count: number } | { kind: 'pdf'; bytes: Uint8Array; ranges?: string } | { kind: 'images'; images: Uint8Array[] };

/** FR-P4: insert pages before the given zero-based position (position = pageCount appends). */
export async function insertPages(bytes: Uint8Array, position: number, source: InsertSource): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const count = doc.getPageCount();
  if (position < 0 || position > count) throw new PdfError(`Position must be between 1 and ${count + 1}`);
  // Match the size of the neighbouring page
  const ref = doc.getPage(Math.min(position, count - 1));
  const { width, height } = ref.getSize();
  if (source.kind === 'blank') {
    if (source.count < 1 || source.count > 500) throw new PdfError('Insert between 1 and 500 blank pages');
    for (let i = 0; i < source.count; i++) doc.insertPage(position + i, [width, height]);
  } else if (source.kind === 'pdf') {
    const other = await loadPdf(source.bytes, 'The inserted PDF');
    const indices = source.ranges?.trim() ? parseRanges(source.ranges, other.getPageCount()) : other.getPageIndices();
    const pages = await doc.copyPages(other, indices);
    pages.forEach((p, i) => doc.insertPage(position + i, p));
  } else {
    let at = position;
    for (const img of source.images) {
      await drawImagePage(doc, img, 'A4', 'auto', 28, at);
      // Use the neighbour's size for consistency
      doc.getPage(at).setSize(width, height);
      at++;
    }
  }
  if (doc.getPageCount() > MAX_PDF_PAGES) throw new PdfError(`The result would exceed ${MAX_PDF_PAGES} pages`);
  return save(doc);
}

// ---------------------------------------------------------------- watermark & numbering (FR-P8)

/** Standard PDF fonts only cover Windows-1252; reject other characters with a clear message. */
function assertWinAnsi(text: string) {
  // Printable ASCII, Latin-1 and the extra Windows-1252 punctuation that Helvetica's WinAnsi encoding covers
  const bad = [...text].find(
    (c) =>
      !/[\u0020-\u007e\u00a0-\u00ff\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]/.test(
        c,
      ),
  );
  if (bad) throw new PdfError(`The character “${bad}” is not supported in watermarks (use Latin letters, digits and common symbols)`);
}

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  opacity: number;
  angle: number;
  color: [number, number, number];
  pages?: string;
}

export async function watermark(bytes: Uint8Array, o: WatermarkOptions): Promise<Uint8Array> {
  if (!o.text.trim()) throw new PdfError('Enter watermark text');
  assertWinAnsi(o.text);
  const doc = await loadPdf(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const targets = o.pages?.trim() ? parseRanges(o.pages, doc.getPageCount()) : doc.getPageIndices();
  for (const i of targets) {
    const page = doc.getPage(i);
    const { width, height } = visualSize(page);
    const textWidth = font.widthOfTextAtSize(o.text, o.fontSize);
    const rad = (o.angle * Math.PI) / 180;
    // Centre the rotated text on the page
    const x = width / 2 - (textWidth / 2) * Math.cos(rad) + (o.fontSize / 3) * Math.sin(rad);
    const y = height / 2 - (textWidth / 2) * Math.sin(rad) - (o.fontSize / 3) * Math.cos(rad);
    drawUpright(page, () => page.drawText(o.text, { x, y, size: o.fontSize, font, color: rgb(...o.color), opacity: o.opacity, rotate: degrees(o.angle) }));
  }
  return save(doc);
}

/** Page size as the reader sees it (width/height swap for 90°/270° rotated pages). */
function visualSize(page: PDFPage) {
  const { width, height } = page.getSize();
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  return rot === 90 || rot === 270 ? { width: height, height: width } : { width, height };
}

/**
 * pdf-lib draws in unrotated page space. Wrap drawing in a transform that maps visual coordinates
 * to page space, so stamps appear upright and positioned as the reader sees the page.
 */
function drawUpright(page: PDFPage, draw: () => void) {
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const { width: W, height: H } = page.getSize();
  const m: Record<number, [number, number, number, number, number, number]> = {
    90: [0, 1, -1, 0, W, 0],
    180: [-1, 0, 0, -1, W, H],
    270: [0, -1, 1, 0, 0, H],
  };
  if (!m[rot]) return draw();
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m[rot]));
  draw();
  page.pushOperators(popGraphicsState());
}

export type NumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';

export interface NumberingOptions {
  position: NumberPosition;
  /** Template with {n} and {total}, e.g. "Page {n} of {total}". */
  format: string;
  start: number;
  fontSize: number;
  marginPt: number;
  skipFirst: boolean;
}

export async function addPageNumbers(bytes: Uint8Array, o: NumberingOptions): Promise<Uint8Array> {
  assertWinAnsi(o.format);
  const doc = await loadPdf(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const numbered = o.skipFirst ? pages.length - 1 : pages.length;
  pages.forEach((page, i) => {
    if (o.skipFirst && i === 0) return;
    const n = o.start + (o.skipFirst ? i - 1 : i);
    const text = o.format.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(numbered + o.start - 1));
    const { width, height } = visualSize(page);
    const tw = font.widthOfTextAtSize(text, o.fontSize);
    const [v, h] = o.position.split('-');
    const x = h === 'left' ? o.marginPt : h === 'right' ? width - o.marginPt - tw : (width - tw) / 2;
    const y = v === 'top' ? height - o.marginPt - o.fontSize : o.marginPt;
    drawUpright(page, () => page.drawText(text, { x, y, size: o.fontSize, font, color: rgb(0.2, 0.2, 0.2) }));
  });
  return save(doc);
}

// ---------------------------------------------------------------- metadata (FR-P9)

export interface PdfMeta {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pageCount: number;
  hasXmp: boolean;
  risky: string[];
}

export async function readMeta(bytes: Uint8Array): Promise<PdfMeta> {
  const doc = await loadPdf(bytes);
  // Count risky content without changing the original
  const probe = await PDFDocument.load(bytes, { updateMetadata: false });
  const risky = sanitize(probe);
  return {
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    keywords: doc.getKeywords(),
    creator: doc.getCreator(),
    producer: doc.getProducer(),
    creationDate: doc.getCreationDate()?.toISOString(),
    modificationDate: doc.getModificationDate()?.toISOString(),
    pageCount: doc.getPageCount(),
    hasXmp: doc.catalog.has(PDFName.of('Metadata')),
    risky,
  };
}

export async function writeMeta(
  bytes: Uint8Array,
  meta: Partial<Record<'title' | 'author' | 'subject' | 'keywords' | 'creator', string>>,
  stripAll: boolean,
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  if (stripAll) {
    const info = doc.context.lookup(doc.context.trailerInfo.Info);
    if (info instanceof PDFDict) for (const key of info.keys()) info.delete(key);
    doc.catalog.delete(PDFName.of('Metadata')); // XMP packet
    sanitize(doc);
    return doc.save({ useObjectStreams: true }); // no Producer stamp when stripping
  }
  const set = (v: string | undefined, fn: (s: string) => void) => v !== undefined && fn(v);
  set(meta.title, (s) => doc.setTitle(s));
  set(meta.author, (s) => doc.setAuthor(s));
  set(meta.subject, (s) => doc.setSubject(s));
  set(meta.keywords, (s) => doc.setKeywords(s.split(/\s*,\s*/).filter(Boolean)));
  set(meta.creator, (s) => doc.setCreator(s));
  doc.setModificationDate(new Date());
  return save(doc);
}

function copyInfo(src: PDFDocument, out: PDFDocument) {
  const t = src.getTitle();
  if (t) out.setTitle(t);
}

/** Safe, synthetic sample document for "Try sample" (UI-12). Each page is labelled and coloured so reordering is visible. */
export async function makeSample(pages = 6, title = 'Sample loan file'): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sections = [
    'Application form',
    'KYC — identity proof',
    'KYC — address proof',
    'Income documents',
    'Property papers',
    'Sanction letter',
    'Agreement',
    'Annexure',
  ];
  const hues: [number, number, number][] = [
    [0, 0.45, 0.74],
    [0.95, 0.44, 0.13],
    [0.18, 0.8, 0.6],
    [0.55, 0.36, 0.85],
    [0.9, 0.3, 0.4],
    [0.25, 0.7, 1],
  ];
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage(PageSizes.A4);
    const [w, h] = PageSizes.A4;
    const c = hues[i % hues.length];
    page.drawRectangle({ x: 0, y: h - 120, width: w, height: 120, color: rgb(...c) });
    page.drawText(`${title}`, { x: 40, y: h - 60, size: 22, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`SAMPLE DATA — NOT A REAL DOCUMENT`, { x: 40, y: h - 90, size: 11, font, color: rgb(1, 1, 1) });
    page.drawText(`${i + 1}`, { x: w / 2 - 40, y: h / 2 - 40, size: 120, font: bold, color: rgb(...c), opacity: 0.85 });
    page.drawText(sections[i % sections.length], { x: 40, y: h / 2 - 120, size: 20, font: bold, color: rgb(0.1, 0.15, 0.25) });
    for (let l = 0; l < 6; l++) page.drawRectangle({ x: 40, y: 200 - l * 22, width: w - 80 - (l % 3) * 60, height: 8, color: rgb(0.85, 0.88, 0.92) });
    page.drawText(`Page ${i + 1} of ${pages}`, { x: w - 120, y: 30, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  }
  doc.setTitle(title);
  doc.setAuthor('DevToolkit sample generator');
  doc.setSubject('Synthetic test document');
  return doc.save();
}

/** Re-saves a PDF with scripts, launch actions and attachments removed (used around server-side jobs). */
export async function clean(bytes: Uint8Array): Promise<Uint8Array> {
  return save(await loadPdf(bytes));
}
