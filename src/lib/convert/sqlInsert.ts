/** FR-D5: rows → SQL INSERT statements (and an optional inferred CREATE TABLE) for each dialect. */
export type SqlDialect = 'oracle' | 'postgresql' | 'mysql' | 'mariadb' | 'tsql' | 'sql';

export const sqlDialects: { value: SqlDialect; label: string }[] = [
  { value: 'oracle', label: 'Oracle' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mariadb', label: 'MariaDB' },
  { value: 'tsql', label: 'T-SQL (SQL Server)' },
  { value: 'sql', label: 'Standard SQL' },
];

export interface InsertOptions {
  table: string;
  dialect: SqlDialect;
  /** Rows per statement; 1 = one INSERT per row. */
  batchSize: number;
  emptyAsNull: boolean;
  quoteIdentifiers: boolean;
  createTable: boolean;
}

const SIMPLE_IDENT = /^[A-Za-z_][A-Za-z0-9_$#]*$/;

export function quoteIdent(name: string, dialect: SqlDialect, force: boolean): string {
  const parts = name.split('.');
  return parts
    .map((p) => {
      if (!force && SIMPLE_IDENT.test(p)) return p;
      if (dialect === 'mysql' || dialect === 'mariadb') return '`' + p.replace(/`/g, '``') + '`';
      if (dialect === 'tsql') return '[' + p.replace(/]/g, ']]') + ']';
      return '"' + p.replace(/"/g, '""') + '"';
    })
    .join('.');
}

export function sqlValue(v: unknown, dialect: SqlDialect, emptyAsNull: boolean): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'boolean') return dialect === 'postgresql' || dialect === 'sql' ? (v ? 'TRUE' : 'FALSE') : v ? '1' : '0';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (s === '' && emptyAsNull) return 'NULL';
  s = s.replace(/'/g, "''");
  // MySQL/MariaDB treat backslash as an escape character in string literals by default
  if (dialect === 'mysql' || dialect === 'mariadb') s = s.replace(/\\/g, '\\\\');
  return dialect === 'tsql' && /[\u0080-\uffff]/.test(s) ? `N'${s}'` : `'${s}'`;
}

function columnsOf(rows: Record<string, unknown>[]): string[] {
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const r of rows)
    for (const k of Object.keys(r))
      if (!seen.has(k)) {
        seen.add(k);
        cols.push(k);
      }
  return cols;
}

function inferType(values: unknown[], dialect: SqlDialect): string {
  const present = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (!present.length) return dialect === 'oracle' ? 'VARCHAR2(255 CHAR)' : dialect === 'tsql' ? 'NVARCHAR(255)' : 'VARCHAR(255)';
  if (present.every((v) => typeof v === 'boolean'))
    return { oracle: 'NUMBER(1)', postgresql: 'BOOLEAN', mysql: 'TINYINT(1)', mariadb: 'TINYINT(1)', tsql: 'BIT', sql: 'BOOLEAN' }[dialect];
  if (present.every((v) => typeof v === 'number' && Number.isInteger(v)))
    return dialect === 'oracle' ? 'NUMBER(19)' : present.some((v) => Math.abs(v as number) > 2147483647) ? 'BIGINT' : 'INTEGER';
  if (present.every((v) => typeof v === 'number')) return dialect === 'oracle' ? 'NUMBER' : 'NUMERIC(18,4)';
  const max = Math.max(...present.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)).length));
  const len = max <= 50 ? 50 : max <= 255 ? 255 : max <= 4000 ? 4000 : 0;
  if (!len) return { oracle: 'CLOB', postgresql: 'TEXT', mysql: 'TEXT', mariadb: 'TEXT', tsql: 'NVARCHAR(MAX)', sql: 'CLOB' }[dialect];
  return dialect === 'oracle' ? `VARCHAR2(${len} CHAR)` : dialect === 'tsql' ? `NVARCHAR(${len})` : `VARCHAR(${len})`;
}

export function generateInserts(rows: Record<string, unknown>[], o: InsertOptions): string {
  if (!o.table.trim()) throw new Error('Enter a table name');
  if (!rows.length) throw new Error('There are no rows to insert');
  const cols = columnsOf(rows);
  if (!cols.length) throw new Error('The rows have no columns');
  const table = quoteIdent(o.table.trim(), o.dialect, o.quoteIdentifiers);
  const colList = cols.map((c) => quoteIdent(c, o.dialect, o.quoteIdentifiers)).join(', ');
  const tuple = (r: Record<string, unknown>) => `(${cols.map((c) => sqlValue(r[c], o.dialect, o.emptyAsNull)).join(', ')})`;
  const out: string[] = [];

  if (o.createTable) {
    const defs = cols.map(
      (c) =>
        `  ${quoteIdent(c, o.dialect, o.quoteIdentifiers)} ${inferType(
          rows.map((r) => r[c]),
          o.dialect,
        )}`,
    );
    out.push(`CREATE TABLE ${table} (\n${defs.join(',\n')}\n);\n`);
  }

  // SQL Server allows at most 1,000 rows per VALUES list
  const batch = Math.max(1, Math.min(o.batchSize, o.dialect === 'tsql' ? 1000 : 10000));
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    if (chunk.length === 1 || batch === 1) {
      for (const r of chunk) out.push(`INSERT INTO ${table} (${colList}) VALUES ${tuple(r)};`);
    } else if (o.dialect === 'oracle') {
      out.push(`INSERT ALL\n${chunk.map((r) => `  INTO ${table} (${colList}) VALUES ${tuple(r)}`).join('\n')}\nSELECT 1 FROM DUAL;`);
    } else {
      out.push(`INSERT INTO ${table} (${colList}) VALUES\n${chunk.map((r) => `  ${tuple(r)}`).join(',\n')};`);
    }
  }
  if (o.dialect === 'oracle' || o.dialect === 'tsql') out.push(o.dialect === 'oracle' ? '\nCOMMIT;' : '');
  return out.join('\n').trimEnd() + '\n';
}
