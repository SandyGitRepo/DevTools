/** FR-M1…M5 acceptance: NIST factors to 4 decimal places. */
import { describe, expect, it } from 'vitest';
import { areaUnits, estimateAreas, formatNumber, fromBase, lengthUnits, otherCategories, parseLength, toBase, toFeetInches } from '../src/lib/units/units';
import { parseSheet } from '../src/lib/cheatsheets/parse';

const conv = (units: { id: string }[], from: string, to: string, v: number) => {
  const u = units as Parameters<typeof toBase>[0][];
  const a = u.find((x) => x.id === from)!;
  const b = u.find((x) => x.id === to)!;
  return fromBase(b, toBase(a, v));
};

describe('length', () => {
  it('exact NIST factors', () => {
    expect(conv(lengthUnits, 'in', 'cm', 1)).toBeCloseTo(2.54, 10);
    expect(conv(lengthUnits, 'ft', 'cm', 1)).toBeCloseTo(30.48, 10);
    expect(conv(lengthUnits, 'mi', 'km', 1)).toBeCloseTo(1.609344, 10);
    expect(conv(lengthUnits, 'yd', 'm', 1)).toBeCloseTo(0.9144, 10);
  });
  it('parses mixed feet/inches input', () => {
    for (const s of [`5' 8"`, `5'8`, '5 ft 8 in', '5ft8in', '5 feet 8 inches', '5′ 8″']) expect(parseLength(s)).toBeCloseTo(1.7272, 10);
    expect(parseLength('68 in')).toBeCloseTo(1.7272, 10);
    expect(parseLength('172.72 cm')).toBeCloseTo(1.7272, 10);
    expect(parseLength('5.5 ft')).toBeCloseTo(1.6764, 10);
    expect(parseLength('hello')).toBeNull();
  });
  it('formats back to feet and inches', () => {
    expect(toFeetInches(1.7272).text).toBe(`5' 8"`);
    expect(toFeetInches(1.8288).text).toBe(`6' 0"`);
    expect(toFeetInches(1.82879).text).toBe(`6' 0"`); // 71.9996 in rounds up and carries
  });
});

describe('area and land units', () => {
  const units = areaUnits(14400, 'Assam');
  it('NIST and Indian land factors', () => {
    expect(conv(units, 'sqft', 'sqm', 1)).toBeCloseTo(0.09290304, 10);
    expect(conv(units, 'acre', 'sqft', 1)).toBeCloseTo(43560, 6);
    expect(conv(units, 'guntha', 'sqft', 1)).toBeCloseTo(1089, 6);
    expect(conv(units, 'cent', 'sqft', 1)).toBeCloseTo(435.6, 6);
    expect(conv(units, 'hectare', 'acre', 1)).toBeCloseTo(2.4711, 4);
    expect(conv(units, 'bigha', 'sqft', 1)).toBeCloseTo(14400, 6);
    expect(conv(units, 'sqyd', 'sqft', 1)).toBeCloseTo(9, 10);
  });
  it('estimates carpet / built-up / super built-up', () => {
    const e = estimateAreas(1000, 'carpet', 10, 30);
    expect(e.builtUp).toBeCloseTo(1100, 8);
    expect(e.superBuiltUp).toBeCloseTo(1430, 8);
    expect(estimateAreas(1430, 'superBuiltUp', 10, 30).carpet).toBeCloseTo(1000, 8);
  });
});

describe('other units', () => {
  const cat = (id: string) => otherCategories.find((c) => c.id === id)!.units;
  it('weight, temperature, data, volume', () => {
    expect(conv(cat('weight'), 'lb', 'kg', 1)).toBeCloseTo(0.45359237, 10);
    expect(conv(cat('temperature'), 'c', 'f', 100)).toBeCloseTo(212, 10);
    expect(conv(cat('temperature'), 'f', 'c', -40)).toBeCloseTo(-40, 10);
    expect(conv(cat('temperature'), 'c', 'k', 0)).toBeCloseTo(273.15, 10);
    expect(conv(cat('data'), 'GiB', 'MB', 1)).toBeCloseTo(1073.741824, 8);
    expect(conv(cat('volume'), 'galus', 'l', 1)).toBeCloseTo(3.785411784, 10);
  });
  it('formats numbers', () => {
    expect(formatNumber(2.5400000001, 4)).toBe('2.54');
    expect(formatNumber(3, 4)).toBe('3');
    expect(formatNumber(1 / 3, 4)).toBe('0.3333');
  });
});

describe('FR-H7 cheat sheet parsing', () => {
  it('splits front matter, intro and cards', () => {
    const s = parseSheet(
      'content/cheatsheets/git.md',
      '---\ntitle: Git\nowner: Platform team\nreviewed: 2026-10-01\nversion: Git 2.46\ntags: [vcs]\n---\nIntro text.\n\n## Branches\n- Create: `git switch -c x`\n\n```bash\ngit switch -c feature/x\n```\n\n## Undo\nText\n',
    );
    expect(s.id).toBe('git');
    expect(s.reviewed).toBe('2026-10-01');
    expect(s.intro).toBe('Intro text.');
    expect(s.cards.map((c) => c.id)).toEqual(['git--branches', 'git--undo']);
    expect(s.cards[0].text).toContain('git switch -c feature/x');
  });
  it('rejects sheets without required metadata', () => {
    expect(() => parseSheet('x.md', '---\ntitle: X\n---\n')).toThrow(/owner/);
  });
});
