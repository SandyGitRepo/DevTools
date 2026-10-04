import { createMD5, createSHA1, createSHA256, createSHA384, createSHA512, createSHA3, createCRC32, createSHA224, type IHasher } from 'hash-wasm';
import { toBase64, toHex } from '../bytes';

export const hashAlgorithms = [
  { id: 'md5', label: 'MD5', legacy: true },
  { id: 'sha1', label: 'SHA-1', legacy: true },
  { id: 'sha224', label: 'SHA-224' },
  { id: 'sha256', label: 'SHA-256' },
  { id: 'sha384', label: 'SHA-384' },
  { id: 'sha512', label: 'SHA-512' },
  { id: 'sha3-256', label: 'SHA3-256' },
  { id: 'sha3-384', label: 'SHA3-384' },
  { id: 'sha3-512', label: 'SHA3-512' },
  { id: 'crc32', label: 'CRC32', legacy: true, note: 'checksum, not a cryptographic hash' },
] as const;

export type HashAlgorithm = (typeof hashAlgorithms)[number]['id'];

function create(alg: HashAlgorithm): Promise<IHasher> {
  switch (alg) {
    case 'md5':
      return createMD5();
    case 'sha1':
      return createSHA1();
    case 'sha224':
      return createSHA224();
    case 'sha256':
      return createSHA256();
    case 'sha384':
      return createSHA384();
    case 'sha512':
      return createSHA512();
    case 'sha3-256':
      return createSHA3(256);
    case 'sha3-384':
      return createSHA3(384);
    case 'sha3-512':
      return createSHA3(512);
    case 'crc32':
      return createCRC32();
  }
}

/** Hashes bytes with several algorithms in one pass. */
export async function hashBytes(data: Uint8Array, algs: readonly HashAlgorithm[]): Promise<Record<string, Uint8Array>> {
  const hashers = await Promise.all(algs.map(create));
  hashers.forEach((h) => {
    h.init();
    h.update(data);
  });
  return Object.fromEntries(algs.map((a, i) => [a, hashers[i].digest('binary')]));
}

/** Streams a File through the hashers in 4 MB chunks so large files never load fully into memory. */
export async function hashFile(file: Blob, algs: readonly HashAlgorithm[], onProgress?: (fraction: number) => void): Promise<Record<string, Uint8Array>> {
  const hashers = await Promise.all(algs.map(create));
  hashers.forEach((h) => h.init());
  const chunk = 4 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunk) {
    const bytes = new Uint8Array(await file.slice(offset, offset + chunk).arrayBuffer());
    hashers.forEach((h) => h.update(bytes));
    onProgress?.(Math.min(1, (offset + chunk) / file.size));
  }
  return Object.fromEntries(algs.map((a, i) => [a, hashers[i].digest('binary')]));
}

/**
 * Does a pasted expected value match the digest? Hex is compared ignoring case and `:`/`-`/space separators;
 * Base64 and Base64url are compared case-sensitively (with or without padding), since case changes their value.
 */
export function matchesExpected(digest: Uint8Array, expected: string): boolean {
  const s = expected.trim();
  if (!s) return false;
  const hex = s.replace(/[\s:-]/g, '').toLowerCase();
  if (/^[0-9a-f]+$/.test(hex) && hex === toHex(digest)) return true;
  const b64 = s.replace(/\s/g, '').replace(/=+$/, '');
  return b64 === toBase64(digest, false, false) || b64 === toBase64(digest, true, false);
}
