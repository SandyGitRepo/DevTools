import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import Loader from '../../components/ui/Loader';
import { TwoPane } from '../../components/tool/layout';
import { useHandoff } from '../../components/tool/useHandoff';
import { TextArea } from '../../components/ui/controls';
import { parseLiteral, segments, type RegexResult } from '../../lib/utils/regex';

const TIMEOUT_MS = 5000;
const FLAGS = [
  { f: 'g', label: 'global' },
  { f: 'i', label: 'ignore case' },
  { f: 'm', label: 'multiline' },
  { f: 's', label: 'dotAll' },
  { f: 'u', label: 'unicode' },
  { f: 'y', label: 'sticky' },
];

const REFERENCE: [string, string][] = [
  ['.', 'any character (except newline unless s)'],
  ['\\d \\w \\s', 'digit · word char · whitespace'],
  ['\\D \\W \\S', 'negated versions'],
  ['[abc] [^abc] [a-z]', 'character sets'],
  ['^ $', 'start · end (of line with m)'],
  ['\\b', 'word boundary'],
  ['* + ?', '0+ · 1+ · 0 or 1'],
  ['{3} {2,5} {2,}', 'exact · range · at least'],
  ['*? +?', 'lazy (as few as possible)'],
  ['(x) (?:x)', 'capture · group without capture'],
  ['(?<name>x)', 'named group → $<name>'],
  ['a|b', 'alternation'],
  ['(?=x) (?!x)', 'lookahead · negative'],
  ['(?<=x) (?<!x)', 'lookbehind · negative'],
  ['$1 $<name> $&', 'replace: group · named · whole match'],
];

const SAMPLE = {
  pattern: '\\b(?<pan>[A-Z]{5}\\d{4}[A-Z])\\b|(?<pin>\\b[1-8]\\d{5}\\b)',
  text: 'Applicant PAN ABCPE1234F, PIN 411001.\nCo-applicant pan: XYZPK9876L, pin 560034.\nInvalid: ABC1234, 012345',
  replace: '[$<pan>$<pin>]',
};

export default function RegexTool() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('');
  const [replace, setReplace] = useState('');
  const [useReplace, setUseReplace] = useState(false);
  const [result, setResult] = useState<RegexResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const busy = useRef(false);

  useHandoff((t) => {
    const lit = parseLiteral(t);
    if (lit) {
      setPattern(lit.pattern);
      setFlags(lit.flags || 'g');
    } else setPattern(t.trim());
  });

  const newWorker = () => {
    worker.current?.terminate();
    worker.current = new Worker(new URL('../../workers/regex.worker.ts', import.meta.url), { type: 'module', name: 'regex' });
    return worker.current;
  };
  useEffect(() => () => worker.current?.terminate(), []);

  // Live evaluation in a worker with a hard 5 s timeout (ReDoS guard)
  useEffect(() => {
    if (!pattern) {
      setResult(null);
      setError(null);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(() => {
      // A still-running worker may be stuck on a catastrophic pattern: replace it
      const w = busy.current || !worker.current ? newWorker() : worker.current;
      busy.current = true;
      setRunning(true);
      const timer = setTimeout(() => {
        if (seq.current !== id) return;
        newWorker();
        busy.current = false;
        setRunning(false);
        setResult(null);
        setError(`Stopped after ${TIMEOUT_MS / 1000} s — this pattern takes too long (catastrophic backtracking). Avoid nested quantifiers such as (a+)+.`);
      }, TIMEOUT_MS);
      w.onmessage = (e: MessageEvent<{ id: number; result?: RegexResult; error?: string }>) => {
        if (e.data.id !== id) return;
        clearTimeout(timer);
        busy.current = false;
        setRunning(false);
        if (e.data.error) {
          setError(e.data.error);
          setResult(null);
        } else {
          setError(null);
          setResult(e.data.result!);
        }
      };
      w.postMessage({ id, pattern, flags, text, replacement: useReplace ? replace : undefined });
    }, 200);
    return () => clearTimeout(t);
  }, [pattern, flags, text, replace, useReplace]);

  const segs = useMemo(() => (result ? segments(text, result.matches) : [{ text }]), [result, text]);

  const toggleFlag = (f: string) => setFlags((cur) => (cur.includes(f) ? cur.replace(f, '') : cur + f));

  const onPatternChange = (v: string) => {
    const lit = parseLiteral(v);
    if (lit && v.trim().startsWith('/')) {
      setPattern(lit.pattern);
      if (lit.flags) setFlags(lit.flags);
    } else setPattern(v);
  };

  return (
    <ToolShell
      onSample={() => {
        setPattern(SAMPLE.pattern);
        setText(SAMPLE.text);
        setReplace(SAMPLE.replace);
        setFlags('g');
      }}
      onClear={() => {
        setPattern('');
        setText('');
        setReplace('');
        setResult(null);
        setError(null);
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Uses the JavaScript (ECMAScript) regex engine — the same one as Node.js and browsers. Java, .NET and PCRE differ in some details.</li>
          <li>
            You can paste a literal like <code>/^\d{'{6}'}$/gm</code> into the pattern box; the flags are picked up automatically.
          </li>
          <li>Matching runs in a background worker and is stopped after 5 seconds, so a runaway pattern cannot freeze the page.</li>
        </ul>
      }
    >
      <section className="hud-panel space-y-3 p-4">
        <div className="flex items-stretch gap-2">
          <span className="flex items-center font-mono text-lg text-muted">/</span>
          <label className="sr-only" htmlFor="regex-pattern">
            Pattern
          </label>
          <input
            id="regex-pattern"
            className="hud-input flex-1 font-mono text-base"
            value={pattern}
            onChange={(e) => onPatternChange(e.target.value)}
            placeholder="Regular expression, e.g. \b\d{6}\b"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="flex items-center font-mono text-lg text-muted">/{flags}</span>
          {running && (
            <span className="flex items-center">
              <Loader label="Matching" />
            </span>
          )}
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Flags</legend>
          {FLAGS.map(({ f, label }) => (
            <label
              key={f}
              className={`cursor-pointer rounded border px-2.5 py-1 font-mono text-xs focus-within:outline focus-within:outline-2 focus-within:outline-accent ${
                flags.includes(f) ? 'border-cyan bg-cyan/15 text-fg' : 'border-primary/40 text-muted'
              }`}
            >
              <input type="checkbox" className="sr-only" checked={flags.includes(f)} onChange={() => toggleFlag(f)} />
              {f} <span className="font-sans">{label}</span>
            </label>
          ))}
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={useReplace} onChange={(e) => setUseReplace(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
            Replace
          </label>
        </fieldset>
        {useReplace && (
          <input
            aria-label="Replacement"
            className="hud-input font-mono"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replacement, e.g. $1 or $<name>"
            spellCheck={false}
          />
        )}
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded border border-danger/40 bg-danger/10 p-2 text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
          </div>
        )}
      </section>
      <TwoPane>
        <div className="space-y-3">
          <TextArea label="Test string" value={text} onChange={setText} rows={8} placeholder="Paste text to test against" />
          <section className="hud-panel p-3" aria-label="Highlighted matches">
            <div className="mb-2 flex items-center gap-3">
              <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Matches</h2>
              {result && (
                <span className="font-mono text-[11px] text-muted" role="status">
                  {result.matches.length} match{result.matches.length === 1 ? '' : 'es'}
                  {result.truncated ? ' (first 5,000)' : ''} · {result.ms} ms
                </span>
              )}
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
              {segs.map((s, i) =>
                s.match !== undefined ? (
                  <mark key={i} className={`rounded-sm px-0.5 text-fg ${s.match % 2 ? 'bg-accent/40' : 'bg-cyan/35'}`} title={`Match ${s.match + 1}`}>
                    {s.text}
                  </mark>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )}
            </pre>
          </section>
          {useReplace && result?.replaced !== undefined && <TextArea label="Result after replace" value={result.replaced} readOnly rows={5} />}
        </div>
        <div className="space-y-3">
          <section className="hud-panel max-h-[26rem] overflow-auto p-3" aria-label="Match details">
            <h2 className="mb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Groups</h2>
            {result && result.matches.length > 0 ? (
              <table className="hud-table font-mono text-xs">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>At</th>
                    <th>Match</th>
                    <th>Groups</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matches.slice(0, 500).map((m, i) => (
                    <tr key={i}>
                      <td className="text-muted">{i + 1}</td>
                      <td className="text-muted">{m.index}</td>
                      <td className="break-all text-cyan">{m.text || <em className="text-muted">(empty)</em>}</td>
                      <td className="break-all">
                        {m.groups
                          .filter((g) => g.value !== undefined)
                          .map((g) => (
                            <div key={g.name}>
                              <span className="text-accent">{g.name}</span>: {g.value}
                            </div>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">{pattern ? 'No matches.' : 'Enter a pattern.'}</p>
            )}
          </section>
          <section className="hud-panel p-3" aria-label="Quick reference">
            <h2 className="mb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Quick reference</h2>
            <table className="w-full text-xs">
              <tbody>
                {REFERENCE.map(([k, v]) => (
                  <tr key={k}>
                    <td className="whitespace-nowrap py-0.5 pr-3 font-mono text-cyan">{k}</td>
                    <td className="py-0.5 text-muted">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </TwoPane>
    </ToolShell>
  );
}
