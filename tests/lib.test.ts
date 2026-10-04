import { describe, expect, it } from 'vitest';
import { hashBytes, hashFile, matchesExpected } from '../src/lib/crypto/hash';
import { toBase64, toHex, utf8Encode } from '../src/lib/bytes';
import { lineColFromOffset, toToolError } from '../src/lib/errors';
import { allZones, epochToDate, formatOffset, humanInZone, isoInZone, parseDate, relative, zoneOffsetMinutes } from '../src/lib/utils/time';
import { cases, convertCase, lineOp, stats, type CaseId } from '../src/lib/utils/text';
import { fieldLabels, generateTestData, type FieldId } from '../src/lib/utils/testdata';
import { formatXml, minifyXml } from '../src/lib/formatters/xml';
import { prettierFormat } from '../src/lib/formatters/prettier';

describe('FR-K1 expected-hash comparison', () => {
  // SHA-256("abc"): hex has no '-', Base64url form of these bytes does
  const findDigest = async () => {
    for (let i = 0; ; i++) {
      const d = (await hashBytes(utf8Encode(`x${i}`), ['sha256'])).sha256;
      const b64 = toBase64(d, false, false);
      if (b64.includes('+') && /[a-z]/.test(b64) && /[A-Z]/.test(b64)) return d;
    }
  };

  it('accepts hex in any case, with separators', async () => {
    const d = await findDigest();
    const hex = toHex(d);
    expect(matchesExpected(d, hex)).toBe(true);
    expect(matchesExpected(d, `  ${hex.toUpperCase()}  `)).toBe(true);
    expect(matchesExpected(d, hex.match(/../g)!.join(':'))).toBe(true);
  });
  it('accepts Base64 and Base64url, padded or not (url form keeps its "-")', async () => {
    const d = await findDigest();
    expect(matchesExpected(d, toBase64(d))).toBe(true);
    expect(matchesExpected(d, toBase64(d, false, false))).toBe(true);
    expect(matchesExpected(d, toBase64(d, true, false))).toBe(true);
    expect(toBase64(d, true, false)).toContain('-');
  });
  it('rejects Base64 with changed letter case (a different value)', async () => {
    const d = await findDigest();
    const b64 = toBase64(d);
    const flipped = b64.replace(/[a-zA-Z]/, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));
    expect(matchesExpected(d, flipped)).toBe(false);
    expect(matchesExpected(d, b64.toLowerCase())).toBe(false);
  });
  it('rejects empty, wrong and truncated values', async () => {
    const d = await findDigest();
    expect(matchesExpected(d, '')).toBe(false);
    expect(matchesExpected(d, '   ')).toBe(false);
    expect(matchesExpected(d, toHex(d).slice(0, -2))).toBe(false);
    expect(matchesExpected(d, 'deadbeef')).toBe(false);
  });
  it('streams a file in chunks with the same result as hashing bytes', async () => {
    const data = new Uint8Array(9 * 1024 * 1024).map((_, i) => i * 31);
    const progress: number[] = [];
    const a = await hashFile(new Blob([data]), ['sha256', 'md5', 'sha3-256', 'crc32'], (f) => progress.push(f));
    const b = await hashBytes(data, ['sha256', 'md5', 'sha3-256', 'crc32']);
    expect(Object.fromEntries(Object.entries(a).map(([k, v]) => [k, toHex(v)]))).toEqual(Object.fromEntries(Object.entries(b).map(([k, v]) => [k, toHex(v)])));
    expect(progress).toEqual([4 / 9, 8 / 9, 1]);
  });
  it('hashes with every algorithm (FIPS 180-4 SHA-224/384, FIPS 202 SHA3-384/512 for "abc")', async () => {
    const r = await hashBytes(utf8Encode('abc'), ['sha224', 'sha384', 'sha3-384', 'sha3-512', 'sha1']);
    expect(toHex(r.sha224)).toBe('23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7');
    expect(toHex(r.sha1)).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(toHex(r.sha384)).toMatch(/^cb00753f45a35e8b/);
    expect(toHex(r['sha3-384'])).toMatch(/^ec01498288516fc9/);
    expect(toHex(r['sha3-512'])).toMatch(/^b751850b1a57168a/);
  });
});

describe('FR-C4 error normalisation', () => {
  it('maps offsets to 1-based line and column', () => {
    expect(lineColFromOffset('ab\ncd\nef', 0)).toEqual({ line: 1, column: 1 });
    expect(lineColFromOffset('ab\ncd\nef', 4)).toEqual({ line: 2, column: 2 });
    expect(lineColFromOffset('ab\ncd\nef', 6)).toEqual({ line: 3, column: 1 });
  });
  it('reads positions from each library shape', () => {
    expect(toToolError(Object.assign(new Error('bad'), { jsonLine: 3, jsonColumn: 7 }))).toEqual({ message: 'bad', line: 3, column: 7 });
    expect(toToolError(Object.assign(new Error('Unexpected token (2:5)\n> 2 | x'), { loc: { start: { line: 2, column: 5 } } }))).toEqual({
      message: 'Unexpected token',
      line: 2,
      column: 5,
    });
    expect(toToolError(Object.assign(new Error('long text'), { reason: 'bad indentation', mark: { line: 0, column: 4 } }))).toEqual({
      message: 'bad indentation',
      line: 1,
      column: 5,
    });
    expect(toToolError(new Error('Unexpected token } in JSON (line 4 column 2)'))).toEqual({ message: 'Unexpected token }', line: 4, column: 2 });
    expect(toToolError(new Error('Parse error at line: 9, column: 3\nmore'))).toEqual({ message: 'Parse error at line: 9, column: 3', line: 9, column: 3 });
  });
  it('converts "at position N" using the source, and humanises JSON messages', () => {
    expect(toToolError(new SyntaxError('Unexpected token x in JSON at position 5'), '{\n "a"x}')).toEqual({
      message: 'Unexpected token x',
      line: 2,
      column: 4,
    });
    expect(toToolError(new SyntaxError('Unexpected end of JSON input'))).toEqual({ message: 'Unexpected end of JSON input' });
    expect(toToolError(new SyntaxError('Unexpected end of JSON input at position 1'), '{').message).toMatch(/ends unexpectedly/);
  });
  it('handles strings and non-Error values', () => {
    expect(toToolError('plain\nsecond')).toEqual({ message: 'plain' });
    expect(toToolError(42)).toEqual({ message: 'Unexpected error' });
    expect(toToolError(null)).toEqual({ message: 'Unexpected error' });
  });
});

describe('FR-U2 timestamps (extra)', () => {
  it('converts every epoch unit and rejects junk', () => {
    const want = Date.UTC(2026, 9, 4, 10, 0, 0);
    expect(epochToDate(String(want / 1000)).date.getTime()).toBe(want);
    expect(epochToDate(String(want), 'ms').date.getTime()).toBe(want);
    expect(epochToDate(String(want * 1000)).unit).toBe('us');
    expect(epochToDate(String(want * 1000)).date.getTime()).toBe(want);
    expect(epochToDate(`${want}000000`).unit).toBe('ns');
    expect(epochToDate(`${want}000000`).date.getTime()).toBe(want);
    expect(epochToDate('-86400').date.toISOString()).toBe('1969-12-31T00:00:00.000Z');
    expect(() => epochToDate('12abc')).toThrow(/whole number/);
    expect(() => epochToDate('99999999999999999', 's')).toThrow(/outside the supported/);
  });
  it('parses RFC 2822 and ISO with offsets, and explains bad input', () => {
    expect(parseDate('Sun, 04 Oct 2026 10:00:00 GMT', 'Asia/Kolkata').toISOString()).toBe('2026-10-04T10:00:00.000Z');
    expect(parseDate('2026-10-04T15:30:00+05:30', 'UTC').toISOString()).toBe('2026-10-04T10:00:00.000Z');
    expect(parseDate('2026-10-04 15:30:00.5', 'Asia/Kolkata').toISOString()).toBe('2026-10-04T10:00:00.500Z');
    expect(() => parseDate('  ', 'UTC')).toThrow(/Enter a date/);
    expect(() => parseDate('next tuesday', 'UTC')).toThrow(/Unrecognised date/);
  });
  it('formats offsets and zoned output', () => {
    expect(formatOffset(330)).toBe('+05:30');
    expect(formatOffset(-570)).toBe('-09:30');
    expect(formatOffset(0)).toBe('+00:00');
    const d = new Date(Date.UTC(2026, 9, 4, 10, 0, 0));
    expect(zoneOffsetMinutes(d, 'Asia/Kolkata')).toBe(330);
    expect(zoneOffsetMinutes(new Date(Date.UTC(2026, 0, 15)), 'America/New_York')).toBe(-300);
    expect(isoInZone(d, 'Asia/Kolkata')).toBe('2026-10-04T15:30:00+05:30');
    expect(isoInZone(d, 'UTC')).toBe('2026-10-04T10:00:00Z');
    expect(isoInZone(new Date(d.getTime() + 250), 'UTC')).toBe('2026-10-04T10:00:00.250Z');
    expect(humanInZone(d, 'Asia/Kolkata')).toMatch(/2026/);
    expect(humanInZone(d, 'Asia/Kolkata')).toMatch(/03:30:00\s*pm/i);
  });
  it('describes relative times', () => {
    const now = new Date(Date.UTC(2026, 9, 4));
    expect(relative(new Date(now.getTime() + 3 * 86400000), now)).toBe('in 3 days');
    expect(relative(new Date(now.getTime() - 2 * 3600000), now)).toBe('2 hours ago');
    expect(relative(now, now)).toBe('now');
    expect(relative(new Date(now.getTime() - 400 * 86400000), now)).toBe('last year');
  });
  it('lists zones with IST and UTC first, without duplicates', () => {
    const z = allZones();
    expect(z.slice(0, 2)).toEqual(['Asia/Kolkata', 'UTC']);
    expect(new Set(z).size).toBe(z.length);
  });
});

describe('FR-U4 text (every operation)', () => {
  it('converts every case', () => {
    const out = Object.fromEntries((Object.keys(cases) as CaseId[]).map((id) => [id, convertCase('loan amount\n\nCustomer ID', id)]));
    expect(out).toEqual({
      camel: 'loanAmount\n\ncustomerId',
      pascal: 'LoanAmount\n\nCustomerId',
      snake: 'loan_amount\n\ncustomer_id',
      constant: 'LOAN_AMOUNT\n\nCUSTOMER_ID',
      kebab: 'loan-amount\n\ncustomer-id',
      title: 'Loan Amount\n\nCustomer Id',
      sentence: 'Loan amount\n\nCustomer id',
      dot: 'loan.amount\n\ncustomer.id',
      path: 'loan/amount\n\ncustomer/id',
      upper: 'LOAN AMOUNT\n\nCUSTOMER ID',
      lower: 'loan amount\n\ncustomer id',
    });
  });
  it('runs every line operation', () => {
    expect(lineOp(' a \r\nb ', 'trim')).toBe('a\nb');
    expect(lineOp('b\na\nb\nB', 'dedupe')).toBe('b\na\nB');
    expect(lineOp('b\nB\na', 'sortAsc')).toBe('B\na\nb');
    expect(lineOp('b\nB\na', 'sortDesc')).toBe('b\na\nB');
    expect(lineOp('10\n-2.5\nx\n3', 'sortNumeric')).toBe('-2.5\nx\n3\n10');
    expect(lineOp('1\n2\n3', 'reverse')).toBe('3\n2\n1');
    expect(lineOp('a\nb', 'number')).toBe('1. a\n2. b');
    expect(lineOp('a\n\nb\n ', 'join')).toBe('a, b');
    const many = Array.from({ length: 50 }, (_, i) => String(i)).join('\n');
    const shuffled = lineOp(many, 'shuffle');
    expect(shuffled.split('\n').sort()).toEqual(many.split('\n').sort());
  });
  it('stats for empty and multi-line text', () => {
    expect(stats('')).toEqual({ characters: 0, charactersNoSpaces: 0, words: 0, lines: 0, sentences: 0, bytesUtf8: 0, readingMinutes: 0 });
    const s = stats('no punctuation here\nsecond line 😀');
    expect(s.lines).toBe(2);
    expect(s.sentences).toBe(1);
    expect(s.characters).toBe(33);
    expect(s.readingMinutes).toBe(1);
    expect(stats(Array(1000).fill('word').join(' ')).readingMinutes).toBe(5);
  });
});

describe('FR-U9 test data (every field)', () => {
  it('generates every field in the expected format', async () => {
    const all = Object.keys(fieldLabels) as FieldId[];
    const rows = await generateTestData(20, all, 7);
    for (const r of rows) {
      expect(Object.keys(r)).toEqual([...all, 'test_record']);
      expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(['F', 'M']).toContain(r.gender);
      const age = (Date.now() - Date.parse(r.dob as string)) / (365.25 * 86400000);
      expect(age).toBeGreaterThanOrEqual(17.9);
      expect(age).toBeLessThanOrEqual(76.1);
      expect(r.account).toMatch(/^[1-9]\d{10,15}$/);
      expect(r.amount as number).toBeGreaterThanOrEqual(100);
      expect(r.amount as number).toBeLessThanOrEqual(2_500_000);
      expect(Math.round((r.amount as number) * 100) / 100).toBe(r.amount);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const k of ['address', 'city', 'state', 'company', 'name']) expect(String(r[k]).length).toBeGreaterThan(0);
    }
  });
  it('is random without a seed, and validates input', async () => {
    const a = await generateTestData(3, ['id']);
    const b = await generateTestData(3, ['id']);
    expect(a).not.toEqual(b);
    await expect(generateTestData(10001, ['id'])).rejects.toThrow(/between 1 and 10,000/);
    await expect(generateTestData(1.5, ['id'])).rejects.toThrow(/between 1 and 10,000/);
    await expect(generateTestData(1, [])).rejects.toThrow(/at least one field/);
  });
});

describe('FR-F6 XML (extra)', () => {
  it('honours the indent and rejects input it cannot parse', () => {
    expect(formatXml('<a><b>x</b></a>', '\t')).toBe('<a>\n\t<b>x</b>\n</a>');
    expect(minifyXml('<a>\n  <b>x</b>\n</a>')).toBe('<a><b>x</b></a>');
    expect(() => formatXml('<a>x</a><c/>')).toThrow(/multiple root/);
    expect(() => minifyXml('not xml')).toThrow();
  });
  it('documents that the library repairs mismatched tags (the tool checks well-formedness first; see e2e)', () => {
    expect(formatXml('<a><b>x</a></b>')).toBe('<a>\n  <b>x</b>\n</a>');
  });
});

describe('FR-F4 Prettier (other parsers)', () => {
  it('formats HTML, SCSS, Less and Markdown', async () => {
    expect(await prettierFormat('<div><p>hi</p><script>let a=1</script></div>', 'html')).toMatch(/let a = 1;/);
    expect(await prettierFormat('.a{.b{color:red}}', 'scss')).toBe('.a {\n  .b {\n    color: red;\n  }\n}\n');
    expect(await prettierFormat('@c:red;.a{color:@c}', 'less')).toMatch(/color: @c;/);
    expect(await prettierFormat('# T\n* a\n* b', 'markdown')).toBe('# T\n\n- a\n- b\n');
    expect(await prettierFormat('const a = {b:1}', 'babel', { semi: false })).toBe('const a = { b: 1 }\n');
  });
});
