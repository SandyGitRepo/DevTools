/** Normalised, user-facing error with optional position (FR-C4). */
export interface ToolError {
  message: string;
  line?: number;
  column?: number;
}

export function lineColFromOffset(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      last = i;
    }
  }
  return { line, column: offset - last };
}

/**
 * Turns any thrown value into a ToolError. Pulls positions out of the common message shapes
 * produced by JSON.parse, Prettier, js-yaml, sql-formatter and DOMParser.
 */
export function toToolError(e: unknown, source?: string): ToolError {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unexpected error';
  const any = e as { loc?: { start?: { line: number; column: number } }; mark?: { line: number; column: number } };
  const pos = e as { jsonLine?: number; jsonColumn?: number };
  if (pos?.jsonLine) return { message: raw, line: pos.jsonLine, column: pos.jsonColumn };
  // Prettier: err.loc.start (1-based line, 1-based column)
  if (any?.loc?.start) {
    return { message: firstLine(stripCodeFrame(raw)), line: any.loc.start.line, column: any.loc.start.column };
  }
  // js-yaml: err.mark (0-based)
  if (any?.mark && typeof any.mark.line === 'number') {
    return { message: firstLine((e as Error & { reason?: string }).reason ?? raw), line: any.mark.line + 1, column: any.mark.column + 1 };
  }
  let m = raw.match(/\(line (\d+) column (\d+)\)/i);
  if (m) return { message: humanise(raw.replace(m[0], '').trim()), line: +m[1], column: +m[2] };
  m = raw.match(/line[: ]+(\d+)[, ]+col(?:umn)?[: ]+(\d+)/i);
  if (m) return { message: firstLine(raw), line: +m[1], column: +m[2] };
  m = raw.match(/at position (\d+)/i);
  if (m && source !== undefined) {
    const pos = lineColFromOffset(source, +m[1]);
    return { message: humanise(raw.replace(/\s*at position \d+/, '')), ...pos };
  }
  return { message: firstLine(raw) };
}

const firstLine = (s: string) => s.split('\n')[0].trim();
const stripCodeFrame = (s: string) => s.replace(/\s*\(\d+:\d+\)\s*$/m, '');
const humanise = (s: string) =>
  firstLine(s)
    .replace(/^SyntaxError:\s*/, '')
    .replace(/ in JSON$/, '')
    .replace(/^Unexpected end of JSON input$/, 'The JSON ends unexpectedly — a bracket, brace or quote is probably missing');
