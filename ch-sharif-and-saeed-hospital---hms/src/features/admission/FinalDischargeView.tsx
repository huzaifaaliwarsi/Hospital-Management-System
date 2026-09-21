import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { fetchAdmissions, dischargeAdmission, AdmissionRecord } from '../../services/admissionService';
import { AdmissionDetailModal } from './AdmissionDetailModal';

function isDischargeReady(a: AdmissionRecord): boolean {
  const gates = a.clearances || [];
  if (gates.length === 0) return false;
  return gates.every((g) => g.status === 'CLEARED' || g.status === 'NOT_APPLICABLE');
}

/**
 * Final Discharge — admissions where all 3 clearance gates are cleared,
 * computed client-side from `dischargeClearances` already embedded in the
 * `/admissions` list response (no extra call per row). This is the
 * pre-v7.2 discharge mechanism (straight to `DISCHARGED`, frees the bed) —
 * the v7.2 doctor-credential re-authentication + Discharge Summary
 * capture (§2.4) is a separate, deliberately deferred pass.
 */
export const FinalDischargeView: React.FC = () => {
  const toast = useToast();
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dischargingId, setDischargingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [activeRows, pendingRows] = await Promise.all([
        fetchAdmissions({ status: 'ACTIVE' }),
        fetchAdmissions({ status: 'DISCHARGE_PENDING' }),
      ]);
      setAdmissions([...activeRows, ...pendingRows]);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load admissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ready = useMemo(() => admissions.filter(isDischargeReady), [admissions]);

  const handleDischarge = async (a: AdmissionRecord) => {
    setDischargingId(a.id);
    try {
      await dischargeAdmission(a.id);
      toast.success(`${a.patientName} discharged. Bed freed.`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to discharge.');
    } finally {
      setDischargingId(null);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Final Discharge</h1>
          <p className="text-xs text-slate-500 mt-0.5">Admissions with all 3 clearance gates cleared — ready for final discharge.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading discharge-ready admissions…" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : ready.length === 0 ? (
          <EmptyState title="No admissions ready for discharge" description="Grant all 3 clearance gates (Clinical, Hospital Billing, Pharmacy) from Clearances first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Admission #', 'Patient', 'Department', 'Doctor', 'Bed', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ready.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-700">{a.admissionNumber}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-900">{a.patientName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.departmentName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{a.doctorName || 'Not Assigned'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.bedLabel || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setDetailId(a.id)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800">
                          View
                        </button>
                        <button
                          type="button"
                          disabled={dischargingId === a.id}
                          onClick={() => handleDischarge(a)}
                          className="px-3 py-1.5 text-[11px] font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg disabled:opacity-60 inline-flex items-center gap-1.5"
                        >
                          {dischargingId === a.id && <Loader2 className="h-3 w-3 animate-spin" />} Discharge
                        </button>
                      </div>
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
