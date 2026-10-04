import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFDict, PDFString, StandardFonts } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { formatRanges, parseRanges } from '../src/lib/pdf/ranges';
import { addPageNumbers, assertPdf, imagesToPdf, insertPages, merge, organize, readMeta, split, watermark, writeMeta, zipFiles } from '../src/lib/pdf/ops';
import { fromBase64 } from '../src/lib/bytes';

/** Creates a test PDF whose pages are labelled "P1", "P2"… with distinct widths so order can be checked. */
async function makePdf(pages: number, opts: { title?: string; withScript?: boolean } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([500 + i, 700]);
    page.drawText(`P${i}`, { x: 50, y: 600, size: 24, font });
  }
  if (opts.title) doc.setTitle(opts.title);
  doc.setAuthor('Secret Author');
  if (opts.withScript) {
    const ctx = doc.context;
    const js = ctx.obj({ S: 'JavaScript', JS: PDFString.of('app.alert("pwned")') });
    doc.catalog.set(PDFName.of('OpenAction'), js);
    const names = ctx.obj({ JavaScript: ctx.obj({ Names: [PDFString.of('x'), js] }), EmbeddedFiles: ctx.obj({ Names: [] }) });
    doc.catalog.set(PDFName.of('Names'), names);
  }
  return doc.save();
}

const widths = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPages().map((p) => Math.round(p.getWidth()) - 500);

// 1x1 PNG
const PNG = fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

describe('page ranges', () => {
  it('parses lists, open ranges and reverse ranges', () => {
    expect(parseRanges('2, 5-7', 10)).toEqual([1, 4, 5, 6]);
    expect(parseRanges('8-', 10)).toEqual([7, 8, 9]);
    expect(parseRanges('-2', 10)).toEqual([0, 1]);
    expect(parseRanges('3-1', 10)).toEqual([2, 1, 0]);
    expect(parseRanges('1,1,2', 10)).toEqual([0, 1]);
  });
  it('rejects bad input', () => {
    expect(() => parseRanges('11', 10)).toThrow(/beyond the last page/);
    expect(() => parseRanges('a-b', 10)).toThrow(/not a page/);
    expect(() => parseRanges('0', 10)).toThrow(/start at 1/);
    expect(() => parseRanges('', 10)).toThrow(/Enter page/);
  });
  it('formats back to compact ranges', () => {
    expect(formatRanges([0, 1, 2, 4, 6, 7])).toBe('1-3, 5, 7-8');
  });
});

describe('SEC-1 validation', () => {
  it('rejects non-PDF input', () => {
    expect(() => assertPdf(new TextEncoder().encode('hello'))).toThrow(/not a PDF/);
  });
});

describe('FR-P1 merge', () => {
  it('concatenates in order', async () => {
    const out = await merge([
      { name: 'a', bytes: await makePdf(2) },
      { name: 'b', bytes: await makePdf(3) },
    ]);
    expect(await widths(out)).toEqual([1, 2, 1, 2, 3]);
  });
  it('needs two files', async () => {
    await expect(merge([{ name: 'a', bytes: await makePdf(1) }])).rejects.toThrow(/at least two/);
  });
});

describe('FR-P2 split', () => {
  it('every N, single and ranges; split → merge keeps page count', async () => {
    const src = await makePdf(7);
    const everyThree = await split(src, { kind: 'every', n: 3 }, 'doc');
    expect(everyThree.map((f) => f.name)).toEqual(['doc_p1-3.pdf', 'doc_p4-6.pdf', 'doc_p7.pdf']);
    expect((await split(src, { kind: 'single' })).length).toBe(7);
    const ranges = await split(src, { kind: 'ranges', ranges: '1-2, 5-' });
    expect(await widths(ranges[1].bytes)).toEqual([5, 6, 7]);
    const merged = await merge(everyThree);
    expect((await PDFDocument.load(merged)).getPageCount()).toBe(7);
  });
  it('zips outputs', async () => {
    const parts = await split(await makePdf(3), { kind: 'single' }, 'x');
    expect(Object.keys(unzipSync(zipFiles(parts)))).toEqual(['x_p1.pdf', 'x_p2.pdf', 'x_p3.pdf']);
  });
});

describe('FR-P3/P5/P6 organize', () => {
  it('deletes, reorders and rotates', async () => {
    const out = await organize(await makePdf(5), [{ index: 4 }, { index: 0, rotate: 90 }, { index: 2, rotate: 270 }]);
    expect(await widths(out)).toEqual([5, 1, 3]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 270]);
  });
  it('refuses an empty result', async () => {
    await expect(organize(await makePdf(2), [])).rejects.toThrow(/no pages/);
  });
});

describe('SEC-3 sanitisation', () => {
  it('strips document JavaScript, OpenAction and embedded files from outputs', async () => {
    const src = await makePdf(2, { withScript: true });
    const meta = await readMeta(src);
    expect(meta.risky).toEqual(expect.arrayContaining(['document OpenAction', 'document JavaScript', 'embedded files']));
    const out = await watermark(src, { text: 'INTERNAL', fontSize: 40, opacity: 0.2, angle: 45, color: [1, 0, 0] });
    const doc = await PDFDocument.load(out);
    expect(doc.catalog.has(PDFName.of('OpenAction'))).toBe(false);
    const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
    expect(names?.has(PDFName.of('JavaScript')) ?? false).toBe(false);
    expect(new TextDecoder('latin1').decode(out)).not.toContain('app.alert');
  });
});

describe('FR-P4 insert', () => {
  it('inserts blank pages, PDF pages and images at a position', async () => {
    const base = await makePdf(3);
    expect((await PDFDocument.load(await insertPages(base, 1, { kind: 'blank', count: 2 }))).getPageCount()).toBe(5);
    const withPdf = await insertPages(base, 3, { kind: 'pdf', bytes: await makePdf(4), ranges: '2-3' });
    expect(await widths(withPdf)).toEqual([1, 2, 3, 2, 3]);
    expect((await PDFDocument.load(await insertPages(base, 0, { kind: 'images', images: [PNG] }))).getPageCount()).toBe(4);
    await expect(insertPages(base, 9, { kind: 'blank', count: 1 })).rejects.toThrow(/Position/);
  });
});

describe('FR-P7 images to PDF', () => {
  it('creates one page per image', async () => {
    const out = await imagesToPdf([PNG, PNG], 'A4', 'portrait', 10);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
  });
  it('rejects unsupported images', async () => {
    await expect(imagesToPdf([new Uint8Array([1, 2, 3, 4])], 'A4', 'auto', 0)).rejects.toThrow(/JPG and PNG/);
  });
});

describe('FR-P8 watermark and numbering', () => {
  it('stamps text on selected pages', async () => {
    const out = await watermark(await makePdf(3), { text: 'Confidential', fontSize: 48, opacity: 0.15, angle: 45, color: [0.8, 0, 0], pages: '1,3' });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(3);
  });
  it('rejects characters outside WinAnsi', async () => {
    await expect(watermark(await makePdf(1), { text: 'गोपनीय', fontSize: 40, opacity: 0.2, angle: 0, color: [0, 0, 0] })).rejects.toThrow(/not supported/);
  });
  it('numbers pages, including rotated ones', async () => {
    const rotated = await organize(await makePdf(3), [{ index: 0 }, { index: 1, rotate: 90 }, { index: 2 }]);
    const out = await addPageNumbers(rotated, {
      position: 'bottom-center',
      format: 'Page {n} of {total}',
      start: 1,
      fontSize: 10,
      marginPt: 24,
      skipFirst: false,
    });
    expect(new TextDecoder('latin1').decode(out).length).toBeGreaterThan(rotated.length);
  });
});

describe('FR-P9 metadata', () => {
  it('reads, edits and strips', async () => {
    const src = await makePdf(1, { title: 'Loan file 42' });
    const meta = await readMeta(src);
    expect(meta.title).toBe('Loan file 42');
    expect(meta.author).toBe('Secret Author');
    const edited = await readMeta(await writeMeta(src, { title: 'Renamed' }, false));
    expect(edited.title).toBe('Renamed');
    const stripped = await readMeta(await writeMeta(src, {}, true));
    expect(stripped.title).toBeUndefined();
    expect(stripped.author).toBeUndefined();
    expect(stripped.producer).toBeUndefined();
  });
});
