export function originalInvoiceForAction<T extends { id: string; invoiceId?: string }>(row: T) {
  return { ...row, id: row.invoiceId || row.id };
}

export function summarizeInvoiceTransactions(rows: { invoiceId: string; transactionType: string; billingAmount: unknown; collectedAmount: unknown; outstanding: unknown }[]) {
  const seen = new Set<string>();
  let billing = 0, collected = 0, outstanding = 0, invoices = 0;
  for (const row of rows) {
    billing += Math.round(Number(row.billingAmount || 0) * 100);
    collected += Math.round(Number(row.collectedAmount || 0) * 100);
    if (!seen.has(row.invoiceId)) outstanding += Math.round(Number(row.outstanding || 0) * 100);
    seen.add(row.invoiceId);
    if (row.transactionType === 'Original Sale') invoices++;
  }
  return { billing: billing / 100, collected: collected / 100, outstanding: outstanding / 100, invoices };
}

export function tableExportHtml(columns: { key: string; header: string }[], rows: Record<string, unknown>[], title: string) {
  const escape = (v: unknown) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const visible = columns.filter(c => c.key !== 'actions');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>body{font:11px sans-serif}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:5px;overflow-wrap:anywhere}thead{display:table-header-group}@page{size:landscape;margin:10mm}</style></head><body><h2>${escape(title)}</h2><table><thead><tr>${visible.map(c => `<th>${escape(c.header)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${visible.map(c => `<td>${escape(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}
