import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromBase64, fromHex, toBase64, toHex, utf8Decode, utf8Encode, sniffMime } from '../src/lib/bytes';
import { base32Decode, base32Encode, decodeText, encodeText, fromBinary } from '../src/lib/encoding/basen';
import { inspect, unicodeEscape, unicodeUnescape } from '../src/lib/encoding/unicode';
import { parseUrl, urlDecode, urlEncode } from '../src/lib/encoding/url';
import { decodeJwt, verifyJwt } from '../src/lib/encoding/jwt';
import { compress, decompress, DecompressionBombError } from '../src/lib/encoding/gzip';
import { decodeCertificates } from '../src/lib/encoding/cert';

const RFC4648 = [
  ['', '', ''],
  ['f', 'Zg==', 'MY======'],
  ['fo', 'Zm8=', 'MZXQ===='],
  ['foo', 'Zm9v', 'MZXW6==='],
  ['foob', 'Zm9vYg==', 'MZXW6YQ='],
  ['fooba', 'Zm9vYmE=', 'MZXW6YTB'],
  ['foobar', 'Zm9vYmFy', 'MZXW6YTBOI======'],
];

describe('FR-E1 Base64 (RFC 4648 §10)', () => {
  it.each(RFC4648)('%j', (plain, b64) => {
    expect(toBase64(utf8Encode(plain))).toBe(b64);
    expect(utf8Decode(fromBase64(b64))).toBe(plain);
  });
  it('URL-safe variant without padding', () => {
    const b = new Uint8Array([0xfb, 0xff, 0xfe]);
    expect(toBase64(b, true, false)).toBe('-__-');
    expect(fromBase64('-__-')).toEqual(b);
  });
  it('accepts data URIs and whitespace, rejects garbage', () => {
    expect(utf8Decode(fromBase64('data:text/plain;base64,Zm9v\nYmFy'))).toBe('foobar');
    expect(() => fromBase64('Zm9v!')).toThrow(/Invalid Base64 character/);
    expect(() => fromBase64('Z')).toThrow(/length/);
  });
  it('round-trips Unicode and large inputs', () => {
    const s = 'हिंदी ✓ 😀 '.repeat(50000);
    expect(utf8Decode(fromBase64(toBase64(utf8Encode(s))))).toBe(s);
  });
  it('sniffs image types', () => {
    expect(sniffMime(fromHex('89504e470d0a1a0a0000')).mime).toBe('image/png');
    expect(sniffMime(utf8Encode('hello')).mime).toBe('text/plain');
  });
});

describe('FR-E4 Base-N', () => {
  it.each(RFC4648)('Base32 %j', (plain, _b64, b32) => {
    expect(base32Encode(utf8Encode(plain))).toBe(b32);
    expect(utf8Decode(base32Decode(b32))).toBe(plain);
  });
  it('Base58 (Bitcoin alphabet)', () => {
    expect(encodeText('Hello World!', 'base58')).toBe('2NEpo7TZRRrLZSi2U');
    expect(decodeText('2NEpo7TZRRrLZSi2U', 'base58')).toBe('Hello World!');
    expect(() => decodeText('0OIl', 'base58')).toThrow(/Base58/);
  });
  it('hex and binary', () => {
    expect(encodeText('Hi', 'hex')).toBe('4869');
    expect(encodeText('Hi', 'hex', ' ')).toBe('48 69');
    expect(decodeText('0x48 0x69', 'hex')).toBe('Hi');
    expect(encodeText('A', 'binary')).toBe('01000001');
    expect(() => fromBinary('0101')).toThrow(/whole bytes/);
    expect(() => fromHex('abc')).toThrow(/even/);
  });
});

describe('FR-E5 Unicode', () => {
  it('escapes and unescapes, including astral code points', () => {
    expect(unicodeEscape('café 😀')).toBe('caf\\u00E9 \\uD83D\\uDE00');
    expect(unicodeEscape('😀', { braces: true })).toBe('\\u{1F600}');
    expect(unicodeUnescape('caf\\u00E9 \\uD83D\\uDE00 \\u{1F600} \\x41\\n')).toBe('café 😀 😀 A\n');
  });
  it('flags zero-width characters', () => {
    const info = inspect('a​b');
    expect(info[1].category).toMatch(/zero-width/);
    expect(info[1].utf8).toBe('E2 80 8B');
  });
});

describe('FR-E2 URL', () => {
  it('component vs full mode', () => {
    expect(urlEncode('a b&c=d/é', 'component')).toBe('a%20b%26c%3Dd%2F%C3%A9');
    expect(urlEncode('https://x.in/a b?q=é', 'full')).toBe('https://x.in/a%20b?q=%C3%A9');
    expect(urlDecode('a+b%26', 'component')).toBe('a b&');
    expect(() => urlDecode('%E0%A4', 'component')).toThrow(/Malformed/);
  });
  it('parses query params', () => {
    const p = parseUrl('https://user:pw@host.internal:8443/p/a%20b?x=1&y=%C3%A9#frag');
    expect(p.params).toEqual([
      ['x', '1'],
      ['y', 'é'],
    ]);
    expect(p.parts.find(([k]) => k === 'Password')![1]).toBe('••');
  });
});

describe('FR-E6 JWT', () => {
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  it('decodes header, payload and IST times', () => {
    const d = decodeJwt(`Bearer ${token}`);
    expect(d.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect((d.payload as Record<string, unknown>).name).toBe('John Doe');
    expect(d.claims[0].value).toMatch(/18 Jan 2018.*IST/);
  });
  it('verifies HS256 with the right secret only', async () => {
    await expect(verifyJwt(token, { kind: 'secret', value: 'your-256-bit-secret' })).resolves.toEqual({ alg: 'HS256' });
    await expect(verifyJwt(token, { kind: 'secret', value: 'wrong' })).rejects.toThrow(/INVALID/);
  });
  it('rejects malformed tokens and alg none', async () => {
    expect(() => decodeJwt('a.b')).toThrow(/3 dot-separated/);
    const none = `${toBase64(utf8Encode('{"alg":"none"}'), true, false)}.${toBase64(utf8Encode('{}'), true, false)}.`;
    await expect(verifyJwt(none, { kind: 'secret', value: 'x' })).rejects.toThrow(/unsigned/);
  });
});

describe('FR-E8 Gzip + SEC-4 bomb guard', () => {
  it('round-trips each format', () => {
    const data = utf8Encode('{"a":1}'.repeat(1000));
    for (const f of ['gzip', 'zlib', 'deflate'] as const) {
      expect(decompress(compress(data, f), f)).toEqual(data);
    }
    expect(decompress(compress(data, 'gzip'))).toEqual(data); // auto-detect
  });
  it('stops a decompression bomb', () => {
    const bomb = compress(new Uint8Array(30 * 1024 * 1024), 'gzip', 9);
    expect(bomb.length).toBeLessThan(100_000);
    expect(() => decompress(bomb, 'gzip', { floorBytes: 1024 * 1024 })).toThrow(DecompressionBombError);
  }, 60000); // building a 30 MB test payload is slow under coverage when suites run in parallel
  it('reports corrupt input', () => {
    expect(() => decompress(utf8Encode('not gzip at all'), 'gzip')).toThrow(/Not valid gzip/);
  });
});

describe('FR-E7 certificates', () => {
  it('decodes a certificate with SANs', async () => {
    const [c] = await decodeCertificates(readFileSync('tests/fixtures/test-cert.pem', 'utf8'));
    const f = Object.fromEntries(c.fields);
    expect(f.Subject).toContain('CN=devtoolkit.test');
    expect(f.Issuer).toContain('self-signed');
    expect(f['Public key']).toBe('RSA 2048 bit');
    expect(f['SHA-256 fingerprint']).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    const san = c.extensions.find(([n]) => n === 'Subject Alternative Name')!;
    expect(san[1]).toBe('DNS:devtoolkit.test, DNS:www.devtoolkit.test, IP:10.0.0.1');
    expect(c.validity!.daysLeft).toBeGreaterThan(3000);
  });
  it('decodes an EC CSR', async () => {
    const [c] = await decodeCertificates(readFileSync('tests/fixtures/test-csr.pem', 'utf8'));
    expect(c.kind).toBe('Certificate signing request');
    expect(Object.fromEntries(c.fields)['Public key']).toBe('EC P-256');
  });
  it('refuses private keys', async () => {
    await expect(decodeCertificates('-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----')).rejects.toThrow(/PRIVATE KEY/);
  });
});

it('hex helper round-trip', () => {
  expect(toHex(fromHex('DE:AD:be:ef'))).toBe('deadbeef');
});
