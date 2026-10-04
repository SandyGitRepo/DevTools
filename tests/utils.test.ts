import { describe, expect, it } from 'vitest';
import { captureGroupNames, compile, parseLiteral, runRegex, segments } from '../src/lib/utils/regex';
import { detectUnit, epochToDate, isoInZone, parseDate, zonedToUtc } from '../src/lib/utils/time';
import { describe as describeCron, nextRuns, normalise } from '../src/lib/utils/cron';
import { convertCase, lineOp, stats } from '../src/lib/utils/text';
import { formatBase, parseBase, twosComplement } from '../src/lib/utils/numberBase';
import { contrastRatio, parseColour, toHex, toHslString, wcag } from '../src/lib/utils/colour';
import { defaultMaskOptions, luhnValid, maskJson, maskText, verhoeffValid } from '../src/lib/utils/masker';
import { generateTestData } from '../src/lib/utils/testdata';

describe('FR-U1 regex', () => {
  it('finds matches with numbered and named groups', () => {
    const r = runRegex('(?<year>\\d{4})-(\\d{2})', 'g', 'from 2026-10 to 2027-01');
    expect(r.matches.map((m) => m.text)).toEqual(['2026-10', '2027-01']);
    expect(r.matches[0].groups).toEqual([
      { name: 'year', value: '2026', start: 5, end: 9 },
      { name: '$2', value: '10', start: 10, end: 12 },
    ]);
  });
  it('stops after the first match without g, and survives empty matches', () => {
    expect(runRegex('a', '', 'aaa').matches).toHaveLength(1);
    expect(runRegex('x*', 'g', 'ab').matches).toHaveLength(3);
  });
  it('replaces and highlights', () => {
    const r = runRegex('(\\w+)@', 'g', 'asha@x ravi@y', '[$1]@');
    expect(r.replaced).toBe('[asha]@x [ravi]@y');
    expect(segments('asha@x', r.matches.slice(0, 1))).toEqual([{ text: 'asha@', match: 0 }, { text: 'x' }]);
  });
  it('reports errors plainly', () => {
    expect(() => compile('(', '')).toThrow(/Unterminated group/);
    expect(() => compile('a', 'gq')).toThrow(/Unknown flag/);
    expect(() => compile('a', 'gg')).toThrow(/only once/);
  });
  it('maps group names in source order, ignoring classes and lookarounds', () => {
    expect(captureGroupNames('(?<a>x)(?:y)(z)[(](?<=q)(?<b>w)\\(')).toEqual(['a', undefined, 'b']);
    expect(parseLiteral('/^\\d{6}$/gm')).toEqual({ pattern: '^\\d{6}$', flags: 'gm' });
  });
});

describe('FR-U2 timestamps', () => {
  it('detects epoch units', () => {
    expect(detectUnit(1791610000)).toBe('s');
    expect(detectUnit(1791610000123)).toBe('ms');
    expect(epochToDate('1791610000').date.toISOString()).toBe('2026-10-10T05:26:40.000Z');
    expect(() => epochToDate('12ab')).toThrow(/whole number/);
  });
  it('converts wall-clock time in IST and zones with DST', () => {
    expect(zonedToUtc(2026, 10, 4, 9, 30, 0, 0, 'Asia/Kolkata').toISOString()).toBe('2026-10-04T04:00:00.000Z');
    expect(parseDate('2026-07-01 12:00', 'America/New_York').toISOString()).toBe('2026-07-01T16:00:00.000Z'); // EDT
    expect(parseDate('2026-01-15 12:00', 'America/New_York').toISOString()).toBe('2026-01-15T17:00:00.000Z'); // EST
    expect(isoInZone(new Date('2026-10-04T04:00:00Z'), 'Asia/Kolkata')).toBe('2026-10-04T09:30:00+05:30');
    expect(isoInZone(new Date('2026-10-04T04:00:00Z'), 'UTC')).toBe('2026-10-04T04:00:00Z');
  });
});

describe('FR-U3 cron', () => {
  const from = new Date('2026-10-04T00:00:00Z'); // Sunday
  it('describes and schedules Unix cron in IST', () => {
    expect(describeCron('30 9 * * 1-5', 'unix')).toMatch(/09:30.*Monday through Friday/);
    expect(nextRuns('30 9 * * 1-5', 'unix', 'Asia/Kolkata', 2, from).map((d) => d.toISOString())).toEqual([
      '2026-10-05T04:00:00.000Z',
      '2026-10-06T04:00:00.000Z',
    ]);
  });
  it('converts Quartz weekdays (Sunday = 1): 6#3 is the third Friday', () => {
    expect(normalise('0 0 12 ? * 6#3', 'quartz').parser).toBe('0 0 12 ? * 5#3');
    const [d] = nextRuns('0 0 12 ? * 6#3', 'quartz', 'Asia/Kolkata', 1, from);
    expect(d.toISOString()).toBe('2026-10-16T06:30:00.000Z');
    expect(describeCron('0 0 12 ? * 6#3', 'quartz')).toMatch(/third Friday/);
  });
  it('handles AWS EventBridge syntax with a year field', () => {
    expect(nextRuns('cron(0 12 * * ? 2027)', 'aws', 'UTC', 1, from)[0].toISOString()).toBe('2027-01-01T12:00:00.000Z');
    expect(describeCron('cron(15 10 ? * 2-6 *)', 'aws')).toMatch(/Monday through Friday/);
  });
  it('validates field counts and ?', () => {
    expect(() => normalise('* * * *', 'unix')).toThrow(/5 fields/);
    expect(() => normalise('0 0 12 * * MON', 'quartz')).toThrow(/“\?”/);
  });
});

describe('FR-U4 text', () => {
  it('converts case per line', () => {
    expect(convertCase('customer id\nloan amount', 'camel')).toBe('customerId\nloanAmount');
    expect(convertCase('customerId', 'constant')).toBe('CUSTOMER_ID');
    expect(convertCase('Customer ID', 'kebab')).toBe('customer-id');
  });
  it('line tools and stats', () => {
    expect(lineOp('b\na\nB\na', 'dedupeCi')).toBe('b\na');
    expect(lineOp('item10\nitem2\nitem1', 'sortNatural')).toBe('item1\nitem2\nitem10');
    expect(lineOp('  x  \n\n y', 'removeEmpty')).toBe('  x  \n y');
    const s = stats('नमस्ते world. Hi!');
    expect(s.words).toBe(3);
    expect(s.sentences).toBe(2);
    expect(s.bytesUtf8).toBeGreaterThan(s.characters);
  });
});

describe('FR-U5 number base', () => {
  it('parses and formats big numbers', () => {
    expect(parseBase('0xFF', 16)).toBe(255n);
    expect(formatBase(parseBase('18446744073709551615', 10), 16)).toBe('FFFFFFFFFFFFFFFF');
    expect(formatBase(255n, 2, true)).toBe('1111 1111');
    expect(() => parseBase('19', 8)).toThrow(/base-8/);
  });
  it("two's complement", () => {
    expect(twosComplement(-1n, 8)).toEqual({ unsigned: 255n, signed: -1n });
    expect(twosComplement(200n, 8).signed).toBe(-56n);
    expect(() => twosComplement(300n, 8)).toThrow(/does not fit/);
  });
});

describe('FR-U7 colour', () => {
  it('converts formats', () => {
    expect(toHex(parseColour('rgb(0, 114, 188)'))).toBe('#0072BC');
    expect(toHslString(parseColour('#0072BC'))).toBe('hsl(204, 100%, 37%)');
    expect(toHex(parseColour('hsl(204, 100%, 37%)'))).toBe('#0071BD');
    expect(toHex(parseColour('#abc'))).toBe('#AABBCC');
  });
  it('computes WCAG contrast', () => {
    expect(contrastRatio(parseColour('#000'), parseColour('#fff'))).toBeCloseTo(21, 5);
    const r = contrastRatio(parseColour('#767676'), parseColour('#fff'));
    expect(r).toBeCloseTo(4.54, 2);
    expect(wcag(r)).toEqual({ aaNormal: true, aaLarge: true, aaaNormal: false, aaaLarge: true });
  });
});

/** Appends a Verhoeff check digit to make a format-valid test number. */
function withVerhoeff(base: string): string {
  for (let d = 0; d <= 9; d++) if (verhoeffValid(base + d)) return base + d;
  throw new Error('unreachable');
}

describe('FR-U8 masker', () => {
  it('checksums', () => {
    expect(verhoeffValid('2363')).toBe(true);
    expect(verhoeffValid('2364')).toBe(false);
    expect(luhnValid('4111111111111111')).toBe(true);
    expect(luhnValid('4111111111111112')).toBe(false);
  });
  it('masks Indian PII in text', () => {
    const aadhaar = withVerhoeff('23412341234');
    const spaced = `${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8)}`;
    const src = `PAN ABCPE1234F, Aadhaar ${spaced}, card 4111 1111 1111 1111, mobile +91 98765 43210, mail asha.verma@example.in, a/c 50100293812345`;
    const { text, counts } = maskText(src, defaultMaskOptions);
    expect(text).toBe(
      `PAN ABXXXXXX4F, Aadhaar XXXX XXXX ${aadhaar.slice(8)}, card XXXX XXXX XXXX 1111, mobile +91 XXXXX X3210, mail aXXXXXXXXX@example.in, a/c XXXXXXXXXX2345`,
    );
    expect(counts).toEqual({ email: 1, pan: 1, card: 1, aadhaar: 1, mobile: 1, account: 1 });
  });
  it('ignores 12-digit numbers that fail Verhoeff (not Aadhaar) but still masks them as accounts', () => {
    const notAadhaar = withVerhoeff('23412341234').replace(/\d$/, (d) => String((Number(d) + 1) % 10));
    const { counts } = maskText(`ref ${notAadhaar}`, defaultMaskOptions);
    expect(counts.aadhaar).toBeUndefined();
    expect(counts.account).toBe(1);
  });
  it('masks JSON values and sensitive keys while keeping structure', () => {
    const out = maskJson({ user: { email: 'a.b@x.in', password: 'hunter2', mobile: 9876543210 }, id: 7 }, defaultMaskOptions) as Record<
      string,
      Record<string, unknown>
    >;
    expect(out.user.password).toBe('XXXXXXXX');
    expect(out.user.email).toBe('aXXX@x.in');
    expect(out.user.mobile).toBe('XXXXXX3210');
    expect(out.id).toBe(7);
  });
});

describe('FR-U9 test data', () => {
  it('generates flagged, reproducible Indian records', async () => {
    const a = await generateTestData(5, ['name', 'email', 'mobile', 'pan', 'pin', 'ifsc'], 42);
    const b = await generateTestData(5, ['name', 'email', 'mobile', 'pan', 'pin', 'ifsc'], 42);
    expect(a).toEqual(b);
    for (const r of a) {
      expect(r.test_record).toBe(true);
      expect(r.email).toMatch(/@example\.test$/);
      expect(r.mobile).toMatch(/^\+91 [6-9]\d{4} \d{5}$/);
      expect(r.pan).toMatch(/^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/);
      expect(r.pin).toMatch(/^[1-8]\d{5}$/);
      expect(r.ifsc).toMatch(/^TEST0[A-Z0-9]{6}$/);
    }
  });
  it('validates count', async () => {
    await expect(generateTestData(0, ['name'])).rejects.toThrow(/between 1 and 10,000/);
  });
});
