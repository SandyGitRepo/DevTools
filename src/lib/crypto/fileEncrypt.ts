import { buf, concatBytes, randomBytes, utf8Encode } from '../bytes';

/**
 * .enc container (FR-K7):
 *   magic "DTKENC" (6) | version 0x01 (1) | iterations uint32 BE (4) | salt (16) | iv (12) | AES-256-GCM ciphertext+tag
 * Key: PBKDF2-HMAC-SHA256(password, salt, iterations) → 256-bit key.
 */
const MAGIC = utf8Encode('DTKENC');
const VERSION = 1;
const HEADER = MAGIC.length + 1 + 4 + 16 + 12;
export const FILE_PBKDF2_ITERATIONS = 600_000;
export const MAX_FILE_BYTES = 500 * 1024 * 1024;

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', buf(utf8Encode(password)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: buf(salt), iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptFile(data: Uint8Array, password: string, iterations = FILE_PBKDF2_ITERATIONS): Promise<Uint8Array> {
  if (password.length < 8) throw new Error('Use a password of at least 8 characters');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, iterations);
  const header = new Uint8Array(HEADER);
  header.set(MAGIC, 0);
  header[6] = VERSION;
  new DataView(header.buffer).setUint32(7, iterations);
  header.set(salt, 11);
  header.set(iv, 27);
  // Header is bound to the ciphertext as additional authenticated data
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv), additionalData: buf(header) }, key, buf(data)));
  return concatBytes(header, ct);
}

export function isEncFile(data: Uint8Array): boolean {
  return data.length > HEADER && MAGIC.every((b, i) => data[i] === b);
}

export async function decryptFile(data: Uint8Array, password: string): Promise<Uint8Array> {
  if (!isEncFile(data)) throw new Error('This is not a DevToolkit .enc file (missing DTKENC header)');
  if (data[6] !== VERSION) throw new Error(`Unsupported .enc version ${data[6]}`);
  const header = data.subarray(0, HEADER);
  const iterations = new DataView(data.buffer, data.byteOffset).getUint32(7);
  if (iterations < 1000 || iterations > 10_000_000) throw new Error('Corrupt header (iteration count out of range)');
  const key = await deriveKey(password, data.subarray(11, 27), iterations);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(data.subarray(27, 39)), additionalData: buf(header) }, key, buf(data.subarray(HEADER))),
    );
  } catch {
    throw new Error('Wrong password, or the file has been modified or truncated');
  }
}
