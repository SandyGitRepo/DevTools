/**
 * FR-M1…M5 unit definitions. Exact factors from NIST SP 811 / the 1959 international yard:
 * 1 in = 2.54 cm, 1 ft = 0.3048 m, 1 yd = 0.9144 m, 1 lb = 0.45359237 kg.
 * Each unit converts to and from a base unit (metre, square metre, kilogram, kelvin, byte, litre).
 */
export interface Unit {
  id: string;
  label: string;
  /** Value in base units for 1 of this unit (linear units). */
  factor?: number;
  /** Affine units (temperature) supply explicit converters. */
  toBase?: (v: number) => number;
  fromBase?: (v: number) => number;
  note?: string;
}

export const toBase = (u: Unit, v: number) => (u.toBase ? u.toBase(v) : v * u.factor!);
export const fromBase = (u: Unit, v: number) => (u.fromBase ? u.fromBase(v) : v / u.factor!);

export const IN = 0.0254;
export const FT = 0.3048;
export const SQFT = FT * FT; // 0.09290304 m²
export const ACRE = 4046.8564224; // 43,560 sq ft
export const GUNTHA = ACRE / 40; // 1,089 sq ft (Maharashtra, Karnataka, Gujarat, Telangana)
export const CENT = ACRE / 100; // 435.6 sq ft (Kerala, Tamil Nadu, Karnataka)

export const lengthUnits: Unit[] = [
  { id: 'mm', label: 'Millimetres (mm)', factor: 0.001 },
  { id: 'cm', label: 'Centimetres (cm)', factor: 0.01 },
  { id: 'm', label: 'Metres (m)', factor: 1 },
  { id: 'km', label: 'Kilometres (km)', factor: 1000 },
  { id: 'in', label: 'Inches (in)', factor: IN },
  { id: 'ft', label: 'Feet (ft)', factor: FT },
  { id: 'yd', label: 'Yards (yd)', factor: 0.9144 },
  { id: 'mi', label: 'Miles (mi)', factor: 1609.344 },
];

/**
 * Bigha differs by state and even district. These are commonly used revenue values; the UI shows
 * the factor and asks users to confirm with local land records for valuation work.
 */
export const bighaStates: { id: string; state: string; sqft: number; note?: string }[] = [
  { id: 'assam', state: 'Assam', sqft: 14400 },
  { id: 'wb', state: 'West Bengal', sqft: 14400, note: '20 katha × 720 sq ft' },
  { id: 'bihar', state: 'Bihar', sqft: 27220 },
  { id: 'jharkhand', state: 'Jharkhand', sqft: 27220 },
  { id: 'up', state: 'Uttar Pradesh', sqft: 27000, note: 'varies by district' },
  { id: 'rajasthan-pucca', state: 'Rajasthan (pucca)', sqft: 27225 },
  { id: 'rajasthan-kachha', state: 'Rajasthan (kachha)', sqft: 17424 },
  { id: 'gujarat', state: 'Gujarat', sqft: 17424 },
  { id: 'mp', state: 'Madhya Pradesh', sqft: 12000 },
  { id: 'punjab', state: 'Punjab', sqft: 9070 },
  { id: 'haryana', state: 'Haryana', sqft: 27225 },
  { id: 'hp', state: 'Himachal Pradesh', sqft: 8712 },
  { id: 'uttarakhand', state: 'Uttarakhand', sqft: 6804 },
];

export function areaUnits(bighaSqft: number, bighaLabel: string): Unit[] {
  return [
    { id: 'sqft', label: 'Square feet (sq ft)', factor: SQFT },
    { id: 'sqm', label: 'Square metres (m²)', factor: 1 },
    { id: 'sqyd', label: 'Square yards (gaj)', factor: 0.83612736 },
    { id: 'acre', label: 'Acres', factor: ACRE },
    { id: 'hectare', label: 'Hectares', factor: 10000 },
    { id: 'guntha', label: 'Guntha', factor: GUNTHA, note: '1 guntha = 1,089 sq ft = 1/40 acre' },
    { id: 'cent', label: 'Cents', factor: CENT, note: '1 cent = 435.6 sq ft = 1/100 acre' },
    { id: 'bigha', label: `Bigha — ${bighaLabel}`, factor: bighaSqft * SQFT, note: `1 bigha = ${bighaSqft.toLocaleString('en-IN')} sq ft (${bighaLabel})` },
  ];
}

export const otherCategories: { id: string; label: string; units: Unit[] }[] = [
  {
    id: 'weight',
    label: 'Weight',
    units: [
      { id: 'mg', label: 'Milligrams (mg)', factor: 1e-6 },
      { id: 'g', label: 'Grams (g)', factor: 0.001 },
      { id: 'kg', label: 'Kilograms (kg)', factor: 1 },
      { id: 't', label: 'Tonnes (t)', factor: 1000 },
      { id: 'quintal', label: 'Quintals (100 kg)', factor: 100 },
      { id: 'oz', label: 'Ounces (oz)', factor: 0.028349523125 },
      { id: 'lb', label: 'Pounds (lb)', factor: 0.45359237 },
      { id: 'st', label: 'Stone (st)', factor: 6.35029318 },
      { id: 'tola', label: 'Tola (11.6638 g)', factor: 0.0116638038 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    units: [
      { id: 'c', label: 'Celsius (°C)', toBase: (v) => v + 273.15, fromBase: (k) => k - 273.15 },
      { id: 'f', label: 'Fahrenheit (°F)', toBase: (v) => ((v - 32) * 5) / 9 + 273.15, fromBase: (k) => ((k - 273.15) * 9) / 5 + 32 },
      { id: 'k', label: 'Kelvin (K)', toBase: (v) => v, fromBase: (k) => k },
    ],
  },
  {
    id: 'data',
    label: 'Data size',
    units: [
      { id: 'bit', label: 'Bits', factor: 0.125 },
      { id: 'B', label: 'Bytes (B)', factor: 1 },
      { id: 'KB', label: 'Kilobytes (KB, 1000)', factor: 1e3 },
      { id: 'MB', label: 'Megabytes (MB, 1000²)', factor: 1e6 },
      { id: 'GB', label: 'Gigabytes (GB, 1000³)', factor: 1e9 },
      { id: 'TB', label: 'Terabytes (TB, 1000⁴)', factor: 1e12 },
      { id: 'KiB', label: 'Kibibytes (KiB, 1024)', factor: 1024 },
      { id: 'MiB', label: 'Mebibytes (MiB, 1024²)', factor: 1024 ** 2 },
      { id: 'GiB', label: 'Gibibytes (GiB, 1024³)', factor: 1024 ** 3 },
      { id: 'TiB', label: 'Tebibytes (TiB, 1024⁴)', factor: 1024 ** 4 },
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    units: [
      { id: 'ml', label: 'Millilitres (ml)', factor: 0.001 },
      { id: 'l', label: 'Litres (l)', factor: 1 },
      { id: 'm3', label: 'Cubic metres (m³)', factor: 1000 },
      { id: 'cuft', label: 'Cubic feet (ft³)', factor: 28.316846592 },
      { id: 'galus', label: 'US gallons', factor: 3.785411784 },
      { id: 'galuk', label: 'UK gallons', factor: 4.54609 },
      { id: 'flozus', label: 'US fluid ounces', factor: 0.0295735295625 },
      { id: 'cup', label: 'US cups', factor: 0.2365882365 },
    ],
  },
];

/**
 * Parses lengths written as 5' 8", 5'8, 5 ft 8 in, 5ft, 8in, 5.5 ft, 170 cm, 1.7 m.
 * Returns metres, or null when the text is not a mixed/explicit length.
 */
export function parseLength(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"').replace(/''/g, '"');
  if (!s) return null;
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/);
  if (ftIn) return Number(ftIn[1]) * FT + Number(ftIn[2] ?? 0) * IN;
  const inOnly = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)$/);
  if (inOnly) return Number(inOnly[1]) * IN;
  const metric = s.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m|km)$/);
  if (metric) return Number(metric[1]) * ({ mm: 0.001, cm: 0.01, m: 1, km: 1000 } as Record<string, number>)[metric[2]];
  return null;
}

/** Metres → feet and inches, with inches rounded to `dp` places (carrying 12 in into a foot). */
export function toFeetInches(m: number, dp = 1): { ft: number; inch: number; text: string } {
  const totalIn = m / IN;
  let ft = Math.floor(totalIn / 12);
  let inch = Number((totalIn - ft * 12).toFixed(dp));
  if (inch >= 12) {
    ft += 1;
    inch = Number((inch - 12).toFixed(dp));
  }
  return { ft, inch, text: `${ft}' ${inch}"` };
}

export interface AreaEstimate {
  carpet: number;
  builtUp: number;
  superBuiltUp: number;
}

/**
 * FR-M4 estimate. Built-up = carpet × (1 + walls%); super built-up = built-up × (1 + loading%).
 * An estimate only — not a valuation and not the RERA carpet-area definition.
 */
export function estimateAreas(value: number, known: keyof AreaEstimate, wallsPct: number, loadingPct: number): AreaEstimate {
  const w = 1 + wallsPct / 100;
  const l = 1 + loadingPct / 100;
  const carpet = known === 'carpet' ? value : known === 'builtUp' ? value / w : value / w / l;
  return { carpet, builtUp: carpet * w, superBuiltUp: carpet * w * l };
}

export function formatNumber(v: number, dp: number): string {
  if (!Number.isFinite(v)) return '';
  const fixed = v.toFixed(dp);
  // Trim trailing zeros but keep at least one decimal place when dp > 0 and the value is fractional
  return dp > 0 ? fixed.replace(/\.?0+$/, '') || '0' : fixed;
}
