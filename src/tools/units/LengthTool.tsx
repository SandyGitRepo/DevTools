import { useState } from 'react';
import ToolShell from '../../components/tool/ToolShell';
import UnitFields, { DecimalPlaces } from '../../components/tool/UnitFields';
import { lengthUnits, parseLength, toFeetInches } from '../../lib/units/units';

export default function LengthTool() {
  const [metres, setMetres] = useState<number | null>(null);
  const [dp, setDp] = useState(4);
  const [mixed, setMixed] = useState('');
  const [mixedErr, setMixedErr] = useState(false);

  const onMixed = (text: string) => {
    setMixed(text);
    if (!text.trim()) {
      setMixedErr(false);
      return;
    }
    const m = parseLength(text);
    setMixedErr(m === null);
    if (m !== null) setMetres(m);
  };

  const fi = metres !== null ? toFeetInches(metres, Math.min(dp, 2)) : null;

  return (
    <ToolShell
      onSample={() => onMixed(`5' 8"`)}
      onClear={() => {
        setMetres(null);
        setMixed('');
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Type in any box and every other unit updates. Exact factors: 1 in = 2.54 cm, 1 ft = 30.48 cm, 1 yd = 0.9144 m.</li>
          <li>
            The mixed box accepts <code>5' 8"</code>, <code>5'8</code>, <code>5 ft 8 in</code>, <code>68 in</code>, <code>172.7 cm</code> or <code>1.73 m</code>
            .
          </li>
        </ul>
      }
    >
      <section className="hud-panel flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="mixed-length" className="hud-label">
            Feet + inches (mixed input)
          </label>
          <input
            id="mixed-length"
            className={`hud-input font-mono text-lg ${mixedErr ? 'border-danger' : ''}`}
            value={mixed}
            onChange={(e) => onMixed(e.target.value)}
            placeholder={`e.g. 5' 8" or 5 ft 8 in`}
            aria-invalid={mixedErr}
            autoComplete="off"
          />
          {mixedErr && <p className="mt-1 text-xs text-danger">Not recognised — try 5' 8", 5 ft 8 in or 170 cm</p>}
        </div>
        {fi && (
          <p className="pb-2 font-hud text-2xl text-fg" role="status">
            {fi.ft}′ {fi.inch}″
          </p>
        )}
        <DecimalPlaces value={dp} onChange={setDp} />
      </section>
      <UnitFields units={lengthUnits} base={metres} onBase={(m) => (setMetres(m), setMixed(''))} dp={dp} columns="sm:grid-cols-2 xl:grid-cols-4" />
    </ToolShell>
  );
}
