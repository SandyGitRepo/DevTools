import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { parseJson } from '../formatters/jsonError';

export type DataFormat = 'json' | 'yaml' | 'xml';

const ATTR = '@_';

/** FR-D2: parse JSON / YAML / XML into a plain JS value. */
export function parseData(text: string, format: DataFormat): unknown {
  if (!text.trim()) throw new Error('Input is empty');
  if (format === 'json') return parseJson(text);
  if (format === 'yaml') return yamlLoad(text);
  // XML: entity declarations are refused (no XXE / billion-laughs expansion)
  if (/<!ENTITY/i.test(text)) throw new Error('XML with <!ENTITY> declarations is not supported, for safety');
  const valid = XMLValidator.validate(text);
  if (valid !== true) throw Object.assign(new Error(valid.err.msg), { jsonLine: valid.err.line, jsonColumn: valid.err.col });
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR,
    parseAttributeValue: true,
    parseTagValue: true,
    trimValues: true,
    processEntities: true,
    htmlEntities: false,
  }).parse(text);
}

export function stringifyData(value: unknown, format: DataFormat, opts: { indent: number; rootName?: string } = { indent: 2 }): string {
  if (format === 'json') return JSON.stringify(value, null, opts.indent);
  if (format === 'yaml') return yamlDump(value, { indent: opts.indent, lineWidth: 120, noRefs: true, sortKeys: false });
  // XML needs exactly one root element
  let root = value;
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const elementKeys = isObj(value) ? Object.keys(value).filter((k) => k !== '?xml') : [];
  if (!isObj(value) || elementKeys.length !== 1 || Array.isArray(value[elementKeys[0]])) {
    root = { [opts.rootName || 'root']: Array.isArray(value) ? { item: value } : value };
  }
  const xml = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR,
    format: true,
    indentBy: ' '.repeat(opts.indent),
    suppressEmptyNode: true,
  }).build(root) as string;
  return xml.startsWith('<?xml') ? xml : `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

export function convertData(text: string, from: DataFormat, to: DataFormat, indent = 2, rootName = 'root'): string {
  return stringifyData(parseData(text, from), to, { indent, rootName }).trimEnd() + '\n';
}
