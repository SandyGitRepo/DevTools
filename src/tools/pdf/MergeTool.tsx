import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Combine, Trash2, FileText } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import FileDrop from '../../components/tool/FileDrop';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import PdfThumb from '../../components/pdf/PdfThumb';
import PdfResult, { type OutputFile } from '../../components/pdf/PdfResult';
import { loadPdfFile, type LoadedPdf } from '../../components/pdf/usePdfFile';
import { useAction } from '../../components/tool/useAction';
import { pdfOps, sampleFile } from '../../lib/pdf/client';
import { closePdf } from '../../lib/pdf/render';
import { formatBytes } from '../../lib/files';

interface Entry extends LoadedPdf {
  id: number;
}

export default function MergeTool() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [result, setResult] = useState<OutputFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const nextId = useRef(1);
  const live = useRef<Entry[]>([]);
  const { error, run, busy, reset } = useAction();

  live.current = entries;
  useEffect(() => () => live.current.forEach((e) => closePdf(e.doc)), []);

  const add = async (files: File[]) => {
    setLoading(true);
    setResult(null);
    const errs: string[] = [];
    const added: Entry[] = [];
    for (const f of files) {
      try {
        added.push({ ...(await loadPdfFile(f)), id: nextId.current++ });
      } catch (e) {
        errs.push(e instanceof Error ? e.message : `${f.name}: could not open`);
      }
    }
    setEntries((prev) => {
      const all = [...prev, ...added];
      if (all.length > 50) {
        errs.push('Only the first 50 PDFs are kept');
        all.slice(50).forEach((e) => closePdf(e.doc));
        return all.slice(0, 50);
      }
      return all;
    });
    setLoadErrors(errs);
    setLoading(false);
  };

  const move = (i: number, to: number) => {
    if (to < 0 || to >= entries.length) return;
    const next = [...entries];
    const [it] = next.splice(i, 1);
    next.splice(to, 0, it);
    setEntries(next);
    setResult(null);
  };

  const remove = (id: number) => {
    const e = entries.find((x) => x.id === id);
    closePdf(e?.doc);
    setEntries(entries.filter((x) => x.id !== id));
    setResult(null);
  };

  const totalPages = entries.reduce((n, e) => n + e.pageCount, 0);

  const doMerge = () =>
    run(async () => {
      const bytes = await pdfOps.merge(entries.map((e) => ({ name: e.file.name, bytes: e.bytes })));
      setResult([{ name: 'merged.pdf', bytes }]);
    });

  return (
    <ToolShell
      onSample={async () => {
        await add([await sampleFile(3, 'sample-part-A.pdf'), await sampleFile(2, 'sample-part-B.pdf')]);
      }}
      onClear={() => {
        entries.forEach((e) => closePdf(e.doc));
        setEntries([]);
        setResult(null);
        setLoadErrors([]);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Add 2–50 PDFs (drop several at once). Drag cards or use the arrows to set the order, then <b>Merge</b>.
          </li>
          <li>Everything happens in your browser. Password-protected files must be unlocked first.</li>
        </ul>
      }
    >
      <FileDrop
        multiple
        onFiles={(fs) => void add(fs)}
        accept=".pdf,application/pdf"
        label="Drop PDFs here or click to add (up to 50, 100 MB each)"
        compact={entries.length > 0}
      />
      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader /> Reading files…
        </p>
      )}
      {loadErrors.map((m) => (
        <ErrorBox key={m} error={{ message: m }} className="rounded border" />
      ))}
      {entries.length > 0 && (
        <section className="hud-panel space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Order</h2>
            <span className="text-sm text-muted">
              {entries.length} files · {totalPages} pages
            </span>
            <button type="button" className="hud-btn hud-btn-accent ml-auto" onClick={doMerge} disabled={entries.length < 2 || busy}>
              {busy ? <Loader /> : <Combine size={15} aria-hidden="true" />} Merge {entries.length} PDFs
            </button>
          </div>
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
            {entries.map((e, i) => (
              <li
                key={e.id}
                draggable
                onDragStart={() => setDragId(e.id)}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={(ev) => {
                  ev.preventDefault();
                  if (dragId !== null)
                    move(
                      entries.findIndex((x) => x.id === dragId),
                      i,
                    );
                  setDragId(null);
                }}
                className={`flex cursor-grab flex-col items-center gap-1.5 rounded border border-primary/40 bg-[var(--surface-strong)] p-2 ${dragId === e.id ? 'opacity-40' : ''}`}
              >
                <span className="self-start font-mono text-xs text-accent">#{i + 1}</span>
                <PdfThumb doc={e.doc} page={1} width={120} />
                <p className="flex w-full items-center gap-1 truncate text-xs text-fg" title={e.file.name}>
                  <FileText size={12} className="shrink-0 text-cyan" aria-hidden="true" />
                  <span className="truncate">{e.file.name}</span>
                </p>
                <p className="text-[11px] text-muted">
                  {e.pageCount} pp · {formatBytes(e.bytes.length)}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:text-cyan disabled:opacity-30"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    aria-label={`Move ${e.file.name} earlier`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:text-cyan disabled:opacity-30"
                    onClick={() => move(i, i + 1)}
                    disabled={i === entries.length - 1}
                    aria-label={`Move ${e.file.name} later`}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className="rounded p-1 text-muted hover:text-danger" onClick={() => remove(e.id)} aria-label={`Remove ${e.file.name}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      {error && <ErrorBox error={error} className="rounded border" />}
      {result && <PdfResult files={result} />}
    </ToolShell>
  );
}
