import { useCallback, useEffect, useRef, useState } from 'react';
import { closePdf, openPdf, type PDFDocumentProxy } from '../../lib/pdf/render';
import { assertPdf, MAX_PDF_BYTES, MAX_PDF_PAGES } from '../../lib/pdf/ops';
import { readFileAsBytes } from '../../lib/files';

export interface LoadedPdf {
  file: File;
  bytes: Uint8Array;
  doc: PDFDocumentProxy;
  pageCount: number;
}

/** Reads and validates a PDF (SEC-1) and opens it with pdf.js for thumbnails. Destroys the previous document. */
export async function loadPdfFile(file: File): Promise<LoadedPdf> {
  const bytes = await readFileAsBytes(file, MAX_PDF_BYTES);
  assertPdf(bytes, file.name);
  const doc = await openPdf(bytes);
  if (doc.numPages > MAX_PDF_PAGES) {
    closePdf(doc);
    throw new Error(`${file.name} has ${doc.numPages} pages; the limit is ${MAX_PDF_PAGES}`);
  }
  return { file, bytes, doc, pageCount: doc.numPages };
}

export function usePdfFile() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<LoadedPdf | null>(null);

  const replace = (next: LoadedPdf | null) => {
    closePdf(current.current?.doc);
    current.current = next;
    setPdf(next);
  };

  const load = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      replace(await loadPdfFile(file));
    } catch (e) {
      replace(null);
      setError(e instanceof Error ? e.message : 'Could not open the PDF');
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    replace(null);
    setError(null);
  }, []);

  useEffect(() => () => closePdf(current.current?.doc), []);

  return { pdf, load, clear, loading, error, setError };
}
