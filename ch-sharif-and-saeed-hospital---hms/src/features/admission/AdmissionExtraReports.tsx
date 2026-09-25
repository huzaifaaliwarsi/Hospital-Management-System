import React, { useState } from 'react';
import { LayoutDashboard, ClipboardList, Users, Bed, ArrowLeftRight, Clock, Boxes, AlertCircle, ShieldCheck, Eye, Loader2 } from 'lucide-react';
import { GenericReportView } from '../../components/reports/GenericReportView';
import { Modal } from '../../components/common/Modal';
import { formatPKR } from '../../utils/formatters';
import {
  fetchAdmissionDailySummary,
  fetchAdmissionRegister,
  fetchInpatientCensus,
  fetchBedOccupancy,
  fetchBedTransferHistory,
  fetchLengthOfStay,
  fetchServiceConsumption,
  fetchInpatientOutstanding,
  fetchDischargeClearance,
  fetchRunningHospitalBill,
  AdmissionRegisterRow,
  CensusRow,
  BedOccupancyRow,
  BedTransferRow,
  LengthOfStayRow,
  ServiceConsumptionRow,
  InpatientOutstandingRow,
  DischargeClearanceRow,
} from '../../services/admissionReportsService';

/** Reporting Guide v7.5 §5.1 — daily operational snapshot of inpatient activity. */
export const AdmissionDailySummaryView: React.FC = () => (
  <GenericReportView<{ metric: string; value: string }>
    title="Admission Daily Summary"
    subtitle="Daily operational snapshot of inpatient activity and discharge readiness."
    icon={LayoutDashboard}
    filenamePrefix="Admission_Daily_Summary"
    fetchReport={fetchAdmissionDailySummary}
    rowKey={(r) => r.metric}
    columns={[
      { header: 'Metric', cell: (r) => r.metric },
      { header: 'Value', align: 'right', cell: (r) => r.value },
    ]}
  />
);

/** Reporting Guide v7.5 §5.2 — master admission register, date-filterable. Each row can drill into its Running Hospital Bill (§5.7). */
export const AdmissionRegisterReportView: React.FC = () => {
  const [billTarget, setBillTarget] = useState<{ id: string; number: string } | null>(null);
  const [bill, setBill] = useState<Awaited<ReturnType<typeof fetchRunningHospitalBill>> | null>(null);
  const [isBillLoading, setIsBillLoading] = useState(false);

  const openBill = async (id: string, number: string) => {
    setBillTarget({ id, number });
    setIsBillLoading(true);
    try {
      setBill(await fetchRunningHospitalBill(id));
    } catch {
      setBill(null);
    } finally {
      setIsBillLoading(false);
    }
  };

  return (
    <>
      <GenericReportView<AdmissionRegisterRow>
        title="Admission Register"
        subtitle="Master transactional report of admissions and discharge status."
        icon={ClipboardList}
        filenamePrefix="Admission_Register"
        fetchReport={fetchAdmissionRegister}
        rowKey={(r, i) => `${r.admissionNumber}-${i}`}
        columns={[
          { header: 'Admission #', cell: (r) => r.admissionNumber },
          { header: 'Patient', cell: (r) => r.patient },
          { header: 'Payer', cell: (r) => r.payer },
          { header: 'Doctor', cell: (r) => r.doctor || '—' },
          { header: 'Department', cell: (r) => r.department },
          { header: 'Ward', cell: (r) => r.ward || '—' },
          { header: 'Bed', cell: (r) => r.bed || '—' },
          { header: 'Admitted', cell: (r) => r.admittedAt || '—' },
          { header: 'Discharged', cell: (r) => r.dischargedAt || '—' },
          { header: 'Status', cell: (r) => r.status },
          { header: 'Created By', cell: (r) => r.createdBy || '—' },
          { header: 'Running Bill', cell: () => 'View' },
        ]}
        renderCell={(col, row) =>
          col.header === 'Running Bill' ? (
            <button
              type="button"
              onClick={() => openBill(row.id, row.admissionNumber)}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[#08775A] hover:bg-[#065f46] text-white rounded text-xs font-medium shadow-2xs transition-colors"
              title="View running Hospital bill"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View</span>
            </button>
          ) : (
            col.cell(row)
          )
        }
      />

      <Modal
        isOpen={!!billTarget}
        onClose={() => {
          setBillTarget(null);
          setBill(null);
        }}
        title={billTarget ? `Running Hospital Bill — ${billTarget.number}` : ''}
        subtitle="Hospital-side charges only (Room/Bed, services, procedures, diagnostics) — Pharmacy Bill is a separate stream."
        maxWidth="2xl"
      >
        {isBillLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : bill ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-medium block">Hospital Subtotal</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{formatPKR(bill.summary.hospitalSubtotal)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-medium block">Discount</span>
                <span className="text-sm font-bold text-rose-700 font-mono">{formatPKR(bill.summary.hospitalDiscount)}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-medium block">Payments Received</span>
                <span className="text-sm font-bold text-emerald-800 font-mono">{formatPKR(bill.summary.hospitalPaymentsReceived)}</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-[10px] text-amber-700 font-medium block">Outstanding</span>
                <span className="text-sm font-bold text-amber-800 font-mono">{formatPKR(bill.summary.hospitalOutstanding)}</span>
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3 font-semibold">Date</th>
                    <th className="py-2 px-3 font-semibold">Charge Ref</th>
                    <th className="py-2 px-3 font-semibold">Service</th>
                    <th className="py-2 px-3 font-semibold text-right">Qty</th>
                    <th className="py-2 px-3 font-semibold text-right">Net</th>
                    <th className="py-2 px-3 font-semibold text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bill.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No Hospital charges posted yet.
                      </td>
                    </tr>
                  ) : (
                    bill.rows.map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2 px-3 text-slate-500">{r.occurredAt}</td>
                        <td className="py-2 px-3 font-mono text-emerald-800">{r.chargeRef}</td>
                        <td className="py-2 px-3">{r.service}</td>
                        <td className="py-2 px-3 text-right font-mono">{r.qty}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{formatPKR(r.net)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatPKR(r.runningBalance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-rose-600">Failed to load running bill.</div>
        )}
      </Modal>
    </>
  );
};

/** Reporting Guide v7.5 §5.3 — point-in-time census for active inpatients. */
export const InpatientCensusReportView: React.FC = () => (
  <GenericReportView<CensusRow>
    title="Inpatient Census"
    subtitle="Point-in-time census with ward/bed and financial attention indicators."
    icon={Users}
    filenamePrefix="Inpatient_Census"
    noDateFilter
    fetchReport={() => fetchInpatientCensus()}
    rowKey={(r) => r.admissionNumber}
    columns={[
      { header: 'Admission #', cell: (r) => r.admissionNumber },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Doctor', cell: (r) => r.doctor || '—' },
      { header: 'Department', cell: (r) => r.department },
      { header: 'Ward', cell: (r) => r.ward || '—' },
      { header: 'Bed', cell: (r) => r.bed || '—' },
      { header: 'Admitted', cell: (r) => r.admittedAt },
      { header: 'Hospital Due', align: 'right', cell: (r) => formatPKR(r.hospitalDue), excelValue: (r) => r.hospitalDue },
      { header: 'Pharmacy Clearance', cell: (r) => r.pharmacyClearance },
      { header: 'Discharge Ready', cell: (r) => (r.dischargeReady ? 'Yes' : 'No') },
    ]}
  />
);

/** Reporting Guide v7.5 §5.4 — occupancy by ward. */
export const BedOccupancyReportView: React.FC = () => (
  <GenericReportView<BedOccupancyRow>
    title="Bed Occupancy / Ward Utilization"
    subtitle="Current occupancy and availability by ward."
    icon={Bed}
    filenamePrefix="Bed_Occupancy"
    noDateFilter
    fetchReport={() => fetchBedOccupancy()}
    rowKey={(r) => r.ward}
    columns={[
      { header: 'Ward', cell: (r) => r.ward },
      { header: 'Capacity', align: 'right', cell: (r) => String(r.capacity), excelValue: (r) => r.capacity },
      { header: 'Occupied', align: 'right', cell: (r) => String(r.occupied), excelValue: (r) => r.occupied },
      { header: 'Available', align: 'right', cell: (r) => String(r.available), excelValue: (r) => r.available },
      { header: 'Occupancy %', align: 'right', cell: (r) => `${r.occupancyPercent}%`, excelValue: (r) => r.occupancyPercent },
    ]}
  />
);

/** Reporting Guide v7.5 §5.5 — complete movement history for inpatient location changes. */
export const BedTransferHistoryReportView: React.FC = () => (
  <GenericReportView<BedTransferRow>
    title="Bed / Ward / Room Transfer History"
    subtitle="Complete, immutable movement history for inpatient location changes."
    icon={ArrowLeftRight}
    filenamePrefix="Bed_Transfer_History"
    fetchReport={fetchBedTransferHistory}
    rowKey={(r, i) => `${r.admissionNumber}-${i}`}
    columns={[
      { header: 'Admission #', cell: (r) => r.admissionNumber },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'From', cell: (r) => `${r.fromWard || '—'} / ${r.fromBed || '—'}` },
      { header: 'To', cell: (r) => `${r.toWard || '—'} / ${r.toBed}` },
      { header: 'Date/Time', cell: (r) => r.transferredAt },
      { header: 'Reason', cell: (r) => r.reason || '—' },
      { header: 'Changed By', cell: (r) => r.changedBy },
    ]}
  />
);

/** Reporting Guide v7.5 §5.6 — inpatient duration for active and discharged cases. */
export const LengthOfStayReportView: React.FC = () => (
  <GenericReportView<LengthOfStayRow>
    title="Length of Stay Report"
    subtitle="Inpatient duration for active and discharged cases."
    icon={Clock}
    filenamePrefix="Length_Of_Stay"
    fetchReport={fetchLengthOfStay}
    rowKey={(r, i) => `${r.admissionNumber}-${i}`}
    columns={[
      { header: 'Admission #', cell: (r) => r.admissionNumber },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Department', cell: (r) => r.department },
      { header: 'Admitted', cell: (r) => r.admittedAt },
      { header: 'Discharged', cell: (r) => r.dischargedAt || '—' },
      { header: 'LOS (days)', align: 'right', cell: (r) => String(r.lengthOfStayDays), excelValue: (r) => r.lengthOfStayDays },
      { header: 'Status', cell: (r) => r.status },
    ]}
  />
);

/** Reporting Guide v7.5 §5.14 — department/ward/service consumption analysis. */
export const ServiceConsumptionReportView: React.FC = () => (
  <GenericReportView<ServiceConsumptionRow>
    title="Admission Service Consumption"
    subtitle="Department/ward/service analysis of hospital-side inpatient resource consumption."
    icon={Boxes}
    filenamePrefix="Service_Consumption"
    fetchReport={fetchServiceConsumption}
    rowKey={(r, i) => `${r.department}-${r.service}-${i}`}
    columns={[
      { header: 'Department', cell: (r) => r.department },
      { header: 'Service', cell: (r) => r.service },
      { header: 'Qty', align: 'right', cell: (r) => String(r.qty), excelValue: (r) => r.qty },
      { header: 'Gross', align: 'right', cell: (r) => formatPKR(r.gross), excelValue: (r) => r.gross },
      { header: 'Discount', align: 'right', cell: (r) => formatPKR(r.discount), excelValue: (r) => r.discount },
      { header: 'Net', align: 'right', cell: (r) => formatPKR(r.net), excelValue: (r) => r.net },
      { header: 'Admissions', align: 'right', cell: (r) => String(r.admissionCount), excelValue: (r) => r.admissionCount },
    ]}
  />
);

/** Reporting Guide v7.5 §5.15 — active/discharged admissions with Hospital balances still outstanding. */
export const InpatientOutstandingReportView: React.FC = () => (
  <GenericReportView<InpatientOutstandingRow>
    title="Inpatient Outstanding Balance"
    subtitle="Active/discharged admissions with Hospital balances still outstanding (never includes standalone Pharmacy due)."
    icon={AlertCircle}
    filenamePrefix="Inpatient_Outstanding"
    fetchReport={fetchInpatientOutstanding}
    rowKey={(r, i) => `${r.admissionNumber}-${i}`}
    columns={[
      { header: 'Admission #', cell: (r) => r.admissionNumber },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Hospital Net', align: 'right', cell: (r) => formatPKR(r.hospitalNet), excelValue: (r) => r.hospitalNet },
      { header: 'Hospital Paid', align: 'right', cell: (r) => formatPKR(r.hospitalPaid), excelValue: (r) => r.hospitalPaid },
      { header: 'Hospital Outstanding', align: 'right', cell: (r) => formatPKR(r.hospitalOutstanding), excelValue: (r) => r.hospitalOutstanding },
      { header: 'Admission Status', cell: (r) => r.admissionStatus },
    ]}
  />
);

/** Reporting Guide v7.5 §5.13 — final discharge readiness queue (Clinical + Hospital + Pharmacy). */
export const DischargeClearanceReportView: React.FC = () => (
  <GenericReportView<DischargeClearanceRow>
    title="Discharge Clearance Report"
    subtitle="Operational queue and audit report for final discharge readiness."
    icon={ShieldCheck}
    filenamePrefix="Discharge_Clearance_Report"
    fetchReport={fetchDischargeClearance}
    rowKey={(r, i) => `${r.admissionNumber}-${i}`}
    columns={[
      { header: 'Admission #', cell: (r) => r.admissionNumber },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Doctor', cell: (r) => r.doctor || '—' },
      { header: 'Clinical Ready', cell: (r) => (r.clinicalReady ? 'Yes' : 'No') },
      { header: 'Hospital Clearance', cell: (r) => r.hospitalClearance },
      { header: 'Hospital Due', align: 'right', cell: (r) => formatPKR(r.hospitalDue), excelValue: (r) => r.hospitalDue },
      { header: 'Pharmacy Clearance', cell: (r) => r.pharmacyClearance },
      { header: 'Discharge Ready', cell: (r) => (r.dischargeReady ? 'Yes' : 'No') },
      { header: 'Discharge Date', cell: (r) => r.dischargeDate || '—' },
    ]}
  />
);
