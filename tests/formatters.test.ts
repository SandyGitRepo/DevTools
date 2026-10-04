import { describe, expect, it } from 'vitest';
import { formatJson, minifyJson, queryJson, sortKeysDeep, validateSchema } from '../src/lib/formatters/json';
import { formatSql, minifySql } from '../src/lib/formatters/sql';
import { prettierFormat } from '../src/lib/formatters/prettier';
import { minifyCss, minifyHtml, minifyJs } from '../src/lib/formatters/minify';
import { formatXml, minifyXml } from '../src/lib/formatters/xml';
import { toToolError } from '../src/lib/errors';
import { detectInput } from '../src/lib/detect';

describe('FR-F1 JSON', () => {
  it('formats, minifies and sorts keys deeply', () => {
    expect(formatJson('{"b":1,"a":[{"d":1,"c":2}]}', '2', true)).toBe('{\n  "a": [\n    {\n      "c": 2,\n      "d": 1\n    }\n  ],\n  "b": 1\n}');
    expect(minifyJson('{ "a" : [ 1, 2 ] }')).toBe('{"a":[1,2]}');
    expect(formatJson('{"a":1}', 'tab')).toBe('{\n\t"a": 1\n}');
    expect(sortKeysDeep([{ z: 1, y: 2 }])).toEqual([{ y: 2, z: 1 }]);
  });
  it('format → minify → format is stable', () => {
    const src = '{"x":[1,{"y":"é😀"}],"n":null,"t":true}';
    const f1 = formatJson(src);
    expect(formatJson(minifyJson(f1))).toBe(f1);
  });
  it('reports line, column and a plain-English message for errors', () => {
    const cases: [string, number, number, RegExp][] = [
      ['{\n  "a": 1,\n  "b": }', 3, 8, /Expected a value/],
      ['{"a": 1,}', 1, 9, /Trailing comma/],
      ['{\n  "a": 1\n  "b": 2\n}', 3, 3, /comma is probably missing/],
      ["{'a': 1}", 1, 2, /double quotes/],
      ['{"a": [1, 2}', 1, 12, /“,” or “]”/],
      ['{"a": 1', 1, 8, /never closed/],
    ];
    for (const [src, line, column, msg] of cases) {
      try {
        formatJson(src);
        expect.fail('should throw');
      } catch (e) {
        const err = toToolError(e, src);
        expect([err.line, err.column, err.message]).toEqual([line, column, expect.stringMatching(msg)]);
      }
    }
  });
  it('JSONPath with safe filter evaluation', () => {
    const doc = '{"store":{"book":[{"price":5,"t":"a"},{"price":15,"t":"b"}]}}';
    expect(queryJson(doc, '$.store.book[*].t')).toEqual(['a', 'b']);
    expect(queryJson(doc, '$..book[?(@.price > 10)].t')).toEqual(['b']);
  });
  it('JSON Schema validation', () => {
    const schema = JSON.stringify({ type: 'object', required: ['id'], properties: { id: { type: 'integer' }, email: { type: 'string', format: 'email' } } });
    expect(validateSchema('{"id":1}', schema)).toEqual([]);
    const issues = validateSchema('{"id":"x"}', schema);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].path).toBe('$.id');
    expect(validateSchema('{}', schema)[0].message).toMatch(/id/);
  });
});

describe('FR-F2 SQL', () => {
  it('formats PL/SQL with upper-case keywords', () => {
    const out = formatSql('select a,b from t where x=1', 'plsql', 'upper');
    expect(out).toBe('SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  x = 1');
  });
  it('minifies without touching strings or quoted identifiers', () => {
    const src = "SELECT  a -- comment\n,  'x  -- not a comment'\n/* block */ FROM \"My  Table\" WHERE b = 'it''s'";
    expect(minifySql(src)).toBe("SELECT a,'x  -- not a comment' FROM \"My  Table\" WHERE b = 'it''s'");
  });
  it('flags unterminated strings', () => {
    expect(() => minifySql("select 'abc")).toThrow(/Unterminated string/);
  });
});

describe('FR-F4 / FR-F5 / FR-F7 Prettier', () => {
  it('formats JS, TS and CSS', async () => {
    expect(await prettierFormat('const a={b:1}', 'babel')).toBe('const a = { b: 1 };\n');
    expect(await prettierFormat('let x:number=1', 'typescript', { semi: false })).toBe('let x: number = 1\n');
    expect(await prettierFormat('a{color:red}', 'css')).toBe('a {\n  color: red;\n}\n');
  });
  it('formats YAML and GraphQL', async () => {
    expect(await prettierFormat('a:   1\nb:\n    - x', 'yaml')).toBe('a: 1\nb:\n  - x\n');
    expect(await prettierFormat('query{user(id:1){name}}', 'graphql')).toContain('user(id: 1)');
  });
  it('surfaces syntax error positions', async () => {
    try {
      await prettierFormat('const = 1', 'babel');
      expect.fail('should throw');
    } catch (e) {
      const err = toToolError(e);
      expect(err.line).toBe(1);
      expect(err.column).toBeGreaterThan(0);
    }
  });
});

describe('Minifiers', () => {
  it('Terser', async () => {
    expect(await minifyJs('function add(first, second) { return first + second; }\nconsole.log(add(1,2));', { mangle: true, module: false })).toMatch(
      /^function add\(\w,\w\)/,
    );
  });
  it('CSS keeps strings', () => {
    expect(minifyCss('a  >  b { content: "a  b" ; color : red ; } /* x */')).toBe('a>b{content:"a  b";color:red}');
  });
  it('HTML keeps <pre>', () => {
    expect(minifyHtml('<div>\n  <p> hi </p>\n  <!-- c -->\n  <pre>  x\n  y</pre>\n</div>')).toBe('<div><p> hi </p><pre>  x\n  y</pre></div>');
  });
});

describe('FR-F6 XML', () => {
  it('formats and minifies', () => {
    expect(formatXml('<a><b>1</b><c/></a>')).toBe('<a>\n  <b>1</b>\n  <c/>\n</a>');
    expect(minifyXml('<a>\n  <b>1</b>\n</a>')).toBe('<a><b>1</b></a>');
  });
});

describe('FR-C3 detection', () => {
  it.each([
    ['{"a":1}', 'json'],
    ['<?xml version="1.0"?><a/>', 'xml'],
    ['SELECT * FROM users', 'sql'],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc', 'jwt'],
    ['SGVsbG8gV29ybGQgZnJvbSBEZXZUb29sa2l0', 'base64'],
    ['-----BEGIN CERTIFICATE-----\nMII', 'cert'],
    ['public class Foo {}', 'java'],
  ])('%s → %s', (input, tool) => {
    expect(detectInput(input)?.toolId).toBe(tool);
  });
  it('returns null for plain prose', () => {
    expect(detectInput('just some words here')).toBeNull();
  });
});
