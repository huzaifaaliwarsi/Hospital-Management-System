import { expect, it } from 'vitest';
import { receiptSettlement } from '../../frontend/src/utils/receiptSettlement';
it('reprints the first installment after clearance without borrowing later receipts', () => {
  const receipts = [{ id: 'first', amount: 500 }, { id: 'second', amount: 500 }];
  expect(receiptSettlement(receipts, receipts[0], 1000)).toEqual({ previouslyPaid: 0, paid: 500, outstanding: 500 });
  expect(receiptSettlement(receipts, receipts[1], 1000)).toEqual({ previouslyPaid: 500, paid: 1000, outstanding: 0 });
});
it('includes signed refunds once and excludes voided positive receipts', () => {
  const receipts = [{ id: 'a', amount: 1000 }, { id: 'void', amount: 500, isReversed: true }, { id: 'refund', amount: -100, isReversed: true }, { id: 'last', amount: 50 }];
  expect(receiptSettlement(receipts, receipts[3], 1000)).toEqual({ previouslyPaid: 900, paid: 950, outstanding: 50 });
});
