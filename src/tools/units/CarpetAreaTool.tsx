import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import { Segmented, TextInput } from '../../components/ui/controls';
import { estimateAreas, formatNumber, SQFT, type AreaEstimate } from '../../lib/units/units';

const LABELS: Record<keyof AreaEstimate, string> = { carpet: 'Carpet area', builtUp: 'Built-up area', superBuiltUp: 'Super built-up area' };

export default function CarpetAreaTool() {
  const [known, setKnown] = useState<keyof AreaEstimate>('carpet');
  const [value, setValue] = useState('');
  const [walls, setWalls] = useState('10');
  const [loading, setLoading] = useState('30');
  const [unit, setUnit] = useState<'sqft' | 'sqm'>('sqft');

  const est = useMemo(() => {
    const v = Number(value);
    if (!value || !Number.isFinite(v) || v <= 0) return null;
    return estimateAreas(v, known, Number(walls) || 0, Number(loading) || 0);
  }, [value, known, walls, loading]);

  const other = (v: number) => (unit === 'sqft' ? `${formatNumber(v * SQFT, 2)} m²` : `${formatNumber(v / SQFT, 2)} sq ft`);

  return (
    <ToolShell
      onSample={() => {
        setKnown('superBuiltUp');
        setValue('1250');
      }}
      onClear={() => setValue('')}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Built-up = carpet × (1 + walls & balcony %). Super built-up = built-up × (1 + loading %) for common areas (lobby, lifts, stairs, clubhouse).</li>
          <li>Typical values: walls/balcony 10–15 %, loading 25–35 %. Use the builder’s stated loading where known.</li>
          <li>Under RERA, flats must be sold on carpet area. This tool gives an estimate only — it is not a valuation.</li>
        </ul>
      }
    >
      <p className="flex items-center gap-2 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn" role="note">
        <AlertTriangle size={16} aria-hidden="true" /> Estimate only — not a valuation and not the legal RERA carpet area. Verify against the approved plan.
      </p>
      <section className="hud-panel flex flex-wrap items-end gap-4 p-4">
        <Segmented
          label="I know the"
          value={known}
          onChange={setKnown}
          options={[
            { value: 'carpet', label: 'Carpet' },
            { value: 'builtUp', label: 'Built-up' },
            { value: 'superBuiltUp', label: 'Super built-up' },
          ]}
        />
        <TextInput label={`${LABELS[known]} (${unit === 'sqft' ? 'sq ft' : 'm²'})`} value={value} onChange={setValue} type="number" className="w-48" />
        <Segmented
          label="Unit"
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'sqft', label: 'sq ft' },
            { value: 'sqm', label: 'm²' },
          ]}
        />
        <TextInput label="Walls & balcony %" value={walls} onChange={setWalls} type="number" className="w-36" />
        <TextInput label="Loading %" value={loading} onChange={setLoading} type="number" className="w-32" />
      </section>
      {est && (
        <section className="grid gap-3 sm:grid-cols-3" role="status">
          {(Object.keys(LABELS) as (keyof AreaEstimate)[]).map((k) => (
            <div key={k} className={`hud-panel p-4 ${k === known ? 'ring-1 ring-accent' : ''}`}>
              <p className="text-xs uppercase tracking-wider text-muted">{LABELS[k]}</p>
              <p className="font-hud text-2xl text-fg">
                {formatNumber(est[k], 1)} <span className="text-sm text-muted">{unit === 'sqft' ? 'sq ft' : 'm²'}</span>
              </p>
              <p className="text-xs text-muted">≈ {other(est[k])}</p>
            </div>
          ))}
        </section>
      )}
      {est && (
        <p className="text-sm text-muted">
          Carpet is {formatNumber((est.carpet / est.superBuiltUp) * 100, 1)} % of super built-up (loading factor{' '}
          {formatNumber(est.superBuiltUp / est.carpet, 3)}).
        </p>
      )}
    </ToolShell>
  );
}
