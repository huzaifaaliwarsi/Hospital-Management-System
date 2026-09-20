import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Loader2, Search, RefreshCw, Eye } from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import { formatDisplayDate } from '../../../utils/dateConstants';
import { LoadingState, ErrorState } from '../../../components/common/StateViews';
import { PanelBadge } from '../../../components/common/PanelBadge';
import {
  fetchAdmissionRecords,
  AdmissionPatientRecordRow,
  AdmissionBillingStatus,
} from '../../../services/admissionBillingService';
import { AdmissionLedgerModal } from './AdmissionLedgerModal';

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDisplayDate(d)}, ${d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`;
}

const BILLING_STATUS_BADGE: Record<AdmissionBillingStatus, string> = {
  NO_CHARGES: 'bg-slate-100 text-slate-600',
  UNPAID: 'bg-rose-50 text-rose-800 border border-rose-200',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-800 border border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
};

const CLINICAL_STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]',
  DISCHARGE_PENDING: 'bg-amber-50 text-amber-800 border border-amber-200',
  DISCHARGED: 'bg-slate-100 text-slate-600 border border-slate-200',
};

/**
 * Front Desk / Billing — "Admission Patient Records" (source-of-truth: the
 * user's admission ledger spec §2). One row per checked-in admission (never
 * per department invoice, unlike `HospitalInvoicesView`'s ADM queue) — the
 * single entry point into an admission's Running Ledger (`AdmissionLedgerModal`).
 */
export const AdmissionPatientRecordsView: React.FC = () => {
  const [rows, setRows] = useState<AdmissionPatientRecordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [openAdmissionId, setOpenAdmissionId] = useState<string | null>(null);

  const load = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError(null);
    try {
      setRows(await fetchAdmissionRecords());
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load admission patient records.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.toLowerCase().trim();
    return rows.filter(
      (r) =>
        r.admissionNumber.toLowerCase().includes(q) ||
        r.patientName.toLowerCase().includes(q) ||
        (r.patientMrNumber || '').toLowerCase().includes(q),
    );
  }, [rows, searchTerm]);

  const metrics = useMemo(
    () =>
      filteredRows.reduce(
        (acc, r) => ({
          count: acc.count + 1,
          totalCharges: acc.totalCharges + r.currentCharges,
          totalPaid: acc.totalPaid + r.totalPaid,
          totalOutstanding: acc.totalOutstanding + r.outstanding,
        }),
        { count: 0, totalCharges: 0, totalPaid: 0, totalOutstanding: 0 },
      ),
    [filteredRows],
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Admission Patient Records</h1>
            <p className="text-xs text-[#52665e] mt-0.5 max-w-2xl leading-relaxed">
              One running financial record per admission — every ward, room, bed, hospital, lab, pharmacy and consultant
              charge accumulates here. Open a record to view the full ledger, receive payment, or generate a statement.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#f6faf8] text-[#52665e] hover:text-[#111827] border border-[#e2eae5] text-xs font-semibold rounded-lg shadow-2xs transition-colors disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-[#08775A] ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {!isLoading && !loadError && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-white rounded-xl border border-[#e2eae5] p-3.5 shadow-2xs">
            <span className="block text-[11px] font-semibold text-[#52665e] uppercase tracking-wider">Admissions</span>
            <span className="text-xl font-bold text-[#111827] block mt-1">{metrics.count}</span>
          </div>
          <div className="bg-white rounded-xl border border-[#e2eae5] p-3.5 shadow-2xs">
            <span className="block text-[11px] font-semibold text-[#52665e] uppercase tracking-wider">Current Charges</span>
            <span className="text-base sm:text-lg font-bold text-[#111827] font-mono block mt-1">{formatPKR(metrics.totalCharges)}</span>
          </div>
          <div className="bg-white rounded-xl border border-[#e2eae5] p-3.5 shadow-2xs">
            <span className="block text-[11px] font-semibold text-[#08775A] uppercase tracking-wider">Total Paid</span>
            <span className="text-base sm:text-lg font-bold text-[#08775A] font-mono block mt-1">{formatPKR(metrics.totalPaid)}</span>
          </div>
          <div className="bg-white rounded-xl border border-[#e2eae5] p-3.5 shadow-2xs">
            <span className="block text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Outstanding</span>
            <span className="text-base sm:text-lg font-bold text-rose-700 font-mono block mt-1">{formatPKR(metrics.totalOutstanding)}</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e2eae5] p-3 shadow-2xs">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8b9e95]" />
          <input
            type="text"
            placeholder="Search Admission #, Patient Name, or MR #…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-[#c2e7db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#08775A] focus:border-[#08775A] bg-white placeholder:text-[#8b9e95]"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e2eae5] shadow-2xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading admission patient records…" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => load()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8faf9] border-b border-[#e2eae5] text-[11px] font-bold text-[#52665e] uppercase tracking-wider">
                  <th className="py-3 px-4">Admission No.</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Payer Type</th>
                  <th className="py-3 px-4">Admission Date</th>
                  <th className="py-3 px-4">Ward / Room / Bed</th>
                  <th className="py-3 px-4 text-right">Current Charges</th>
                  <th className="py-3 px-4 text-right">Total Paid</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-center">Clinical Status</th>
                  <th className="py-3 px-4 text-center">Billing Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2eae5] text-slate-700">
                {filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#f8fcfa] transition-colors cursor-pointer" onClick={() => setOpenAdmissionId(r.id)}>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.admissionNumber}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block">{r.patientName}</span>
                      {r.patientMrNumber && (
                        <span className="inline-block mt-0.5 font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {r.patientMrNumber}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.payerType === 'PANEL' ? <PanelBadge /> : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Self-Pay</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">{formatTimestamp(r.admittedAt)}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {[r.ward, r.room, r.bed].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">{formatPKR(r.currentCharges)}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">{formatPKR(r.totalPaid)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {r.outstanding > 0 ? (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">{formatPKR(r.outstanding)}</span>
                      ) : r.availableCredit > 0 ? (
                        <span className="text-[#08775A] bg-[#effaf5] px-2 py-0.5 rounded border border-[#c2e7db]" title="Available advance / credit">
                          Credit {formatPKR(r.availableCredit)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">Settled</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${CLINICAL_STATUS_BADGE[r.clinicalStatus] || 'bg-slate-100 text-slate-600'}`}>
                        {r.clinicalStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${BILLING_STATUS_BADGE[r.billingStatus]}`}>
                        {r.billingStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setOpenAdmissionId(r.id)}
                        title="View Admission Record"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-[#08775A] text-[#08775A] hover:text-white border border-[#c2e7db] hover:border-[#08775A] text-[11px] font-semibold rounded shadow-2xs transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-500">
                      <ClipboardList className="h-9 w-9 text-slate-300 mx-auto mb-2" />
                      <h4 className="text-sm font-semibold text-slate-800">No Admission Records Found</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {searchTerm ? 'No admission matches your search.' : 'No patient has been checked in yet.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {isRefreshing && (
          <div className="px-4 py-2 border-t border-[#e2eae5] flex items-center gap-1.5 text-[10px] text-[#52665e]">
            <Loader2 className="h-3 w-3 animate-spin" /> Refreshing…
          </div>
        )}
      </div>

      {openAdmissionId && (
        <AdmissionLedgerModal
          admissionId={openAdmissionId}
          onClose={() => setOpenAdmissionId(null)}
          onChanged={() => load(true)}
        />
      )}
    </div>
  );
};
