import baseX from 'base-x';
import { fromHex, toHex, utf8Decode, utf8Encode } from '../bytes';

const base58 = baseX('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 Base32 with padding. */
export function base32Encode(b: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of b) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  while (out.length % 8) out += '=';
  return out;
}

export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/\s+/g, '').replace(/=+$/, '');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid Base32 character “${ch}”`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function toBinary(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(2).padStart(8, '0')).join(' ');
}

export function fromBinary(s: string): Uint8Array {
  const clean = s.replace(/[\s,]+/g, '');
  if (!/^[01]*$/.test(clean)) throw new Error('Binary input may only contain 0, 1 and spaces');
  if (clean.length % 8) throw new Error(`Binary input must be whole bytes (got ${clean.length} bits, not a multiple of 8)`);
  const out = new Uint8Array(clean.length / 8);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 8, 8), 2);
  return out;
}

export type BaseN = 'hex' | 'binary' | 'base32' | 'base58';

export function encodeText(text: string, to: BaseN, hexSep = ''): string {
  const b = utf8Encode(text);
  switch (to) {
    case 'hex':
      return toHex(b, hexSep);
    case 'binary':
      return toBinary(b);
    case 'base32':
      return base32Encode(b);
    case 'base58':
      return base58.encode(b);
  }
}

export function decodeToBytes(input: string, from: BaseN): Uint8Array {
  const s = input.trim();
  switch (from) {
    case 'hex':
      return fromHex(s);
    case 'binary':
      return fromBinary(s);
    case 'base32':
      return base32Decode(s);
    case 'base58':
      try {
        return base58.decode(s);
      } catch {
        throw new Error('Invalid Base58: only 1-9, A-Z and a-z are allowed, excluding 0, O, I and l');
      }
  }
}

export function decodeText(input: string, from: BaseN): string {
  return utf8Decode(decodeToBytes(input, from));
}
