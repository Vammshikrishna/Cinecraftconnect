import { formatMoney } from '@cinecraft/core';

export interface ReceiptOrder {
  id?: string; receipt: string; kind: string; item: string; amount_minor: number; tax_minor: number; currency: string; status: string;
  created_at: string; paid_at: string | null; refunded_minor: number;
}

export interface InvoiceDetails {
  invoice_no: string; issued_at: string; currency: string;
  taxable_minor: number; tax_minor: number; total_minor: number;
  tax_rate_bps: number; tax_label: string | null; sac_code: string | null;
  supplier: { legal_name?: string | null; gstin?: string | null; address?: string | null; state_code?: string | null; pan?: string | null };
  buyer: { name?: string | null; username?: string | null };
  lines: { description: string; quantity: number; amount_minor: number }[];
  credit_notes: { invoice_no: string; issued_at: string; total_minor: number }[];
}

export const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** One CSV cell. Quotes when needed, and stops a spreadsheet running text that starts with = + - @ as a formula. */
export const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const major = (minor: number) => (minor / 100).toFixed(2);

/** The person's own payments as CSV, optionally limited to a date range (inclusive, yyyy-mm-dd). */
export function paymentsCsv(orders: ReceiptOrder[], from?: string, to?: string, invoiceNos: Record<string, string> = {}) {
  const rows = orders.filter((o) => {
    const d = day(o.paid_at || o.created_at);
    return (!from || d >= from) && (!to || d <= to);
  });
  const head = ['Date', 'Receipt', 'Invoice', 'Item', 'Type', 'Status', 'Currency', 'Amount before tax', 'Tax', 'Total paid', 'Refunded'];
  const lines = rows.map((o) => [
    day(o.paid_at || o.created_at), o.receipt, (o.id && invoiceNos[o.id]) || '', o.item, o.kind, o.status, o.currency,
    major(o.amount_minor - o.tax_minor), major(o.tax_minor), major(o.amount_minor), major(o.refunded_minor),
  ].map(csvCell).join(','));
  return { count: rows.length, text: '﻿' + [head.join(','), ...lines].join('\r\n') + '\r\n' };
}

export function downloadText(name: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A clean one-page receipt / tax invoice. Every value is escaped; it is printed from a hidden frame so the app around it never prints. */
export function receiptHtml(o: ReceiptOrder, inv?: InvoiceDetails | null) {
  const cur = o.currency;
  const sup = inv?.supplier || {};
  const title = inv ? 'Tax invoice' : 'Receipt';
  const rows = inv
    ? inv.lines.map((l) => `<tr><td>${escapeHtml(l.description)}</td><td class="n">${l.quantity}</td><td class="n">${escapeHtml(formatMoney(l.amount_minor, cur))}</td></tr>`).join('')
    : `<tr><td>${escapeHtml(o.item)}</td><td class="n">1</td><td class="n">${escapeHtml(formatMoney(o.amount_minor - o.tax_minor, cur))}</td></tr>`;
  const taxable = inv ? inv.taxable_minor : o.amount_minor - o.tax_minor;
  const tax = inv ? inv.tax_minor : o.tax_minor;
  const total = inv ? inv.total_minor : o.amount_minor;
  const rate = inv && inv.tax_rate_bps > 0 ? ` (${(inv.tax_rate_bps / 100).toString()}%)` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)} ${escapeHtml(inv?.invoice_no || o.receipt)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;color:#111;margin:32px;max-width:640px}h1{font-size:22px;margin:0 0 4px}.m{color:#555;font-size:12px}
table{width:100%;border-collapse:collapse;margin:20px 0}td,th{padding:8px 4px;border-bottom:1px solid #ddd;text-align:left}.n{text-align:right;font-variant-numeric:tabular-nums}
.t td{font-weight:700;border-bottom:0}.row{display:flex;justify-content:space-between;gap:24px}</style></head><body>
<div class="row"><div><h1>${escapeHtml(title)}</h1><div class="m">${escapeHtml(inv?.invoice_no || o.receipt)} · ${escapeHtml(day(inv?.issued_at || o.paid_at || o.created_at))}</div></div>
<div class="m" style="text-align:right"><b>${escapeHtml(sup.legal_name || 'CineCraft Connect')}</b>${sup.address ? '<br>' + escapeHtml(sup.address) : ''}${sup.gstin ? '<br>GSTIN ' + escapeHtml(sup.gstin) : ''}${sup.pan ? '<br>PAN ' + escapeHtml(sup.pan) : ''}</div></div>
${inv?.buyer?.name || inv?.buyer?.username ? `<p class="m">Billed to: ${escapeHtml(inv.buyer.name || inv.buyer.username)}</p>` : ''}
<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Amount</th></tr></thead><tbody>${rows}
<tr><td colspan="2" class="n">Amount before tax</td><td class="n">${escapeHtml(formatMoney(taxable, cur))}</td></tr>
${tax > 0 ? `<tr><td colspan="2" class="n">${escapeHtml(inv?.tax_label || 'Tax')}${rate}</td><td class="n">${escapeHtml(formatMoney(tax, cur))}</td></tr>` : ''}
<tr class="t"><td colspan="2" class="n">Total paid</td><td class="n">${escapeHtml(formatMoney(total, cur))}</td></tr></tbody></table>
${inv?.sac_code ? `<p class="m">SAC ${escapeHtml(inv.sac_code)}</p>` : ''}
${o.refunded_minor > 0 ? `<p class="m">Refunded: ${escapeHtml(formatMoney(o.refunded_minor, cur))}${inv?.credit_notes?.length ? ' · Credit notes: ' + escapeHtml(inv.credit_notes.map((c) => c.invoice_no).join(', ')) : ''}</p>` : ''}
<p class="m">This is a computer-generated document.</p></body></html>`;
}

/** Print a receipt from a hidden frame (no pop-up for a blocker to stop). */
export function printReceipt(html: string) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  f.srcdoc = html;
  f.onload = () => {
    f.contentWindow?.focus();
    f.contentWindow?.print();
    setTimeout(() => f.remove(), 2000);
  };
  document.body.appendChild(f);
}
