import { v4 as uuidv4, v7 as uuidv7 } from 'uuid';
import { buf, fromBase64, randomBytes, toBase64, toHex, utf8Encode } from '../bytes';
import { parsePem, toPem } from '../pem';

export type KeyPairType = 'RSA-2048' | 'RSA-4096' | 'EC-P256' | 'EC-P384';

export interface GeneratedKeyPair {
  publicPem: string;
  privatePem: string;
  publicJwk: string;
  privateJwk: string;
}

/** Generates a key pair. RSA keys are created as RSA-PSS but the PEM/JWK work for any RSA use. */
export async function generateKeyPair(type: KeyPairType): Promise<GeneratedKeyPair> {
  const alg: RsaHashedKeyGenParams | EcKeyGenParams = type.startsWith('RSA')
    ? { name: 'RSA-PSS', modulusLength: type === 'RSA-4096' ? 4096 : 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
    : { name: 'ECDSA', namedCurve: type === 'EC-P384' ? 'P-384' : 'P-256' };
  const pair = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair;
  const [spki, pkcs8, pubJwk, privJwk] = await Promise.all([
    crypto.subtle.exportKey('spki', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
    crypto.subtle.exportKey('jwk', pair.publicKey),
    crypto.subtle.exportKey('jwk', pair.privateKey),
  ]);
  // Drop WebCrypto-specific fields so the JWK is algorithm-neutral
  const clean = (j: JsonWebKey) => {
    const { key_ops: _o, ext: _e, alg: _a, ...rest } = j;
    return JSON.stringify(rest, null, 2);
  };
  return {
    publicPem: toPem(new Uint8Array(spki), 'PUBLIC KEY'),
    privatePem: toPem(new Uint8Array(pkcs8), 'PRIVATE KEY'),
    publicJwk: clean(pubJwk),
    privateJwk: clean(privJwk),
  };
}

export type SecretFormat = 'hex' | 'base64' | 'base64url';
export function randomSecret(bytes: number, format: SecretFormat): string {
  if (bytes < 1 || bytes > 1024) throw new Error('Choose between 1 and 1024 bytes');
  const b = randomBytes(bytes);
  return format === 'hex' ? toHex(b) : toBase64(b, format === 'base64url', format === 'base64');
}

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
};
const AMBIGUOUS = /[O0oIl1|`'"]/g;

/** Unbiased random index via rejection sampling. */
function randInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a);
  while (a[0] >= limit);
  return a[0] % max;
}

/** Generates a password containing at least one character from each selected set. */
export function generatePassword(o: PasswordOptions): string {
  const sets = (Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => o[k]).map((k) => (o.excludeAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
  if (!sets.length) throw new Error('Select at least one character set');
  if (o.length < sets.length || o.length > 256) throw new Error(`Length must be between ${sets.length} and 256`);
  const all = sets.join('');
  const chars = sets.map((s) => s[randInt(s.length)]);
  while (chars.length < o.length) chars.push(all[randInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function passwordEntropyBits(o: PasswordOptions): number {
  const pool = (Object.keys(SETS) as (keyof typeof SETS)[])
    .filter((k) => o[k])
    .reduce((n, k) => n + (o.excludeAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]).length, 0);
  return pool ? Math.floor(o.length * Math.log2(pool)) : 0;
}

export const uuid = (version: 4 | 7) => (version === 7 ? uuidv7() : uuidv4());

// ---- Asymmetric operations (FR-K5) ----

export type AsymAlg = 'RSA-OAEP' | 'RSA-PSS' | 'ECDSA-P256' | 'ECDSA-P384';

function importParams(alg: AsymAlg): RsaHashedImportParams | EcKeyImportParams {
  if (alg === 'RSA-OAEP' || alg === 'RSA-PSS') return { name: alg, hash: 'SHA-256' };
  return { name: 'ECDSA', namedCurve: alg === 'ECDSA-P384' ? 'P-384' : 'P-256' };
}

export async function importPemKey(pem: string, alg: AsymAlg, use: 'public' | 'private'): Promise<CryptoKey> {
  const block = parsePem(pem)[0];
  if (!block) throw new Error(`Paste a PEM ${use} key`);
  if (use === 'public' && !/PUBLIC KEY/.test(block.label)) throw new Error('Expected -----BEGIN PUBLIC KEY----- (SPKI)');
  if (use === 'private') {
    if (/RSA PRIVATE KEY|EC PRIVATE KEY/.test(block.label))
      throw new Error('This is a PKCS#1/SEC1 key. Convert it to PKCS#8 first: openssl pkcs8 -topk8 -nocrypt -in key.pem');
    if (!/^PRIVATE KEY$/.test(block.label)) throw new Error('Expected -----BEGIN PRIVATE KEY----- (PKCS#8)');
  }
  const usages: KeyUsage[] = alg === 'RSA-OAEP' ? [use === 'public' ? 'encrypt' : 'decrypt'] : [use === 'public' ? 'verify' : 'sign'];
  try {
    return await crypto.subtle.importKey(use === 'public' ? 'spki' : 'pkcs8', buf(block.der), importParams(alg), false, usages);
  } catch {
    throw new Error(`This key does not match ${alg}. Check the algorithm (RSA vs EC) and curve.`);
  }
}

const signParams = (alg: AsymAlg): RsaPssParams | EcdsaParams =>
  alg === 'RSA-PSS' ? { name: 'RSA-PSS', saltLength: 32 } : { name: 'ECDSA', hash: alg === 'ECDSA-P384' ? 'SHA-384' : 'SHA-256' };

export async function rsaEncrypt(publicPem: string, text: string): Promise<string> {
  const key = await importPemKey(publicPem, 'RSA-OAEP', 'public');
  try {
    return toBase64(new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, buf(utf8Encode(text)))));
  } catch {
    throw new Error('Message too long for RSA-OAEP with this key (max ≈ key bytes − 66). Use AES for large data.');
  }
}

export async function rsaDecrypt(privatePem: string, b64: string): Promise<string> {
  const key = await importPemKey(privatePem, 'RSA-OAEP', 'private');
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, buf(fromBase64(b64))));
  } catch {
    throw new Error('Decryption failed: wrong private key, or the ciphertext was not made with RSA-OAEP SHA-256');
  }
}

export async function sign(privatePem: string, alg: AsymAlg, text: string): Promise<string> {
  const key = await importPemKey(privatePem, alg, 'private');
  return toBase64(new Uint8Array(await crypto.subtle.sign(signParams(alg), key, buf(utf8Encode(text)))));
}

export async function verify(publicPem: string, alg: AsymAlg, text: string, sigB64: string): Promise<boolean> {
  const key = await importPemKey(publicPem, alg, 'public');
  return crypto.subtle.verify(signParams(alg), key, buf(fromBase64(sigB64)), buf(utf8Encode(text)));
}
