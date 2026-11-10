import React from 'react';
import { Pill, ClipboardCheck, ShieldAlert, PackageCheck, CreditCard } from 'lucide-react';
import { GenericReportView } from '../../components/reports/GenericReportView';
import { formatPKR } from '../../utils/formatters';
import {
  fetchPharmacyMedicineRequests,
  fetchMedicineFulfillment,
  fetchHighValueApprovals,
  fetchPharmacyClearanceStatus,
  PharmacyRequestRow,
  MedicineFulfillmentRow,
  HighValueApprovalRow,
  PharmacyClearanceRow,
} from '../../services/admissionPharmacyReportsService';
import { fetchAdmissionPaymentCollections, AdmissionPaymentCollectionRow } from '../../services/frontdeskReportsService';

/** Reporting Guide v7.5 §5.9 — medicines requested for inpatients and Pharmacy's returned fulfillment status. */
export const PharmacyMedicineRequestsView: React.FC = () => (
  <GenericReportView<PharmacyRequestRow>
    title="Pharmacy Medicine Requests"
    subtitle="Medicines requested for inpatients and the fulfillment status Pharmacy returned."
    icon={Pill}
    filenamePrefix="Pharmacy_Medicine_Requests"
    fetchReport={fetchPharmacyMedicineRequests}
    rowKey={(r, i) => `${r.requestRef}-${i}`}
    columns={[
      { header: 'Request Ref', cell: (r) => r.requestRef },
      { header: 'Admission #', cell: (r) => r.admissionNumber },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Medicine', cell: (r) => r.medicine },
      { header: 'Requested Qty', align: 'right', cell: (r) => String(r.requestedQty), excelValue: (r) => r.requestedQty },
      { header: 'Requested By', cell: (r) => r.requestedBy },
      { header: 'Requested At', cell: (r) => r.requestedAt },
      { header: 'Dispensed Qty', align: 'right', cell: (r) => String(r.dispensedQty), excelValue: (r) => r.dispensedQty },
      { header: 'Status', cell: (r) => r.status },
    ]}
  />
);

/** Reporting Guide v7.5 §5.10 — requested vs actual Pharmacy fulfillment quantities. */
export const MedicineFulfillmentReportView: React.FC = () => (
  <GenericReportView<MedicineFulfillmentRow>
    title="Medicine Request Fulfillment"
    subtitle="Requested vs actually dispensed medicine quantities."
    icon={ClipboardCheck}
    filenamePrefix="Medicine_Fulfillment"
    fetchReport={fetchMedicineFulfillment}
    rowKey={(r, i) => `${r.requestRef}-${i}`}
    columns={[
      { header: 'Request Ref', cell: (r) => r.requestRef },
      { header: 'Medicine', cell: (r) => r.medicine },
      { header: 'Requested Qty', align: 'right', cell: (r) => String(r.requestedQty), excelValue: (r) => r.requestedQty },
      { header: 'Dispensed Qty', align: 'right', cell: (r) => String(r.dispensedQty), excelValue: (r) => r.dispensedQty },
      { header: 'Unfulfilled Qty', align: 'right', cell: (r) => String(r.unfulfilledQty), excelValue: (r) => r.unfulfilledQty },
      { header: 'Fulfillment %', align: 'right', cell: (r) => `${r.fulfillmentPercent}%`, excelValue: (r) => r.fulfillmentPercent },
      { header: 'Status', cell: (r) => r.status },
      { header: 'Dispensed At', cell: (r) => r.dispensedAt || '—' },
    ]}
  />
);

/** Reporting Guide v7.5 §5.11 — linked Pharmacy requests requiring configured high-value authorization before dispense. */
export const HighValueApprovalReportView: React.FC = () => (
  <GenericReportView<HighValueApprovalRow>
    title="High-Value Medicine Approval Visibility"
    subtitle="Pharmacy requests requiring configured high-value authorization before dispense."
    icon={ShieldAlert}
    filenamePrefix="High_Value_Medicine_Approvals"
    fetchReport={fetchHighValueApprovals}
    rowKey={(r, i) => `${r.requestRef}-${i}`}
    columns={[
      { header: 'Request Ref', cell: (r) => r.requestRef },
      { header: 'Admission #', cell: (r) => r.admissionNumber },
      { header: 'Medicine', cell: (r) => r.medicine },
      { header: 'Charge Amount', align: 'right', cell: (r) => formatPKR(r.chargeAmount), excelValue: (r) => r.chargeAmount },
      { header: 'Approval Status', cell: (r) => r.approvalStatus },
      { header: 'Approved By', cell: (r) => r.approvedBy || '—' },
      { header: 'Approved At', cell: (r) => r.approvedAt || '—' },
      { header: 'Dispense Status', cell: (r) => r.dispenseStatus },
    ]}
  />
);

/** Reporting Guide v7.5 §5.12 — read-only Admission view of linked Pharmacy financial/fulfillment clearance for discharge. */
export const PharmacyClearanceStatusView: React.FC = () => (
  <GenericReportView<PharmacyClearanceRow>
    title="Pharmacy Clearance Status"
    subtitle="Read-only view of linked Pharmacy financial/fulfillment clearance required for discharge."
    icon={PackageCheck}
    filenamePrefix="Pharmacy_Clearance_Status"
    fetchReport={fetchPharmacyClearanceStatus}
    rowKey={(r, i) => `${r.admissionNumber}-${i}`}
    columns={[
      { header: 'Admission #', cell: (r) => r.admissionNumber },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Pharmacy Invoice Ref', cell: (r) => r.pharmacyInvoiceRef },
      { header: 'Charge Summary', cell: (r) => r.chargeSummary },
      { header: 'Clearance Status', cell: (r) => r.clearanceStatus },
      { header: 'Updated At', cell: (r) => r.updatedAt },
      { header: 'Pharmacy Actor', cell: (r) => r.pharmacyActor || '—' },
    ]}
  />
);

/**
 * Reporting Guide v7.5 §5.8 — Admission's read-only view of payment
 * requests it raised and the receipts Billing returned. Same underlying
 * data as Front Desk's §3.6 "Admission Hospital Payment Collection Report"
 * (`fetchAdmissionPaymentCollections`) — Billing is the source of truth for
 * collection, Admission only ever reads the synced status.
 */
export const AdmissionPaymentRequestStatusView: React.FC = () => (
  <GenericReportView<AdmissionPaymentCollectionRow>
    title="Hospital Payment Request & Status"
    subtitle="Payment requests raised to Front Desk / Billing and the receipts returned — read-only."
    icon={CreditCard}
    filenamePrefix="Payment_Request_Status"
    fetchReport={fetchAdmissionPaymentCollections}
    rowKey={(r, i) => `${r.admissionNumber}-${r.receiptNo || i}`}
    columns={[
      { header: 'Admission #', cell: (r) => r.admissionNumber },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Requested Amount', align: 'right', cell: (r) => formatPKR(r.requestedAmount), excelValue: (r) => r.requestedAmount },
      { header: 'Receipt #', cell: (r) => r.receiptNo || '—' },
      { header: 'Collected Amount', align: 'right', cell: (r) => formatPKR(r.collectedAmount), excelValue: (r) => r.collectedAmount },
      { header: 'Method', cell: (r) => r.method || '—' },
      { header: 'Collected By', cell: (r) => r.collectedBy || '—' },
      { header: 'Status', cell: (r) => r.status },
    ]}
  />
);
