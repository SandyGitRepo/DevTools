import { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import ErrorBox from '../../components/tool/ErrorBox';
import { ActionBar } from '../../components/tool/layout';
import { useHandoff } from '../../components/tool/useHandoff';
import { Segmented, Select } from '../../components/ui/controls';
import { describe, nextRuns, type CronDialect } from '../../lib/utils/cron';
import { allZones, humanInZone, isoInZone } from '../../lib/utils/time';

const EXAMPLES: Record<CronDialect, [string, string][]> = {
  unix: [
    ['*/15 * * * *', 'every 15 minutes'],
    ['30 9 * * 1-5', 'weekdays at 09:30'],
    ['0 2 1 * *', '02:00 on the 1st'],
    ['0 18 * * 5', 'Fridays 18:00'],
  ],
  quartz: [
    ['0 0/30 9-18 ? * MON-FRI', 'every 30 min, office hours'],
    ['0 0 12 ? * 6#3', 'third Friday at noon'],
    ['0 0 0 L * ?', 'midnight, last day of month'],
  ],
  aws: [
    ['cron(0 12 * * ? *)', 'daily 12:00 UTC'],
    ['cron(15 10 ? * MON-FRI *)', 'weekdays 10:15'],
    ['cron(0 18 L * ? *)', 'last day of month 18:00'],
  ],
};

const FIELDS: Record<CronDialect, string> = {
  unix: 'minute · hour · day-of-month · month · day-of-week (0–6, Sun = 0)',
  quartz: 'second · minute · hour · day-of-month · month · day-of-week (1–7, Sun = 1) · [year]',
  aws: 'minute · hour · day-of-month · month · day-of-week (1–7, Sun = 1) · year',
};

export default function CronTool() {
  const zones = useMemo(allZones, []);
  const [dialect, setDialect] = useState<CronDialect>('unix');
  const [expr, setExpr] = useState('');
  const [zone, setZone] = useState('Asia/Kolkata');
  useHandoff((t) => {
    const v = t.trim();
    setExpr(v);
    // Pick the dialect from the shape: cron(...) is EventBridge; 6–7 fields with ? is Quartz
    if (/^cron\(/i.test(v)) setDialect('aws');
    else if (v.split(/\s+/).length >= 6) setDialect('quartz');
  });

  const result = useMemo(() => {
    if (!expr.trim()) return null;
    try {
      return { text: describe(expr, dialect), runs: nextRuns(expr, dialect, dialect === 'aws' ? 'UTC' : zone, 10) };
    } catch (e) {
      return { error: (e as Error).message.replace(/^Error: /, '') };
    }
  }, [expr, dialect, zone]);

  return (
    <ToolShell
      onSample={() => setExpr(EXAMPLES[dialect][1][0])}
      onClear={() => setExpr('')}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Unix/Linux</b> crontab and Kubernetes CronJobs use 5 fields. <b>Quartz</b> (Spring, Java schedulers) adds seconds first and an optional year.{' '}
            <b>AWS EventBridge</b> uses 6 fields with year last, wrapped in <code>cron(…)</code>, and always runs in UTC.
          </li>
          <li>
            Quartz and EventBridge number weekdays 1–7 starting Sunday; this tool converts them correctly. They also require <code>?</code> in either
            day-of-month or day-of-week.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Dialect"
          value={dialect}
          onChange={setDialect}
          options={[
            { value: 'unix', label: 'Unix / K8s' },
            { value: 'quartz', label: 'Quartz / Spring' },
            { value: 'aws', label: 'AWS EventBridge' },
          ]}
        />
        {dialect !== 'aws' && <Select label="Time zone" value={zone} onChange={setZone} options={zones} />}
      </ActionBar>
      <section className="hud-panel space-y-3 p-4">
        <label htmlFor="cron-expr" className="hud-label">
          Expression — {FIELDS[dialect]}
        </label>
        <input
          id="cron-expr"
          className="hud-input font-mono text-lg"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder={EXAMPLES[dialect][0][0]}
          spellCheck={false}
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES[dialect].map(([e, label]) => (
            <button
              key={e}
              type="button"
              className="rounded border border-primary/40 px-2 py-1 text-xs text-muted hover:border-cyan hover:text-fg"
              onClick={() => setExpr(e)}
            >
              <code className="text-cyan">{e}</code> — {label}
            </button>
          ))}
        </div>
      </section>
      {result && 'error' in result && <ErrorBox error={{ message: result.error! }} className="rounded border" />}
      {result && 'text' in result && (
        <>
          <section className="hud-panel flex items-start gap-3 p-4">
            <CalendarClock size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <p className="text-lg text-fg" role="status">
              {result.text}
            </p>
          </section>
          <section className="hud-panel p-4">
            <h2 className="mb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">
              Next {result.runs!.length} runs ({dialect === 'aws' ? 'UTC' : zone})
            </h2>
            <ol className="space-y-1 font-mono text-sm">
              {result.runs!.map((d, i) => (
                <li key={i} className="flex flex-wrap gap-x-4">
                  <span className="w-6 text-right text-muted">{i + 1}.</span>
                  <span>{humanInZone(d, dialect === 'aws' ? 'UTC' : zone)}</span>
                  <span className="text-muted">{isoInZone(d, dialect === 'aws' ? 'UTC' : zone)}</span>
                  {dialect === 'aws' && <span className="text-muted">= {humanInZone(d, 'Asia/Kolkata')} IST</span>}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </ToolShell>
  );
}
