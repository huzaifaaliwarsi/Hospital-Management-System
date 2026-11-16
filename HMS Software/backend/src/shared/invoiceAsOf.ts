import { Decimal } from '@prisma/client/runtime/library';
import { invoiceBalance, signedReceiptWhere } from './departmentCollections';
import { invoicePaymentStatus } from './invoicePaymentStatus';

/** Receipt dates, never today's cached invoice paidTotal, determine a cutoff balance. */
export const receiptsThrough = (end: Date) => ({
  where: { ...signedReceiptWhere, collectedAt: { lte: end } },
  select: { amount: true, collectedAt: true },
});
export const remittancesThrough = (end: Date) => ({
  where: { panelRemittance: { receivedAt: { lte: end } } },
  select: { allocatedAmount: true },
});
export function invoiceAsOf<T extends {
  total: Decimal; panelReceivable?: Decimal; status: string;
  paymentReceipts: { amount: Decimal }[];
  panelRemittanceAllocations?: { allocatedAmount: Decimal }[];
}>(invoice: T) {
  const paidTotal = invoice.paymentReceipts.reduce((sum, receipt) => sum.plus(receipt.amount), new Decimal(0));
  const status = invoice.status === 'VOID' ? 'VOID' : invoicePaymentStatus(invoice.total.minus(invoice.panelReceivable ?? 0), paidTotal);
  return { ...invoice, paidTotal, status, balance: invoiceBalance({ ...invoice, paidTotal }) };
}
