import { useMemo, useState } from 'react';
import ToolShell from '../../components/tool/ToolShell';
import { IN, FT, toFeetInches, formatNumber } from '../../lib/units/units';

export default function HeightTool() {
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [cm, setCm] = useState('');

  const fromFtIn = (f: string, i: string) => {
    setFt(f);
    setInch(i);
    const F = Number(f || 0);
    const I = Number(i || 0);
    if ((f || i) && Number.isFinite(F) && Number.isFinite(I)) setCm(formatNumber((F * FT + I * IN) * 100, 2));
    else setCm('');
  };
  const fromCm = (c: string) => {
    setCm(c);
    const n = Number(c);
    if (c && Number.isFinite(n)) {
      const r = toFeetInches(n / 100, 1);
      setFt(String(r.ft));
      setInch(String(r.inch));
    } else {
      setFt('');
      setInch('');
    }
  };

  const table = useMemo(() => Array.from({ length: 37 }, (_, k) => 48 + k), []); // 4'0" … 7'0"
  const currentIn = Math.round(Number(ft || 0) * 12 + Number(inch || 0));

  return (
    <ToolShell
      onSample={() => fromFtIn('5', '8')}
      onClear={() => fromFtIn('', '')}
      help={<p>Enter feet and inches, or centimetres. The reference table covers 4′ 0″ to 7′ 0″ in 1-inch steps (1 in = 2.54 cm exactly).</p>}
    >
      <section className="hud-panel grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-end">
        <div>
          <label htmlFor="h-ft" className="hud-label">
            Feet
          </label>
          <input id="h-ft" inputMode="numeric" className="hud-input font-mono text-lg" value={ft} onChange={(e) => fromFtIn(e.target.value, inch)} />
        </div>
        <div>
          <label htmlFor="h-in" className="hud-label">
            Inches
          </label>
          <input id="h-in" inputMode="decimal" className="hud-input font-mono text-lg" value={inch} onChange={(e) => fromFtIn(ft, e.target.value)} />
        </div>
        <span className="hidden pb-2 text-center font-hud text-xl text-muted sm:block" aria-hidden="true">
          ⇄
        </span>
        <div>
          <label htmlFor="h-cm" className="hud-label">
            Centimetres
          </label>
          <input id="h-cm" inputMode="decimal" className="hud-input font-mono text-lg" value={cm} onChange={(e) => fromCm(e.target.value)} />
        </div>
      </section>
      <section className="hud-panel p-4">
        <h2 className="mb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Reference table</h2>
        <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((col) => (
            <table key={col} className="hud-table font-mono text-sm">
              <thead>
                <tr>
                  <th>ft / in</th>
                  <th className="text-right">cm</th>
                </tr>
              </thead>
              <tbody>
                {table.slice(col * 10, col * 10 + 10).map((total) => (
                  <tr key={total} className={total === currentIn && (ft || inch) ? 'bg-accent/20' : ''}>
                    <td>
                      {Math.floor(total / 12)}′ {total % 12}″
                    </td>
                    <td className="text-right">{(total * 2.54).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </section>
    </ToolShell>
  );
}
