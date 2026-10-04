/**
 * pdf.js (Apache-2.0) rendering for thumbnails, previews and PDF→PNG. Browser only.
 * SEC-3: pdf.js 6 never compiles fonts with eval (the option was removed); XFA is disabled. All assets
 * are served from ./pdfjs/.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy };

const assetBase = new URL('./pdfjs/', document.baseURI).href;

// pdf.js 6 tears documents down through their loading task
const tasks = new WeakMap<PDFDocumentProxy, { destroy(): Promise<void> }>();

/** Releases the document and its worker-side memory. Safe to call more than once. */
export function closePdf(doc: PDFDocumentProxy | null | undefined): void {
  if (!doc) return;
  void tasks.get(doc)?.destroy();
  tasks.delete(doc);
}

export async function openPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  const task = pdfjs.getDocument({
    data: bytes.slice(), // pdf.js takes ownership of the buffer; keep the caller's copy intact
    password,
    enableXfa: false,
    cMapUrl: `${assetBase}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    wasmUrl: `${assetBase}wasm/`,
    iccUrl: `${assetBase}iccs/`,
    useSystemFonts: false,
    stopAtErrors: false,
  });
  try {
    const doc = await task.promise;
    tasks.set(doc, task);
    return doc;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'PasswordException') throw new Error('This PDF is password-protected. Remove the password with “Protect / Unlock PDF” first.', { cause: e });
    if (name === 'InvalidPDFException') throw new Error('This file is not a valid PDF, or it is damaged.', { cause: e });
    throw e;
  }
}

/** Renders a page into the given canvas, fitting within maxWidth CSS pixels. */
export async function renderPage(doc: PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement, maxWidth: number, extraRotation = 0) {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1, rotation: (page.rotate + extraRotation) % 360 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (maxWidth / base.width) * dpr;
  const viewport = page.getViewport({ scale, rotation: (page.rotate + extraRotation) % 360 });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvas, canvasContext: ctx, viewport, annotationMode: pdfjs.AnnotationMode.ENABLE }).promise;
  page.cleanup();
}

/** Renders a page to PNG bytes at the given DPI (FR-P7 PDF → PNG). */
export async function pageToPng(doc: PDFDocumentProxy, pageNumber: number, dpi: number): Promise<Uint8Array> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: dpi / 72 });
  if (viewport.width * viewport.height > 60_000_000) throw new Error(`Page ${pageNumber} is too large to render at ${dpi} DPI — choose a lower DPI`);
  const canvas = new OffscreenCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
  page.cleanup();
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}
