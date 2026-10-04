import { JSONPath } from 'jsonpath-plus';
import { Validator } from '@cfworker/json-schema';
import { parseJson } from './jsonError';

export function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => [k, sortKeysDeep((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export type Indent = '2' | '4' | 'tab';
const indentOf = (i: Indent) => (i === 'tab' ? '\t' : Number(i));

export function formatJson(text: string, indent: Indent = '2', sortKeys = false): string {
  let data = parseJson(text);
  if (sortKeys) data = sortKeysDeep(data);
  return JSON.stringify(data, null, indentOf(indent));
}

export function minifyJson(text: string, sortKeys = false): string {
  let data = parseJson(text);
  if (sortKeys) data = sortKeysDeep(data);
  return JSON.stringify(data);
}

/** JSONPath query; filter expressions use the library's sandboxed evaluator (no eval / new Function). */
export function queryJson(text: string, path: string): unknown[] {
  const json = parseJson(text);
  return JSONPath({ path, json, wrap: true, eval: 'safe' }) as unknown[];
}

export interface SchemaIssue {
  path: string;
  message: string;
}

export function validateSchema(text: string, schemaText: string): SchemaIssue[] {
  const data = parseJson(text);
  let schema: { $schema?: string };
  try {
    schema = JSON.parse(schemaText);
  } catch (e) {
    throw new Error(`Schema is not valid JSON: ${(e as Error).message}`, { cause: e });
  }
  const id = String(schema.$schema ?? '');
  const draft = id.includes('draft-04') ? '4' : id.includes('draft-07') ? '7' : id.includes('2019-09') ? '2019-09' : '2020-12';
  const validator = new Validator(schema as object, draft, false);
  const result = validator.validate(data);
  // Drop the wrapper errors that only say "a child failed"
  return result.errors
    .filter((e) => !['properties', 'items', '$ref', 'allOf', 'prefixItems'].includes(e.keyword))
    .map((e) => ({ path: e.instanceLocation.replace(/^#/, '$').replace(/\//g, '.') || '$', message: e.error }));
}

export type JsonNode = { key: string; type: string; value?: string; children?: JsonNode[]; path: string };

export function toTree(v: unknown, key = '$', path = '$'): JsonNode {
  if (Array.isArray(v)) return { key, type: `array[${v.length}]`, path, children: v.map((x, i) => toTree(x, String(i), `${path}[${i}]`)) };
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as object);
    return {
      key,
      type: `object{${keys.length}}`,
      path,
      children: keys.map((k) =>
        toTree((v as Record<string, unknown>)[k], k, /^[A-Za-z_$][\w$]*$/.test(k) ? `${path}.${k}` : `${path}['${k.replace(/'/g, "\\'")}']`),
      ),
    };
  }
  return { key, type: v === null ? 'null' : typeof v, value: JSON.stringify(v), path };
}
