import { buf, decodeKey, utf8Encode, type KeyEncoding } from '../bytes';

export type HmacHash = 'SHA-256' | 'SHA-384' | 'SHA-512' | 'SHA-1';

export async function hmac(message: string | Uint8Array, key: string, keyEncoding: KeyEncoding, hash: HmacHash): Promise<Uint8Array> {
  const keyBytes = decodeKey(key, keyEncoding);
  if (!keyBytes.length) throw new Error('Enter a key');
  const k = await crypto.subtle.importKey('raw', buf(keyBytes), { name: 'HMAC', hash }, false, ['sign']);
  const data = typeof message === 'string' ? utf8Encode(message) : message;
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, buf(data)));
}

/** Constant-time comparison of two byte arrays. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
