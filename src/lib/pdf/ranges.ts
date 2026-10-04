/**
 * Parses page-range text such as "1-3, 5, 8-" into zero-based page indices (FR-P2, FR-P3, FR-P6).
 * Pages are 1-based in the text. "8-" means 8 to the end, "-3" means 1 to 3. Order is preserved
 * and duplicates removed.
 */
export function parseRanges(text: string, pageCount: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const parts = text
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) throw new Error('Enter page numbers, e.g. 1-3, 5, 8-');
  for (const part of parts) {
    const m = part.match(/^(\d*)\s*-\s*(\d*)$|^(\d+)$/);
    if (!m) throw new Error(`“${part}” is not a page or range (use e.g. 2 or 5-7)`);
    let from: number;
    let to: number;
    if (m[3]) {
      from = to = +m[3];
    } else {
      from = m[1] ? +m[1] : 1;
      to = m[2] ? +m[2] : pageCount;
    }
    if (from < 1 || to < 1) throw new Error('Page numbers start at 1');
    if (from > pageCount || to > pageCount) throw new Error(`“${part}” is beyond the last page (${pageCount})`);
    const step = from <= to ? 1 : -1;
    for (let p = from; step > 0 ? p <= to : p >= to; p += step) {
      if (!seen.has(p - 1)) {
        seen.add(p - 1);
        out.push(p - 1);
      }
    }
  }
  return out;
}

/** Formats zero-based indices back into compact 1-based ranges: [0,1,2,4] → "1-3, 5". */
export function formatRanges(indices: number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(i === j ? `${sorted[i] + 1}` : `${sorted[i] + 1}-${sorted[j] + 1}`);
    i = j + 1;
  }
  return out.join(', ');
}
