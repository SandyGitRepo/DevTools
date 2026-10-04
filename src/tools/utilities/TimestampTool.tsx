import { useEffect, useMemo, useState } from 'react';
import { Clock, Copy, Check } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import ErrorBox from '../../components/tool/ErrorBox';
import { ActionBar } from '../../components/tool/layout';
import { useHandoff } from '../../components/tool/useHandoff';
import { Select, TextInput } from '../../components/ui/controls';
import { allZones, epochToDate, humanInZone, isoInZone, parseDate, relative, type EpochUnit } from '../../lib/utils/time';
import { copyText } from '../../lib/files';

function Row({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <tr>
      <th scope="row" className="w-44 whitespace-nowrap font-medium normal-case tracking-normal">
        {label}
      </th>
      <td className="break-all font-mono text-xs">{value}</td>
      <td className="w-10">
        <button
          type="button"
          className="rounded p-1 text-muted hover:text-cyan"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            if (await copyText(value)) {
              setDone(true);
              setTimeout(() => setDone(false), 1000);
            }
          }}
        >
          {done ? <Check size={14} className="text-success" /> : <Copy size={14} />}
        </button>
      </td>
    </tr>
  );
}

export default function TimestampTool() {
  const zones = useMemo(allZones, []);
  const [input, setInput] = useState('');
  const [unit, setUnit] = useState<EpochUnit | 'auto'>('auto');
  const [zone, setZone] = useState('Asia/Kolkata');
  const [extraZone, setExtraZone] = useState('America/New_York');
  const [now, setNow] = useState(() => new Date());
  useHandoff(setInput);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const parsed = useMemo(() => {
    if (!input.trim()) return null;
    try {
      if (/^-?\d+(\.\d+)?$/.test(input.trim())) {
        const r = epochToDate(input, unit);
        return { date: r.date, note: `Read as ${{ s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds' }[r.unit]} since 1970-01-01 UTC` };
      }
      return { date: parseDate(input, zone), note: `Read as a date${/[zZ]|[+-]\d{2}:?\d{2}$/.test(input.trim()) ? ' with its own offset' : ` in ${zone}`}` };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [input, unit, zone]);

  const d = parsed && 'date' in parsed ? parsed.date : null;

  return (
    <ToolShell
      onSample={() => setInput('1791610000')}
      onClear={() => setInput('')}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Paste an epoch number (seconds, milliseconds, micro- or nanoseconds — detected from its size) or a date.</li>
          <li>
            Dates without an offset, such as <code>2026-10-04 15:30</code>, are read in the selected zone (IST by default). ISO dates with <code>Z</code> or{' '}
            <code>+05:30</code> keep their own offset.
          </li>
          <li>Daylight-saving time is handled for every zone using your browser’s time-zone database.</li>
        </ul>
      }
    >
      <section className="hud-panel flex flex-wrap items-center gap-4 p-4">
        <Clock size={20} className="text-cyan" aria-hidden="true" />
        <div className="font-mono text-sm">
          <div>
            <span className="text-muted">Now (epoch s): </span>
            <button type="button" className="text-cyan hover:underline" onClick={() => setInput(String(Math.floor(now.getTime() / 1000)))}>
              {Math.floor(now.getTime() / 1000)}
            </button>
            <span className="ml-4 text-muted">ms: </span>
            <button type="button" className="text-cyan hover:underline" onClick={() => setInput(String(now.getTime()))}>
              {now.getTime()}
            </button>
          </div>
          <div className="text-muted">{humanInZone(now, 'Asia/Kolkata')} IST</div>
        </div>
      </section>
      <ActionBar>
        <TextInput
          label="Epoch or date"
          value={input}
          onChange={setInput}
          mono
          placeholder="1791610000 · 2026-10-04 15:30 · 2026-10-04T10:00:00Z"
          className="min-w-[18rem] flex-1"
        />
        <Select
          label="Epoch unit"
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'auto', label: 'Auto-detect' },
            { value: 's', label: 'Seconds' },
            { value: 'ms', label: 'Milliseconds' },
            { value: 'us', label: 'Microseconds' },
            { value: 'ns', label: 'Nanoseconds' },
          ]}
        />
        <Select label="Zone for dates without offset" value={zone} onChange={setZone} options={zones} />
      </ActionBar>
      {parsed && 'error' in parsed && <ErrorBox error={{ message: parsed.error! }} className="rounded border" />}
      {d && (
        <section className="hud-panel p-4">
          <p className="mb-2 text-xs text-muted">{parsed && 'note' in parsed ? parsed.note : ''}</p>
          <table className="hud-table">
            <tbody>
              <Row label="IST (Asia/Kolkata)" value={`${humanInZone(d, 'Asia/Kolkata')}`} />
              <Row label="ISO-8601 (IST)" value={isoInZone(d, 'Asia/Kolkata')} />
              <Row label="ISO-8601 (UTC)" value={isoInZone(d, 'UTC')} />
              <Row label="UTC" value={humanInZone(d, 'UTC')} />
              <Row
                label={`${zone === 'Asia/Kolkata' ? 'Your browser' : zone}`}
                value={zone === 'Asia/Kolkata' ? d.toString() : `${humanInZone(d, zone)} · ${isoInZone(d, zone)}`}
              />
              <Row label="RFC 2822 / HTTP" value={d.toUTCString()} />
              <Row label="Epoch seconds" value={String(Math.floor(d.getTime() / 1000))} />
              <Row label="Epoch milliseconds" value={String(d.getTime())} />
              <Row label="Relative" value={relative(d, now)} />
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Select label="Also show in" value={extraZone} onChange={setExtraZone} options={zones} />
            <p className="pb-2 font-mono text-sm">
              {humanInZone(d, extraZone)} <span className="text-muted">({isoInZone(d, extraZone)})</span>
            </p>
          </div>
        </section>
      )}
    </ToolShell>
  );
}
