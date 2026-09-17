import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Users, Bed, CheckCircle2, Clock } from 'lucide-react';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { fetchAdmissions, AdmissionRecord, AdmissionStatus } from '../../services/admissionService';

const STATUS_LABELS: Record<AdmissionStatus, string> = {
  PLANNED: 'Planned',
  CONFIRMED: 'Confirmed',
  ACTIVE: 'Active',
  DISCHARGE_PENDING: 'Discharge Pending',
  DISCHARGED: 'Discharged',
  CANCELLED: 'Cancelled',
};

/**
 * Admission Reports — client-side aggregation over the real `/admissions`
 * list (no status filter). No dedicated backend report endpoint exists yet
 * for Admission (only Super Admin dashboard / Front Desk billing do) —
 * this follows the same approach Front Desk's own dashboard used before a
 * dedicated endpoint existed: real data, computed on read, not mocked.
 */
export const AdmissionReportsView: React.FC = () => {
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setAdmissions(await fetchAdmissions());
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load admissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    admissions.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [admissions]);

  const byDepartment = useMemo(() => {
    const counts = new Map<string, number>();
    admissions.forEach((a) => {
      counts.set(a.departmentName || 'Unassigned', (counts.get(a.departmentName || 'Unassigned') || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [admissions]);

  const byDoctor = useMemo(() => {
    const counts = new Map<string, number>();
    admissions.forEach((a) => {
      counts.set(a.doctorName || 'Unassigned', (counts.get(a.doctorName || 'Unassigned') || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [admissions]);

  const kpis = [
    { label: 'Total Admissions', value: admissions.length, icon: Users, color: 'text-slate-700 bg-slate-100' },
    { label: 'Active', value: byStatus.ACTIVE || 0, icon: Bed, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Planned / Confirmed', value: (byStatus.PLANNED || 0) + (byStatus.CONFIRMED || 0), icon: Clock, color: 'text-blue-700 bg-blue-50' },
    { label: 'Discharged', value: byStatus.DISCHARGED || 0, icon: CheckCircle2, color: 'text-slate-700 bg-slate-100' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <LineChart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admission Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Admissions, transfers, services and clinical discharge status — computed from live data.</p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading admission reports…" />
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
                <div>
                  <p className="text-lg font-bold text-slate-900 leading-none">{k.value}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{k.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">By Status</h3>
              <div className="space-y-2">
                {(Object.keys(STATUS_LABELS) as AdmissionStatus[]).map((s) => (
                  <div key={s} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{STATUS_LABELS[s]}</span>
                    <span className="font-bold text-slate-900">{byStatus[s] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">By Department</h3>
              <div className="space-y-2">
                {byDepartment.length === 0 ? (
                  <p className="text-xs text-slate-400">No data.</p>
                ) : (
                  byDepartment.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{name}</span>
                      <span className="font-bold text-slate-900">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Top Admitting Doctors</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {byDoctor.length === 0 ? (
                  <p className="text-xs text-slate-400">No data.</p>
                ) : (
                  byDoctor.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{name}</span>
                      <span className="font-bold text-slate-900">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
