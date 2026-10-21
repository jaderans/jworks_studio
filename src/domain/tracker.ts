import { cellText, type Sheet } from './xlsx';
import { priorityFromTracker, statusFromTracker, typeFromTracker } from './jobs';
import { toCents, type Cents } from '../lib/money';
import type { BirSettings, JobStatus, JobType, MonthlyTarget, PayMethod, Priority } from '../db/types';

/**
 * Reads the JoshWorks commission tracker (.xlsx): the Main Commission Tracker,
 * Payment Designation (team splits), Monthly Summary (targets) and BIR settings.
 * Columns are found by their header text, so added or moved columns still work.
 * Runs on the device; the workbook is never uploaded.
 */

export interface TrackerJob {
  /** COM-005 */
  number: string;
  title: string;
  type: JobType;
  total: Cents;
  initial: Cents;
  final: Cents;
  /** When each payment came in (ISO), or '' when the tracker doesn't say. */
  initialOn: string;
  finalOn: string;
  priority: Priority;
  clientName: string;
  clientEmail: string;
  status: JobStatus;
  startDate: string;
  dueDate: string;
  completedOn: string;
  rush: boolean;
  method: PayMethod;
  notes: string;
  createdOn: string;
  invoiceNo: string;
  taxWithheld: Cents;
  form2307: 'yes' | 'no' | 'na';
  /** Spreadsheet row, for messages. */
  row: number;
}

export interface TrackerSplit {
  number: string;
  /** 0–100 */
  deductionPct: number;
  /** Name as in the sheet's column (Joshua, Renz…) → percent 0–100. */
  shares: { name: string; pct: number }[];
  row: number;
}

export interface TrackerImport {
  jobs: TrackerJob[];
  /** By job number; when a job appears twice, the lower row wins. */
  splits: Map<string, TrackerSplit>;
  /** People with a column in Payment Designation. */
  people: string[];
  targets: MonthlyTarget[];
  bigProject: Cents | null;
  bir: Partial<BirSettings>;
  warnings: string[];
}

/** Excel's day number (46036) or a typed date → YYYY-MM-DD. */
export function excelDate(v: string): string {
  const t = v.trim();
  if (!t) return '';
  if (/^\d{4,5}(\.\d+)?$/.test(t)) {
    const n = Math.floor(Number(t));
    if (n < 20000 || n > 80000) return '';
    return new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10);
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "₱4,750.00", "4750" → centavos; blank → 0. */
export function money(v: string): Cents {
  const n = Number(v.replace(/[₱,\s]|PHP/gi, ''));
  return Number.isFinite(n) ? toCents(n) : 0;
}

/** A sheet percent: 0.55 (formatted 55%) or 55 → 55. */
export function percent(v: string): number {
  const t = v.trim().replace('%', '');
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n <= 1 && !v.includes('%') ? n * 100 : n) * 1000) / 1000;
}

const METHODS: Record<string, PayMethod> = {
  gcash: 'GCash',
  'mari bank': 'Mari Bank',
  maribank: 'Mari Bank',
  'union bank': 'Union Bank',
  unionbank: 'Union Bank',
  'on hand': 'On Hand',
  cash: 'On Hand',
  'bank transfer': 'Bank transfer',
  paypal: 'PayPal',
  wise: 'Wise',
};
export const methodFromTracker = (v: string): PayMethod => METHODS[v.trim().toLowerCase()] ?? (v.trim() ? 'Other' : 'GCash');

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

/** Column numbers by header text, matching the start of the header. */
function columns(sheet: Sheet, headerRow: number): (label: string) => number {
  const row = sheet.rows.get(headerRow);
  const heads = new Map<number, string>();
  for (const c of row?.keys() ?? []) heads.set(c, norm(cellText(sheet, headerRow, c)));
  return (label: string) => {
    const want = norm(label);
    for (const [c, h] of heads) if (h === want) return c;
    for (const [c, h] of heads) if (h.startsWith(want)) return c;
    return 0;
  };
}

function findHeaderRow(sheet: Sheet, first: string, max = 12): number {
  for (let r = 1; r <= Math.min(max, sheet.maxRow); r++) {
    const row = sheet.rows.get(r);
    if (!row) continue;
    for (const c of row.keys()) if (norm(cellText(sheet, r, c)) === norm(first)) return r;
  }
  return 0;
}

const findSheet = (sheets: Sheet[], name: string) => sheets.find((s) => norm(s.name) === norm(name)) ?? sheets.find((s) => norm(s.name).startsWith(norm(name)));

export function parseTracker(sheets: Sheet[]): TrackerImport {
  const warnings: string[] = [];
  const main = findSheet(sheets, 'Main Commission Tracker');
  if (!main) throw new Error('This isn’t the commission tracker: there’s no “Main Commission Tracker” sheet.');
  const hr = findHeaderRow(main, 'Task') || 1;
  const col = columns(main, hr);
  const c = {
    task: col('Task'),
    type: col('Commission Type'),
    total: col('Total Amount'),
    initial: col('Initial Payment'),
    final: col('Final Payment'),
    priority: col('Priority'),
    client: col('Client Name'),
    email: col('Client Email'),
    status: col('Status'),
    start: col('Start date'),
    end: col('End date'),
    done: col('Actual Completion'),
    rush: col('Rush Service'),
    method: col('Payment Method'),
    notes: col('Notes'),
    created: col('Date Created'),
    id: col('Project ID'),
    initialOn: col('Initial Paid On'),
    finalOn: col('Final Paid On'),
    invoice: col('Invoice No'),
    tax: col('Tax Withheld'),
    f2307: col('2307 Received'),
  };
  if (!c.task || !c.id) throw new Error('The Main Commission Tracker needs “Task” and “Project ID” columns.');
  const t = (r: number, k: number) => (k ? cellText(main, r, k).trim() : '');
  const jobs: TrackerJob[] = [];
  const seen = new Set<string>();
  for (let r = hr + 1; r <= main.maxRow; r++) {
    const title = t(r, c.task);
    const number = t(r, c.id).toUpperCase();
    if (!title || !/^COM-\d+$/.test(number)) continue; // empty and placeholder rows
    if (seen.has(number)) {
      warnings.push(`${number} is listed twice in the Main Commission Tracker (row ${r}); the first one is used.`);
      continue;
    }
    seen.add(number);
    const f2307 = t(r, c.f2307).toLowerCase();
    jobs.push({
      number,
      title,
      type: typeFromTracker(t(r, c.type)),
      total: money(t(r, c.total)),
      initial: money(t(r, c.initial)),
      final: money(t(r, c.final)),
      initialOn: excelDate(t(r, c.initialOn)),
      finalOn: excelDate(t(r, c.finalOn)),
      priority: priorityFromTracker(t(r, c.priority)),
      clientName: t(r, c.client).replace(/\s+/g, ' '),
      clientEmail: t(r, c.email).toLowerCase(),
      status: statusFromTracker(t(r, c.status)),
      startDate: excelDate(t(r, c.start)),
      dueDate: excelDate(t(r, c.end)),
      completedOn: excelDate(t(r, c.done)),
      rush: /^y/i.test(t(r, c.rush)),
      method: methodFromTracker(t(r, c.method)),
      notes: t(r, c.notes),
      createdOn: excelDate(t(r, c.created)),
      invoiceNo: t(r, c.invoice),
      taxWithheld: money(t(r, c.tax)),
      form2307: f2307.startsWith('y') ? 'yes' : f2307.startsWith('n') && f2307 !== 'n/a' ? 'no' : 'na',
      row: r,
    });
  }
  for (const j of jobs) {
    if (j.total > 0 && j.initial + j.final > j.total) warnings.push(`${j.number}: payments (${(j.initial + j.final) / 100}) are more than the total (${j.total / 100}).`);
    if (!j.total && j.status !== 'blocked' && j.status !== 'cancelled') warnings.push(`${j.number} “${j.title}” has no total amount yet.`);
  }

  // Team splits.
  const splits = new Map<string, TrackerSplit>();
  const people: string[] = [];
  const des = findSheet(sheets, 'Payment Designation');
  if (des) {
    const dr = findHeaderRow(des, 'Project ID');
    if (dr) {
      const dcol = columns(des, dr);
      const idCol = dcol('Project ID');
      const dedCol = dcol('Deduction %');
      const pctCols: { name: string; col: number }[] = [];
      for (const k of des.rows.get(dr)?.keys() ?? []) {
        const m = /^(.+?)\s*%$/.exec(cellText(des, dr, k).trim());
        if (m && !/deduction|check/i.test(m[1])) pctCols.push({ name: m[1].trim(), col: k });
      }
      people.push(...pctCols.map((p) => p.name));
      for (let r = dr + 1; r <= des.maxRow; r++) {
        const number = cellText(des, r, idCol).trim().toUpperCase();
        if (!/^COM-\d+$/.test(number)) continue;
        const shares = pctCols.map((p) => ({ name: p.name, pct: percent(cellText(des, r, p.col)) })).filter((s) => s.pct > 0);
        const sum = Math.round(shares.reduce((a, s) => a + s.pct, 0) * 100) / 100;
        if (shares.length && Math.abs(sum - 100) > 0.05) warnings.push(`${number}: the team split adds up to ${sum}% (row ${r}).`);
        if (splits.has(number)) {
          warnings.push(`${number} has two rows in Payment Designation (rows ${splits.get(number)!.row} and ${r}); the later one (row ${r}) is used.`);
        }
        splits.set(number, { number, deductionPct: percent(dedCol ? cellText(des, r, dedCol) : ''), shares, row: r });
      }
    }
  } else warnings.push('No “Payment Designation” sheet: jobs come in without a team split.');

  // Targets and the big-project line.
  const targets: MonthlyTarget[] = [];
  let bigProject: Cents | null = null;
  const sum = findSheet(sheets, 'Monthly Summary');
  if (sum) {
    const sr = findHeaderRow(sum, 'Month / Year');
    if (sr) {
      const scol = columns(sum, sr);
      const mCol = scol('Month / Year');
      const lo = scol('Target Low');
      const hi = scol('Target High');
      for (let r = sr + 1; r <= sum.maxRow; r++) {
        const month = excelDate(cellText(sum, r, mCol)).slice(0, 7);
        const low = lo ? money(cellText(sum, r, lo)) : 0;
        const high = hi ? money(cellText(sum, r, hi)) : 0;
        if (month && (low || high)) targets.push({ month, low, high: Math.max(high, low) });
      }
    }
    for (let r = 1; r < (sr || 5); r++)
      for (const k of sum.rows.get(r)?.keys() ?? [])
        if (/big project/i.test(cellText(sum, r, k))) {
          for (let k2 = k + 1; k2 <= k + 4; k2++) {
            const v = money(cellText(sum, r, k2));
            if (v > 0) {
              bigProject = v;
              break;
            }
          }
        }
  }

  // BIR settings.
  const bir: Partial<BirSettings> = {};
  const b = findSheet(sheets, 'BIR');
  if (b) {
    for (let r = 1; r <= Math.min(b.maxRow, 20); r++) {
      const label = cellText(b, r, 1).toLowerCase();
      const v = cellText(b, r, 2);
      if (label.startsWith('bir start date')) bir.startDate = excelDate(v) || undefined;
      else if (label.startsWith('income tax rate')) bir.eightPct = Math.abs(percent(v) - 8) < 0.01;
      else if (label.startsWith('tax-free')) bir.exemption = money(v) || undefined;
      else if (label.startsWith('non-vat')) bir.vatCeiling = money(v) || undefined;
    }
    for (const k of Object.keys(bir) as (keyof BirSettings)[]) if (bir[k] === undefined) delete bir[k];
  }

  return { jobs, splits, people, targets, bigProject, bir, warnings };
}

/** The payments a tracker row stands for, with the best date the sheet gives. */
export function trackerPayments(j: TrackerJob, today: string): { key: 'initial' | 'final'; amount: Cents; date: string; guessed: boolean }[] {
  const out: { key: 'initial' | 'final'; amount: Cents; date: string; guessed: boolean }[] = [];
  if (j.initial > 0) {
    const date = j.initialOn || j.startDate || j.createdOn;
    out.push({ key: 'initial', amount: j.initial, date: date || today, guessed: !j.initialOn });
  }
  if (j.final > 0) {
    const date = j.finalOn || j.completedOn || j.dueDate || j.startDate || j.createdOn;
    out.push({ key: 'final', amount: j.final, date: date || today, guessed: !j.finalOn });
  }
  return out;
}
