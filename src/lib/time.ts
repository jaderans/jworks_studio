/** Dates are stored as epoch ms; calendar days as YYYY-MM-DD in the device's own time zone. */

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(ms: number = Date.now()): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = (): string => isoDate(Date.now());

/** Start of a local calendar day in ms. */
export function dayStart(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
}

export function addDays(iso: string, days: number): string {
  const t = new Date(dayStart(iso));
  t.setDate(t.getDate() + days);
  return isoDate(t.getTime());
}

/** Inclusive list of days between two ISO dates (max 60). */
export function daysBetween(startIso: string, endIso: string): string[] {
  if (!startIso) return [];
  const out: string[] = [];
  let cur = startIso;
  const end = endIso && endIso >= startIso ? endIso : startIso;
  for (let i = 0; i < 60 && cur <= end; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

export const fmtDate = (ms: number): string => dateFmt.format(ms);
export const fmtDateShort = (ms: number): string => dateShortFmt.format(ms);
export const fmtTime = (ms: number): string => timeFmt.format(ms);
export const fmtDateTime = (ms: number): string => `${dateShortFmt.format(ms)}, ${timeFmt.format(ms)}`;
export const fmtIsoDate = (iso: string): string => (iso ? dateFmt.format(dayStart(iso)) : '—');
export const fmtIsoWeekday = (iso: string): string => (iso ? weekdayFmt.format(dayStart(iso)) : '—');

export function fmtDateRange(startIso: string, endIso: string): string {
  if (!startIso) return 'No date yet';
  if (!endIso || endIso === startIso) return fmtIsoDate(startIso);
  return `${dateShortFmt.format(dayStart(startIso))} – ${fmtIsoDate(endIso)}`;
}

/** Minutes since midnight from "HH:MM". */
export function hhmmToMinutes(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Hours between two "HH:MM" times; an end before the start means past midnight. */
export function shiftHours(start: string, end: string): number {
  const a = hhmmToMinutes(start);
  const b = hhmmToMinutes(end);
  if (a === null || b === null) return 0;
  const diff = b >= a ? b - a : b + 24 * 60 - a;
  return Math.round((diff / 60) * 100) / 100;
}

export const localHour = (ms: number): number => new Date(ms).getHours();

export function hourLabel(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

export function relativeTime(ms: number, now = Date.now()): string {
  const s = Math.round((now - ms) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return fmtDateShort(ms);
}

// ----- weeks and months (the calendar runs Monday to Sunday) -----

const DAY_MS = 86_400_000;

/** 0 = Sunday … 6 = Saturday. */
export const weekdayOf = (iso: string): number => new Date(dayStart(iso)).getDay();

/** The Monday of the week that contains this day. */
export function mondayOf(iso: string): string {
  const dow = weekdayOf(iso);
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

/** Whole days from a to b (b later = positive). */
export const daysFrom = (a: string, b: string): number => Math.round((dayStart(b) - dayStart(a)) / DAY_MS);

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const isoOf = (y: number, m: number, d: number): string => isoDate(new Date(y, m - 1, d).getTime());

/** The nth (1-based) given weekday of a month; n = -1 means the last one. month is 1–12. */
export function nthWeekdayOfMonth(year: number, month: number, dow: number, n: number): string {
  if (n === -1) {
    const last = new Date(year, month, 0);
    const back = (last.getDay() - dow + 7) % 7;
    return isoOf(year, month, last.getDate() - back);
  }
  const first = new Date(year, month - 1, 1);
  const fwd = (dow - first.getDay() + 7) % 7;
  return isoOf(year, month, 1 + fwd + (n - 1) * 7);
}

export const lastMondayOfMonth = (year: number, month: number): string => nthWeekdayOfMonth(year, month, 1, -1);

/** First day of the month after the one containing iso. */
export function nextMonthStart(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return m === 12 ? isoOf(y + 1, 1, 1) : isoOf(y, m + 1, 1);
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return isoOf(t.getFullYear(), t.getMonth() + 1, Math.min(d, lastDay));
}

/** First Monday on or after this day. */
export function mondayOnOrAfter(iso: string): string {
  const dow = weekdayOf(iso);
  return dow === 1 ? iso : addDays(iso, (8 - dow) % 7);
}

const monthFmt = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' });
const monthShortFmt = new Intl.DateTimeFormat('en-PH', { month: 'short' });
const dayNameFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'long' });
const dowShortFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'short' });

export const fmtMonth = (iso: string): string => monthFmt.format(dayStart(iso.length === 7 ? `${iso}-01` : iso));
export const fmtMonthShort = (iso: string): string => monthShortFmt.format(dayStart(iso));
export const fmtDayName = (iso: string): string => dayNameFmt.format(dayStart(iso));
export const fmtDowShort = (iso: string): string => dowShortFmt.format(dayStart(iso));

export const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Date ranges the list pages filter by ('' = any time). */
export type Period = '' | 'month' | 'last30' | 'last90' | 'year' | 'lastYear';
export const PERIOD_LABEL: Record<Exclude<Period, ''>, string> = {
  month: 'This month',
  last30: 'Last 30 days',
  last90: 'Last 3 months',
  year: 'This year',
  lastYear: 'Last year',
};

export function inPeriod(iso: string, period: Period, today: string = todayISO()): boolean {
  if (!period) return true;
  if (!iso) return false;
  const day = iso.slice(0, 10);
  const year = today.slice(0, 4);
  switch (period) {
    case 'month':
      return day.slice(0, 7) === today.slice(0, 7);
    case 'last30':
      return day > addDays(today, -30) && day <= today;
    case 'last90':
      return day > addDays(today, -91) && day <= today;
    case 'year':
      return day.slice(0, 4) === year;
    case 'lastYear':
      return day.slice(0, 4) === String(Number(year) - 1);
  }
}
