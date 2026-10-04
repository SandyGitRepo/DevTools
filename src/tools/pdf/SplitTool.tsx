import { useState } from 'react';
import { Scissors } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import PdfPicker from '../../components/pdf/PdfPicker';
import PdfResult, { type OutputFile } from '../../components/pdf/PdfResult';
import PageGrid, { initialItems } from '../../components/pdf/PageGrid';
import { usePdfFile } from '../../components/pdf/usePdfFile';
import { useAction } from '../../components/tool/useAction';
import { ActionBar } from '../../components/tool/layout';
import { Segmented, TextInput } from '../../components/ui/controls';
import { pdfOps, sampleFile } from '../../lib/pdf/client';

type Mode = 'ranges' | 'every' | 'single';

export default function SplitTool() {
  const state = usePdfFile();
  const { pdf } = state;
  const [mode, setMode] = useState<Mode>('ranges');
  const [ranges, setRanges] = useState('1-2, 3-');
  const [n, setN] = useState('2');
  const [result, setResult] = useState<OutputFile[] | null>(null);
  const { error, run, busy, reset } = useAction();

  const base = pdf?.file.name.replace(/\.pdf$/i, '') || 'document';

  const doSplit = () =>
    run(async () => {
      const m =
        mode === 'ranges' ? { kind: 'ranges' as const, ranges } : mode === 'every' ? { kind: 'every' as const, n: Number(n) } : { kind: 'single' as const };
      setResult(await pdfOps.split(pdf!.bytes, m, base));
    });

  return (
    <ToolShell
      onSample={async () => {
        setResult(null);
        await state.load(await sampleFile(6));
      }}
      onClear={() => {
        state.clear();
        setResult(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>By ranges:</b> each comma-separated group becomes its own file — <code>1-3, 4, 5-</code> gives three files.
          </li>
          <li>
            <b>Every N pages:</b> fixed-size chunks. <b>One file per page:</b> every page separately.
          </li>
          <li>Several outputs can be downloaded one by one or together as a ZIP.</li>
        </ul>
      }
    >
      <PdfPicker state={state} />
      {pdf && (
        <>
          <ActionBar>
            <Segmented
              label="Split"
              value={mode}
              onChange={(m) => (setMode(m), setResult(null))}
              options={[
                { value: 'ranges', label: 'By ranges' },
                { value: 'every', label: 'Every N pages' },
                { value: 'single', label: 'One file per page' },
              ]}
            />
            {mode === 'ranges' && (
              <TextInput label="Ranges (one file each)" value={ranges} onChange={setRanges} mono className="min-w-[14rem] flex-1" placeholder="1-3, 4, 5-" />
            )}
            {mode === 'every' && <TextInput label="Pages per file" value={n} onChange={setN} type="number" className="w-36" />}
            <button type="button" className="hud-btn hud-btn-accent" onClick={doSplit} disabled={busy}>
              {busy ? <Loader /> : <Scissors size={15} aria-hidden="true" />} Split
            </button>
          </ActionBar>
          {error && <ErrorBox error={error} className="rounded border" />}
          {result && <PdfResult files={result} zipName={`${base}_split.zip`} />}
          <section className="hud-panel p-4">
            <h2 className="mb-3 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Source pages</h2>
            <PageGrid doc={pdf.doc} items={initialItems(pdf.pageCount)} />
          </section>
        </>
      )}
    </ToolShell>
  );
}
