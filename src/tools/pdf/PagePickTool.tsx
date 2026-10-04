import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, ListChecks, Square, Trash2, FileOutput } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import PdfPicker from '../../components/pdf/PdfPicker';
import PdfResult, { type OutputFile } from '../../components/pdf/PdfResult';
import PageGrid, { initialItems, type PageItem } from '../../components/pdf/PageGrid';
import { usePdfFile } from '../../components/pdf/usePdfFile';
import { useAction } from '../../components/tool/useAction';
import { ActionBar } from '../../components/tool/layout';
import { TextInput } from '../../components/ui/controls';
import { pdfOps, sampleFile } from '../../lib/pdf/client';
import { formatRanges, parseRanges } from '../../lib/pdf/ranges';

/**
 * Shared implementation for FR-P3 (delete pages) and FR-P6 (extract pages): pick pages by clicking
 * thumbnails or typing ranges; the tool keeps or removes the selection.
 */
export function PagePickTool({ mode }: { mode: 'delete' | 'extract' }) {
  const state = usePdfFile();
  const { pdf } = state;
  const [items, setItems] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ranges, setRanges] = useState('');
  const [result, setResult] = useState<OutputFile[] | null>(null);
  const { error, run, busy, reset, setError } = useAction();
  const del = mode === 'delete';

  useEffect(() => {
    setItems(pdf ? initialItems(pdf.pageCount) : []);
    setSelected(new Set());
    setRanges('');
    setResult(null);
  }, [pdf]);

  // Keep the ranges box in sync with clicked thumbnails
  const syncRanges = (sel: Set<string>) => setRanges(formatRanges(items.filter((i) => sel.has(i.key)).map((i) => i.index)));

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    syncRanges(next);
    setResult(null);
  };

  const applyRanges = () => {
    try {
      const idx = new Set(parseRanges(ranges, pdf!.pageCount));
      const next = new Set(items.filter((i) => idx.has(i.index)).map((i) => i.key));
      setSelected(next);
      setError(null);
      setResult(null);
    } catch (e) {
      setError({ message: (e as Error).message });
    }
  };

  const selectAll = (on: boolean) => {
    const next = on ? new Set(items.map((i) => i.key)) : new Set<string>();
    setSelected(next);
    syncRanges(next);
  };

  const keep = useMemo(() => items.filter((i) => (del ? !selected.has(i.key) : selected.has(i.key))), [items, selected, del]);

  const go = () =>
    run(async () => {
      if (!keep.length) throw new Error(del ? 'You cannot delete every page' : 'Select at least one page to extract');
      const bytes = await pdfOps.organize(
        pdf!.bytes,
        keep.map((i) => ({ index: i.index })),
      );
      const base = pdf!.file.name.replace(/\.pdf$/i, '');
      setResult([{ name: del ? `${base}_edited.pdf` : `${base}_pages_${formatRanges(keep.map((k) => k.index)).replace(/[ ,]+/g, '_')}.pdf`, bytes }]);
    });

  return (
    <ToolShell
      onSample={async () => await state.load(await sampleFile(8))}
      onClear={() => {
        state.clear();
        reset();
      }}
      help={
        del ? (
          <p>
            Click thumbnails to mark pages for removal (they turn red), or type ranges such as <code>2, 5-7</code> and press <b>Select</b>. Then <b>Delete</b>{' '}
            creates a new PDF without them.
          </p>
        ) : (
          <p>
            Click thumbnails or type ranges such as <code>1-3, 9</code> to choose pages, then <b>Extract</b> saves just those pages, in page order, as a new
            PDF.
          </p>
        )
      }
    >
      <PdfPicker state={state} />
      {pdf && (
        <>
          <ActionBar>
            <TextInput
              label={del ? 'Pages to delete' : 'Pages to extract'}
              value={ranges}
              onChange={setRanges}
              mono
              placeholder="e.g. 2, 5-7"
              className="min-w-[14rem] flex-1"
            />
            <button type="button" className="hud-btn" onClick={applyRanges} disabled={!ranges.trim()}>
              <ListChecks size={15} aria-hidden="true" /> Select
            </button>
            <button type="button" className="hud-btn" onClick={() => selectAll(true)}>
              <CheckSquare size={15} aria-hidden="true" /> All
            </button>
            <button type="button" className="hud-btn" onClick={() => selectAll(false)}>
              <Square size={15} aria-hidden="true" /> None
            </button>
            <button type="button" className="hud-btn hud-btn-accent" onClick={go} disabled={busy || selected.size === 0}>
              {busy ? <Loader /> : del ? <Trash2 size={15} aria-hidden="true" /> : <FileOutput size={15} aria-hidden="true" />}
              {del ? `Delete ${selected.size} page${selected.size === 1 ? '' : 's'}` : `Extract ${selected.size} page${selected.size === 1 ? '' : 's'}`}
            </button>
            <span className="self-center text-sm text-muted">
              Result: {keep.length} page{keep.length === 1 ? '' : 's'}
            </span>
          </ActionBar>
          {error && <ErrorBox error={error} className="rounded border" />}
          {result && <PdfResult files={result} />}
          <section className="hud-panel p-4">
            <PageGrid doc={pdf.doc} items={items} selected={selected} onToggle={toggle} selectTone={del ? 'danger' : 'accent'} />
          </section>
        </>
      )}
    </ToolShell>
  );
}

export function DeletePagesTool() {
  return <PagePickTool mode="delete" />;
}
export function ExtractPagesTool() {
  return <PagePickTool mode="extract" />;
}
