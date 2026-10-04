import { useEffect, useState } from 'react';
import { ArrowDownUp, RotateCcw, RotateCw, Undo2, Save } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import PdfPicker from '../../components/pdf/PdfPicker';
import PdfResult, { type OutputFile } from '../../components/pdf/PdfResult';
import PageGrid, { initialItems, type PageItem } from '../../components/pdf/PageGrid';
import { usePdfFile } from '../../components/pdf/usePdfFile';
import { useAction } from '../../components/tool/useAction';
import { ActionBar } from '../../components/tool/layout';
import { pdfOps, sampleFile } from '../../lib/pdf/client';

export default function ReorderTool() {
  const state = usePdfFile();
  const { pdf } = state;
  const [items, setItems] = useState<PageItem[]>([]);
  const [result, setResult] = useState<OutputFile[] | null>(null);
  const { error, run, busy, reset } = useAction();

  useEffect(() => {
    setItems(pdf ? initialItems(pdf.pageCount) : []);
    setResult(null);
  }, [pdf]);

  const update = (next: PageItem[]) => {
    setItems(next);
    setResult(null);
  };
  const rotateAll = (d: number) => update(items.map((i) => ({ ...i, rotate: (((i.rotate + d) % 360) + 360) % 360 })));
  const changed = items.some((it, i) => it.index !== i || it.rotate !== 0);

  const save = () =>
    run(async () => {
      const bytes = await pdfOps.organize(
        pdf!.bytes,
        items.map((i) => ({ index: i.index, rotate: i.rotate })),
      );
      setResult([{ name: `${pdf!.file.name.replace(/\.pdf$/i, '')}_reordered.pdf`, bytes }]);
    });

  return (
    <ToolShell
      onSample={async () => await state.load(await sampleFile(6))}
      onClear={() => {
        state.clear();
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Drag thumbnails to reorder, or use the ‹ › buttons under each page (keyboard friendly).</li>
          <li>
            Rotate single pages with ↺ ↻, or every page with <b>Rotate all</b>. Rotation is added to any rotation the page already has.
          </li>
        </ul>
      }
    >
      <PdfPicker state={state} />
      {pdf && (
        <>
          <ActionBar>
            <button type="button" className="hud-btn" onClick={() => rotateAll(-90)}>
              <RotateCcw size={15} aria-hidden="true" /> Rotate all left
            </button>
            <button type="button" className="hud-btn" onClick={() => rotateAll(90)}>
              <RotateCw size={15} aria-hidden="true" /> Rotate all right
            </button>
            <button type="button" className="hud-btn" onClick={() => update([...items].reverse())}>
              <ArrowDownUp size={15} aria-hidden="true" /> Reverse order
            </button>
            <button type="button" className="hud-btn" onClick={() => update(initialItems(pdf.pageCount))} disabled={!changed}>
              <Undo2 size={15} aria-hidden="true" /> Reset
            </button>
            <button type="button" className="hud-btn hud-btn-accent ml-auto" onClick={save} disabled={busy || !changed}>
              {busy ? <Loader /> : <Save size={15} aria-hidden="true" />} Apply changes
            </button>
          </ActionBar>
          {error && <ErrorBox error={error} className="rounded border" />}
          {result && <PdfResult files={result} />}
          <section className="hud-panel p-4">
            <PageGrid doc={pdf.doc} items={items} onItemsChange={update} reorder rotate />
          </section>
        </>
      )}
    </ToolShell>
  );
}
