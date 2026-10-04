import { compactVerify, importJWK, importSPKI, importX509, type JWK } from 'jose';
import { fromBase64, utf8Decode, utf8Encode } from '../bytes';

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown> | string;
  signature: string;
  claims: { name: string; value: string; note?: string }[];
}

const IST = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  dateStyle: 'medium',
  timeStyle: 'medium',
  hour12: true,
});

export const formatIst = (epochSeconds: number) => `${IST.format(new Date(epochSeconds * 1000))} IST`;

function relative(sec: number, now: number): string {
  const d = sec - now;
  const abs = Math.abs(d);
  const unit =
    abs < 120
      ? `${Math.round(abs)} s`
      : abs < 7200
        ? `${Math.round(abs / 60)} min`
        : abs < 172800
          ? `${Math.round(abs / 3600)} h`
          : `${Math.round(abs / 86400)} days`;
  return d >= 0 ? `in ${unit}` : `${unit} ago`;
}

export function decodeJwt(token: string, nowSec = Date.now() / 1000): DecodedJwt {
  const t = token.trim().replace(/^Bearer\s+/i, '');
  const parts = t.split('.');
  if (parts.length === 5) throw new Error('This is an encrypted JWE (5 parts); only signed JWTs (3 parts) can be decoded without the key');
  if (parts.length !== 3) throw new Error(`A JWT has 3 dot-separated parts; this has ${parts.length}`);
  const part = (s: string, name: string) => {
    try {
      return utf8Decode(fromBase64(s), true);
    } catch {
      throw new Error(`The ${name} is not valid Base64URL`);
    }
  };
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(part(parts[0], 'header'));
  } catch (e) {
    throw new Error(e instanceof Error && e.message.startsWith('The ') ? e.message : 'The header is not valid JSON', { cause: e });
  }
  const payloadText = part(parts[1], 'payload');
  let payload: Record<string, unknown> | string;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    payload = payloadText;
  }
  const claims: DecodedJwt['claims'] = [];
  if (typeof payload === 'object' && payload) {
    for (const k of ['iat', 'nbf', 'exp'] as const) {
      const v = payload[k];
      if (typeof v === 'number') {
        let note = relative(v, nowSec);
        if (k === 'exp') note = v < nowSec ? `EXPIRED ${note}` : `valid, expires ${note}`;
        if (k === 'nbf' && v > nowSec) note = `NOT YET VALID (${note})`;
        claims.push({ name: { iat: 'Issued at', nbf: 'Not before', exp: 'Expires' }[k], value: formatIst(v), note });
      }
    }
    for (const [k, label] of [
      ['iss', 'Issuer'],
      ['sub', 'Subject'],
      ['aud', 'Audience'],
      ['jti', 'Token ID'],
    ] as const) {
      if (payload[k] !== undefined) claims.push({ name: label, value: Array.isArray(payload[k]) ? (payload[k] as string[]).join(', ') : String(payload[k]) });
    }
  }
  return { header, payload, signature: parts[2], claims };
}

export type KeyInput = { kind: 'secret'; value: string; base64?: boolean } | { kind: 'pem-or-jwk'; value: string };

/** Verifies the signature only (claims are reported separately). Throws a readable error on failure. */
export async function verifyJwt(token: string, key: KeyInput): Promise<{ alg: string }> {
  const t = token.trim().replace(/^Bearer\s+/i, '');
  const { header } = decodeJwt(t);
  const alg = String(header.alg ?? '');
  if (!alg || alg === 'none') throw new Error('Token uses alg "none" — it is unsigned and must not be trusted');
  let k: CryptoKey | Uint8Array;
  if (alg.startsWith('HS')) {
    if (key.kind !== 'secret') throw new Error(`${alg} needs a shared secret, not a public key`);
    k = key.base64 ? fromBase64(key.value) : utf8Encode(key.value);
  } else {
    if (key.kind !== 'pem-or-jwk') throw new Error(`${alg} needs a public key (PEM, certificate or JWK), not a secret`);
    const v = key.value.trim();
    if (v.startsWith('{')) k = (await importJWK(JSON.parse(v) as JWK, alg)) as CryptoKey;
    else if (v.includes('BEGIN CERTIFICATE')) k = await importX509(v, alg);
    else if (v.includes('BEGIN PUBLIC KEY')) k = await importSPKI(v, alg);
    else if (v.includes('PRIVATE KEY')) throw new Error('Paste the PUBLIC key; never paste private keys to verify a token');
    else throw new Error('Key must be a PEM public key, an X.509 certificate or a JWK');
  }
  try {
    await compactVerify(t, k);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(/signature verification failed/i.test(msg) ? 'Signature is INVALID for this key' : msg, { cause: e });
  }
  return { alg };
}
