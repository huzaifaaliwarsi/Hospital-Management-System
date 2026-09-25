import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';

export const cashService = {
  /**
   * Cashier Balance Sheet — §4.9, §8.12, D04 p.2–3
   * Computes opening float, cash collections, non-cash collections, refunds,
   * and net expected physical cash for the logged-in cashier.
   */
  async getCashierBalanceSheet(portalUserId: string) {
    // Query unsettled cash balance entries for this cashier, plus their
    // current carry-forward liability (Balance Sheet & Account Settlement
    // Guide §5.1) — the most recent non-reversed settlement's
    // `carryForwardAmount`, same lookup `settlementService.submitSettlement`
    // uses to compute the next settlement's expected cash.
    const [transactions, previousSettlement] = await Promise.all([
      prisma.userCashBalance.findMany({
        where: {
          portalUserId,
          isSettled: false,
        },
        include: {
          paymentReceipt: {
            include: {
              hospitalInvoice: {
                select: { invoiceNumber: true, status: true },
              },
            },
          },
        },
        orderBy: { occurredAt: 'desc' },
      }),
      prisma.accountSettlement.findFirst({
        where: { portalUserId, moduleScope: 'BILLING', status: { not: 'REVERSED' } },
        orderBy: { createdAt: 'desc' },
        select: { carryForwardAmount: true },
      }),
    ]);

    let physicalCashIn = new Decimal(0);
    let physicalCashOut = new Decimal(0);
    let nonPhysicalTotal = new Decimal(0);
    let totalCollections = new Decimal(0);
    let totalRefunds = new Decimal(0);

    for (const tx of transactions) {
      if (tx.isPhysicalCash) {
        if (tx.direction === 'IN') {
          physicalCashIn = physicalCashIn.plus(tx.amount);
          if (tx.category === 'COLLECTION') totalCollections = totalCollections.plus(tx.amount);
        } else {
          physicalCashOut = physicalCashOut.plus(tx.amount);
          if (tx.category === 'REFUND') totalRefunds = totalRefunds.plus(tx.amount);
        }
      } else {
        // Digital (Card/Bank/Online): tracked separately without inflating physical cash
        nonPhysicalTotal = nonPhysicalTotal.plus(tx.amount);
        if (tx.category === 'COLLECTION') totalCollections = totalCollections.plus(tx.amount);
        else if (tx.category === 'REFUND') totalRefunds = totalRefunds.plus(tx.amount);
      }
    }

    const carriedForwardAmount = previousSettlement?.carryForwardAmount ?? new Decimal(0);
    const expectedPhysicalCash = physicalCashIn.minus(physicalCashOut).plus(carriedForwardAmount);

    return {
      portalUserId,
      summary: {
        expectedPhysicalCash,
        carriedForwardAmount,
        physicalCashIn,
        physicalCashOut,
        nonPhysicalTotal,
        totalCollections,
        totalRefunds,
        unsettledCount: transactions.length,
      },
      transactions: transactions.map((t) => ({
        id: t.id,
        direction: t.direction,
        amount: t.amount,
        category: t.category,
        isPhysicalCash: t.isPhysicalCash,
        occurredAt: t.occurredAt,
        receiptNumber: t.paymentReceipt?.receiptNumber ?? null,
        invoiceNumber: t.paymentReceipt?.hospitalInvoice?.invoiceNumber ?? null,
        paymentMethod: t.paymentReceipt?.method ?? (t.isPhysicalCash ? 'CASH' : 'NON_CASH'),
      })),
    };
  },
};
