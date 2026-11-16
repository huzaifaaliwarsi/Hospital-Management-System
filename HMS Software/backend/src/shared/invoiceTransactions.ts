/** Read-only projection: never post financial entries from display rows. */
const hospitalDay = (date: Date) => new Date(date.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
type Receipt = { id: string; receiptNumber: string; amount: unknown; collectedAt: Date; isReversed: boolean; method: string; paymentAccount: string | null; collectedBy: { username: string } | null };
type Invoice = { id: string; createdAt: Date; total: unknown; subtotal: unknown; discountTotal: unknown; paymentReceipts: Receipt[] };

export function invoiceTransactions<T extends Invoice>(invoices: T[]) {
  return invoices.flatMap(invoice => {
    const receipts = [...invoice.paymentReceipts].sort((a, b) => a.collectedAt.getTime() - b.collectedAt.getTime() || a.receiptNumber.localeCompare(b.receiptNumber, undefined, { numeric: true }) || a.id.localeCompare(b.id));
    // Legacy records have no initial-receipt flag. Only the first positive receipt
    // on the invoice's hospital calendar day belongs in the original row.
    const first = receipts.find(r => Number(r.amount) > 0);
    const initial = first && hospitalDay(first.collectedAt) === hospitalDay(invoice.createdAt) ? first : undefined;
    const row = (receipt?: Receipt, original = false) => ({
      ...invoice,
      transactionId: original ? `invoice:${invoice.id}` : `receipt:${receipt!.id}`,
      transactionType: original ? 'Original Invoice' : Number(receipt!.amount) < 0 ? 'Refund / Reversal' : receipt!.isReversed ? 'Reversed Receipt' : 'Remaining Collection',
      transactionAt: original ? invoice.createdAt : receipt!.collectedAt,
      billingAmount: original ? Number(invoice.total) : 0,
      grossAmount: original ? Number(invoice.subtotal) : 0,
      discountAmount: original ? Number(invoice.discountTotal) : 0,
      collectedAmount: receipt && (!receipt.isReversed || Number(receipt.amount) < 0) ? Number(receipt.amount) : 0,
      transactionReceipt: receipt ?? null,
    });
    return [row(initial, true), ...receipts.filter(r => r.id !== initial?.id).map(r => row(r))];
  }).sort((a, b) => b.transactionAt.getTime() - a.transactionAt.getTime() || a.transactionId.localeCompare(b.transactionId));
}
