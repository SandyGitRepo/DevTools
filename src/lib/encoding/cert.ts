import * as asn1js from 'asn1js';
import { Certificate, CertificationRequest, AttributeTypeAndValue, AltName, Extension, BasicConstraints, ExtKeyUsage } from 'pkijs';
import { parsePem } from '../pem';
import { buf, toHex } from '../bytes';

const OIDS: Record<string, string> = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.5': 'serialNumber',
  '1.2.840.113549.1.9.1': 'E',
  '0.9.2342.19200300.100.1.25': 'DC',
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.10045.2.1': 'EC',
  '1.3.101.112': 'Ed25519',
  '1.2.840.113549.1.1.5': 'sha1WithRSA',
  '1.2.840.113549.1.1.11': 'sha256WithRSA',
  '1.2.840.113549.1.1.12': 'sha384WithRSA',
  '1.2.840.113549.1.1.13': 'sha512WithRSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
  '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',
  '1.3.132.0.35': 'P-521',
  '1.3.6.1.5.5.7.3.1': 'TLS server auth',
  '1.3.6.1.5.5.7.3.2': 'TLS client auth',
  '1.3.6.1.5.5.7.3.3': 'Code signing',
  '1.3.6.1.5.5.7.3.4': 'Email protection',
  '1.3.6.1.5.5.7.3.8': 'Time stamping',
  '1.3.6.1.5.5.7.3.9': 'OCSP signing',
  '2.5.29.17': 'Subject Alternative Name',
  '2.5.29.19': 'Basic Constraints',
  '2.5.29.15': 'Key Usage',
  '2.5.29.37': 'Extended Key Usage',
  '2.5.29.14': 'Subject Key Identifier',
  '2.5.29.35': 'Authority Key Identifier',
  '2.5.29.31': 'CRL Distribution Points',
  '1.3.6.1.5.5.7.1.1': 'Authority Info Access',
  '2.5.29.32': 'Certificate Policies',
  '1.3.6.1.4.1.11129.2.4.2': 'SCT List',
  '1.2.840.113549.1.9.14': 'extensionRequest',
};

const name = (oid: string) => OIDS[oid] ?? oid;

function dn(typesAndValues: AttributeTypeAndValue[]): string {
  return typesAndValues.map((tv) => `${name(tv.type)}=${(tv.value.valueBlock as { value?: string }).value ?? ''}`).join(', ');
}

const KEY_USAGE = [
  'Digital signature',
  'Non-repudiation',
  'Key encipherment',
  'Data encipherment',
  'Key agreement',
  'Certificate signing',
  'CRL signing',
  'Encipher only',
  'Decipher only',
];

function describeExtension(ext: Extension): string {
  try {
    switch (ext.extnID) {
      case '2.5.29.17': {
        const alt = ext.parsedValue as AltName;
        return alt.altNames
          .map((n) => {
            const prefix = ({ 1: 'email', 2: 'DNS', 6: 'URI', 7: 'IP' } as Record<number, string>)[n.type] ?? `type${n.type}`;
            let v: string = typeof n.value === 'string' ? n.value : '';
            if (n.type === 7) {
              const bytes = new Uint8Array((n.value as asn1js.OctetString).valueBlock.valueHexView);
              v = bytes.length === 4 ? Array.from(bytes).join('.') : toHex(bytes).match(/.{4}/g)!.join(':');
            }
            return `${prefix}:${v}`;
          })
          .join(', ');
      }
      case '2.5.29.19': {
        const bc = ext.parsedValue as BasicConstraints;
        return `CA: ${bc.cA ? 'yes' : 'no'}${bc.pathLenConstraint !== undefined ? `, path length ${bc.pathLenConstraint}` : ''}`;
      }
      case '2.5.29.15': {
        const bits = new Uint8Array((ext.parsedValue as asn1js.BitString).valueBlock.valueHexView);
        const set: string[] = [];
        KEY_USAGE.forEach((label, i) => {
          if ((bits[i >> 3] ?? 0) & (0x80 >> (i & 7))) set.push(label);
        });
        return set.join(', ');
      }
      case '2.5.29.37':
        return (ext.parsedValue as ExtKeyUsage).keyPurposes.map(name).join(', ');
      case '2.5.29.14':
        return toHex(new Uint8Array((ext.parsedValue as asn1js.OctetString).valueBlock.valueHexView), ':').toUpperCase();
      default:
        return '';
    }
  } catch {
    return '';
  }
}

export interface CertInfo {
  kind: 'Certificate' | 'Certificate signing request';
  fields: [string, string][];
  extensions: [string, string, boolean][];
  validity?: { notBefore: Date; notAfter: Date; daysLeft: number };
}

async function fingerprint(der: Uint8Array, alg: 'SHA-1' | 'SHA-256') {
  return toHex(new Uint8Array(await crypto.subtle.digest(alg, buf(der))), ':').toUpperCase();
}

function keyDescription(spki: Certificate['subjectPublicKeyInfo']): string {
  const alg = name(spki.algorithm.algorithmId);
  if (alg === 'RSA') {
    try {
      const pk = spki.parsedKey as { modulus?: asn1js.Integer } | undefined;
      const mod = pk?.modulus?.valueBlock.valueHexView;
      if (mod) return `RSA ${(mod[0] === 0 ? mod.length - 1 : mod.length) * 8} bit`;
    } catch {
      /* fall through */
    }
    return 'RSA';
  }
  if (alg === 'EC') {
    const params = spki.algorithm.algorithmParams as asn1js.ObjectIdentifier | undefined;
    return `EC ${params?.valueBlock ? name(params.valueBlock.toString()) : ''}`.trim();
  }
  return alg;
}

export async function decodeCertificates(text: string): Promise<CertInfo[]> {
  const blocks = parsePem(text);
  if (!blocks.length) throw new Error('No PEM block found. Paste text starting with -----BEGIN CERTIFICATE-----');
  const out: CertInfo[] = [];
  for (const block of blocks) {
    if (/PRIVATE KEY/.test(block.label)) throw new Error('This is a PRIVATE KEY. Do not paste private keys here; this tool decodes certificates and CSRs.');
    const asn = asn1js.fromBER(buf(block.der));
    if (asn.offset === -1) throw new Error(`Could not parse the ${block.label || 'PEM'} block (invalid DER)`);
    const isCsr = /REQUEST/.test(block.label);
    if (isCsr) {
      const csr = new CertificationRequest({ schema: asn.result });
      const exts: [string, string, boolean][] = [];
      for (const attr of csr.attributes ?? []) {
        if (attr.type === '1.2.840.113549.1.9.14') {
          for (const v of attr.values) {
            for (const e of (v as asn1js.Sequence).valueBlock.value) {
              const ext = new Extension({ schema: e });
              exts.push([name(ext.extnID), describeExtension(ext), !!ext.critical]);
            }
          }
        }
      }
      out.push({
        kind: 'Certificate signing request',
        fields: [
          ['Subject', dn(csr.subject.typesAndValues)],
          ['Public key', keyDescription(csr.subjectPublicKeyInfo)],
          ['Signature algorithm', name(csr.signatureAlgorithm.algorithmId)],
          ['SHA-256 of request', await fingerprint(block.der, 'SHA-256')],
        ],
        extensions: exts,
      });
    } else {
      const cert = new Certificate({ schema: asn.result });
      const notBefore = cert.notBefore.value;
      const notAfter = cert.notAfter.value;
      const subject = dn(cert.subject.typesAndValues);
      const issuer = dn(cert.issuer.typesAndValues);
      out.push({
        kind: 'Certificate',
        fields: [
          ['Subject', subject],
          ['Issuer', issuer + (subject === issuer ? '  (self-signed)' : '')],
          ['Serial number', toHex(new Uint8Array(cert.serialNumber.valueBlock.valueHexView), ':').toUpperCase()],
          ['Version', `v${cert.version + 1}`],
          ['Not before', notBefore.toUTCString()],
          ['Not after', notAfter.toUTCString()],
          ['Public key', keyDescription(cert.subjectPublicKeyInfo)],
          ['Signature algorithm', name(cert.signatureAlgorithm.algorithmId)],
          ['SHA-256 fingerprint', await fingerprint(block.der, 'SHA-256')],
          ['SHA-1 fingerprint', await fingerprint(block.der, 'SHA-1')],
        ],
        extensions: (cert.extensions ?? []).map((e) => [name(e.extnID), describeExtension(e), !!e.critical]),
        validity: { notBefore, notAfter, daysLeft: Math.floor((notAfter.getTime() - Date.now()) / 86400000) },
      });
    }
  }
  return out;
}
