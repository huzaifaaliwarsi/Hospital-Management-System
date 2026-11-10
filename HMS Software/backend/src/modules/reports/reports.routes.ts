import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { dashboardController } from './dashboard.controller';
import { getSuperAdminDashboardQuerySchema } from './dashboard.schemas';
import { frontdeskReportsController as fd } from './frontdeskReports.controller';
import * as fds from './frontdeskReports.schemas';
import { admissionReportsController as adm } from './admissionReports.controller';
import * as ads from './admissionReports.schemas';
import { admissionPharmacyReportsController as admPharm } from './admissionPharmacyReports.controller';
import * as apds from './admissionPharmacyReports.schemas';
import { managementReportsController as mgmt } from './managementReports.controller';
import * as mgs from './managementReports.schemas';
import { inventoryReportsController as inv } from './inventoryReports.controller';
import * as invs from './inventoryReports.schemas';

const router = Router();
const view = authorize('reports', 'view');
const viewManagement = authorize('management-reports', 'view');

// Super Admin executive overview dashboard aggregation
router.get(
  '/dashboard/super-admin',
  view,
  validate({ query: getSuperAdminDashboardQuerySchema }),
  asyncHandler(dashboardController.getSuperAdminDashboard),
);

router.get(
  '/frontdesk-billing',
  view,
  validate({ query: fds.billingSummaryQuerySchema }),
  asyncHandler(dashboardController.getFrontDeskBillingReport),
);

// ── Front Desk / Billing Reports (Reporting Guide v7.5 §3–4) ──────────────
router.get('/frontdesk/encounters', view, validate({ query: fds.encounterRegisterQuerySchema }), asyncHandler(fd.encounterRegister));
router.get('/frontdesk/invoices', view, validate({ query: fds.invoiceRegisterQuerySchema }), asyncHandler(fd.invoiceRegister));
router.get('/frontdesk/collections', view, validate({ query: fds.collectionReportQuerySchema }), asyncHandler(fd.collectionReport));
router.get('/frontdesk/outstanding', view, validate({ query: fds.outstandingInvoicesQuerySchema }), asyncHandler(fd.outstandingInvoices));
router.get('/frontdesk/discounts', view, validate({ query: fds.discountReportQuerySchema }), asyncHandler(fd.discountReport));
router.get('/frontdesk/refunds-voids', view, validate({ query: fds.refundVoidReportQuerySchema }), asyncHandler(fd.refundVoidReport));
router.get('/frontdesk/department-revenue', view, validate({ query: fds.departmentRevenueQuerySchema }), asyncHandler(fd.departmentRevenue));
router.get(
  '/frontdesk/admission-payment-collections',
  view,
  validate({ query: fds.admissionPaymentCollectionQuerySchema }),
  asyncHandler(fd.admissionPaymentCollection),
);
router.get('/frontdesk/invoices/:invoiceId/ledger', view, validate({ params: fds.invoiceLedgerParamsSchema }), asyncHandler(fd.invoiceLedger));
router.get('/frontdesk/panel-payer', view, validate({ query: fds.panelPayerReportQuerySchema }), asyncHandler(fd.panelPayerReport));
router.get('/frontdesk/receipt-exceptions', view, validate({ query: fds.receiptExceptionLogQuerySchema }), asyncHandler(fd.receiptExceptionLog));
router.get('/frontdesk/cashier-performance', view, validate({ query: fds.cashierPerformanceQuerySchema }), asyncHandler(fd.cashierPerformance));
router.get('/frontdesk/exceptions', view, validate({ query: fds.financialExceptionsQuerySchema }), asyncHandler(fd.financialExceptions));
router.get('/frontdesk/filter-options', view, asyncHandler(fd.filterOptions));

// ── Admission Reports (Reporting Guide v7.5 §5) ────────────────────────────
router.get('/admission/daily-summary', view, validate({ query: ads.admissionDailySummaryQuerySchema }), asyncHandler(adm.dailySummary));
router.get('/admission/register', view, validate({ query: ads.admissionRegisterQuerySchema }), asyncHandler(adm.register));
router.get('/admission/census', view, validate({ query: ads.inpatientCensusQuerySchema }), asyncHandler(adm.census));
router.get('/admission/bed-occupancy', view, validate({ query: ads.bedOccupancyQuerySchema }), asyncHandler(adm.bedOccupancy));
router.get('/admission/bed-transfers', view, validate({ query: ads.bedTransferHistoryQuerySchema }), asyncHandler(adm.bedTransferHistory));
router.get('/admission/length-of-stay', view, validate({ query: ads.lengthOfStayQuerySchema }), asyncHandler(adm.lengthOfStay));
router.get(
  '/admission/:admissionRecordId/running-bill',
  view,
  validate({ params: ads.admissionRecordIdParamsSchema }),
  asyncHandler(adm.runningHospitalBill),
);
router.get('/admission/service-consumption', view, validate({ query: ads.serviceConsumptionQuerySchema }), asyncHandler(adm.serviceConsumption));
router.get('/admission/outstanding', view, validate({ query: ads.inpatientOutstandingQuerySchema }), asyncHandler(adm.inpatientOutstanding));
router.get('/admission/discharge-clearance', view, validate({ query: ads.dischargeClearanceQuerySchema }), asyncHandler(adm.dischargeClearance));
router.get('/admission/summary', view, validate({ query: ads.admissionSummaryQuerySchema }), asyncHandler(adm.summary));
router.get('/admission/census-beds', view, validate({ query: ads.censusBedQuerySchema }), asyncHandler(adm.censusBeds));
router.get('/admission/transfer-los', view, validate({ query: ads.transferLosQuerySchema }), asyncHandler(adm.transferLos));
router.get('/admission/hospital-bill-status', view, validate({ query: ads.hospitalBillStatusQuerySchema }), asyncHandler(adm.hospitalBillStatus));
router.get('/admission/pharmacy-request-fulfillment', view, validate({ query: ads.pharmacyRequestFulfillmentQuerySchema }), asyncHandler(adm.pharmacyRequestFulfillment));
router.get('/admission/filter-options', view, asyncHandler(adm.filterOptions));

// ── Admission — Pharmacy-linked Reports (Reporting Guide v7.5 §5.9–5.12) ──
router.get('/admission/pharmacy-requests', view, validate({ query: apds.pharmacyRequestReportQuerySchema }), asyncHandler(admPharm.medicineRequests));
router.get('/admission/medicine-fulfillment', view, validate({ query: apds.medicineFulfillmentQuerySchema }), asyncHandler(admPharm.medicineFulfillment));
router.get('/admission/high-value-approvals', view, validate({ query: apds.highValueApprovalQuerySchema }), asyncHandler(admPharm.highValueApproval));
router.get('/admission/pharmacy-clearance-status', view, validate({ query: apds.pharmacyClearanceStatusQuerySchema }), asyncHandler(admPharm.clearanceStatus));

// ── Admin / Super Admin management reports (reporting.md §8.3) ──────────
// #4 Admission & Bed Summary uses /admission/summary; #5 Expense Report uses /expenses.
router.get('/management/summary', viewManagement, validate({ query: mgs.managementSummaryQuerySchema }), asyncHandler(mgmt.summary));
router.get('/management/billing-collection', viewManagement, validate({ query: mgs.billingCollectionQuerySchema }), asyncHandler(mgmt.billingCollection));
router.get('/management/outstanding-panel', viewManagement, validate({ query: mgs.outstandingPanelQuerySchema }), asyncHandler(mgmt.outstandingPanel));
router.get('/management/balance-settlements', viewManagement, validate({ query: mgs.balanceSettlementsQuerySchema }), asyncHandler(mgmt.balanceSettlements));
router.get('/management/staff-payroll-commission', viewManagement, validate({ query: mgs.staffPayrollQuerySchema }), asyncHandler(mgmt.staffPayrollCommission));
router.get('/management/inventory-pharmacy', viewManagement, validate({ query: mgs.inventoryPharmacyQuerySchema }), asyncHandler(mgmt.inventoryPharmacy));
router.get('/management/filter-options', viewManagement, asyncHandler(mgmt.filterOptions));

// ── Inventory Reports (inventory.md §7/§8, §9 step 7) ──────────────────
router.get('/inventory/summary', view, validate({ query: invs.inventorySummaryQuerySchema }), asyncHandler(inv.summary));
router.get('/inventory/stock-movement', view, validate({ query: invs.stockMovementReportQuerySchema }), asyncHandler(inv.stockMovement));
router.get('/inventory/purchases', view, validate({ query: invs.purchaseReportQuerySchema }), asyncHandler(inv.purchases));
router.get(
  '/inventory/department-issue-return',
  view,
  validate({ query: invs.departmentIssueReturnReportQuerySchema }),
  asyncHandler(inv.departmentIssueReturn),
);
router.get('/inventory/suppliers', view, validate({ query: invs.supplierReportQuerySchema }), asyncHandler(inv.supplierReport));
router.get('/inventory/expenses', view, validate({ query: invs.inventoryExpenseReportQuerySchema }), asyncHandler(inv.expenseReport));
router.get('/inventory/stock-status', view, validate({ query: invs.stockStatusReportQuerySchema }), asyncHandler(inv.stockStatus));
router.get('/inventory/cash-settlement', view, validate({ query: invs.cashSettlementReportQuerySchema }), asyncHandler(inv.cashSettlement));

router.get('/_scaffold', (_req, res) => {
  res.json({ data: { module: 'reports', status: 'scaffolded' } });
});

export default router;

