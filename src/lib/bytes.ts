/** Byte/encoding primitives shared by the encoding and crypto tools. Pure, no DOM. */
const enc = new TextEncoder();

export const utf8Encode = (s: string): Uint8Array => enc.encode(s);

/** Decodes UTF-8; with fatal=true throws on invalid sequences (used to detect binary data). */
export const utf8Decode = (b: Uint8Array, fatal = false): string => new TextDecoder('utf-8', { fatal }).decode(b);

export function isLikelyText(b: Uint8Array): boolean {
  try {
    const s = utf8Decode(b.subarray(0, 65536), true);
    // Control chars other than tab/newline/CR suggest binary.
    // eslint-disable-next-line no-control-regex
    return !/[\x00-\x08\x0E-\x1F]/.test(s);
  } catch {
    return false;
  }
}

export function toHex(b: Uint8Array, sep = ''): string {
  let out = '';
  for (let i = 0; i < b.length; i++) out += (i && sep ? sep : '') + b[i].toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '').replace(/[\s:,-]|0x/gi, '');
  if (clean.length % 2) throw new Error('Hex input must have an even number of digits');
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Hex input contains characters other than 0-9 and A-F');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Chunked, so it works for large files without blowing the call stack. */
export function toBase64(b: Uint8Array, urlSafe = false, pad = true): string {
  let out = '';
  const chunk = 0x7ffe; // multiple of 3, so no padding appears mid-string
  for (let i = 0; i < b.length; i += chunk) {
    out += btoa(String.fromCharCode.apply(null, b.subarray(i, i + chunk) as unknown as number[]));
  }
  if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_');
  if (!pad) out = out.replace(/=+$/, '');
  return out;
}

export function fromBase64(input: string): Uint8Array {
  let s = input
    .replace(/^data:[^,]*,/, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) {
    const bad = s.match(/[^A-Za-z0-9+/=]/);
    throw new Error(bad ? `Invalid Base64 character “${bad[0]}”` : 'Padding (=) may only appear at the end');
  }
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) throw new Error('Base64 input has an invalid length (truncated?)');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  // getRandomValues is limited to 65536 bytes per call
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(out.subarray(i, Math.min(n, i + 65536)));
  return out;
}

/** Key/secret input in one of three encodings. */
export type KeyEncoding = 'text' | 'hex' | 'base64';
export function decodeKey(value: string, encoding: KeyEncoding): Uint8Array {
  if (encoding === 'hex') return fromHex(value);
  if (encoding === 'base64') return fromBase64(value);
  return utf8Encode(value);
}

/** Copies into a fresh ArrayBuffer-backed view (Web Crypto rejects SharedArrayBuffer views in TS 5.7+ typings). */
export const buf = (b: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(b) as Uint8Array<ArrayBuffer>;

/** Detects common file types from magic bytes (for previews and safe downloads). */
export function sniffMime(b: Uint8Array): { mime: string; ext: string } {
  const h = (n: number) => toHex(b.subarray(0, n));
  if (h(8) === '89504e470d0a1a0a') return { mime: 'image/png', ext: 'png' };
  if (h(3) === 'ffd8ff') return { mime: 'image/jpeg', ext: 'jpg' };
  if (h(4) === '47494638') return { mime: 'image/gif', ext: 'gif' };
  if (h(4) === '52494646' && toHex(b.subarray(8, 12)) === '57454250') return { mime: 'image/webp', ext: 'webp' };
  if (h(4) === '25504446') return { mime: 'application/pdf', ext: 'pdf' };
  if (h(4) === '504b0304') return { mime: 'application/zip', ext: 'zip' };
  if (h(2) === '1f8b') return { mime: 'application/gzip', ext: 'gz' };
  if (isLikelyText(b)) return { mime: 'text/plain', ext: 'txt' };
  return { mime: 'application/octet-stream', ext: 'bin' };
}
