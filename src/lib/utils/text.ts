/** FR-U4 case conversion and line tools. */
import { camelCase, pascalCase, snakeCase, constantCase, kebabCase, capitalCase, sentenceCase, dotCase, pathCase } from 'change-case';

export const cases = {
  camel: { label: 'camelCase', fn: camelCase },
  pascal: { label: 'PascalCase', fn: pascalCase },
  snake: { label: 'snake_case', fn: snakeCase },
  constant: { label: 'CONSTANT_CASE', fn: constantCase },
  kebab: { label: 'kebab-case', fn: kebabCase },
  title: { label: 'Title Case', fn: capitalCase },
  sentence: { label: 'Sentence case', fn: sentenceCase },
  dot: { label: 'dot.case', fn: dotCase },
  path: { label: 'path/case', fn: pathCase },
  upper: { label: 'UPPER CASE', fn: (s: string) => s.toUpperCase() },
  lower: { label: 'lower case', fn: (s: string) => s.toLowerCase() },
} as const;

export type CaseId = keyof typeof cases;

/** Converts each line independently so lists of identifiers stay one per line. */
export function convertCase(text: string, id: CaseId): string {
  return text
    .split(/\r?\n/)
    .map((l) => (l.trim() ? cases[id].fn(l) : l))
    .join('\n');
}

export type LineOp =
  'trim' | 'removeEmpty' | 'dedupe' | 'dedupeCi' | 'sortAsc' | 'sortDesc' | 'sortNatural' | 'sortNumeric' | 'reverse' | 'shuffle' | 'number' | 'join';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function lineOp(text: string, op: LineOp): string {
  const lines = text.split(/\r?\n/);
  switch (op) {
    case 'trim':
      return lines.map((l) => l.trim()).join('\n');
    case 'removeEmpty':
      return lines.filter((l) => l.trim()).join('\n');
    case 'dedupe':
      return [...new Set(lines)].join('\n');
    case 'dedupeCi': {
      const seen = new Set<string>();
      return lines.filter((l) => !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase())).join('\n');
    }
    case 'sortAsc':
      return [...lines].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join('\n');
    case 'sortDesc':
      return [...lines].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).join('\n');
    case 'sortNatural':
      return [...lines].sort(collator.compare).join('\n');
    case 'sortNumeric':
      return [...lines].sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)).join('\n');
    case 'reverse':
      return [...lines].reverse().join('\n');
    case 'shuffle': {
      const a = [...lines];
      for (let i = a.length - 1; i > 0; i--) {
        const r = new Uint32Array(1);
        crypto.getRandomValues(r);
        const j = r[0] % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a.join('\n');
    }
    case 'number':
      return lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
    case 'join':
      return lines.filter((l) => l.trim()).join(', ');
  }
}

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  lines: number;
  sentences: number;
  bytesUtf8: number;
  readingMinutes: number;
}

export function stats(text: string): TextStats {
  const words = text.trim() ? (text.trim().match(/[\p{L}\p{M}\p{N}'’-]+/gu) ?? []).length : 0;
  return {
    characters: [...text].length,
    charactersNoSpaces: [...text.replace(/\s/g, '')].length,
    words,
    lines: text ? text.split(/\r?\n/).length : 0,
    sentences: text.trim() ? (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]).length : 0,
    bytesUtf8: new TextEncoder().encode(text).length,
    readingMinutes: Math.max(words ? 1 : 0, Math.round(words / 200)),
  };
}
