import { Decimal } from '@prisma/client/runtime/library';

export function salaryBalance(row: { generatedAmount: Decimal; payments: { amount: Decimal }[]; correctionEntries?: { amount: Decimal }[] }) {
  const adjustments = (row.correctionEntries ?? []).reduce((s, r) => s.plus(r.amount), new Decimal(0));
  const payable = Decimal.max(row.generatedAmount.plus(adjustments), 0);
  const paid = row.payments.reduce((s, r) => s.plus(r.amount), new Decimal(0));
  return { adjustments, payable, paid, remaining: Decimal.max(payable.minus(paid), 0), overpaid: Decimal.max(paid.minus(payable), 0) };
}
