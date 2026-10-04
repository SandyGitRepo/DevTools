import { useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import DataGrid from '../../components/tool/DataGrid';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Checkbox, Select } from '../../components/ui/controls';
import { jsonToCsv, parseCsv, type Delimiter } from '../../lib/convert/csv';
import { parseJson } from '../../lib/formatters/jsonError';

const SAMPLE_CSV = `loan_id,customer,city,amount,tenure_months,disbursed_on,active
LN-0001,Asha Verma,Pune,500000,60,2026-04-12,true
LN-0002,"Rao, Kiran",Hyderabad,125000.50,24,2026-05-03,false
LN-0003,Meera Iyer,Chennai,980000,120,2026-06-21,true
LN-0004,Arjun Singh,Delhi,45000,12,,true`;

const DELIMS: { value: Delimiter; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: ',', label: 'Comma ,' },
  { value: ';', label: 'Semicolon ;' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe |' },
];

export default function CsvJsonTool() {
  const [csv, setCsv] = useState('');
  const [json, setJson] = useState('');
  const [delimiter, setDelimiter] = useState<Delimiter>('auto');
  const [header, setHeader] = useState(true);
  const [typing, setTyping] = useState(true);
  const [flattenNested, setFlattenNested] = useState(true);
  const [grid, setGrid] = useState<{ columns: string[]; rows: unknown[][] } | null>(null);
  const { error, status, run, reset, setStatus } = useAction();
  useHandoff(setCsv);

  const toJson = () =>
    run(
      () => {
        const r = parseCsv(csv, { delimiter, header, dynamicTyping: typing });
        setJson(JSON.stringify(r.rows, null, 2));
        const columns = header ? r.fields : Array.from({ length: Math.max(0, ...(r.rows as unknown[][]).map((x) => x.length)) }, (_, i) => `column_${i + 1}`);
        setGrid({ columns, rows: header ? (r.rows as Record<string, unknown>[]).map((o) => columns.map((c) => o[c])) : (r.rows as unknown[][]) });
        setStatus(
          r.warnings.length
            ? { kind: 'warn', text: `${r.rows.length} rows · ${r.warnings[0]}` }
            : { kind: 'success', text: `${r.rows.length} rows · delimiter “${r.delimiter === '\t' ? 'tab' : r.delimiter}”` },
        );
      },
      { source: csv },
    );

  const toCsv = () =>
    run(
      () => {
        const out = jsonToCsv(parseJson(json), { delimiter: delimiter === 'auto' ? ',' : delimiter, flattenNested });
        setCsv(out);
        const r = parseCsv(out, { delimiter: 'auto', header: true, dynamicTyping: false });
        setGrid({ columns: r.fields, rows: (r.rows as Record<string, unknown>[]).map((o) => r.fields.map((c) => o[c])) });
        setStatus({ kind: 'success', text: `${r.rows.length} rows · ${r.fields.length} columns` });
      },
      { source: json },
    );

  return (
    <ToolShell
      onSample={() => {
        setCsv(SAMPLE_CSV);
        setJson('');
        setGrid(null);
      }}
      onClear={() => {
        setCsv('');
        setJson('');
        setGrid(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>CSV → JSON:</b> with a header row you get an array of objects; without, an array of arrays. “Detect numbers & booleans” turns <code>42</code> and{' '}
            <code>true</code> into real values — turn it off to keep leading zeros (PIN codes, account numbers).
          </li>
          <li>
            <b>JSON → CSV:</b> accepts an array of objects (or an object containing one). Nested objects become <code>dot.path</code> columns; arrays are stored
            as JSON text.
          </li>
          <li>
            Cells starting with <code>= + - @</code> are escaped so spreadsheets do not run them as formulas (CSV injection).
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Select label="Delimiter" value={delimiter} onChange={setDelimiter} options={DELIMS} />
        <div className="flex flex-col gap-1.5 pb-1">
          <Checkbox label="First row is a header" checked={header} onChange={setHeader} />
          <Checkbox label="Detect numbers & booleans" checked={typing} onChange={setTyping} />
        </div>
        <div className="pb-2">
          <Checkbox label="Flatten nested objects (JSON → CSV)" checked={flattenNested} onChange={setFlattenNested} />
        </div>
        <button type="button" className="hud-btn hud-btn-accent" onClick={toJson} disabled={!csv}>
          CSV <ArrowRight size={15} aria-hidden="true" /> JSON
        </button>
        <button type="button" className="hud-btn" onClick={toCsv} disabled={!json}>
          <ArrowLeft size={15} aria-hidden="true" /> CSV from JSON
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane
          title="CSV"
          value={csv}
          onChange={setCsv}
          acceptFile=".csv,.tsv,.txt"
          downloadName="data.csv"
          error={error}
          className="h-[45vh] min-h-[260px]"
        />
        <EditorPane
          title="JSON"
          value={json}
          onChange={setJson}
          language="json"
          acceptFile=".json"
          downloadName="data.json"
          className="h-[45vh] min-h-[260px]"
        />
      </TwoPane>
      {grid && <DataGrid columns={grid.columns} rows={grid.rows} />}
    </ToolShell>
  );
}
