import { useEffect, useState } from 'react';
import { Download, FileArchive, ShieldCheck } from 'lucide-react';
import PdfThumb from './PdfThumb';
import Loader from '../ui/Loader';
import { closePdf, openPdf, type PDFDocumentProxy } from '../../lib/pdf/render';
import { pdfOps } from '../../lib/pdf/client';
import { downloadBlob, formatBytes } from '../../lib/files';

export interface OutputFile {
  name: string;
  bytes: Uint8Array;
}

const PREVIEW_PAGES = 12;

/** Shows a preview of the produced PDF(s) before download (section 3.4: "every operation shows a preview"). */
export default function PdfResult({ files, zipName = 'pdfs.zip', note }: { files: OutputFile[]; zipName?: string; note?: string }) {
  const [active, setActive] = useState(0);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const file = files[Math.min(active, files.length - 1)];

  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    setDoc(null);
    setErr(null);
    openPdf(file.bytes)
      .then((d) => {
        opened = d;
        if (cancelled) closePdf(d);
        else setDoc(d);
      })
      .catch((e) => !cancelled && setErr(e.message));
    return () => {
      cancelled = true;
      closePdf(opened);
    };
  }, [file]);

  const total = files.reduce((n, f) => n + f.bytes.length, 0);

  return (
    <section className="hud-panel space-y-3 p-4" aria-label="Result preview">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-success">Result ready</h2>
        <span className="text-sm text-muted">
          {files.length > 1 ? `${files.length} files · ` : ''}
          {doc ? `${doc.numPages} page${doc.numPages === 1 ? '' : 's'} · ` : ''}
          {formatBytes(files.length > 1 ? total : file.bytes.length)}
        </span>
        <span className="flex items-center gap-1 text-xs text-success" title="Scripts, launch actions and embedded files are removed from every output (SEC-3)">
          <ShieldCheck size={13} aria-hidden="true" /> Scripts & attachments removed
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            className="hud-btn hud-btn-accent"
            onClick={() => downloadBlob(new Blob([file.bytes as BlobPart], { type: 'application/pdf' }), file.name)}
          >
            <Download size={15} aria-hidden="true" /> Download{files.length > 1 ? ' this file' : ''}
          </button>
          {files.length > 1 && (
            <button
              type="button"
              className="hud-btn"
              onClick={async () => downloadBlob(new Blob([(await pdfOps.zipFiles(files)) as BlobPart], { type: 'application/zip' }), zipName)}
            >
              <FileArchive size={15} aria-hidden="true" /> Download all (ZIP)
            </button>
          )}
        </div>
      </div>
      {note && <p className="text-sm text-muted">{note}</p>}
      {files.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Output files">
          {files.map((f, i) => (
            <button
              key={f.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`rounded border px-2 py-1 font-mono text-xs ${i === active ? 'border-cyan bg-cyan/15 text-fg' : 'border-primary/40 text-muted hover:text-fg'}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
      {err && (
        <p role="alert" className="text-sm text-danger">
          {err}
        </p>
      )}
      {!doc && !err && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader /> Rendering preview…
        </p>
      )}
      {doc && (
        <>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: Math.min(doc.numPages, PREVIEW_PAGES) }, (_, i) => (
              <div key={i} className="shrink-0 rounded border border-primary/30 p-1 text-center">
                <PdfThumb doc={doc} page={i + 1} width={110} />
                <span className="font-mono text-[10px] text-muted">{i + 1}</span>
              </div>
            ))}
          </div>
          {doc.numPages > PREVIEW_PAGES && (
            <p className="text-xs text-muted">
              Showing the first {PREVIEW_PAGES} of {doc.numPages} pages.
            </p>
          )}
        </>
      )}
    </section>
  );
}
