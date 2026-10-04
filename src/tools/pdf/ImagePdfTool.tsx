import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, FileImage, Images, Trash2 } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import ErrorBox from '../../components/tool/ErrorBox';
import FileDrop from '../../components/tool/FileDrop';
import Loader from '../../components/ui/Loader';
import StatusLine from '../../components/tool/StatusLine';
import PdfPicker from '../../components/pdf/PdfPicker';
import PdfResult, { type OutputFile } from '../../components/pdf/PdfResult';
import { usePdfFile } from '../../components/pdf/usePdfFile';
import { useAction } from '../../components/tool/useAction';
import { ActionBar } from '../../components/tool/layout';
import { Segmented, Select, TextInput } from '../../components/ui/controls';
import { pdfOps, sampleFile } from '../../lib/pdf/client';
import { pageToPng } from '../../lib/pdf/render';
import { parseRanges } from '../../lib/pdf/ranges';
import { downloadBlob, formatBytes, readFileAsBytes } from '../../lib/files';
import type { Orientation, PageSize } from '../../lib/pdf/ops';

interface Img {
  id: number;
  file: File;
  url: string;
}
let seq = 1;

function ImagesToPdf() {
  const [imgs, setImgs] = useState<Img[]>([]);
  const [size, setSize] = useState<PageSize>('A4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [margin, setMargin] = useState('10');
  const [result, setResult] = useState<OutputFile[] | null>(null);
  const { error, run, busy } = useAction();

  const live = useRef<Img[]>([]);
  live.current = imgs;
  useEffect(() => () => live.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const add = (files: File[]) => {
    const ok = files.filter((f) => /image\/(png|jpeg)/.test(f.type) || /\.(png|jpe?g)$/i.test(f.name));
    setImgs((prev) => [...prev, ...ok.map((file) => ({ id: seq++, file, url: URL.createObjectURL(file) }))]);
    setResult(null);
  };
  const removeImg = (im: Img) => {
    URL.revokeObjectURL(im.url);
    setImgs(imgs.filter((x) => x.id !== im.id));
    setResult(null);
  };
  const move = (i: number, to: number) => {
    if (to < 0 || to >= imgs.length) return;
    const next = [...imgs];
    const [it] = next.splice(i, 1);
    next.splice(to, 0, it);
    setImgs(next);
    setResult(null);
  };

  const make = () =>
    run(async () => {
      const bytes = await pdfOps.imagesToPdf(
        await Promise.all(imgs.map((i) => readFileAsBytes(i.file, 50 * 1024 * 1024))),
        size,
        orientation,
        Number(margin) || 0,
      );
      setResult([{ name: 'images.pdf', bytes }]);
    });

  return (
    <div className="space-y-4">
      <FileDrop multiple onFiles={add} accept="image/png,image/jpeg" label="Drop JPG / PNG images here or click to add" compact={imgs.length > 0} />
      {imgs.length > 0 && (
        <>
          <ActionBar>
            <Select
              label="Page size"
              value={size}
              onChange={setSize}
              options={[
                { value: 'A4', label: 'A4' },
                { value: 'Letter', label: 'Letter' },
                { value: 'Legal', label: 'Legal' },
                { value: 'fit', label: 'Fit to image' },
              ]}
            />
            {size !== 'fit' && (
              <Select
                label="Orientation"
                value={orientation}
                onChange={setOrientation}
                options={[
                  { value: 'auto', label: 'Auto (match image)' },
                  { value: 'portrait', label: 'Portrait' },
                  { value: 'landscape', label: 'Landscape' },
                ]}
              />
            )}
            <TextInput label="Margin (mm)" value={margin} onChange={setMargin} type="number" className="w-28" />
            <button type="button" className="hud-btn hud-btn-accent" onClick={make} disabled={busy}>
              {busy ? <Loader /> : <FileImage size={15} aria-hidden="true" />} Create PDF ({imgs.length} page{imgs.length === 1 ? '' : 's'})
            </button>
          </ActionBar>
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {imgs.map((im, i) => (
              <li key={im.id} className="flex flex-col items-center gap-1 rounded border border-primary/40 bg-[var(--surface-strong)] p-2">
                <span className="self-start font-mono text-xs text-accent">#{i + 1}</span>
                <img src={im.url} alt={im.file.name} className="h-32 w-full rounded bg-white/90 object-contain" />
                <span className="w-full truncate text-[11px] text-muted" title={im.file.name}>
                  {im.file.name}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:text-cyan disabled:opacity-30"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Move earlier"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:text-cyan disabled:opacity-30"
                    onClick={() => move(i, i + 1)}
                    disabled={i === imgs.length - 1}
                    aria-label="Move later"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:text-danger"
                    onClick={() => removeImg(im)}
                    aria-label={`Remove ${im.file.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {error && <ErrorBox error={error} className="rounded border" />}
      {result && <PdfResult files={result} />}
    </div>
  );
}

function PdfToImages({ initialFile }: { initialFile?: File | null }) {
  const state = usePdfFile();
  const { pdf } = state;
  const { load } = state;
  useEffect(() => {
    if (initialFile) void load(initialFile);
  }, [initialFile, load]);
  const [dpi, setDpi] = useState('150');
  const [ranges, setRanges] = useState('');
  const [pngs, setPngs] = useState<{ name: string; bytes: Uint8Array; url: string }[]>([]);
  const [progress, setProgress] = useState('');
  const { error, run, busy, status } = useAction();

  useEffect(() => () => pngs.forEach((p) => URL.revokeObjectURL(p.url)), [pngs]);
  useEffect(() => setPngs([]), [pdf]);

  const convert = () =>
    run(
      async () => {
        const pages = ranges.trim() ? parseRanges(ranges, pdf!.pageCount) : Array.from({ length: pdf!.pageCount }, (_, i) => i);
        if (pages.length > 300) throw new Error('Convert at most 300 pages at a time (use page ranges)');
        const base = pdf!.file.name.replace(/\.pdf$/i, '');
        const out: { name: string; bytes: Uint8Array; url: string }[] = [];
        for (const [k, p] of pages.entries()) {
          setProgress(`Rendering page ${p + 1} (${k + 1}/${pages.length})…`);
          const bytes = await pageToPng(pdf!.doc, p + 1, Number(dpi));
          out.push({ name: `${base}_p${p + 1}.png`, bytes, url: URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' })) });
        }
        setProgress('');
        setPngs(out);
        return out.length;
      },
      { success: (n) => `Rendered ${n} page(s)` },
    );

  return (
    <div className="space-y-4">
      <PdfPicker state={state} />
      {pdf && (
        <ActionBar>
          <Select
            label="Resolution"
            value={dpi}
            onChange={setDpi}
            options={[
              { value: '72', label: '72 DPI (screen)' },
              { value: '150', label: '150 DPI' },
              { value: '300', label: '300 DPI (print)' },
            ]}
          />
          <TextInput label="Pages (blank = all)" value={ranges} onChange={setRanges} mono placeholder="e.g. 1-3" className="w-48" />
          <button type="button" className="hud-btn hud-btn-accent" onClick={convert} disabled={busy}>
            {busy ? <Loader /> : <Images size={15} aria-hidden="true" />} Convert to PNG
          </button>
          {pngs.length > 1 && (
            <button
              type="button"
              className="hud-btn"
              onClick={async () =>
                downloadBlob(
                  new Blob([(await pdfOps.zipFiles(pngs.map(({ name, bytes }) => ({ name, bytes })))) as BlobPart], { type: 'application/zip' }),
                  'pages-png.zip',
                )
              }
            >
              <Download size={15} aria-hidden="true" /> Download all (ZIP)
            </button>
          )}
          <div className="self-center text-sm text-muted">{progress || <StatusLine status={status} />}</div>
        </ActionBar>
      )}
      {error && <ErrorBox error={error} className="rounded border" />}
      {pngs.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {pngs.map((p) => (
            <li key={p.name} className="flex flex-col items-center gap-1 rounded border border-primary/40 bg-[var(--surface-strong)] p-2">
              <img src={p.url} alt={p.name} className="h-40 w-full rounded bg-white object-contain" />
              <span className="w-full truncate text-[11px] text-muted">{p.name}</span>
              <button
                type="button"
                className="hud-btn px-2 py-1 text-xs"
                onClick={() => downloadBlob(new Blob([p.bytes as BlobPart], { type: 'image/png' }), p.name)}
              >
                <Download size={13} aria-hidden="true" /> {formatBytes(p.bytes.length)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ImagePdfTool() {
  const [dir, setDir] = useState<'to-pdf' | 'to-png'>('to-pdf');
  const [nonce, setNonce] = useState(0);
  const [sample, setSample] = useState<File | null>(null);
  return (
    <ToolShell
      onSample={async () => {
        setDir('to-png');
        setSample(await sampleFile(3));
        setNonce((n) => n + 1);
      }}
      onClear={() => {
        setSample(null);
        setNonce((n) => n + 1);
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Images → PDF:</b> one image per page, scaled to fit inside the margins; order them first.
          </li>
          <li>
            <b>PDF → PNG:</b> renders pages at the chosen DPI; several pages download as a ZIP.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Direction"
          value={dir}
          onChange={(d) => (setDir(d), setNonce((n) => n + 1))}
          options={[
            { value: 'to-pdf', label: 'Images → PDF' },
            { value: 'to-png', label: 'PDF → PNG' },
          ]}
        />
      </ActionBar>
      <div key={nonce}>{dir === 'to-pdf' ? <ImagesToPdf /> : <PdfToImages initialFile={sample} />}</div>
    </ToolShell>
  );
}
