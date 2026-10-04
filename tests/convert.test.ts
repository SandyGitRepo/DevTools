import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { flatten, jsonToCsv, parseCsv, recordsFromJson } from '../src/lib/convert/csv';
import { convertData, parseData } from '../src/lib/convert/formats';
import { generateInserts, quoteIdent, sqlValue } from '../src/lib/convert/sqlInsert';
import { generateCode } from '../src/lib/convert/codegen';
import { assertNotZipBomb, readWorkbook } from '../src/lib/convert/excel';

describe('FR-D1 CSV ↔ JSON', () => {
  it('parses with header, auto delimiter and typing', () => {
    const r = parseCsv('id;name;active\n1;Asha;true\n2;"Ravi; Jr";false\n', { delimiter: 'auto', header: true, dynamicTyping: true });
    expect(r.delimiter).toBe(';');
    expect(r.fields).toEqual(['id', 'name', 'active']);
    expect(r.rows).toEqual([
      { id: 1, name: 'Asha', active: true },
      { id: 2, name: 'Ravi; Jr', active: false },
    ]);
  });
  it('keeps leading zeros as text when typing is off', () => {
    const r = parseCsv('pin\n000123', { delimiter: ',', header: true, dynamicTyping: false });
    expect(r.rows).toEqual([{ pin: '000123' }]);
  });
  it('JSON → CSV with column union, flattening and formula escaping', () => {
    const csv = jsonToCsv([{ a: 1, b: { c: 'x' } }, { a: 2, d: [1, 2] }, { a: '=cmd()' }], { delimiter: ',', flattenNested: true });
    expect(csv.split('\r\n')).toEqual(['a,b.c,d', '1,x,', '2,,"[1,2]"', `"'=cmd()",,`]);
  });
  it('finds the records array inside an object', () => {
    expect(recordsFromJson({ meta: 1, items: [{ x: 1 }] })).toEqual([{ x: 1 }]);
    expect(flatten({ a: { b: { c: 1 } } })).toEqual({ 'a.b.c': 1 });
  });
  it('round-trips', () => {
    const src = [{ id: 1, city: 'Pune, MH', note: 'He said "hi"' }];
    const back = parseCsv(jsonToCsv(src, { delimiter: ',', flattenNested: false }), { delimiter: 'auto', header: true, dynamicTyping: true });
    expect(back.rows).toEqual(src);
  });
});

describe('FR-D2 JSON ↔ YAML ↔ XML', () => {
  it('JSON → YAML → JSON is lossless', () => {
    const json = '{"service":{"name":"api","ports":[80,443],"tls":true,"owner":null}}';
    const yaml = convertData(json, 'json', 'yaml');
    expect(yaml).toContain('ports:\n    - 80');
    expect(JSON.parse(convertData(yaml, 'yaml', 'json'))).toEqual(JSON.parse(json));
  });
  it('XML with attributes round-trips through JSON', () => {
    const xml = '<account id="42" type="SAVINGS"><balance currency="INR">1250.5</balance><holder>Asha</holder></account>';
    const data = parseData(xml, 'xml') as { account: Record<string, unknown> };
    expect(data.account['@_id']).toBe(42);
    expect(data.account.holder).toBe('Asha');
    const back = convertData(JSON.stringify(data), 'json', 'xml');
    expect(back).toContain('<account id="42" type="SAVINGS">');
    expect(back).toContain('<balance currency="INR">1250.5</balance>');
  });
  it('wraps multi-key JSON in a root element', () => {
    expect(convertData('{"a":1,"b":2}', 'json', 'xml', 2, 'data')).toContain('<data>\n  <a>1</a>');
  });
  it('rejects entity declarations and reports XML errors', () => {
    expect(() => parseData('<!DOCTYPE x [<!ENTITY a "aaaa">]><x>&a;</x>', 'xml')).toThrow(/ENTITY/);
    expect(() => parseData('<a><b></a>', 'xml')).toThrow();
  });
});

describe('FR-D5 SQL INSERT generator', () => {
  const rows = [
    { id: 1, name: "O'Brien", active: true, note: null },
    { id: 2, name: 'C:\\path', active: false, note: '' },
  ];
  it('escapes values per dialect', () => {
    expect(sqlValue("O'Brien", 'oracle', false)).toBe("'O''Brien'");
    expect(sqlValue('C:\\x', 'mysql', false)).toBe("'C:\\\\x'");
    expect(sqlValue(true, 'postgresql', false)).toBe('TRUE');
    expect(sqlValue(true, 'tsql', false)).toBe('1');
    expect(sqlValue('पुणे', 'tsql', false)).toBe("N'पुणे'");
    expect(sqlValue('', 'oracle', true)).toBe('NULL');
  });
  it('quotes identifiers only when needed (or when forced)', () => {
    expect(quoteIdent('LOANS', 'oracle', false)).toBe('LOANS');
    expect(quoteIdent('first name', 'mysql', false)).toBe('`first name`');
    expect(quoteIdent('dbo.Order', 'tsql', true)).toBe('[dbo].[Order]');
  });
  it('builds multi-row inserts and Oracle INSERT ALL', () => {
    const pg = generateInserts(rows, {
      table: 'customers',
      dialect: 'postgresql',
      batchSize: 100,
      emptyAsNull: true,
      quoteIdentifiers: false,
      createTable: false,
    });
    expect(pg).toBe("INSERT INTO customers (id, name, active, note) VALUES\n  (1, 'O''Brien', TRUE, NULL),\n  (2, 'C:\\path', FALSE, NULL);\n");
    const ora = generateInserts(rows, {
      table: 'CUSTOMERS',
      dialect: 'oracle',
      batchSize: 100,
      emptyAsNull: false,
      quoteIdentifiers: false,
      createTable: true,
    });
    expect(ora).toContain('CREATE TABLE CUSTOMERS (\n  id NUMBER(19),\n  name VARCHAR2(50 CHAR),\n  active NUMBER(1)');
    expect(ora).toContain('INSERT ALL\n  INTO CUSTOMERS');
    expect(ora).toContain('SELECT 1 FROM DUAL;');
    expect(ora.trim().endsWith('COMMIT;')).toBe(true);
    const single = generateInserts(rows, { table: 't', dialect: 'mysql', batchSize: 1, emptyAsNull: false, quoteIdentifiers: false, createTable: false });
    expect(single.trim().split('\n')).toHaveLength(2);
  });
});

describe('FR-D4 JSON → classes', () => {
  const sample = '{"customerId":10293,"name":"Asha","email":"a@example.test","loans":[{"id":"LN-1","amount":500000.5,"active":true}]}';
  it('TypeScript interfaces', async () => {
    const ts = await generateCode(sample, { lang: 'typescript', topLevel: 'Customer', namespace: '', lombok: false, justTypes: true });
    expect(ts).toContain('export interface Customer {');
    expect(ts).toContain('loans:');
    expect(ts).toContain('export interface Loan {');
  }, 30000);
  it('Java POJO with package', async () => {
    const java = await generateCode(sample, { lang: 'java', topLevel: 'Customer', namespace: 'com.example.model', lombok: false, justTypes: true });
    expect(java).toContain('package com.example.model;');
    expect(java).toMatch(/class Customer/);
  }, 30000);
  it('C# class with namespace', async () => {
    const cs = await generateCode(sample, { lang: 'csharp', topLevel: 'Customer', namespace: 'Example.Models', lombok: false, justTypes: true });
    expect(cs).toContain('namespace Example.Models');
    expect(cs).toMatch(/public partial class Customer/);
  }, 30000);
  it('reports invalid JSON with position', async () => {
    await expect(generateCode('{"a":}', { lang: 'typescript', topLevel: 'X', namespace: '', lombok: false, justTypes: true })).rejects.toThrow(
      /Expected a value/,
    );
  });
});

describe('FR-D3 Excel + SEC-4', () => {
  it('reads sheets from a generated workbook', async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['id', 'name'],
        [1, 'Asha'],
        [2, 'Ravi'],
      ]),
      'Customers',
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x'], [9]]), 'Other');
    const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    const book = await readWorkbook(bytes);
    expect(book.sheetNames).toEqual(['Customers', 'Other']);
    const s = book.sheet('Customers');
    expect(s.json).toEqual([
      { id: 1, name: 'Asha' },
      { id: 2, name: 'Ravi' },
    ]);
    expect(s.csv).toBe('id,name\n1,Asha\n2,Ravi');
  });
  it('refuses a zip bomb', () => {
    const bomb = zipSync({ 'xl/worksheets/sheet1.xml': [new Uint8Array(250 * 1024 * 1024), { level: 9 }] });
    expect(() => assertNotZipBomb(bomb)).toThrow(/zip bomb/);
  }, 60000); // building a 250 MB test archive is slow when suites run in parallel
});

describe('FR-D3 dates', () => {
  it('exports Excel dates as ISO yyyy-mm-dd', async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['when'], [new Date(Date.UTC(2026, 3, 12))]], { cellDates: true }), 'S');
    const book = await readWorkbook(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer));
    expect(book.sheet('S').csv).toBe('when\n2026-04-12');
  });
});
