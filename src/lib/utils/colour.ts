/** FR-U7 colour conversion and WCAG 2.1 contrast. */
export interface RGB {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColour(input: string): RGB {
  const s = input.trim().toLowerCase();
  let m = s.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  m = s.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    if ([r, g, b].some((x) => x > 255)) throw new Error('RGB values must be 0–255');
    return { r, g, b, a: alpha(m[4]) };
  }
  m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) return { ...hslToRgb(Number(m[1]), Number(m[2]), Number(m[3])), a: alpha(m[4]) };
  throw new Error('Use #RRGGBB, #RGB, rgb(r, g, b) or hsl(h, s%, l%)');
}

const alpha = (v?: string) => (v === undefined ? 1 : v.endsWith('%') ? Number(v.slice(0, -1)) / 100 : Number(v));

export function hslToRgb(h: number, s: number, l: number): Omit<RGB, 'a'> {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export const toHex = ({ r, g, b, a }: RGB) =>
  '#' +
  [r, g, b, ...(a < 1 ? [Math.round(a * 255)] : [])]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
export const toRgbString = ({ r, g, b, a }: RGB) => (a < 1 ? `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})` : `rgb(${r}, ${g}, ${b})`);
export const toHslString = (c: RGB) => {
  const { h, s, l } = rgbToHsl(c);
  return c.a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${+c.a.toFixed(3)})` : `hsl(${h}, ${s}%, ${l}%)`;
};

/** WCAG 2.1 relative luminance. */
export function luminance({ r, g, b }: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function wcag(ratio: number) {
  return { aaNormal: ratio >= 4.5, aaLarge: ratio >= 3, aaaNormal: ratio >= 7, aaaLarge: ratio >= 4.5 };
}
