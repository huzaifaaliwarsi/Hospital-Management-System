import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { resolveDateRange } from './dashboard.service';
import type { BillingSummaryQuery } from './frontdeskReports.schemas';
import { patientBalanceDue } from '@/shared/invoicePaymentStatus';

/**
 * Front Desk / Billing Reports (HMS_V7.2_NEW_REQUIREMENTS.md §3.3) — real
 * aggregation over `UserCashBalance` (collections/refunds, moduleScope
 * `BILLING` — same ledger every Front Desk collection/refund already
 * writes to) and `HospitalInvoice` (discounts, invoice status mix) for a
 * date range. Line-item service departments (e.g. LAB) are supported.
 */
export const frontdeskBillingReportService = {
  async getReport(query: BillingSummaryQuery) {
    const { start, end, label } = resolveDateRange(query);
    const dateFilter = { gte: start, lte: end };
    const deptId = query.departmentId;

    const invoiceDeptFilter = deptId
      ? {
          OR: [
            { departmentId: deptId },
            { lines: { some: { serviceRate: { departmentId: deptId } } } },
          ],
        }
      : {};

    const ledgerFilter = {
      ...(query.cashierId ? { portalUserId: query.cashierId } : {}),
      ...(deptId
        ? {
            paymentReceipt: {
              hospitalInvoice: invoiceDeptFilter,
            },
          }
        : {}),
    };

    const [collections, refunds, invoices] = await Promise.all([
      prisma.userCashBalance.findMany({
        where: { moduleScope: 'BILLING', category: 'COLLECTION', direction: 'IN', occurredAt: dateFilter, ...ledgerFilter },
        select: {
          amount: true,
          isPhysicalCash: true,
          paymentReceipt: {
            select: {
              method: true,
              hospitalInvoice: {
                select: {
                  id: true,
                  total: true,
                  departmentId: true,
                  lines: {
                    select: {
                      lineNet: true,
                      serviceRate: { select: { departmentId: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.userCashBalance.findMany({
        where: { moduleScope: 'BILLING', category: 'REFUND', direction: 'OUT', occurredAt: dateFilter, ...ledgerFilter },
        select: {
          amount: true,
          paymentReceipt: {
            select: {
              method: true,
              hospitalInvoice: {
                select: {
                  id: true,
                  total: true,
                  departmentId: true,
                  lines: {
                    select: {
                      lineNet: true,
                      serviceRate: { select: { departmentId: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.hospitalInvoice.findMany({
        where: {
          createdAt: dateFilter,
          status: { not: 'VOID' },
          ...(query.cashierId ? { createdById: query.cashierId } : {}),
          ...invoiceDeptFilter,
        },
        select: {
          id: true,
          status: true,
          subtotal: true,
          discountTotal: true,
          total: true,
          paidTotal: true,
          patientShare: true,
          panelPatientId: true,
          panelReceivable: true,
          departmentId: true,
          lines: {
            select: {
              lineGross: true,
              discountAmount: true,
              lineNet: true,
              serviceRate: {
                select: {
                  departmentId: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const byMethod: Record<string, Decimal> = { CASH: new Decimal(0), CARD: new Decimal(0), BANK: new Decimal(0), ONLINE: new Decimal(0) };
    let totalCollections = new Decimal(0);
    for (const c of collections) {
      const method = c.paymentReceipt?.method ?? 'CASH';
      let effAmount = c.amount;
      if (deptId && c.paymentReceipt?.hospitalInvoice) {
        const inv = c.paymentReceipt.hospitalInvoice;
        if (inv.lines && inv.lines.length > 0 && inv.total.greaterThan(0)) {
          const matchingLines = inv.lines.filter(
            (l) => l.serviceRate?.departmentId === deptId || (!l.serviceRate?.departmentId && inv.departmentId === deptId),
          );
          const deptNet = matchingLines.reduce((s, l) => s.plus(l.lineNet), new Decimal(0));
          effAmount = c.amount.times(deptNet).dividedBy(inv.total);
        }
      }
      byMethod[method] = (byMethod[method] ?? new Decimal(0)).plus(effAmount);
      totalCollections = totalCollections.plus(effAmount);
    }

    let totalRefunds = new Decimal(0);
    for (const refund of refunds) {
      const method = refund.paymentReceipt?.method ?? 'CASH';
      let effAmount = refund.amount;
      if (deptId && refund.paymentReceipt?.hospitalInvoice) {
        const inv = refund.paymentReceipt.hospitalInvoice;
        if (inv.lines && inv.lines.length > 0 && inv.total.greaterThan(0)) {
          const matchingLines = inv.lines.filter(
            (l) => l.serviceRate?.departmentId === deptId || (!l.serviceRate?.departmentId && inv.departmentId === deptId),
          );
          const deptNet = matchingLines.reduce((s, l) => s.plus(l.lineNet), new Decimal(0));
          effAmount = refund.amount.times(deptNet).dividedBy(inv.total);
        }
      }
      byMethod[method] = (byMethod[method] ?? new Decimal(0)).minus(effAmount);
      totalRefunds = totalRefunds.plus(effAmount);
    }

    let totalDiscounts = new Decimal(0);
    let totalGross = new Decimal(0);
    let totalNet = new Decimal(0);
    let totalOutstanding = new Decimal(0);

    for (const inv of invoices) {
      if (deptId && inv.lines && inv.lines.length > 0) {
        const matchingLines = inv.lines.filter(
          (l) => l.serviceRate?.departmentId === deptId || (!l.serviceRate?.departmentId && inv.departmentId === deptId),
        );
        for (const l of matchingLines) {
          totalGross = totalGross.plus(l.lineGross);
          totalDiscounts = totalDiscounts.plus(l.discountAmount);
          totalNet = totalNet.plus(l.lineNet);
          if (inv.status !== 'PAID') {
            const linePaid = inv.total.greaterThan(0) ? inv.paidTotal.times(l.lineNet).dividedBy(inv.total) : new Decimal(0);
            totalOutstanding = totalOutstanding.plus(Decimal.max(l.lineNet.minus(linePaid), 0));
          }
        }
      } else {
        totalGross = totalGross.plus(inv.subtotal);
        totalDiscounts = totalDiscounts.plus(inv.discountTotal);
        totalNet = totalNet.plus(inv.total);
        if (inv.status !== 'VOID' && inv.status !== 'PAID') {
          totalOutstanding = totalOutstanding.plus(patientBalanceDue(inv, inv.paidTotal));
        }
      }
    }

    const invoiceCountsByStatus: Record<string, number> = {};
    for (const inv of invoices) {
      invoiceCountsByStatus[inv.status] = (invoiceCountsByStatus[inv.status] ?? 0) + 1;
    }

    return {
      period: { label, start: start.toISOString(), end: end.toISOString() },
      collections: {
        total: totalCollections.minus(totalRefunds),
        byMethod,
      },
      refunds: { total: totalRefunds },
      billing: {
        invoiceCount: invoices.length,
        invoiceCountsByStatus,
        totalGross,
        totalDiscounts,
        totalNet,
        totalOutstanding,
      },
    };
  },
};
