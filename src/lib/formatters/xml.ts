import xmlFormatter from 'xml-formatter';
import type { ToolError } from '../errors';

export function formatXml(xml: string, indent = '  '): string {
  return xmlFormatter(xml, { indentation: indent, collapseContent: true, lineSeparator: '\n', throwOnFailure: true });
}

export function minifyXml(xml: string): string {
  return xmlFormatter.minify(xml, { collapseContent: true, throwOnFailure: true });
}

/** Browser-only: DOMParser well-formedness check. Returns null if well-formed. */
export function checkWellFormed(xml: string): ToolError | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (!err) return null;
  const text = err.textContent ?? 'XML is not well-formed';
  const m = text.match(/line\s*(?:number\s*)?(\d+)\D+(\d+)/i);
  const msg = text
    .replace(/^This page contains the following errors:/, '')
    .replace(/Below is a rendering[\s\S]*$/, '')
    .trim()
    .split('\n')[0]
    .replace(/^error on line \d+ at column \d+:\s*/i, '');
  return { message: msg || 'XML is not well-formed', line: m ? +m[1] : undefined, column: m ? +m[2] : undefined };
}

/** Browser-only XPath evaluation; namespace prefixes are resolved from the document (default namespace → "d"). */
export function xpathQuery(xml: string, expr: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Fix the XML before running an XPath query');
  const nsMap = new Map<string, string>();
  const walk = (el: Element) => {
    for (const a of Array.from(el.attributes)) {
      if (a.name.startsWith('xmlns:')) nsMap.set(a.name.slice(6), a.value);
      else if (a.name === 'xmlns') nsMap.set('d', a.value);
    }
    for (const c of Array.from(el.children)) walk(c);
  };
  walk(doc.documentElement);
  const resolver = (p: string | null) => (p ? (nsMap.get(p) ?? null) : null);
  const res = doc.evaluate(expr, doc, resolver, XPathResult.ANY_TYPE, null);
  const ser = new XMLSerializer();
  switch (res.resultType) {
    case XPathResult.NUMBER_TYPE:
      return [String(res.numberValue)];
    case XPathResult.STRING_TYPE:
      return [res.stringValue];
    case XPathResult.BOOLEAN_TYPE:
      return [String(res.booleanValue)];
    default: {
      const out: string[] = [];
      let n = res.iterateNext();
      while (n && out.length < 5000) {
        out.push(n.nodeType === Node.ATTRIBUTE_NODE || n.nodeType === Node.TEXT_NODE ? (n.nodeValue ?? '') : ser.serializeToString(n));
        n = res.iterateNext();
      }
      return out;
    }
  }
}
