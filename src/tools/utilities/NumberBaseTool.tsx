import { useState } from 'react';
import ToolShell from '../../components/tool/ToolShell';
import UnitFields, { DecimalPlaces } from '../../components/tool/UnitFields';
import { Checkbox, Select } from '../../components/ui/controls';
import { formatBase, parseBase, twosComplement, byteUnits, type Base } from '../../lib/utils/numberBase';
import type { Unit } from '../../lib/units/units';

const BASES: { base: Base; label: string }[] = [
  { base: 10, label: 'Decimal (base 10)' },
  { base: 16, label: 'Hexadecimal (base 16)' },
  { base: 8, label: 'Octal (base 8)' },
  { base: 2, label: 'Binary (base 2)' },
];

const BYTE_UNITS: Unit[] = byteUnits.map((u) => ({ id: u.id, label: u.id, factor: u.factor }));

export default function NumberBaseTool() {
  const [value, setValue] = useState<bigint | null>(null);
  const [editing, setEditing] = useState<{ base: Base; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState(true);
  const [bits, setBits] = useState('32');
  const [bytes, setBytes] = useState<number | null>(null);
  const [dp, setDp] = useState(3);

  const change = (base: Base, text: string) => {
    setEditing({ base, text });
    if (!text.trim()) {
      setValue(null);
      setError(null);
      return;
    }
    try {
      setValue(parseBase(text, base));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  let tc: { unsigned: bigint; signed: bigint } | null = null;
  let tcErr = '';
  if (value !== null) {
    try {
      tc = twosComplement(value, Number(bits));
    } catch (e) {
      tcErr = (e as Error).message;
    }
  }

  return (
    <ToolShell
      onSample={() => change(10, '3735928559')}
      onClear={() => {
        setValue(null);
        setEditing(null);
        setError(null);
        setBytes(null);
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Type in any field; the others update. Numbers of any size are supported (BigInt). Prefixes <code>0x</code>, <code>0o</code>, <code>0b</code> and
            separators (spaces, underscores, commas) are accepted.
          </li>
          <li>
            The two’s-complement view shows how a value is stored in a fixed-width signed integer (e.g. Java <code>int</code> = 32 bits).
          </li>
          <li>Byte sizes: KB/MB/GB are decimal (1000), KiB/MiB/GiB are binary (1024) — disks use the former, RAM and most OSes the latter.</li>
        </ul>
      }
    >
      <section className="space-y-3">
        <div className="flex items-center gap-4">
          <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Number base</h2>
          <Checkbox label="Group digits" checked={group} onChange={setGroup} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {BASES.map(({ base, label }) => (
            <div key={base} className="hud-panel p-3">
              <label htmlFor={`base-${base}`} className="hud-label">
                {label}
              </label>
              <input
                id={`base-${base}`}
                className="hud-input font-mono"
                value={editing?.base === base ? editing.text : value === null ? '' : formatBase(value, base, group)}
                onChange={(e) => change(base, e.target.value)}
                onBlur={() => setEditing(null)}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {value !== null && (
          <div className="hud-panel flex flex-wrap items-end gap-4 p-3">
            <Select label="Two's complement width" value={bits} onChange={setBits} options={['8', '16', '32', '64']} />
            {tc ? (
              <p className="pb-2 font-mono text-sm">
                unsigned <span className="text-cyan">{tc.unsigned.toString()}</span> · signed <span className="text-cyan">{tc.signed.toString()}</span> · hex{' '}
                <span className="text-cyan">{formatBase(tc.unsigned, 16).padStart(Number(bits) / 4, '0')}</span>
              </p>
            ) : (
              <p className="pb-2 text-sm text-warn">{tcErr}</p>
            )}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <div className="flex items-end gap-4">
          <h2 className="pb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Byte size</h2>
          <DecimalPlaces value={dp} onChange={setDp} />
        </div>
        <UnitFields units={BYTE_UNITS} base={bytes} onBase={setBytes} dp={dp} columns="sm:grid-cols-3 xl:grid-cols-5" />
      </section>
    </ToolShell>
  );
}
