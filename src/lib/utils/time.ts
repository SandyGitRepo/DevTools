/** FR-U2 timestamp helpers built on the platform Intl API (no timezone database to ship). */
export type EpochUnit = 's' | 'ms' | 'us' | 'ns';

/** Guesses the unit of an epoch number from its magnitude (dates between 1973 and 5138). */
export function detectUnit(n: number): EpochUnit {
  const a = Math.abs(n);
  if (a < 1e11) return 's';
  if (a < 1e14) return 'ms';
  if (a < 1e17) return 'us';
  return 'ns';
}

export function epochToDate(input: string, unit: EpochUnit | 'auto' = 'auto'): { date: Date; unit: EpochUnit } {
  const s = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error('Enter a whole number of seconds or milliseconds since 1970-01-01 UTC');
  const n = Number(s);
  const u = unit === 'auto' ? detectUnit(n) : unit;
  const ms = u === 's' ? n * 1000 : u === 'ms' ? n : u === 'us' ? n / 1000 : n / 1e6;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) throw new Error('That timestamp is outside the supported date range');
  return { date, unit: u };
}

/** Parses ISO-8601, RFC 2822 and "YYYY-MM-DD HH:mm[:ss]" (interpreted in the given zone when it has no offset). */
export function parseDate(input: string, zone: string): Date {
  const s = input.trim();
  if (!s) throw new Error('Enter a date');
  const local = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/);
  if (local) {
    const [, y, mo, d, h = '0', mi = '0', se = '0', msec = '0'] = local;
    return zonedToUtc(+y, +mo, +d, +h, +mi, +se, +msec.padEnd(3, '0'), zone);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('Unrecognised date. Use ISO-8601 like 2026-10-04T15:30:00+05:30, or 2026-10-04 15:30');
  return d;
}

/** Offset of `zone` from UTC at the given instant, in minutes. */
export function zoneOffsetMinutes(date: Date, zone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Wall-clock time in a zone → UTC instant (handles DST by re-checking the offset). */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, ms: number, zone: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  let t = guess - zoneOffsetMinutes(new Date(guess), zone) * 60000;
  t = guess - zoneOffsetMinutes(new Date(t), zone) * 60000;
  return new Date(t);
}

export function formatOffset(min: number): string {
  const sign = min >= 0 ? '+' : '-';
  const a = Math.abs(min);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** ISO-8601 with the zone's offset, e.g. 2026-10-04T21:00:00+05:30. */
export function isoInZone(date: Date, zone: string): string {
  const off = zoneOffsetMinutes(date, zone);
  const shifted = new Date(date.getTime() + off * 60000);
  const iso = shifted.toISOString().replace('Z', '');
  return `${iso.endsWith('.000') ? iso.slice(0, -4) : iso}${off === 0 && zone === 'UTC' ? 'Z' : formatOffset(off)}`;
}

export function humanInZone(date: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: zone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

export function relative(date: Date, now = new Date()): string {
  const diff = (date.getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [u, s] of units) if (Math.abs(diff) >= s || u === 'second') return rtf.format(Math.round(diff / s), u);
  return '';
}

export function allZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  return ['Asia/Kolkata', 'UTC', ...supported.filter((z) => z !== 'Asia/Kolkata' && z !== 'UTC')];
}
