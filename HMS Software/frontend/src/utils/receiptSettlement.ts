type Receipt = { id?: string; receiptNumber?: string; amount: number | string; isReversed?: boolean };

/** A reprint must stop at the chosen installment, not use today's invoice balance. */
export function receiptSettlement(receipts: Receipt[], receipt: Receipt | undefined, payable: number) {
  if (!receipt) return null;
  const index = receipts.findIndex(r => (receipt.id && r.id === receipt.id) || (receipt.receiptNumber && r.receiptNumber === receipt.receiptNumber));
  if (index < 0) return null;
  const cents = (rows: Receipt[]) => rows.reduce((sum, r) => r.isReversed && Number(r.amount) >= 0 ? sum : sum + Math.round(Number(r.amount) * 100), 0);
  const previouslyPaid = cents(receipts.slice(0, index)) / 100;
  const paid = cents(receipts.slice(0, index + 1)) / 100;
  return { previouslyPaid, paid, outstanding: Math.max(0, Math.round(payable * 100) - Math.round(paid * 100)) / 100 };
}
