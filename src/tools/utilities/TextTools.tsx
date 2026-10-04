import { useMemo, useState } from 'react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import { TwoPane } from '../../components/tool/layout';
import { useHandoff } from '../../components/tool/useHandoff';
import { cases, convertCase, lineOp, stats, type CaseId, type LineOp } from '../../lib/utils/text';

const LINE_OPS: { id: LineOp; label: string }[] = [
  { id: 'trim', label: 'Trim lines' },
  { id: 'removeEmpty', label: 'Remove empty lines' },
  { id: 'dedupe', label: 'Remove duplicates' },
  { id: 'dedupeCi', label: 'Remove duplicates (ignore case)' },
  { id: 'sortAsc', label: 'Sort A→Z' },
  { id: 'sortDesc', label: 'Sort Z→A' },
  { id: 'sortNatural', label: 'Sort natural (item2 < item10)' },
  { id: 'sortNumeric', label: 'Sort numeric' },
  { id: 'reverse', label: 'Reverse order' },
  { id: 'shuffle', label: 'Shuffle' },
  { id: 'number', label: 'Number lines' },
  { id: 'join', label: 'Join with commas' },
];

const SAMPLE = `customer id
loan amount
emi due date
Customer ID
kyc status
loan amount`;

export default function TextTools() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  useHandoff(setInput);
  const s = useMemo(() => stats(input), [input]);

  const btn = 'rounded border border-primary/40 px-2.5 py-1 text-xs hover:border-cyan hover:bg-primary/15 disabled:opacity-40';

  return (
    <ToolShell
      onSample={() => setInput(SAMPLE)}
      onClear={() => {
        setInput('');
        setOutput('');
      }}
      help={
        <p>
          Case conversions apply to each line separately, so a list of field names stays one per line. Line tools work on the input; use{' '}
          <b>Use output as input</b> to chain operations.
        </p>
      }
    >
      <section className="hud-panel space-y-3 p-4">
        <div>
          <h2 className="hud-label">Change case</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(cases) as CaseId[]).map((id) => (
              <button key={id} type="button" className={`${btn} font-mono`} disabled={!input} onClick={() => setOutput(convertCase(input, id))}>
                {cases[id].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="hud-label">Lines</h2>
          <div className="flex flex-wrap gap-2">
            {LINE_OPS.map((o) => (
              <button key={o.id} type="button" className={btn} disabled={!input} onClick={() => setOutput(lineOp(input, o.id))}>
                {o.label}
              </button>
            ))}
            <button type="button" className={`${btn} border-accent/60 text-accent`} disabled={!output} onClick={() => setInput(output)}>
              ↑ Use output as input
            </button>
          </div>
        </div>
      </section>
      <section className="hud-panel grid grid-cols-2 gap-3 p-4 text-center sm:grid-cols-4 lg:grid-cols-7" aria-label="Statistics" role="status">
        {[
          ['Characters', s.characters],
          ['No spaces', s.charactersNoSpaces],
          ['Words', s.words],
          ['Lines', s.lines],
          ['Sentences', s.sentences],
          ['UTF-8 bytes', s.bytesUtf8],
          ['Reading', `${s.readingMinutes} min`],
        ].map(([k, v]) => (
          <div key={k as string}>
            <div className="font-hud text-xl text-fg">{typeof v === 'number' ? v.toLocaleString('en-IN') : v}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted">{k}</div>
          </div>
        ))}
      </section>
      <TwoPane>
        <EditorPane title="Input" value={input} onChange={setInput} acceptFile=".txt,.csv,.log,.md" className="h-[45vh] min-h-[240px]" />
        <EditorPane title="Output" value={output} readOnly downloadName="text.txt" className="h-[45vh] min-h-[240px]" />
      </TwoPane>
    </ToolShell>
  );
}
