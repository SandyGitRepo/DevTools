import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import UnitFields, { DecimalPlaces } from '../../components/tool/UnitFields';
import { Select, TextInput } from '../../components/ui/controls';
import { areaUnits, bighaStates, SQFT } from '../../lib/units/units';

export default function AreaTool() {
  const [sqm, setSqm] = useState<number | null>(null);
  const [dp, setDp] = useState(4);
  const [stateId, setStateId] = useState('wb');
  const [custom, setCustom] = useState('');

  const bigha = useMemo(() => {
    if (stateId === 'custom') {
      const n = Number(custom);
      return { sqft: Number.isFinite(n) && n > 0 ? n : 14400, state: 'Custom factor', note: undefined as string | undefined };
    }
    return bighaStates.find((b) => b.id === stateId)!;
  }, [stateId, custom]);
  const units = useMemo(() => areaUnits(bigha.sqft, bigha.state), [bigha]);

  return (
    <ToolShell
      onSample={() => setSqm(2400 * SQFT)}
      onClear={() => setSqm(null)}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Type in any box and every unit updates. 1 sq ft = 0.09290304 m² exactly; 1 acre = 43,560 sq ft; 1 guntha = 1,089 sq ft; 1 cent = 435.6 sq ft.</li>
          <li>
            Bigha varies by state (and often by district). Choose the state; the factor used is shown. For valuation or legal work, confirm with local revenue
            records, or enter a custom factor.
          </li>
        </ul>
      }
    >
      <section className="hud-panel flex flex-wrap items-end gap-4 p-4">
        <Select
          label="Bigha standard"
          value={stateId}
          onChange={setStateId}
          options={[
            ...bighaStates.map((b) => ({ value: b.id, label: `${b.state} — ${b.sqft.toLocaleString('en-IN')} sq ft` })),
            { value: 'custom', label: 'Custom…' },
          ]}
        />
        {stateId === 'custom' && <TextInput label="Sq ft per bigha" value={custom} onChange={setCustom} type="number" className="w-40" />}
        <DecimalPlaces value={dp} onChange={setDp} />
        <p className="flex items-center gap-1.5 pb-2 text-xs text-muted" role="note">
          <Info size={13} aria-hidden="true" /> Bigha factor in use: {bigha.sqft.toLocaleString('en-IN')} sq ft ({bigha.state}
          {bigha.note ? ` · ${bigha.note}` : ''})
        </p>
      </section>
      <UnitFields units={units} base={sqm} onBase={setSqm} dp={dp} columns="sm:grid-cols-2 xl:grid-cols-4" />
    </ToolShell>
  );
}
