/**
 * Section 8 — property-based tests (round-trips, 1,000 random cases each) and fuzzing (malformed
 * input must never crash a parser or hang for more than 5 s). Uses fast-check (MIT).
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PDFDocument } from 'pdf-lib';
import { fromBase64, fromHex, toBase64, toHex, utf8Decode, utf8Encode } from '../src/lib/bytes';
import { base32Decode, base32Encode, decodeText, encodeText, fromBinary, toBinary } from '../src/lib/encoding/basen';
import { unicodeEscape, unicodeUnescape } from '../src/lib/encoding/unicode';
import { urlDecode, urlEncode } from '../src/lib/encoding/url';
import { compress, decompress } from '../src/lib/encoding/gzip';
import { decodeJwt } from '../src/lib/encoding/jwt';
import { decodeCertificates } from '../src/lib/encoding/cert';
import { formatJson, minifyJson } from '../src/lib/formatters/json';
import { locateJsonError } from '../src/lib/formatters/jsonError';
import { minifySql } from '../src/lib/formatters/sql';
import { aesDecrypt, aesEncrypt } from '../src/lib/crypto/aes';
import { hmac } from '../src/lib/crypto/hmac';
import { formatRanges, parseRanges } from '../src/lib/pdf/ranges';
import { loadPdf, merge, split } from '../src/lib/pdf/ops';
import { parseData, convertData } from '../src/lib/convert/formats';
import { jsonToCsv, parseCsv } from '../src/lib/convert/csv';
import { formatBase, parseBase, type Base } from '../src/lib/utils/numberBase';
import { parseColour, toHex as colourHex } from '../src/lib/utils/colour';
import { defaultMaskOptions, maskText } from '../src/lib/utils/masker';
import { describe as describeCron, normalise } from '../src/lib/utils/cron';
import { compile } from '../src/lib/utils/regex';
import { areaUnits, fromBase, lengthUnits, otherCategories, parseLength, toBase } from '../src/lib/units/units';

const RUNS = 1000;
const text = fc.string({ unit: 'grapheme', maxLength: 200 });

/** Runs fn, requiring that it returns or throws an Error (not a non-Error / crash) within 5 s. */
async function survives(fn: () => unknown): Promise<number> {
  const t0 = performance.now();
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof Error)) throw new Error(`Threw a non-Error value: ${String(e)}`, { cause: e });
    if (!e.message) throw new Error('Threw an Error without a message', { cause: e });
  }
  const ms = performance.now() - t0;
  if (ms > 5000) throw new Error(`Took ${ms.toFixed(0)} ms (limit 5,000)`);
  return ms;
}

describe('property: encoding round-trips (1,000 cases each)', () => {
  it('Base64 standard and URL-safe', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 512 }), fc.boolean(), fc.boolean(), (b, urlSafe, pad) => {
        expect(fromBase64(toBase64(b, urlSafe, pad))).toEqual(b);
      }),
      { numRuns: RUNS },
    );
  });
  it('hex, binary and Base32 bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 256 }), (b) => {
        expect(fromHex(toHex(b))).toEqual(b);
        expect(fromBinary(toBinary(b))).toEqual(b);
        expect(base32Decode(base32Encode(b))).toEqual(b);
      }),
      { numRuns: RUNS },
    );
  });
  it('text through every Base-N encoding (UTF-8, any script and emoji)', () => {
    fc.assert(
      fc.property(text, fc.constantFrom('hex', 'binary', 'base32', 'base58') as fc.Arbitrary<'hex' | 'binary' | 'base32' | 'base58'>, (s, enc) => {
        expect(decodeText(encodeText(s, enc), enc)).toBe(s);
      }),
      { numRuns: RUNS },
    );
  });
  it('UTF-8 encode/decode', () => {
    fc.assert(
      fc.property(text, (s) => {
        expect(utf8Decode(utf8Encode(s))).toBe(s);
      }),
      { numRuns: RUNS },
    );
  });
  it('Unicode escape/unescape', () => {
    fc.assert(
      fc.property(text, fc.boolean(), fc.boolean(), (s, all, braces) => {
        expect(unicodeUnescape(unicodeEscape(s, { all, braces }))).toBe(s);
      }),
      { numRuns: RUNS },
    );
  });
  it('URL component encode/decode', () => {
    fc.assert(
      fc.property(text, (s) => {
        expect(urlDecode(urlEncode(s, 'component'), 'component', false)).toBe(s);
      }),
      { numRuns: RUNS },
    );
  });
  it('Gzip / zlib / deflate', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 2048 }), fc.constantFrom('gzip', 'zlib', 'deflate') as fc.Arbitrary<'gzip' | 'zlib' | 'deflate'>, (b, f) => {
        expect(decompress(compress(b, f), f)).toEqual(b);
      }),
      { numRuns: RUNS },
    );
  });
});

describe('property: formatters and converters', () => {
  it('JSON format → minify → format is stable', () => {
    fc.assert(
      fc.property(fc.json({ maxDepth: 4 }), (j) => {
        const f1 = formatJson(j);
        expect(formatJson(minifyJson(f1))).toBe(f1);
        expect(JSON.parse(minifyJson(j))).toEqual(JSON.parse(j));
      }),
      { numRuns: RUNS },
    );
  });
  it('SQL minify is idempotent and keeps string literals', () => {
    const word = fc.constantFrom('SELECT', 'a', 'b', 'FROM', 't', 'WHERE', '=', ',', '(', ')', '1', '--note\n', '/* c */', "'x  y'", "'it''s'", '"Col A"');
    fc.assert(
      fc.property(fc.array(word, { maxLength: 30 }), fc.array(fc.constantFrom(' ', '  ', '\n', '\t'), { minLength: 30, maxLength: 30 }), (words, gaps) => {
        const sql = words.map((w, i) => w + gaps[i]).join('');
        const once = minifySql(sql);
        expect(minifySql(once)).toBe(once);
        for (const lit of ["'x  y'", "'it''s'", '"Col A"']) if (sql.includes(lit)) expect(once).toContain(lit);
      }),
      { numRuns: RUNS },
    );
  });
  it('JSON → YAML → JSON is lossless', () => {
    fc.assert(
      fc.property(fc.json({ maxDepth: 3 }), (j) => {
        expect(JSON.parse(convertData(convertData(j, 'json', 'yaml'), 'yaml', 'json'))).toEqual(JSON.parse(j));
      }),
      { numRuns: RUNS },
    );
  });
  it('records → CSV → records (text values)', () => {
    const value = fc.string({ maxLength: 20 }).filter((v) => !/^[=+\-@\t\r]/.test(v) && v.trim() === v && v !== '');
    fc.assert(
      fc.property(fc.array(fc.record({ a: value, b: value }), { minLength: 1, maxLength: 20 }), (rows) => {
        const back = parseCsv(jsonToCsv(rows, { delimiter: ',', flattenNested: false }), { delimiter: ',', header: true, dynamicTyping: false });
        expect(back.rows).toEqual(rows);
      }),
      { numRuns: RUNS },
    );
  });
});

describe('property: crypto', () => {
  it('AES-GCM / CBC / CTR round-trip with random raw keys and text', async () => {
    await fc.assert(
      fc.asyncProperty(
        text,
        fc.constantFrom('AES-GCM', 'AES-CBC', 'AES-CTR') as fc.Arbitrary<'AES-GCM' | 'AES-CBC' | 'AES-CTR'>,
        fc.constantFrom(128, 256) as fc.Arbitrary<128 | 256>,
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (s, mode, size, keyBytes) => {
          const src = { kind: 'raw' as const, keyHex: toHex(keyBytes.subarray(0, size / 8)) };
          const enc = await aesEncrypt(s, mode, size, src);
          expect(await aesDecrypt(enc.packed, mode, size, src)).toBe(s);
        },
      ),
      { numRuns: RUNS },
    );
  });
  it('HMAC is deterministic and key-sensitive', async () => {
    await fc.assert(
      fc.asyncProperty(text, fc.string({ minLength: 1, maxLength: 40 }), async (msg, key) => {
        const a = await hmac(msg, key, 'text', 'SHA-256');
        expect(await hmac(msg, key, 'text', 'SHA-256')).toEqual(a);
        expect(await hmac(msg, key + 'x', 'text', 'SHA-256')).not.toEqual(a);
      }),
      { numRuns: RUNS },
    );
  });
});

describe('property: PDF', () => {
  it('page ranges format → parse round-trip', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: 0, max: 199 }), { minLength: 1, maxLength: 60 }), (idx) => {
        expect(parseRanges(formatRanges(idx), 200)).toEqual([...idx].sort((a, b) => a - b));
      }),
      { numRuns: RUNS },
    );
  });
  it('split → merge keeps the page count', async () => {
    const make = async (n: number) => {
      const d = await PDFDocument.create();
      for (let i = 0; i < n; i++) d.addPage([200, 200]);
      return d.save();
    };
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 25 }), fc.integer({ min: 1, max: 6 }), async (pages, every) => {
        const parts = await split(await make(pages), { kind: 'every', n: every });
        const merged = parts.length >= 2 ? await merge(parts) : parts[0].bytes;
        expect((await PDFDocument.load(merged)).getPageCount()).toBe(pages);
      }),
      { numRuns: 100 },
    );
  }, 120000);
});

describe('property: utilities and units', () => {
  it('number bases round-trip any BigInt', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(2n ** 200n), max: 2n ** 200n }), fc.constantFrom(2, 8, 10, 16) as fc.Arbitrary<Base>, fc.boolean(), (v, base, group) => {
        expect(parseBase(formatBase(v, base, group), base)).toBe(v);
      }),
      { numRuns: RUNS },
    );
  });
  it('colour HEX → RGB → HEX', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffff }), (n) => {
        const hex = '#' + n.toString(16).padStart(6, '0').toUpperCase();
        expect(colourHex(parseColour(hex))).toBe(hex);
      }),
      { numRuns: RUNS },
    );
  });
  it('every unit converts to base and back exactly (within 1e-9 relative)', () => {
    const all = [...lengthUnits, ...areaUnits(14400, 'X'), ...otherCategories.flatMap((c) => c.units)];
    fc.assert(
      fc.property(fc.constantFrom(...all), fc.double({ min: -1e9, max: 1e9, noNaN: true }), (u, v) => {
        const back = fromBase(u, toBase(u, v));
        expect(Math.abs(back - v)).toBeLessThanOrEqual(Math.max(1e-9, Math.abs(v) * 1e-12));
      }),
      { numRuns: RUNS },
    );
  });
  it('masking hides every sensitive value and is idempotent (realistic separators)', () => {
    // Known limitation (documented): bare digit groups run together with single spaces are ambiguous.
    const SENSITIVE = ['ABCPE1234F', '4111 1111 1111 1111', '5500-0000-0000-0004', '+91 98765 43210', 'asha@x.in', '2341 2341 2346'];
    const token = fc.constantFrom(...SENSITIVE, '50100293812345', 'hello', 'loan', 'ref');
    const sep = fc.constantFrom(', ', ' | ', '\n', '; ', ' and ', '" : "');
    fc.assert(
      fc.property(fc.array(fc.tuple(token, sep), { maxLength: 12 }), fc.constantFrom('', 'card=', 'value: '), (parts, prefix) => {
        const src = parts.map(([t, s]) => prefix + t + s).join('');
        const once = maskText(src, defaultMaskOptions).text;
        expect(maskText(once, defaultMaskOptions).text).toBe(once);
        for (const v of SENSITIVE) expect(once).not.toContain(v);
      }),
      { numRuns: RUNS },
    );
  });
});

describe('fuzz: malformed input never crashes or hangs (1,000 cases each)', () => {
  const junk = fc.oneof(
    fc.string({ maxLength: 300 }),
    fc.string({ unit: 'binary', maxLength: 300 }),
    fc.json().map((j) => j.slice(0, Math.max(0, j.length - 2))),
  );

  it('JSON parser and error locator', async () => {
    await fc.assert(
      fc.asyncProperty(junk, async (s) => {
        await survives(() => formatJson(s));
        expect(() => locateJsonError(s)).not.toThrow();
      }),
      { numRuns: RUNS },
    );
  });
  it('XML and YAML parsers', async () => {
    const xmlish = fc.oneof(
      junk,
      fc
        .array(fc.constantFrom('<a>', '</a>', '<b x="1">', '</b>', 'text', '&amp;', '<!--', '-->', '<?xml version="1.0"?>', '<![CDATA[', ']]>'), {
          maxLength: 20,
        })
        .map((a) => a.join('')),
    );
    await fc.assert(
      fc.asyncProperty(xmlish, async (s) => {
        await survives(() => parseData(s, 'xml'));
        await survives(() => parseData(s, 'yaml'));
      }),
      { numRuns: RUNS },
    );
  });
  it('Base64, JWT and gzip decoders', async () => {
    await fc.assert(
      fc.asyncProperty(junk, fc.uint8Array({ maxLength: 512 }), async (s, b) => {
        await survives(() => fromBase64(s));
        await survives(() => decodeJwt(s));
        await survives(() => decompress(b, 'auto'));
        await survives(() => decompress(new Uint8Array([0x1f, 0x8b, ...b]), 'gzip'));
      }),
      { numRuns: RUNS },
    );
  });
  it('certificate decoder on garbage PEM', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 400 }), async (b) => {
        await survives(() => decodeCertificates(`-----BEGIN CERTIFICATE-----\n${toBase64(b)}\n-----END CERTIFICATE-----`));
      }),
      { numRuns: RUNS },
    );
  });
  it('PDF loader on mutated and truncated PDFs', async () => {
    const d = await PDFDocument.create();
    d.addPage();
    d.addPage();
    const valid = await d.save({ useObjectStreams: false });
    let maxMs = 0;
    await fc.assert(
      fc.asyncProperty(fc.array(fc.tuple(fc.nat(valid.length - 1), fc.nat(255)), { maxLength: 20 }), fc.nat(valid.length), async (flips, cut) => {
        const bytes = valid.slice(0, Math.max(16, cut));
        for (const [i, v] of flips) if (i < bytes.length && i > 8) bytes[i] = v;
        maxMs = Math.max(maxMs, await survives(() => loadPdf(bytes)));
      }),
      { numRuns: RUNS },
    );
    expect(maxMs).toBeLessThan(5000);
  }, 120000);
  it('cron, regex, length, colour and number parsers', async () => {
    await fc.assert(
      fc.asyncProperty(junk, async (s) => {
        for (const d of ['unix', 'quartz', 'aws'] as const) {
          await survives(() => normalise(s, d));
          await survives(() => describeCron(s, d));
        }
        await survives(() => compile(s, 'g'));
        await survives(() => parseLength(s));
        await survives(() => parseColour(s));
        await survives(() => parseBase(s, 16));
      }),
      { numRuns: RUNS },
    );
  });
});
