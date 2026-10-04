/** Escapes every non-ASCII (or every) character as \uXXXX, using surrogate pairs for astral code points. */
export function unicodeEscape(text: string, opts: { all?: boolean; braces?: boolean } = {}): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (!opts.all && cp >= 0x20 && cp < 0x7f) {
      out += ch;
    } else if (opts.braces && cp > 0xffff) {
      out += `\\u{${cp.toString(16).toUpperCase()}}`;
    } else {
      for (let i = 0; i < ch.length; i++) out += '\\u' + ch.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
    }
  }
  return out;
}

/** Unescapes \uXXXX, \u{X…}, \xXX and the common C escapes (\n \t \r \\ \" \'). */
export function unicodeUnescape(text: string): string {
  return text.replace(/\\(u\{([0-9a-fA-F]{1,6})\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|[ntr\\"'0])/g, (m, _all, braced, u4, x2) => {
    if (braced) {
      const cp = parseInt(braced, 16);
      if (cp > 0x10ffff) throw new Error(`${m} is beyond the Unicode range`);
      return String.fromCodePoint(cp);
    }
    if (u4) return String.fromCharCode(parseInt(u4, 16));
    if (x2) return String.fromCharCode(parseInt(x2, 16));
    return ({ n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '0': '\0' } as Record<string, string>)[m[1]];
  });
}

export interface CodePointInfo {
  char: string;
  codePoint: string;
  decimal: number;
  utf8: string;
  utf16: string;
  category: string;
}

function category(cp: number): string {
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 'Control';
  if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0xfeff || cp === 0x2060) return 'Invisible / zero-width';
  if (cp === 0x20 || cp === 0xa0 || (cp >= 0x2000 && cp <= 0x200a) || cp === 0x3000) return 'Space';
  if (cp >= 0xd800 && cp <= 0xdfff) return 'Lone surrogate';
  if (cp < 0x80) return 'ASCII';
  if (cp >= 0x0900 && cp <= 0x097f) return 'Devanagari';
  if (cp >= 0x1f300 && cp <= 0x1faff) return 'Emoji / symbol';
  if (cp > 0xffff) return 'Astral (non-BMP)';
  return 'Unicode';
}

/** Per-character breakdown; flags invisible and control characters that often break parsers. */
export function inspect(text: string, limit = 2000): CodePointInfo[] {
  const enc = new TextEncoder();
  const out: CodePointInfo[] = [];
  for (const ch of text) {
    if (out.length >= limit) break;
    const cp = ch.codePointAt(0)!;
    out.push({
      char: cp < 0x20 || cp === 0x7f ? '' : ch,
      codePoint: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
      decimal: cp,
      utf8: Array.from(enc.encode(ch), (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      utf16: Array.from({ length: ch.length }, (_, i) => ch.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')).join(' '),
      category: category(cp),
    });
  }
  return out;
}
