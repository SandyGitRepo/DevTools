import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import FileDrop from '../../components/tool/FileDrop';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import DataGrid from '../../components/tool/DataGrid';
import CodeEditor from '../../components/tool/CodeEditor';
import { ActionBar } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { Segmented, Select } from '../../components/ui/controls';
import { readWorkbook, MAX_EXCEL_BYTES, type Workbook } from '../../lib/convert/excel';
import { downloadBlob, formatBytes, readFileAsBytes } from '../../lib/files';

/** Builds a small synthetic workbook for "Try sample" (no real data). */
async function sampleWorkbook(): Promise<File> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const loans = [
    ['Loan ID', 'Customer', 'Branch', 'Amount (INR)', 'Rate %', 'Disbursed'],
    ['LN-0001', 'Asha Verma', 'Pune', 500000, 8.5, new Date('2026-04-12')],
    ['LN-0002', 'Kiran Rao', 'Hyderabad', 125000.5, 10.25, new Date('2026-05-03')],
    ['LN-0003', 'Meera Iyer', 'Chennai', 980000, 8.75, new Date('2026-06-21')],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(loans, { cellDates: true }), 'Loans');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Branch', 'Region'],
      ['Pune', 'West'],
      ['Chennai', 'South'],
    ]),
    'Branches',
  );
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([bytes], 'sample-loans.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export default function ExcelTool() {
  const [file, setFile] = useState<File | null>(null);
  const [book, setBook] = useState<Workbook | null>(null);
  const [sheet, setSheet] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [delimiter, setDelimiter] = useState(',');
  const { error, run, busy, reset } = useAction();

  const open = (f: File) => {
    setFile(f);
    setBook(null);
    void run(async () => {
      const b = await readWorkbook(await readFileAsBytes(f, MAX_EXCEL_BYTES), delimiter);
      setBook(b);
      setSheet(b.sheetNames[0]);
    });
  };

  // Re-read when the CSV delimiter changes (it is applied at export time by SheetJS)
  useEffect(() => {
    if (file && book) open(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delimiter]);

  const data = useMemo(() => {
    if (!book || !sheet) return null;
    try {
      return book.sheet(sheet);
    } catch {
      return null;
    }
  }, [book, sheet]);

  const output = data ? (format === 'csv' ? data.csv : JSON.stringify(data.json, null, 2)) : '';
  const base = `${file?.name.replace(/\.(xlsx|xlsm|xls|ods|csv)$/i, '') ?? 'sheet'}_${sheet}`;
  const columns = data?.rows[0]?.map((c, i) => (c === null || c === '' ? `column_${i + 1}` : String(c))) ?? [];

  return (
    <ToolShell
      onSample={async () => open(await sampleWorkbook())}
      onClear={() => {
        setFile(null);
        setBook(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Opens .xlsx, .xlsm, .xls and .ods entirely in your browser (max {formatBytes(MAX_EXCEL_BYTES)}). Pick a sheet, preview it, then export CSV or JSON.
          </li>
          <li>JSON uses the first row as keys and keeps numbers as numbers. Formulas are exported as their last calculated values; macros are never run.</li>
          <li>Workbooks that would expand to more than 200 MB are refused (zip-bomb protection).</li>
        </ul>
      }
    >
      <FileDrop onFile={open} file={file} accept=".xlsx,.xlsm,.xls,.ods" label="Drop an Excel workbook here or click to choose" compact={!!book} />
      {busy && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader /> Reading workbook…
        </p>
      )}
      {error && <ErrorBox error={error} className="rounded border" />}
      {book && data && (
        <>
          <ActionBar>
            <Select label="Sheet" value={sheet} onChange={setSheet} options={book.sheetNames} />
            <Segmented
              label="Export as"
              value={format}
              onChange={setFormat}
              options={[
                { value: 'csv', label: 'CSV' },
                { value: 'json', label: 'JSON' },
              ]}
            />
            {format === 'csv' && (
              <Select
                label="Delimiter"
                value={delimiter}
                onChange={setDelimiter}
                options={[
                  { value: ',', label: 'Comma' },
                  { value: ';', label: 'Semicolon' },
                  { value: '\t', label: 'Tab' },
                ]}
              />
            )}
            <button
              type="button"
              className="hud-btn hud-btn-accent"
              onClick={() => downloadBlob(output, `${base}.${format}`, format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json')}
            >
              <Download size={15} aria-hidden="true" /> Download {format.toUpperCase()}
            </button>
          </ActionBar>
          <DataGrid columns={columns} rows={data.rows.slice(1)} caption={`Sheet: ${sheet}`} />
          <section className="hud-panel h-[35vh] min-h-[200px] overflow-hidden" aria-label={`${format.toUpperCase()} output`}>
            <CodeEditor
              value={output}
              readOnly
              language={format === 'json' ? 'json' : 'plaintext'}
              ariaLabel={`${format.toUpperCase()} output`}
              wordWrap={false}
            />
          </section>
        </>
      )}
    </ToolShell>
  );
}
