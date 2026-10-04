/** FR-D3: Excel → CSV / JSON with SheetJS Community Edition (Apache-2.0, official 0.20.x build). */
import { unzipSync } from 'fflate';

export const MAX_EXCEL_BYTES = 50 * 1024 * 1024;
const MAX_EXPANDED = 200 * 1024 * 1024;

/**
 * SEC-4: .xlsx/.xlsm/.ods are ZIP files. Sum the declared uncompressed sizes from the central
 * directory (without inflating anything) and refuse archives that would expand past the cap.
 */
export function assertNotZipBomb(bytes: Uint8Array) {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return; // legacy .xls (BIFF) is not a zip
  let total = 0;
  let entries = 0;
  try {
    unzipSync(bytes, {
      filter: (f) => {
        total += f.originalSize;
        entries++;
        return false; // read headers only
      },
    });
  } catch {
    throw new Error('The workbook is damaged or not a valid Excel file');
  }
  const cap = Math.min(MAX_EXPANDED, Math.max(bytes.length * 100, 20 * 1024 * 1024));
  if (total > cap || entries > 10000) throw new Error(`Refused: this workbook would expand to ${Math.round(total / 1048576)} MB (possible zip bomb)`);
}

export interface Workbook {
  sheetNames: string[];
  sheet(name: string): { rows: unknown[][]; csv: string; json: Record<string, unknown>[] };
}

export async function readWorkbook(bytes: Uint8Array, delimiter = ','): Promise<Workbook> {
  if (bytes.length > MAX_EXCEL_BYTES) throw new Error('Workbooks larger than 50 MB are not supported');
  assertNotZipBomb(bytes);
  const XLSX = await import('xlsx');
  let wb: import('xlsx').WorkBook;
  try {
    wb = XLSX.read(bytes, { type: 'array', cellDates: true, dense: true, cellFormula: false, cellHTML: false, bookVBA: false });
  } catch (e) {
    throw new Error(`Could not read the workbook: ${(e as Error).message}`, { cause: e });
  }
  if (!wb.SheetNames.length) throw new Error('The workbook has no sheets');
  // Excel date formats such as m/d/yy are ambiguous (4/12 vs 12/4); export every date as ISO yyyy-mm-dd
  for (const name of wb.SheetNames) {
    const rows = (wb.Sheets[name] as { '!data'?: (import('xlsx').CellObject | undefined)[][] })['!data'] ?? [];
    for (const row of rows)
      for (const cell of row ?? []) {
        if (cell?.t === 'd' || (cell?.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z))) {
          cell.z = 'yyyy-mm-dd';
          delete cell.w;
        }
      }
  }
  return {
    sheetNames: wb.SheetNames,
    sheet(name) {
      const ws = wb.Sheets[name];
      if (!ws) throw new Error(`Sheet “${name}” not found`);
      return {
        rows: XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false, raw: false, dateNF: 'yyyy-mm-dd' }),
        csv: XLSX.utils.sheet_to_csv(ws, { FS: delimiter, blankrows: false, dateNF: 'yyyy-mm-dd' }),
        json: XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true, dateNF: 'yyyy-mm-dd' }),
      };
    },
  };
}
