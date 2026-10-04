import { argon2id, argon2Verify, bcrypt, bcryptVerify } from 'hash-wasm';
import { buf, fromBase64, randomBytes, toBase64, utf8Encode } from '../bytes';
import { timingSafeEqual } from './hmac';

export async function bcryptHash(password: string, cost: number): Promise<string> {
  if (utf8Encode(password).length > 72) throw new Error('bcrypt only uses the first 72 bytes of a password; use Argon2id for longer secrets');
  if (cost < 4 || cost > 15) throw new Error('Cost must be between 4 and 15');
  return bcrypt({ password, salt: randomBytes(16), costFactor: cost, outputType: 'encoded' });
}

export async function bcryptCheck(password: string, hash: string): Promise<boolean> {
  if (!/^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash.trim()))
    throw new Error('Not a bcrypt hash (expected $2a$/$2b$/$2y$ followed by cost and 53 characters)');
  return bcryptVerify({ password, hash: hash.trim().replace(/^\$2[xy]\$/, '$2b$') });
}

export interface Argon2Params {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  hashLength: number;
}

/** OWASP 2024 baseline: m=19 MiB, t=2, p=1. */
export const argon2Defaults: Argon2Params = { memoryKiB: 19456, iterations: 2, parallelism: 1, hashLength: 32 };

export async function argon2Hash(password: string, p: Argon2Params): Promise<string> {
  return argon2id({
    password,
    salt: randomBytes(16),
    memorySize: p.memoryKiB,
    iterations: p.iterations,
    parallelism: p.parallelism,
    hashLength: p.hashLength,
    outputType: 'encoded',
  });
}

export async function argon2Check(password: string, hash: string): Promise<boolean> {
  if (!/^\$argon2(id|i|d)\$/.test(hash.trim())) throw new Error('Not an Argon2 PHC string (expected $argon2id$v=19$m=…)');
  return argon2Verify({ password, hash: hash.trim() });
}

export type PbkdfHash = 'SHA-256' | 'SHA-512';

async function pbkdf2Raw(password: string, salt: Uint8Array, iterations: number, hash: PbkdfHash, bytes: number) {
  const key = await crypto.subtle.importKey('raw', buf(utf8Encode(password)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: buf(salt), iterations, hash }, key, bytes * 8));
}

/** Output format: pbkdf2-sha256$<iterations>$<salt b64>$<hash b64> (self-describing, verifiable). */
export async function pbkdf2Hash(password: string, iterations: number, hash: PbkdfHash): Promise<string> {
  if (iterations < 1000) throw new Error('Use at least 1,000 iterations (OWASP recommends 600,000 for SHA-256)');
  const salt = randomBytes(16);
  const dk = await pbkdf2Raw(password, salt, iterations, hash, 32);
  return `pbkdf2-${hash.replace('-', '').toLowerCase()}$${iterations}$${toBase64(salt, false, false)}$${toBase64(dk, false, false)}`;
}

export async function pbkdf2Check(password: string, encoded: string): Promise<boolean> {
  const m = encoded.trim().match(/^pbkdf2[-_](sha256|sha512)\$(\d+)\$([A-Za-z0-9+/=._-]+)\$([A-Za-z0-9+/=._-]+)$/);
  if (!m) throw new Error('Expected pbkdf2-sha256$iterations$salt$hash (Base64 salt and hash)');
  const expected = fromBase64(m[4]);
  const dk = await pbkdf2Raw(password, fromBase64(m[3]), +m[2], m[1] === 'sha256' ? 'SHA-256' : 'SHA-512', expected.length);
  return timingSafeEqual(dk, expected);
}
