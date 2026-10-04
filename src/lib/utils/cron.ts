/**
 * FR-U3 cron explainer for Unix (5 fields), Quartz (6–7 fields, seconds first) and AWS EventBridge
 * (6 fields, year last, written as cron(...)). Descriptions come from cronstrue; next run times
 * from cron-parser, after normalising each dialect to cron-parser's syntax.
 */
import cronstrue from 'cronstrue';
import { CronExpressionParser } from 'cron-parser';

export type CronDialect = 'unix' | 'quartz' | 'aws';

/** Quartz and AWS number weekdays 1–7 with Sunday = 1; Unix/cron-parser use 0–6 with Sunday = 0. */
function shiftDow(field: string): string {
  return field.replace(/\d+/g, (d, offset: number, whole: string) => {
    // Leave the "#n" nth-occurrence number alone
    if (whole[offset - 1] === '#') return d;
    const n = Number(d);
    if (n < 1 || n > 7) throw new Error(`Day-of-week ${n} is out of range (1–7, Sunday = 1)`);
    return String(n - 1);
  });
}

export interface Normalised {
  /** Expression for cron-parser (seconds-first 6 fields). */
  parser: string;
  /** Expression for cronstrue. */
  describe: string;
  years?: string;
}

export function normalise(expr: string, dialect: CronDialect): Normalised {
  let s = expr.trim().replace(/\s+/g, ' ');
  if (!s) throw new Error('Enter a cron expression');
  if (dialect === 'aws') {
    const m = s.match(/^(?:cron\()?(.+?)\)?$/i);
    s = m ? m[1].trim() : s;
  }
  const f = s.split(' ');
  if (dialect === 'unix') {
    if (f.length !== 5) throw new Error(`A Unix cron expression has 5 fields (minute hour day month weekday); this has ${f.length}`);
    return { parser: `0 ${s}`, describe: s };
  }
  if (dialect === 'quartz') {
    if (f.length !== 6 && f.length !== 7)
      throw new Error(`A Quartz expression has 6 or 7 fields (second minute hour day month weekday [year]); this has ${f.length}`);
    const [sec, min, hour, dom, mon, dow, year] = f;
    if (dom !== '?' && dow !== '?') throw new Error('Quartz needs “?” in either day-of-month or day-of-week');
    return { parser: [sec, min, hour, dom, mon, dow === '?' ? '?' : shiftDow(dow)].join(' '), describe: s, years: year };
  }
  if (f.length !== 6) throw new Error(`An EventBridge expression has 6 fields (minute hour day month weekday year); this has ${f.length}`);
  const [min, hour, dom, mon, dow, year] = f;
  if (dom !== '?' && dow !== '?') throw new Error('EventBridge needs “?” in either day-of-month or day-of-week');
  return { parser: ['0', min, hour, dom, mon, dow === '?' ? '?' : shiftDow(dow)].join(' '), describe: `0 ${s}`, years: year };
}

export function describe(expr: string, dialect: CronDialect): string {
  const n = normalise(expr, dialect);
  try {
    return cronstrue.toString(n.describe, {
      use24HourTimeFormat: true,
      verbose: true,
      dayOfWeekStartIndexZero: dialect === 'unix',
      throwExceptionOnParseError: true,
    });
  } catch (e) {
    // cronstrue throws plain strings such as "Error: Expression contains invalid values"
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg.replace(/^Error:\s*/, ''), { cause: e });
  }
}

function yearMatches(field: string | undefined, year: number): boolean {
  if (!field || field === '*' || field === '?') return true;
  return field.split(',').some((part) => {
    const [range, step] = part.split('/');
    const [a, b] = range === '*' ? [1970, 2199] : range.split('-').map(Number);
    const hi = b ?? (step ? 2199 : a);
    return year >= a && year <= hi && (year - a) % Number(step ?? 1) === 0;
  });
}

export function nextRuns(expr: string, dialect: CronDialect, zone: string, count = 10, from = new Date()): Date[] {
  const n = normalise(expr, dialect);
  const it = CronExpressionParser.parse(n.parser, { tz: zone, currentDate: from });
  const out: Date[] = [];
  for (let guard = 0; out.length < count && guard < 5000; guard++) {
    let d: Date;
    try {
      d = it.next().toDate();
    } catch {
      break;
    }
    if (yearMatches(n.years, Number(new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric' }).format(d)))) out.push(d);
  }
  return out;
}
