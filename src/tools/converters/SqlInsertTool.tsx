import { useState } from 'react';
import { Database } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Checkbox, Segmented, Select, TextInput } from '../../components/ui/controls';
import { generateInserts, sqlDialects, type SqlDialect } from '../../lib/convert/sqlInsert';
import { parseCsv, recordsFromJson } from '../../lib/convert/csv';
import { parseJson } from '../../lib/formatters/jsonError';

const SAMPLE = `customer_id,full_name,city,credit_limit,kyc_verified,notes
10293,Asha Verma,Pune,500000,true,
10294,"D'Souza, Neil",Mumbai,250000.50,false,"Prefers ""email"" contact"
10295,Meera Iyer,Chennai,980000,true,VIP`;

export default function SqlInsertTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [inputKind, setInputKind] = useState<'csv' | 'json'>('csv');
  const [dialect, setDialect] = useState<SqlDialect>('oracle');
  const [table, setTable] = useState('CUSTOMERS');
  const [batch, setBatch] = useState('100');
  const [emptyAsNull, setEmptyAsNull] = useState(true);
  const [quote, setQuote] = useState(false);
  const [create, setCreate] = useState(false);
  const { error, status, run, reset } = useAction();
  useHandoff(setInput);

  const go = () =>
    run(
      () => {
        const rows =
          inputKind === 'csv'
            ? (parseCsv(input, { delimiter: 'auto', header: true, dynamicTyping: true }).rows as Record<string, unknown>[])
            : recordsFromJson(parseJson(input));
        setOutput(generateInserts(rows, { table, dialect, batchSize: Number(batch), emptyAsNull, quoteIdentifiers: quote, createTable: create }));
        return rows.length;
      },
      { source: input, success: (n) => `${n} row(s) → INSERT statements` },
    );

  return (
    <ToolShell
      onSample={() => {
        setInputKind('csv');
        setInput(SAMPLE);
      }}
      onClear={() => {
        setInput('');
        setOutput('');
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Input is CSV with a header row, or a JSON array of objects. Numbers and booleans are detected; everything else is quoted with <code>''</code>{' '}
            escaping (plus backslash escaping for MySQL/MariaDB).
          </li>
          <li>
            Multi-row statements use <code>INSERT ALL … SELECT 1 FROM DUAL</code> on Oracle and <code>VALUES (…), (…)</code> elsewhere (max 1,000 rows per
            statement on SQL Server).
          </li>
          <li>
            Identifiers are quoted only when needed — quoting in Oracle/PostgreSQL makes names case-sensitive. “Create table” infers column types from the data;
            review before running.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Input"
          value={inputKind}
          onChange={setInputKind}
          options={[
            { value: 'csv', label: 'CSV' },
            { value: 'json', label: 'JSON' },
          ]}
        />
        <Select label="Dialect" value={dialect} onChange={setDialect} options={sqlDialects} />
        <TextInput label="Table" value={table} onChange={setTable} mono className="w-44" />
        <Select
          label="Rows per statement"
          value={batch}
          onChange={setBatch}
          options={[
            { value: '1', label: '1 (one per row)' },
            { value: '50', label: '50' },
            { value: '100', label: '100' },
            { value: '500', label: '500' },
            { value: '1000', label: '1000' },
          ]}
        />
        <div className="grid grid-cols-1 gap-1 pb-1 sm:grid-cols-2 sm:gap-x-4">
          <Checkbox label="Empty → NULL" checked={emptyAsNull} onChange={setEmptyAsNull} />
          <Checkbox label="Quote all identifiers" checked={quote} onChange={setQuote} />
          <Checkbox label="Add CREATE TABLE" checked={create} onChange={setCreate} />
        </div>
        <button type="button" className="hud-btn hud-btn-accent" onClick={go} disabled={!input}>
          <Database size={15} aria-hidden="true" /> Generate
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane
          title={inputKind.toUpperCase()}
          value={input}
          onChange={setInput}
          language={inputKind === 'json' ? 'json' : 'plaintext'}
          acceptFile=".csv,.json,.txt"
          error={error}
        />
        <EditorPane title="SQL" value={output} readOnly language="sql" downloadName={`${table || 'insert'}.sql`} />
      </TwoPane>
    </ToolShell>
  );
}
