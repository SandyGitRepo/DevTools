import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatNumber, fromBase, toBase, type Unit } from '../../lib/units/units';
import { copyText } from '../../lib/files';

/**
 * Two-way unit fields (section 3.7): editing any field updates every other field instantly.
 * The field being edited keeps the user's raw text; the rest show the converted value.
 */
export default function UnitFields({
  units,
  base,
  onBase,
  dp,
  columns = 'sm:grid-cols-2 xl:grid-cols-3',
}: {
  units: Unit[];
  base: number | null;
  onBase: (v: number | null) => void;
  dp: number;
  columns?: string;
}) {
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [copied, setCopied] = useState('');

  const change = (u: Unit, text: string) => {
    setEditing({ id: u.id, text });
    const clean = text.replace(/,/g, '').trim();
    if (!clean) return onBase(null);
    const n = Number(clean);
    if (Number.isFinite(n)) onBase(toBase(u, n));
  };

  return (
    <div className={`grid grid-cols-1 gap-3 ${columns}`}>
      {units.map((u) => {
        const shown = editing?.id === u.id ? editing.text : base === null ? '' : formatNumber(fromBase(u, base), dp);
        const invalid = editing?.id === u.id && editing.text.trim() !== '' && !Number.isFinite(Number(editing.text.replace(/,/g, '').trim()));
        return (
          <div key={u.id} className="hud-panel p-3">
            <label htmlFor={`unit-${u.id}`} className="hud-label">
              {u.label}
            </label>
            <div className="flex gap-1.5">
              <input
                id={`unit-${u.id}`}
                inputMode="decimal"
                className={`hud-input font-mono ${invalid ? 'border-danger' : ''}`}
                value={shown}
                onChange={(e) => change(u, e.target.value)}
                onBlur={() => setEditing(null)}
                aria-invalid={invalid}
                autoComplete="off"
              />
              <button
                type="button"
                className="hud-btn px-2"
                disabled={!shown}
                aria-label={`Copy ${u.label}`}
                onClick={async () => {
                  if (await copyText(shown)) {
                    setCopied(u.id);
                    setTimeout(() => setCopied(''), 1000);
                  }
                }}
              >
                {copied === u.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>
            {u.note && <p className="mt-1 text-[11px] text-muted">{u.note}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function DecimalPlaces({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col">
      <span className="hud-label">Decimal places</span>
      <select className="hud-input w-28" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {[0, 1, 2, 3, 4, 6, 8].map((n) => (
          <option key={n} value={n} className="bg-navy">
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
