import { lineColFromOffset, type ToolError } from '../errors';

/**
 * Locates the first JSON syntax error with a plain-English message (FR-C4). V8 does not always
 * report a position (e.g. "Unexpected token '}'"), so we scan the text ourselves.
 */
export function locateJsonError(text: string): ToolError | null {
  let i = 0;
  const n = text.length;
  const fail = (message: string, at = i): never => {
    throw Object.assign(new Error(message), { offset: at });
  };
  const ws = () => {
    while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++;
  };
  const describe = (c: string | undefined) => (c === undefined ? 'the end of the input' : `“${c}”`);

  const value = (depth: number): void => {
    if (depth > 5000) fail('Nesting is too deep');
    ws();
    const c = text[i];
    if (c === '{') return object(depth);
    if (c === '[') return array(depth);
    if (c === '"') return string();
    if (c === '-' || (c >= '0' && c <= '9')) return number();
    for (const lit of ['true', 'false', 'null']) {
      if (text.startsWith(lit, i)) {
        i += lit.length;
        return;
      }
    }
    if (c === "'") fail('Strings must use double quotes ("), not single quotes');
    if (c === undefined) fail('The JSON ends unexpectedly — a value is missing');
    if (c === '}' || c === ']') fail(`Expected a value but found ${describe(c)} — there may be a trailing comma before it`);
    if (/[A-Za-z_]/.test(c)) fail('Unquoted text — strings must be wrapped in double quotes (true, false and null are lower-case)');
    fail(`Unexpected character ${describe(c)}`);
  };

  const object = (depth: number) => {
    const open = i;
    i++;
    ws();
    if (text[i] === '}') {
      i++;
      return;
    }
    for (;;) {
      ws();
      if (text[i] === '}') fail('Trailing comma before “}” is not allowed in JSON');
      if (text[i] !== '"')
        fail(
          text[i] === undefined
            ? `Object opened at line ${lineColFromOffset(text, open).line} is never closed`
            : `Property names must be in double quotes; found ${describe(text[i])}`,
        );
      string();
      ws();
      if (text[i] !== ':') fail(`Expected “:” after the property name, found ${describe(text[i])}`);
      i++;
      value(depth + 1);
      ws();
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === '}') {
        i++;
        return;
      }
      if (text[i] === undefined) fail(`Object opened at line ${lineColFromOffset(text, open).line} is never closed — add “}”`);
      fail(`Expected “,” or “}” after a property value, found ${describe(text[i])} — a comma is probably missing`);
    }
  };

  const array = (depth: number) => {
    const open = i;
    i++;
    ws();
    if (text[i] === ']') {
      i++;
      return;
    }
    for (;;) {
      ws();
      if (text[i] === ']') fail('Trailing comma before “]” is not allowed in JSON');
      value(depth + 1);
      ws();
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === ']') {
        i++;
        return;
      }
      if (text[i] === undefined) fail(`Array opened at line ${lineColFromOffset(text, open).line} is never closed — add “]”`);
      fail(`Expected “,” or “]” after an array item, found ${describe(text[i])} — a comma is probably missing`);
    }
  };

  const string = () => {
    const start = i;
    i++;
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        i++;
        return;
      }
      if (c === '\\') {
        const e = text[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.substr(i + 2, 4))) fail('Invalid \\u escape — it needs exactly 4 hex digits');
          i += 6;
        } else if ('"\\/bfnrt'.includes(e)) i += 2;
        else fail(`Invalid escape “\\${e ?? ''}” in string`);
        continue;
      }
      if (c === '\n') fail('Strings cannot contain raw line breaks — use \\n', start);
      if (c < ' ') fail('Strings cannot contain raw control characters (tab etc.) — escape them');
      i++;
    }
    fail('A string is never closed — a closing " is missing', start);
  };

  const number = () => {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i, i + 400));
    if (!m) fail('Invalid number');
    i += m![0].length;
    if (/[0-9.xXeE]/.test(text[i] ?? '')) fail('Invalid number (leading zeros, hex and trailing dots are not allowed)');
  };

  try {
    ws();
    if (i >= n) fail('Input is empty');
    value(0);
    ws();
    if (i < n) fail(`Unexpected ${describe(text[i])} after the end of the JSON — only one top-level value is allowed`);
    return null;
  } catch (e) {
    const offset = (e as { offset?: number }).offset ?? i;
    return { message: (e as Error).message, ...lineColFromOffset(text, offset) };
  }
}

/** JSON.parse with a positioned, plain-English error. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    const located = locateJsonError(text);
    throw Object.assign(new Error(located?.message ?? (e as Error).message), located ? { jsonLine: located.line, jsonColumn: located.column } : {});
  }
}
