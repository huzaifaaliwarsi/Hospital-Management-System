import { Decimal } from '@prisma/client/runtime/library';

/** All consumers use the original rule snapshot, never today's edited rule. */
export function commissionBalance(row: {
  commissionAmount: Decimal;
  ruleSnapshot: unknown;
  reversals: { reversalAmount: Decimal; source?: string }[];
  payouts: { amount: Decimal }[];
  adjustments?: { amount: Decimal }[];
}) {
  const snapshot = (row.ruleSnapshot ?? {}) as Record<string, unknown>;
  const gross = row.commissionAmount;
  const priceChanges = row.reversals.filter(r => r.source === 'SERVICE_REPRICE').reduce((s, r) => s.plus(r.reversalAmount), new Decimal(0));
  const serviceGross = Decimal.max(gross.minus(priceChanges), 0);
  const refunds = Decimal.min(serviceGross, row.reversals.filter(r => r.source !== 'SERVICE_REPRICE').reduce((s, r) => s.plus(r.reversalAmount), new Decimal(0)));
  const reversed = priceChanges.plus(refunds);
  const earned = serviceGross.minus(refunds);
  const originalTax = new Decimal(String(snapshot.commissionTaxAmount ?? 0));
  // A reversal reverses its share of the original withholding as well.
  const serviceTax = snapshot.commissionTaxMethod === 'PERCENTAGE'
    ? serviceGross.mul(String(snapshot.commissionTaxValue ?? 0)).div(100)
    : Decimal.min(serviceGross, originalTax);
  const tax = serviceGross.gt(0) ? serviceTax.mul(earned).div(serviceGross).toDecimalPlaces(2) : new Decimal(0);
  const adjustments = (row.adjustments ?? []).reduce((s, r) => s.plus(r.amount), new Decimal(0));
  const payable = Decimal.max(earned.minus(tax).plus(adjustments), 0).toDecimalPlaces(2);
  const paid = row.payouts.reduce((s, p) => s.plus(p.amount), new Decimal(0));
  const remaining = Decimal.max(payable.minus(paid), 0);
  const overpaid = Decimal.max(paid.minus(payable), 0);
  return { gross, reversed, tax, adjustments, payable, paid, remaining, overpaid };
}
