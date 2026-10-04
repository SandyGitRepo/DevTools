import { useState } from 'react';
import { FilePlus2 } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import ErrorBox from '../../components/tool/ErrorBox';
import FileDrop from '../../components/tool/FileDrop';
import Loader from '../../components/ui/Loader';
import PdfPicker from '../../components/pdf/PdfPicker';
import PdfResult, { type OutputFile } from '../../components/pdf/PdfResult';
import PageGrid, { initialItems } from '../../components/pdf/PageGrid';
import { usePdfFile } from '../../components/pdf/usePdfFile';
import { useAction } from '../../components/tool/useAction';
import { ActionBar } from '../../components/tool/layout';
import { Segmented, Select, TextInput } from '../../components/ui/controls';
import { pdfOps, sampleFile } from '../../lib/pdf/client';
import { readFileAsBytes } from '../../lib/files';
import { MAX_PDF_BYTES } from '../../lib/pdf/ops';

type Source = 'blank' | 'pdf' | 'images';

export default function InsertTool() {
  const state = usePdfFile();
  const { pdf } = state;
  const [where, setWhere] = useState<'before' | 'after'>('after');
  const [pageNo, setPageNo] = useState('1');
  const [source, setSource] = useState<Source>('blank');
  const [count, setCount] = useState('1');
  const [otherPdf, setOtherPdf] = useState<File | null>(null);
  const [otherRanges, setOtherRanges] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [result, setResult] = useState<OutputFile[] | null>(null);
  const { error, run, busy, reset } = useAction();

  const go = () =>
    run(async () => {
      const n = Number(pageNo);
      if (!Number.isInteger(n) || n < 1 || n > pdf!.pageCount) throw new Error(`Choose a page between 1 and ${pdf!.pageCount}`);
      const position = where === 'before' ? n - 1 : n;
      let src: Parameters<typeof pdfOps.insertPages>[2];
      if (source === 'blank') src = { kind: 'blank', count: Number(count) };
      else if (source === 'pdf') {
        if (!otherPdf) throw new Error('Choose the PDF to insert pages from');
        src = { kind: 'pdf', bytes: await readFileAsBytes(otherPdf, MAX_PDF_BYTES), ranges: otherRanges };
      } else {
        if (!images.length) throw new Error('Choose one or more JPG/PNG images');
        src = { kind: 'images', images: await Promise.all(images.map((f) => readFileAsBytes(f, 50 * 1024 * 1024))) };
      }
      const bytes = await pdfOps.insertPages(pdf!.bytes, position, src);
      setResult([{ name: `${pdf!.file.name.replace(/\.pdf$/i, '')}_inserted.pdf`, bytes }]);
    });

  return (
    <ToolShell
      onSample={async () => await state.load(await sampleFile(4))}
      onClear={() => {
        state.clear();
        setOtherPdf(null);
        setImages([]);
        setResult(null);
        reset();
      }}
      help={
        <p>
          Choose where to insert (before or after a page), then what: blank pages the same size as that page, selected pages from another PDF, or JPG/PNG images
          (each image becomes a page, fitted with a small margin).
        </p>
      }
    >
      <PdfPicker state={state} />
      {pdf && (
        <>
          <ActionBar>
            <Select
              label="Insert"
              value={where}
              onChange={setWhere}
              options={[
                { value: 'after', label: 'After page' },
                { value: 'before', label: 'Before page' },
              ]}
            />
            <TextInput label={`Page (1–${pdf.pageCount})`} value={pageNo} onChange={setPageNo} type="number" className="w-32" />
            <Segmented
              label="What"
              value={source}
              onChange={setSource}
              options={[
                { value: 'blank', label: 'Blank pages' },
                { value: 'pdf', label: 'Pages from a PDF' },
                { value: 'images', label: 'Images' },
              ]}
            />
            {source === 'blank' && <TextInput label="How many" value={count} onChange={setCount} type="number" className="w-28" />}
            {source === 'pdf' && (
              <TextInput label="Pages to take (blank = all)" value={otherRanges} onChange={setOtherRanges} mono placeholder="e.g. 1-2" className="w-48" />
            )}
            <button type="button" className="hud-btn hud-btn-accent" onClick={go} disabled={busy}>
              {busy ? <Loader /> : <FilePlus2 size={15} aria-hidden="true" />} Insert
            </button>
          </ActionBar>
          {source === 'pdf' && (
            <FileDrop onFile={setOtherPdf} file={otherPdf} accept=".pdf,application/pdf" label="Choose the PDF to take pages from" compact />
          )}
          {source === 'images' && (
            <FileDrop
              multiple
              onFiles={setImages}
              accept="image/png,image/jpeg"
              label={images.length ? `${images.length} image(s): ${images.map((i) => i.name).join(', ')}` : 'Choose JPG or PNG images'}
              compact
            />
          )}
          {error && <ErrorBox error={error} className="rounded border" />}
          {result && <PdfResult files={result} />}
          <section className="hud-panel p-4">
            <h2 className="mb-3 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Current pages</h2>
            <PageGrid doc={pdf.doc} items={initialItems(pdf.pageCount)} />
          </section>
        </>
      )}
    </ToolShell>
  );
}
