import Papa from 'papaparse';

export type Delimiter = 'auto' | ',' | ';' | '\t' | '|';

export interface CsvParseResult {
  rows: Record<string, unknown>[] | unknown[][];
  fields: string[];
  delimiter: string;
  warnings: string[];
}

/** FR-D1: CSV → rows. Reports malformed rows by line number instead of failing silently. */
export function parseCsv(text: string, opts: { delimiter: Delimiter; header: boolean; dynamicTyping: boolean }): CsvParseResult {
  if (!text.trim()) throw new Error('Paste or open some CSV first');
  const res = Papa.parse(text.replace(/^\ufeff/, ''), {
    delimiter: opts.delimiter === 'auto' ? '' : opts.delimiter,
    header: opts.header,
    dynamicTyping: opts.dynamicTyping,
    skipEmptyLines: 'greedy',
    transformHeader: (h, i) => h.trim() || `column_${i + 1}`,
  });
  const fatal = res.errors.find((e) => e.type === 'Quotes');
  if (fatal) throw Object.assign(new Error(`${fatal.message} (row ${(fatal.row ?? 0) + 1})`), { jsonLine: (fatal.row ?? 0) + (opts.header ? 2 : 1) });
  const warnings = res.errors.slice(0, 5).map((e) => `Row ${(e.row ?? 0) + 1}: ${e.message}`);
  if (res.errors.length > 5) warnings.push(`…and ${res.errors.length - 5} more`);
  return {
    rows: res.data as Record<string, unknown>[] | unknown[][],
    fields: opts.header ? (res.meta.fields ?? []) : [],
    delimiter: res.meta.delimiter,
    warnings,
  };
}

/** Flattens nested objects to dot-path keys; arrays become JSON text (one CSV cell). */
export function flatten(obj: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) flatten(v as Record<string, unknown>, key, out);
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

/** Extracts the array of records from JSON: a top-level array, or the first array property of an object. */
export function recordsFromJson(data: unknown): Record<string, unknown>[] {
  let arr: unknown = data;
  if (!Array.isArray(arr) && arr && typeof arr === 'object') {
    arr = Object.values(arr).find(Array.isArray) ?? [arr];
  }
  if (!Array.isArray(arr)) throw new Error('Expected a JSON array of objects (or an object containing one)');
  return arr.map((r, i) => {
    if (r && typeof r === 'object' && !Array.isArray(r)) return r as Record<string, unknown>;
    if (Array.isArray(r)) return Object.fromEntries(r.map((v, j) => [`column_${j + 1}`, v]));
    if (r === null || typeof r !== 'object') return { value: r };
    throw new Error(`Item ${i + 1} is not an object`);
  });
}

/** FR-D1: JSON → CSV with a stable union of columns (first-seen order). */
export function jsonToCsv(data: unknown, opts: { delimiter: Exclude<Delimiter, 'auto'>; flattenNested: boolean }): string {
  const records = recordsFromJson(data).map((r) => (opts.flattenNested ? flatten(r) : r));
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of records)
    for (const k of Object.keys(r))
      if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }
  const cell = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v);
  return Papa.unparse(
    { fields: columns, data: records.map((r) => columns.map((c) => cell(r[c]))) },
    { delimiter: opts.delimiter, newline: '\r\n', escapeFormulae: true },
  );
}
