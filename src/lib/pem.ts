import { fromBase64, toBase64 } from './bytes';

export function toPem(der: Uint8Array, label: string): string {
  const b64 = toBase64(der);
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END ${label}-----\n`;
}

export interface PemBlock {
  label: string;
  der: Uint8Array;
}

/** Parses every PEM block in the text. Raw Base64 (no armour) is accepted as a single unlabeled block. */
export function parsePem(text: string): PemBlock[] {
  const blocks: PemBlock[] = [];
  const re = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const body = m[2].replace(/^[A-Za-z-]+:.*$/gm, ''); // drop RFC 1421 headers
    blocks.push({ label: m[1], der: fromBase64(body) });
  }
  if (!blocks.length) {
    const s = text.trim();
    if (s && /^[A-Za-z0-9+/=\s]+$/.test(s)) blocks.push({ label: '', der: fromBase64(s) });
  }
  return blocks;
}
