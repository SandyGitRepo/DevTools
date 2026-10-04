/**
 * FR-U1 regex engine. Pure functions — executed inside a Web Worker by the UI so a catastrophic
 * (ReDoS) pattern can be killed after 5 s without freezing the page (A04).
 */
export interface RegexMatch {
  index: number;
  end: number;
  text: string;
  groups: { name: string; value: string | undefined; start?: number; end?: number }[];
}

export interface RegexResult {
  matches: RegexMatch[];
  truncated: boolean;
  replaced?: string;
  ms: number;
}

export const MAX_MATCHES = 5000;

export function compile(pattern: string, flags: string): RegExp {
  if (!/^[dgimsuyv]*$/.test(flags)) throw new Error(`Unknown flag in “${flags}” (allowed: d g i m s u v y)`);
  if (new Set(flags).size !== flags.length) throw new Error('Each flag may appear only once');
  try {
    return new RegExp(pattern, flags);
  } catch (e) {
    throw new Error((e as Error).message.replace(/^Invalid regular expression: /, ''), { cause: e });
  }
}

export function runRegex(pattern: string, flags: string, text: string, replacement?: string): RegexResult {
  const t0 = performance.now();
  // Always iterate globally with indices so we can list every match and its group positions
  const re = compile(pattern, flags.includes('d') ? flags : flags + 'd');
  const global = flags.includes('g') || flags.includes('y');
  const iter = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const matches: RegexMatch[] = [];
  let truncated = false;
  const groupNames = captureGroupNames(pattern);
  let m: RegExpExecArray | null;
  while ((m = iter.exec(text))) {
    const idx = (m as RegExpExecArray & { indices?: [number, number][] }).indices;
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      text: m[0],
      groups: m.slice(1).map((value, i) => ({ name: groupNames[i] ?? `$${i + 1}`, value, start: idx?.[i + 1]?.[0], end: idx?.[i + 1]?.[1] })),
    });
    if (m[0] === '') iter.lastIndex++; // avoid infinite loop on empty matches
    if (!global) break;
    if (matches.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }
  }
  const replaced = replacement !== undefined ? text.replace(compile(pattern, flags), replacement) : undefined;
  return { matches, truncated, replaced, ms: Math.round((performance.now() - t0) * 10) / 10 };
}

/** Splits text into plain/match segments for highlighting (rendered as React elements, never HTML). */
export function segments(text: string, matches: RegexMatch[]): { text: string; match?: number }[] {
  const out: { text: string; match?: number }[] = [];
  let pos = 0;
  matches.forEach((m, i) => {
    if (m.index > pos) out.push({ text: text.slice(pos, m.index) });
    if (m.end > m.index) out.push({ text: text.slice(m.index, m.end), match: i });
    pos = Math.max(pos, m.end);
  });
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** Accepts "/pattern/flags" literal syntax (e.g. pasted from code or a cheat sheet). */
export function parseLiteral(input: string): { pattern: string; flags: string } | null {
  const m = input.trim().match(/^\/([\s\S]+)\/([a-z]*)$/);
  return m ? { pattern: m[1], flags: m[2] } : null;
}

/**
 * Names of capturing groups in source order (undefined for unnamed ones), so group N in a match
 * can be labelled correctly. Skips escapes, character classes and non-capturing/lookaround groups.
 */
export function captureGroupNames(pattern: string): (string | undefined)[] {
  const names: (string | undefined)[] = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (inClass) {
      if (c === ']') inClass = false;
      continue;
    }
    if (c === '[') inClass = true;
    else if (c === '(') {
      if (pattern[i + 1] !== '?') names.push(undefined);
      else if (pattern[i + 2] === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!') {
        const end = pattern.indexOf('>', i + 3);
        names.push(pattern.slice(i + 3, end));
      }
    }
  }
  return names;
}
