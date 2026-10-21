import { useMemo } from 'react';
import { useInvoices, usePayments } from './data';
import { invoiceTotals } from '../domain/money';
import { todayISO } from '../lib/time';
import type { Payment } from '../db/types';

/** Invoice totals, keyed by invoice, using each job's payments. */
export function useInvoiceRows() {
  const invoices = useInvoices();
  const payments = usePayments();
  return useMemo(() => {
    if (!invoices || !payments) return null;
    const today = todayISO();
    const byJob = new Map<string, Payment[]>();
    for (const p of payments) if (p.jobId) byJob.set(p.jobId, [...(byJob.get(p.jobId) ?? []), p]);
    return invoices.map((inv) => ({ inv, t: invoiceTotals(inv, inv.jobId ? (byJob.get(inv.jobId) ?? []) : [], today) }));
  }, [invoices, payments]);
}
