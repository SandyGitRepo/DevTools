import { useState } from 'react';
import { FlaskConical, AlertTriangle } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import Loader from '../../components/ui/Loader';
import DataGrid from '../../components/tool/DataGrid';
import { ActionBar } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { Checkbox, Segmented, Select, TextInput } from '../../components/ui/controls';
import { defaultFields, fieldLabels, generateTestData, type FieldId } from '../../lib/utils/testdata';
import { jsonToCsv } from '../../lib/convert/csv';
import { generateInserts, sqlDialects, type SqlDialect } from '../../lib/convert/sqlInsert';

type Format = 'json' | 'csv' | 'sql';

export default function TestDataTool() {
  const [fields, setFields] = useState<FieldId[]>(defaultFields);
  const [count, setCount] = useState('25');
  const [seed, setSeed] = useState('');
  const [format, setFormat] = useState<Format>('json');
  const [dialect, setDialect] = useState<SqlDialect>('postgresql');
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const { error, status, run, busy, reset } = useAction();

  const toggle = (id: FieldId, on: boolean) =>
    setFields(on ? [...fields, id].sort((a, b) => Object.keys(fieldLabels).indexOf(a) - Object.keys(fieldLabels).indexOf(b)) : fields.filter((f) => f !== id));

  const generate = () =>
    run(
      async () => {
        const r = await generateTestData(Number(count), fields, seed.trim() ? Number(seed) : undefined);
        setRows(r);
        return r.length;
      },
      { success: (n) => `Generated ${n} test records` },
    );

  const output = rows
    ? format === 'json'
      ? JSON.stringify(rows, null, 2)
      : format === 'csv'
        ? jsonToCsv(rows, { delimiter: ',', flattenNested: false })
        : generateInserts(rows, { table: 'test_customers', dialect, batchSize: 100, emptyAsNull: true, quoteIdentifiers: false, createTable: true })
    : '';
  const columns = rows?.[0] ? Object.keys(rows[0]) : [];

  return (
    <ToolShell
      onSample={() => {
        setCount('25');
        setSeed('42');
        void run(async () => setRows(await generateTestData(25, fields, 42)), { success: 'Generated 25 test records (seed 42)' });
      }}
      onClear={() => {
        setRows(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Creates realistic but fake Indian records for testing and demos. Every record includes <code>test_record: true</code>, emails use the reserved{' '}
            <code>.test</code> domain and IFSC codes use the non-existent bank code <code>TEST</code>.
          </li>
          <li>PAN values only follow the format — they are random and must never be used as real identifiers.</li>
          <li>Enter a seed to get the same data every time (useful for repeatable tests).</li>
        </ul>
      }
    >
      <p className="flex items-center gap-2 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
        <AlertTriangle size={16} aria-hidden="true" /> Test data only — values are fake and flagged as such. Do not load into production systems.
      </p>
      <section className="hud-panel p-4">
        <h2 className="hud-label">Fields</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          {(Object.keys(fieldLabels) as FieldId[]).map((id) => (
            <Checkbox key={id} label={fieldLabels[id]} checked={fields.includes(id)} onChange={(v) => toggle(id, v)} />
          ))}
        </div>
      </section>
      <ActionBar>
        <TextInput label="Records (max 10,000)" value={count} onChange={setCount} type="number" className="w-40" />
        <TextInput label="Seed (optional)" value={seed} onChange={setSeed} type="number" className="w-36" placeholder="random" />
        <Segmented
          label="Output"
          value={format}
          onChange={setFormat}
          options={[
            { value: 'json', label: 'JSON' },
            { value: 'csv', label: 'CSV' },
            { value: 'sql', label: 'SQL' },
          ]}
        />
        {format === 'sql' && <Select label="Dialect" value={dialect} onChange={setDialect} options={sqlDialects} />}
        <button type="button" className="hud-btn hud-btn-accent" onClick={generate} disabled={busy || !fields.length}>
          {busy ? <Loader /> : <FlaskConical size={15} aria-hidden="true" />} Generate
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      {rows && (
        <>
          <DataGrid columns={columns} rows={rows.map((r) => columns.map((c) => r[c]))} limit={50} caption="Fake data" />
          <EditorPane
            title={format.toUpperCase()}
            value={output}
            readOnly
            language={format === 'csv' ? 'plaintext' : format}
            downloadName={`test-data.${format}`}
            className="h-[45vh] min-h-[240px]"
          />
        </>
      )}
    </ToolShell>
  );
}
