export interface CsvOrder {
  id?: string; receipt: string; kind: string; item: string; amount_minor: number; tax_minor: number; currency: string; status: string;
  created_at: string; paid_at: string | null; refunded_minor: number;
}

/** One CSV cell. Quotes when needed, and stops a spreadsheet running text that starts with = + - @ as a formula. */
export const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const major = (minor: number) => (minor / 100).toFixed(2);

/** The person's own payments as CSV, optionally limited to a date range (inclusive, yyyy-mm-dd). */
export function paymentsCsv(orders: CsvOrder[], from?: string, to?: string, invoiceNos: Record<string, string> = {}) {
  const rows = orders.filter((o) => {
    const d = day(o.paid_at || o.created_at);
    return (!from || d >= from) && (!to || d <= to);
  });
  const head = ['Date', 'Receipt', 'Invoice', 'Item', 'Type', 'Status', 'Currency', 'Amount before tax', 'Tax', 'Total paid', 'Refunded'];
  const lines = rows.map((o) => [
    day(o.paid_at || o.created_at), o.receipt, (o.id && invoiceNos[o.id]) || '', o.item, o.kind, o.status, o.currency,
    major(o.amount_minor - o.tax_minor), major(o.tax_minor), major(o.amount_minor), major(o.refunded_minor),
  ].map(csvCell).join(','));
  return { count: rows.length, text: [head.join(','), ...lines].join('\r\n') + '\r\n' };
}
