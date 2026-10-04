import { buf, concatBytes, fromBase64, fromHex, randomBytes, toBase64, toHex, utf8Decode, utf8Encode } from '../bytes';

export type AesMode = 'AES-GCM' | 'AES-CBC' | 'AES-CTR';
export type AesKeySize = 128 | 256;
export const PBKDF2_ITERATIONS = 600_000;

export const ivLength = (mode: AesMode) => (mode === 'AES-GCM' ? 12 : 16);

export type KeySource = { kind: 'passphrase'; passphrase: string; iterations?: number } | { kind: 'raw'; keyHex: string };

async function deriveKey(passphrase: string, salt: Uint8Array, mode: AesMode, size: AesKeySize, iterations: number) {
  if (!passphrase) throw new Error('Enter a passphrase');
  const base = await crypto.subtle.importKey('raw', buf(utf8Encode(passphrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: buf(salt), iterations, hash: 'SHA-256' }, base, { name: mode, length: size }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function importRaw(keyHex: string, mode: AesMode, size: AesKeySize) {
  const raw = fromHex(keyHex);
  if (raw.length * 8 !== size) throw new Error(`A raw AES-${size} key must be ${size / 8} bytes (${size / 4} hex characters); got ${raw.length} bytes`);
  return crypto.subtle.importKey('raw', buf(raw), { name: mode }, false, ['encrypt', 'decrypt']);
}

const params = (mode: AesMode, iv: Uint8Array): AlgorithmIdentifier & Record<string, unknown> =>
  mode === 'AES-CTR' ? { name: mode, counter: buf(iv), length: 64 } : { name: mode, iv: buf(iv) };

export interface EncryptResult {
  /** Base64 of [salt (16, passphrase only)] + IV + ciphertext — what Decrypt expects. */
  packed: string;
  ivHex: string;
  saltHex?: string;
  ciphertextB64: string;
}

export async function aesEncrypt(plaintext: string, mode: AesMode, size: AesKeySize, src: KeySource): Promise<EncryptResult> {
  const iv = randomBytes(ivLength(mode));
  let salt: Uint8Array | undefined;
  let key: CryptoKey;
  if (src.kind === 'passphrase') {
    salt = randomBytes(16);
    key = await deriveKey(src.passphrase, salt, mode, size, src.iterations ?? PBKDF2_ITERATIONS);
  } else {
    key = await importRaw(src.keyHex, mode, size);
  }
  const ct = new Uint8Array(await crypto.subtle.encrypt(params(mode, iv), key, buf(utf8Encode(plaintext))));
  return {
    packed: toBase64(salt ? concatBytes(salt, iv, ct) : concatBytes(iv, ct)),
    ivHex: toHex(iv),
    saltHex: salt ? toHex(salt) : undefined,
    ciphertextB64: toBase64(ct),
  };
}

export async function aesDecrypt(packedB64: string, mode: AesMode, size: AesKeySize, src: KeySource): Promise<string> {
  const data = fromBase64(packedB64);
  const ivLen = ivLength(mode);
  let offset = 0;
  let key: CryptoKey;
  if (src.kind === 'passphrase') {
    if (data.length < 16 + ivLen + 1) throw new Error('Input is too short to contain salt + IV + ciphertext');
    key = await deriveKey(src.passphrase, data.subarray(0, 16), mode, size, src.iterations ?? PBKDF2_ITERATIONS);
    offset = 16;
  } else {
    if (data.length < ivLen + 1) throw new Error('Input is too short to contain IV + ciphertext');
    key = await importRaw(src.keyHex, mode, size);
  }
  const iv = data.subarray(offset, offset + ivLen);
  const ct = data.subarray(offset + ivLen);
  let pt: ArrayBuffer;
  try {
    pt = await crypto.subtle.decrypt(params(mode, iv), key, buf(ct));
  } catch {
    throw new Error(
      mode === 'AES-GCM'
        ? 'Decryption failed: wrong key/passphrase, wrong mode or key size, or the data was altered (GCM authentication failed)'
        : 'Decryption failed: wrong key/passphrase, mode or key size (bad padding)',
    );
  }
  try {
    return utf8Decode(new Uint8Array(pt), true);
  } catch {
    if (mode === 'AES-CTR') throw new Error('Decrypted bytes are not valid text — the key or passphrase is probably wrong (CTR has no integrity check)');
    throw new Error('Decrypted data is binary, not UTF-8 text');
  }
}
