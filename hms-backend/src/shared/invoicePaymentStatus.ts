import { Decimal } from '@prisma/client/runtime/library';

export function invoicePaymentStatus(total: Decimal, paidTotal: Decimal) {
  return paidTotal.greaterThanOrEqualTo(total) ? 'PAID' as const
    : paidTotal.greaterThan(0) ? 'PARTIALLY_PAID' as const : 'UNPAID' as const;
}
