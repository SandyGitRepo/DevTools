import { useState } from 'react';
import { Check, X } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import { contrastRatio, parseColour, toHex, toHslString, toRgbString, wcag, type RGB } from '../../lib/utils/colour';

function ColourInput({ label, value, onChange }: { label: string; value: RGB; onChange: (c: RGB) => void }) {
  const [edit, setEdit] = useState<{ field: string; text: string } | null>(null);
  const [err, setErr] = useState('');
  const fields: [string, string][] = [
    ['HEX', toHex(value)],
    ['RGB', toRgbString(value)],
    ['HSL', toHslString(value)],
  ];
  const change = (field: string, text: string) => {
    setEdit({ field, text });
    try {
      onChange(parseColour(text));
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <section className="hud-panel space-y-3 p-4">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={toHex({ ...value, a: 1 }).slice(0, 7)}
          onChange={(e) => onChange({ ...parseColour(e.target.value), a: value.a })}
          className="h-12 w-16 cursor-pointer rounded border border-primary/50 bg-transparent"
          aria-label={`${label} picker`}
        />
        <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">{label}</h2>
      </div>
      {fields.map(([f, v]) => (
        <div key={f}>
          <label htmlFor={`${label}-${f}`} className="hud-label">
            {f}
          </label>
          <input
            id={`${label}-${f}`}
            className="hud-input font-mono"
            value={edit?.field === f ? edit.text : v}
            onChange={(e) => change(f, e.target.value)}
            onBlur={() => setEdit(null)}
            spellCheck={false}
          />
        </div>
      ))}
      {err && (
        <p role="alert" className="text-xs text-danger">
          {err}
        </p>
      )}
    </section>
  );
}

const Pass = ({ ok, label }: { ok: boolean; label: string }) => (
  <div className={`flex items-center gap-1.5 rounded border px-3 py-2 text-sm ${ok ? 'border-success/50 text-success' : 'border-danger/50 text-danger'}`}>
    {ok ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />} {label} — {ok ? 'pass' : 'fail'}
  </div>
);

export default function ColourTool() {
  const [fg, setFg] = useState<RGB>(parseColour('#E8F1FA'));
  const [bg, setBg] = useState<RGB>(parseColour('#001A33'));
  const ratio = contrastRatio(fg, bg);
  const w = wcag(ratio);
  return (
    <ToolShell
      onSample={() => {
        setFg(parseColour('#F37021'));
        setBg(parseColour('#FFFFFF'));
      }}
      onClear={() => {
        setFg(parseColour('#000000'));
        setBg(parseColour('#FFFFFF'));
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Edit HEX, RGB or HSL (or use the picker); the other formats follow. Alpha is supported in #RRGGBBAA, rgba() and hsla().</li>
          <li>Contrast follows WCAG 2.1: normal text needs 4.5:1 for AA (7:1 for AAA); large text (18 pt, or 14 pt bold) needs 3:1 (4.5:1 for AAA).</li>
        </ul>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ColourInput label="Text colour" value={fg} onChange={setFg} />
        <ColourInput label="Background" value={bg} onChange={setBg} />
      </div>
      <section className="hud-panel grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded border border-primary/30 p-6" style={{ background: toRgbString(bg), color: toRgbString(fg) }}>
          <p className="text-2xl font-bold">Large heading text</p>
          <p className="mt-2 text-sm">Normal body text — the quick brown fox jumps over the lazy dog. ₹ 1,25,000.00</p>
        </div>
        <div className="space-y-3">
          <p className="font-hud text-3xl text-fg" role="status">
            {ratio.toFixed(2)} : 1
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Pass ok={w.aaNormal} label="AA normal" />
            <Pass ok={w.aaLarge} label="AA large" />
            <Pass ok={w.aaaNormal} label="AAA normal" />
            <Pass ok={w.aaaLarge} label="AAA large" />
          </div>
          <button
            type="button"
            className="hud-btn"
            onClick={() => {
              setFg(bg);
              setBg(fg);
            }}
          >
            Swap colours
          </button>
        </div>
      </section>
    </ToolShell>
  );
}
