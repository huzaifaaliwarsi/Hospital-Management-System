import { AdmissionLedgerButton } from './AdmissionLedgerButton';
import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Search, RotateCcw, Eye } from 'lucide-react';
import { TextInput } from '../../components/forms/FormControls';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { PanelBadge } from '../../components/common/PanelBadge';
import { fetchAdmissions, AdmissionRecord, ClearanceType } from '../../services/admissionService';
import { AdmissionDetailModal } from './AdmissionDetailModal';

const GATES: { type: ClearanceType; label: string }[] = [
  { type: 'CLINICAL', label: 'Clinical' },
  { type: 'HOSPITAL_BILLING', label: 'Hospital Billing' },
  { type: 'PHARMACY', label: 'Pharmacy' },
];

const STATUS_STYLE: Record<string, string> = {
  CLEARED: 'bg-emerald-100 text-emerald-800',
  NOT_APPLICABLE: 'bg-slate-200 text-slate-600',
  PENDING: 'bg-amber-100 text-amber-800',
};

function gateStatus(admission: AdmissionRecord, type: ClearanceType): string {
  return admission.clearances?.find((c) => c.clearanceType === type)?.status || 'PENDING';
}

/**
 * Discharge Clearances — the 3-key gate (Clinical / Hospital Billing /
 * Pharmacy) shown per admission at a glance, using `clearances` already
 * embedded on each `/admissions` list row (no per-row extra call). Every
 * gate's actual grant action (doctor credential for Clinical, direct grant
 * for the other two) stays inside `AdmissionDetailModal`'s Clearances tab —
 * this view is the real, purpose-built status board, not a copy of Active
 * Admissions with a different title.
 */
export const DischargeClearancesView: React.FC = () => {
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setAdmissions(await fetchAdmissions({ status: 'ACTIVE' }));
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load admissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return admissions;
    return admissions.filter(
      (a) => a.patientName.toLowerCase().includes(q) || a.admissionNumber.toLowerCase().includes(q),
    );
  }, [admissions, searchTerm]);

  const readyCount = useMemo(
    () => admissions.filter((a) => GATES.every((g) => ['CLEARED', 'NOT_APPLICABLE'].includes(gateStatus(a, g.type)))).length,
    [admissions],
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Discharge Clearances</h1>
          <p className="text-xs text-slate-500 mt-0.5">Clinical, Hospital Billing and Pharmacy gate status for every active admission.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Active Admissions</span>
          <span className="text-lg font-bold text-slate-900">{admissions.length}</span>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs">
          <span className="text-[10px] text-emerald-700 uppercase font-bold block">All Gates Cleared</span>
          <span className="text-lg font-bold text-emerald-800">{readyCount}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 max-w-sm">
            <TextInput
              label="Search"
              icon={<Search className="h-3.5 w-3.5" />}
              placeholder="Patient name, admission #…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="button" onClick={() => setSearchTerm('')} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading discharge clearances…" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No active admissions" description="Discharge gate status will appear here once patients are admitted." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Admission #', 'Patient', 'Department', 'Bed', ...GATES.map((g) => g.label), 'Actions'].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-700">{a.admissionNumber}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{a.patientName}</div>
                      {a.payerType === 'Corporate / Panel' ? <PanelBadge /> : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Self-Pay</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.departmentName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.bedLabel || '—'}</td>
                    {GATES.map((g) => {
                      const status = gateStatus(a, g.type);
                      return (
                        <td key={g.type} className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-600'}`}>
                            {status === 'NOT_APPLICABLE' ? 'N/A' : status}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button type="button" title="Open Clearances" onClick={() => setDetailId(a.id)} className="p-1.5 rounded-md text-[#08775A] hover:bg-[#effaf5]">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                        <AdmissionLedgerButton admissionId={a.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailId && <AdmissionDetailModal admissionId={detailId} initialTab="clearances" onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
};
