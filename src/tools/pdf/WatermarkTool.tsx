import { useState } from 'react';
import { Hash, Stamp } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import PdfPicker from '../../components/pdf/PdfPicker';
import PdfResult, { type OutputFile } from '../../components/pdf/PdfResult';
import { usePdfFile } from '../../components/pdf/usePdfFile';
import { useAction } from '../../components/tool/useAction';
import { ActionBar } from '../../components/tool/layout';
import { Checkbox, Segmented, Select, TextInput } from '../../components/ui/controls';
import { pdfOps, sampleFile } from '../../lib/pdf/client';
import type { NumberPosition } from '../../lib/pdf/ops';

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export default function WatermarkTool() {
  const state = usePdfFile();
  const { pdf } = state;
  const [mode, setMode] = useState<'watermark' | 'numbers'>('watermark');
  // watermark
  const [text, setText] = useState('Confidential');
  const [size, setSize] = useState('54');
  const [opacity, setOpacity] = useState(0.18);
  const [angle, setAngle] = useState('45');
  const [color, setColor] = useState('#c0392b');
  const [pages, setPages] = useState('');
  // numbering
  const [position, setPosition] = useState<NumberPosition>('bottom-center');
  const [format, setFormat] = useState('Page {n} of {total}');
  const [start, setStart] = useState('1');
  const [numSize, setNumSize] = useState('10');
  const [skipFirst, setSkipFirst] = useState(false);
  const [result, setResult] = useState<OutputFile[] | null>(null);
  const { error, run, busy, reset } = useAction();

  const base = pdf?.file.name.replace(/\.pdf$/i, '') ?? 'document';

  const apply = () =>
    run(async () => {
      const bytes =
        mode === 'watermark'
          ? await pdfOps.watermark(pdf!.bytes, { text, fontSize: Number(size), opacity, angle: Number(angle), color: hexToRgb(color), pages })
          : await pdfOps.addPageNumbers(pdf!.bytes, { position, format, start: Number(start) || 1, fontSize: Number(numSize), marginPt: 24, skipFirst });
      setResult([{ name: `${base}_${mode === 'watermark' ? 'watermarked' : 'numbered'}.pdf`, bytes }]);
    });

  return (
    <ToolShell
      onSample={async () => await state.load(await sampleFile(4))}
      onClear={() => {
        state.clear();
        setResult(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Watermark:</b> diagonal text across the centre of each page. Leave “Pages” blank for all pages.
          </li>
          <li>
            <b>Page numbers:</b> use <code>{'{n}'}</code> for the number and <code>{'{total}'}</code> for the count, e.g. <code>{'Page {n} of {total}'}</code>.
          </li>
          <li>Text uses the built-in Helvetica font, so Latin letters, digits and common symbols are supported.</li>
        </ul>
      }
    >
      <PdfPicker state={state} />
      {pdf && (
        <>
          <ActionBar>
            <Segmented
              label="Add"
              value={mode}
              onChange={(m) => (setMode(m), setResult(null))}
              options={[
                { value: 'watermark', label: 'Text watermark' },
                { value: 'numbers', label: 'Page numbers' },
              ]}
            />
          </ActionBar>
          <ActionBar>
            {mode === 'watermark' ? (
              <>
                <TextInput label="Text" value={text} onChange={setText} className="min-w-[14rem] flex-1" />
                <TextInput label="Size (pt)" value={size} onChange={setSize} type="number" className="w-24" />
                <TextInput label="Angle (°)" value={angle} onChange={setAngle} type="number" className="w-24" />
                <label className="flex flex-col">
                  <span className="hud-label">Opacity: {Math.round(opacity * 100)}%</span>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={opacity}
                    onChange={(e) => setOpacity(+e.target.value)}
                    className="w-32 accent-[rgb(var(--accent))]"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="hud-label">Colour</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-14 cursor-pointer rounded border border-primary/50 bg-transparent"
                    aria-label="Watermark colour"
                  />
                </label>
                <TextInput label="Pages (blank = all)" value={pages} onChange={setPages} mono className="w-40" placeholder="e.g. 1-3" />
              </>
            ) : (
              <>
                <Select
                  label="Position"
                  value={position}
                  onChange={setPosition}
                  options={[
                    { value: 'bottom-center', label: 'Bottom centre' },
                    { value: 'bottom-right', label: 'Bottom right' },
                    { value: 'bottom-left', label: 'Bottom left' },
                    { value: 'top-center', label: 'Top centre' },
                    { value: 'top-right', label: 'Top right' },
                    { value: 'top-left', label: 'Top left' },
                  ]}
                />
                <TextInput label="Format" value={format} onChange={setFormat} className="min-w-[12rem] flex-1" />
                <TextInput label="Start at" value={start} onChange={setStart} type="number" className="w-24" />
                <TextInput label="Size (pt)" value={numSize} onChange={setNumSize} type="number" className="w-24" />
                <div className="pb-2">
                  <Checkbox label="Skip first page (cover)" checked={skipFirst} onChange={setSkipFirst} />
                </div>
              </>
            )}
            <button type="button" className="hud-btn hud-btn-accent" onClick={apply} disabled={busy}>
              {busy ? <Loader /> : mode === 'watermark' ? <Stamp size={15} aria-hidden="true" /> : <Hash size={15} aria-hidden="true" />} Apply
            </button>
          </ActionBar>
          {error && <ErrorBox error={error} className="rounded border" />}
          {result && <PdfResult files={result} />}
        </>
      )}
    </ToolShell>
  );
}
