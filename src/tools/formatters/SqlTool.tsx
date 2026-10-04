import { useState } from 'react';
import { Minimize2, Play } from 'lucide-react';
import type { KeywordCase } from 'sql-formatter';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Select } from '../../components/ui/controls';
import { dialects, formatSql, minifySql, type Dialect } from '../../lib/formatters/sql';

const SAMPLE = `select c.customer_id, c.full_name, sum(l.amount) as total_exposure, count(*) loans
from customers c join loans l on l.customer_id = c.customer_id
where l.status in ('ACTIVE','NPA') and l.disbursed_on >= to_date('2026-04-01','YYYY-MM-DD')
group by c.customer_id, c.full_name having sum(l.amount) > 1000000 order by total_exposure desc
fetch first 20 rows only;`;

export default function SqlTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [dialect, setDialect] = useState<Dialect>('plsql');
  const [kwCase, setKwCase] = useState<KeywordCase>('upper');
  const [indent, setIndent] = useState('2');
  const { error, status, run, reset } = useAction();
  useHandoff(setInput);

  return (
    <ToolShell
      onSample={() => setInput(SAMPLE)}
      onClear={() => {
        setInput('');
        setOutput('');
        reset();
      }}
      help={
        <p>
          Choose the dialect so vendor syntax (e.g. Oracle <code>CONNECT BY</code>, T-SQL <code>TOP</code>, PostgreSQL <code>::</code> casts) is understood.{' '}
          <b>Minify</b> strips comments and whitespace but never touches string literals or quoted identifiers.
        </p>
      }
    >
      <ActionBar>
        <Select label="Dialect" value={dialect} onChange={setDialect} options={dialects} />
        <Select
          label="Keywords"
          value={kwCase}
          onChange={setKwCase}
          options={[
            { value: 'upper', label: 'UPPER' },
            { value: 'lower', label: 'lower' },
            { value: 'preserve', label: 'Preserve' },
          ]}
        />
        <Select
          label="Indent"
          value={indent}
          onChange={setIndent}
          options={[
            { value: '2', label: '2 spaces' },
            { value: '4', label: '4 spaces' },
          ]}
        />
        <button
          type="button"
          className="hud-btn hud-btn-accent"
          disabled={!input}
          onClick={() => run(() => setOutput(formatSql(input, dialect, kwCase, +indent)), { success: 'Formatted' })}
        >
          <Play size={15} aria-hidden="true" /> Format
        </button>
        <button type="button" className="hud-btn" disabled={!input} onClick={() => run(() => setOutput(minifySql(input)), { success: 'Minified' })}>
          <Minimize2 size={15} aria-hidden="true" /> Minify
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane title="Input" value={input} onChange={setInput} language="sql" acceptFile=".sql,.txt" error={error} detectFrom="sql" />
        <EditorPane title="Output" value={output} readOnly language="sql" downloadName="formatted.sql" />
      </TwoPane>
    </ToolShell>
  );
}
