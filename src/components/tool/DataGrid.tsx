/** Read-only preview table for tabular data (first N rows). Values render as text, never HTML. */
export default function DataGrid({ columns, rows, limit = 100, caption }: { columns: string[]; rows: unknown[][]; limit?: number; caption?: string }) {
  const shown = rows.slice(0, limit);
  const fmt = (v: unknown) =>
    v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return (
    <div className="hud-panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-primary/30 px-3 py-1.5">
        <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Preview</h2>
        <span className="font-mono text-[10px] text-muted">
          {rows.length.toLocaleString()} rows × {columns.length} columns{rows.length > limit ? ` · first ${limit} shown` : ''}
        </span>
        {caption && <span className="ml-auto text-xs text-muted">{caption}</span>}
      </div>
      <div className="max-h-[45vh] overflow-auto">
        <table className="hud-table whitespace-nowrap font-mono text-xs">
          <thead className="sticky top-0 bg-[var(--surface-strong)] backdrop-blur">
            <tr>
              <th className="w-10 text-right">#</th>
              {columns.map((c, i) => (
                <th key={i} className="normal-case tracking-normal">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                <td className="text-right text-muted">{i + 1}</td>
                {columns.map((_, j) => (
                  <td key={j} className="max-w-[24rem] truncate" title={fmt(r[j])}>
                    {fmt(r[j])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
