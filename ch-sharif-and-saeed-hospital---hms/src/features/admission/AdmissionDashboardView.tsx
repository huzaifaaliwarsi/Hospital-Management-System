import { AdmissionLedgerButton } from './AdmissionLedgerButton';
import React, { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Clock, Users, BedDouble, CheckCircle2, Pill, Eye } from 'lucide-react';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { PanelBadge } from '../../components/common/PanelBadge';
import { fetchAdmissions, AdmissionRecord } from '../../services/admissionService';
import { fetchWardHierarchy } from '../../services/wardsRoomsBedsService';
import { AdmissionDetailModal } from './AdmissionDetailModal';

function isDischargeReady(a: AdmissionRecord): boolean {
  const gates = a.clearances || [];
  if (gates.length === 0) return false;
  return gates.every((g) => g.status === 'CLEARED' || g.status === 'NOT_APPLICABLE');
}

/**
 * Admission Portal Dashboard — every figure here comes from the real
 * `/admissions` + `/setup/wards-rooms-beds` endpoints, computed on read the
 * same way `AdmissionReportsView`/`FrontDeskDashboard` already do. This nav
 * item previously had no case in `AdmissionModuleView`'s switch, so it fell
 * through to `ModulePlaceholderView` — a hardcoded, fabricated patient list
 * that never touched the database.
 */
export const AdmissionDashboardView: React.FC = () => {
  const [planned, setPlanned] = useState<AdmissionRecord[]>([]);
  const [active, setActive] = useState<AdmissionRecord[]>([]);
  const [dischargePending, setDischargePending] = useState<AdmissionRecord[]>([]);
  const [bedCounts, setBedCounts] = useState({ total: 0, occupied: 0, available: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [plannedRows, confirmedRows, activeRows, dischargePendingRows, hierarchy] = await Promise.all([
        fetchAdmissions({ status: 'PLANNED' }),
        fetchAdmissions({ status: 'CONFIRMED' }),
        fetchAdmissions({ status: 'ACTIVE' }),
        fetchAdmissions({ status: 'DISCHARGE_PENDING' }),
        fetchWardHierarchy(),
      ]);
      setPlanned([...plannedRows, ...confirmedRows]);
      setActive(activeRows);
      setDischargePending(dischargePendingRows);
      setBedCounts({
        total: hierarchy.beds.length,
        occupied: hierarchy.beds.filter((b) => b.occupancyStatus === 'Occupied').length,
        available: hierarchy.beds.filter((b) => b.occupancyStatus === 'Available').length,
      });
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load admission dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const readyForDischarge = useMemo(() => active.filter(isDischargeReady).length, [active]);
  const hospitalManagedCount = useMemo(() => active.filter((a) => a.medicationMode === 'HOSPITAL_MANAGED').length, [active]);
  const occupancyPercent = bedCounts.total > 0 ? Math.round((bedCounts.occupied / bedCounts.total) * 100) : 0;

  const recentActive = useMemo(
    () => [...active].sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()).slice(0, 8),
    [active],
  );

  const kpis = [
    { label: 'Awaiting Check-In', value: planned.length, icon: Clock, color: 'text-blue-700 bg-blue-50' },
    { label: 'Active Inpatients', value: active.length, icon: Users, color: 'text-emerald-700 bg-emerald-50' },
    {
      label: 'Bed Occupancy',
      value: `${bedCounts.occupied}/${bedCounts.total}`,
      sub: `${occupancyPercent}% occupied • ${bedCounts.available} available`,
      icon: BedDouble,
      color: 'text-purple-700 bg-purple-50',
    },
    { label: 'Ready for Discharge', value: readyForDischarge, icon: CheckCircle2, color: 'text-amber-700 bg-amber-50' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admission Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live inpatient stay overview — every figure computed from real admission and bed records.</p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading admission dashboard…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${k.color}`}>
                  <k.icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-slate-900 leading-none">{k.value}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{k.label}</p>
                  {k.sub && <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Discharge Pending (Billing)</span>
              <span className="text-lg font-bold text-slate-900">{dischargePending.length}</span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <Pill className="h-3 w-3" /> Hospital-Managed Medication
              </span>
              <span className="text-lg font-bold text-slate-900">{hospitalManagedCount} <span className="text-xs font-normal text-slate-400">of {active.length} active</span></span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Self-Arranged Medication</span>
              <span className="text-lg font-bold text-slate-900">{active.length - hospitalManagedCount} <span className="text-xs font-normal text-slate-400">of {active.length} active</span></span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Recently Admitted (Active)</h3>
              <span className="text-[11px] text-slate-400">{active.length} total active</span>
            </div>
            {recentActive.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No active admissions right now.</p>
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
                    {recentActive.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-700">{a.admissionNumber}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{a.patientName}</div>
                          {a.payerType === 'Corporate / Panel' ? <PanelBadge /> : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Self-Pay</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.departmentName}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{a.doctorName || 'Not Assigned'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.bedLabel || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <button type="button" title="View" onClick={() => setDetailId(a.id)} className="p-1.5 rounded-md text-[#08775A] hover:bg-[#effaf5]">
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
        </>
      )}

      {detailId && <AdmissionDetailModal admissionId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
};
