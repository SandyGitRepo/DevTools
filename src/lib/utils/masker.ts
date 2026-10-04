/**
 * FR-U8 data masker for Indian PII before sharing logs or payloads. Order matters: the most
 * specific patterns run first so a 12-digit Aadhaar is not also counted as an account number.
 * Checksums (Verhoeff for Aadhaar, Luhn for cards) cut false positives.
 */
export type RuleId = 'pan' | 'aadhaar' | 'card' | 'mobile' | 'email' | 'account' | 'ifsc';

export interface MaskOptions {
  rules: Record<RuleId, boolean>;
  maskChar: string;
  keepLast: number;
  /** JSON mode: also fully mask values of keys such as password, token, secret. */
  sensitiveKeys: boolean;
}

export const ruleLabels: Record<RuleId, string> = {
  pan: 'PAN',
  aadhaar: 'Aadhaar',
  card: 'Card number',
  mobile: 'Mobile',
  email: 'Email',
  account: 'Account number',
  ifsc: 'IFSC',
};

export const defaultMaskOptions: MaskOptions = {
  rules: { pan: true, aadhaar: true, card: true, mobile: true, email: true, account: true, ifsc: false },
  maskChar: 'X',
  keepLast: 4,
  sensitiveKeys: true,
};

// Verhoeff checksum tables (used by UIDAI for Aadhaar)
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits: string): boolean {
  let c = 0;
  [...digits].reverse().forEach((ch, i) => (c = D[c][P[i % 8][Number(ch)]]));
  return c === 0;
}

export function luhnValid(digits: string): boolean {
  let sum = 0;
  [...digits].reverse().forEach((ch, i) => {
    let d = Number(ch);
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  });
  return sum % 10 === 0;
}

/** Masks all but the last `keep` digits/letters, preserving separators (spaces, dashes). */
function maskKeep(s: string, keep: number, ch: string): string {
  const total = (s.match(/[A-Za-z0-9]/g) ?? []).length;
  let seen = 0;
  return s.replace(/[A-Za-z0-9]/g, (c) => (++seen > total - keep ? c : ch));
}

interface Rule {
  id: RuleId;
  re: RegExp;
  valid?: (m: string) => boolean;
  mask: (m: string, o: MaskOptions) => string;
}

const RULES: Rule[] = [
  {
    id: 'email',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    mask: (m, o) => {
      const [local, domain] = m.split('@');
      return `${local[0]}${o.maskChar.repeat(Math.max(3, local.length - 1))}@${domain}`;
    },
  },
  // PAN: 5 letters, 4 digits, 1 letter; 4th letter is the holder type (P, C, H, F, A, T, B, L, J, G)
  { id: 'pan', re: /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g, mask: (m, o) => m.slice(0, 2) + o.maskChar.repeat(6) + m.slice(8) },
  { id: 'ifsc', re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g, mask: (m, o) => m.slice(0, 4) + o.maskChar.repeat(7) },
  {
    id: 'card',
    re: /\b(?:\d[ -]?){12,18}\d\b/g,
    valid: (m) => {
      const d = m.replace(/\D/g, '');
      return d.length >= 13 && d.length <= 19 && luhnValid(d) && !/^(\d)\1+$/.test(d);
    },
    mask: (m, o) => maskKeep(m, o.keepLast, o.maskChar),
  },
  {
    id: 'aadhaar',
    re: /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g,
    valid: (m) => verhoeffValid(m.replace(/\D/g, '')),
    mask: (m, o) => maskKeep(m, 4, o.maskChar),
  },
  {
    id: 'mobile',
    re: /(?<![\d+])(?:\+91[ -]?|0091[ -]?|\b0)?[6-9]\d{4}[ -]?\d{5}\b/g,
    mask: (m, o) => {
      const prefix = m.match(/^(\+91|0091)[ -]?/)?.[0] ?? '';
      return prefix + maskKeep(m.slice(prefix.length), o.keepLast, o.maskChar);
    },
  },
  { id: 'account', re: /\b\d{9,18}\b/g, mask: (m, o) => maskKeep(m, o.keepLast, o.maskChar) },
];

export type MaskCounts = Partial<Record<RuleId | 'key', number>>;

/** Masks PII in free text. Returns the masked text and how many items of each type were masked. */
export function maskText(text: string, o: MaskOptions, counts: MaskCounts = {}): { text: string; counts: MaskCounts } {
  // Replace matches with placeholders as we go so later rules never re-match masked output
  const store: string[] = [];
  let out = text;
  for (const rule of RULES) {
    if (!o.rules[rule.id]) continue;
    out = out.replace(rule.re, (m) => {
      if (rule.valid && !rule.valid(m)) return m;
      counts[rule.id] = (counts[rule.id] ?? 0) + 1;
      store.push(rule.mask(m, o));
      return `\u0000${store.length - 1}\u0000`;
    });
  }
  // eslint-disable-next-line no-control-regex -- \u0000 delimits our own placeholders
  return { text: out.replace(/\u0000(\d+)\u0000/g, (_, i) => store[+i]), counts };
}

const SENSITIVE_KEY = /pass(word|wd)?|secret|token|api[_-]?key|authorization|cvv|cvc|pin$|otp|private[_-]?key|session/i;

/** JSON mode: walks the structure, masking string/number values and fully hiding sensitive keys. */
export function maskJson(value: unknown, o: MaskOptions, counts: MaskCounts = {}): unknown {
  const walk = (v: unknown, key?: string): unknown => {
    if (key && o.sensitiveKeys && SENSITIVE_KEY.test(key) && v !== null && typeof v !== 'object') {
      counts.key = (counts.key ?? 0) + 1;
      return o.maskChar.repeat(8);
    }
    if (typeof v === 'string') return maskText(v, o, counts).text;
    if (typeof v === 'number' && Number.isInteger(v) && String(v).length >= 9) {
      const masked = maskText(String(v), o, counts).text;
      return masked === String(v) ? v : masked;
    }
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  return walk(value);
}
