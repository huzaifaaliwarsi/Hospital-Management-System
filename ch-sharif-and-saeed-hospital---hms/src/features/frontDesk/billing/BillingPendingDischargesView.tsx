import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Loader2, AlertTriangle, Receipt } from 'lucide-react';
import { fetchAdmissions, AdmissionRecord } from '../../../services/admissionService';
import { fetchInvoices, InvoiceSummary } from '../../../services/invoiceService';
import { AdmissionStatementModal } from './AdmissionStatementModal';

/**
 * Real "Billing Pending Discharges" queue — admissions the doctor has
 * clinically discharged (`AdmissionStatus.DISCHARGE_PENDING`, a real,
 * pre-existing status) and that now need Front Desk's financial closure
 * (v7.2 §2.10/§2.11 — the "Clinically Discharged → Billing Pending" status
 * chain). Final billing now opens the real per-department Interim Statement
 * + Payment Allocation (§2.2 — `AdmissionStatementModal`), not a generic
 * link into the single-invoice Hospital Invoices list.
 */
export const BillingPendingDischargesView: React.FC = () => {
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statementAdmissionId, setStatementAdmissionId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [admissionRows, invoiceRows] = await Promise.all([
        fetchAdmissions({ status: 'DISCHARGE_PENDING' }),
        fetchInvoices({ status: 'UNPAID' }),
      ]);
      setAdmissions(admissionRows);
      setInvoices(invoiceRows);
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load billing-pending discharges.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" /> <span>Loading billing-pending discharges…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-rose-700 font-medium">{loadError}</p>
        <button onClick={load} className="px-4 py-2 bg-[#08775A] hover:bg-[#0e7d5a] text-white text-xs font-semibold rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Billing Pending Discharges</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Clinically discharged cases awaiting Front Desk financial closure. Open the linked invoice to finalize billing.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">Admission #</th>
                <th className="py-2.5 px-4">Patient</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Doctor</th>
                <th className="py-2.5 px-4">Discharged At</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {admissions.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{a.admissionNumber}</td>
                  <td className="py-2.5 px-4">
                    <span className="font-semibold text-slate-900">{a.patientName}</span>
                    <span className="text-[10px] text-slate-400 block">{a.payerType}</span>
                  </td>
                  <td className="py-2.5 px-4">{a.departmentName}</td>
                  <td className="py-2.5 px-4">{a.doctorName}</td>
                  <td className="py-2.5 px-4 text-slate-500">{a.dischargedAt || '—'}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setStatementAdmissionId(a.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#08775A] hover:underline"
                    >
                      <Receipt className="h-3 w-3" /> View Statement / Collect
                    </button>
                  </td>
                </tr>
              ))}
              {admissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <ClipboardCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <span className="font-semibold text-xs text-slate-700 block">No cases pending financial closure right now.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {invoices.length > 0 && (
        <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-[11px] text-blue-900">
          {invoices.length} unpaid invoice(s) in the system overall — open Hospital Invoices to search by patient and collect the
          remaining balance for a discharged case.
        </div>
      )}

      {statementAdmissionId && (
        <AdmissionStatementModal
          admissionId={statementAdmissionId}
          onClose={() => setStatementAdmissionId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
};
