/** Minifiers for JS (Terser), CSS and HTML. CSS/HTML minification is conservative and string-safe. */
export async function minifyJs(code: string, opts: { mangle: boolean; module: boolean }): Promise<string> {
  const { minify } = await import('terser');
  const res = await minify(code, { mangle: opts.mangle, compress: true, module: opts.module, format: { comments: false } });
  return res.code ?? '';
}

export function minifyCss(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) j += css[j] === '\\' ? 2 : 1;
      out += css.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (/\s/.test(c)) {
      while (i < css.length && /\s/.test(css[i])) i++;
      const prev = out[out.length - 1];
      const next = css[i];
      if (prev && next && !/[{}:;,>+~(]/.test(prev) && !/[{}:;,>+~)!]/.test(next)) out += ' ';
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/;}/g, '}').trim();
}

/** Collapses inter-tag whitespace and drops comments; leaves <pre>, <textarea>, <script>, <style> bodies untouched. */
export function minifyHtml(html: string): string {
  const keep: string[] = [];
  const guarded = html.replace(/<(pre|textarea|script|style)\b[\s\S]*?<\/\1>/gi, (m) => {
    keep.push(m);
    // Tag-shaped placeholder so the inter-tag whitespace rules still apply around it
    return `<\u0001${keep.length - 1}>`;
  });
  const min = guarded
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // eslint-disable-next-line no-control-regex -- \u0001 is our own placeholder marker
  return min.replace(/<\u0001(\d+)>/g, (_, i) => keep[+i]);
}
