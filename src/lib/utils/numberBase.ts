/** FR-U5 number bases (BigInt, any size) and byte-size conversion. */
export type Base = 2 | 8 | 10 | 16;

const DIGITS: Record<Base, RegExp> = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/i };
const PREFIX: Record<Base, string> = { 2: '0b', 8: '0o', 10: '', 16: '0x' };

export function parseBase(input: string, base: Base): bigint {
  let s = input.trim().replace(/[\s_,]/g, '');
  if (!s) throw new Error('Enter a number');
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  if (PREFIX[base] && s.toLowerCase().startsWith(PREFIX[base])) s = s.slice(2);
  if (!DIGITS[base].test(s)) throw new Error(`“${input.trim()}” is not a valid base-${base} number`);
  const v = base === 10 ? BigInt(s) : BigInt(PREFIX[base] + s);
  return neg ? -v : v;
}

export function formatBase(v: bigint, base: Base, group = false): string {
  const neg = v < 0n;
  let s = (neg ? -v : v).toString(base);
  if (base === 16) s = s.toUpperCase();
  if (group) {
    const size = base === 10 ? 3 : 4;
    const sep = base === 10 ? ',' : ' ';
    s = s.replace(new RegExp(`\\B(?=(.{${size}})+$)`, 'g'), sep);
  }
  return (neg ? '-' : '') + s;
}

/** Two's-complement view of a (possibly negative) value at the given bit width. */
export function twosComplement(v: bigint, bits: number): { unsigned: bigint; signed: bigint } {
  const mod = 1n << BigInt(bits);
  const min = -(mod >> 1n);
  if (v < min || v >= mod) throw new Error(`${v} does not fit in ${bits} bits`);
  const unsigned = ((v % mod) + mod) % mod;
  const signed = unsigned >= mod >> 1n ? unsigned - mod : unsigned;
  return { unsigned, signed };
}

export const byteUnits = [
  { id: 'B', factor: 1 },
  { id: 'KB', factor: 1e3 },
  { id: 'MB', factor: 1e6 },
  { id: 'GB', factor: 1e9 },
  { id: 'TB', factor: 1e12 },
  { id: 'KiB', factor: 1024 },
  { id: 'MiB', factor: 1024 ** 2 },
  { id: 'GiB', factor: 1024 ** 3 },
  { id: 'TiB', factor: 1024 ** 4 },
] as const;
