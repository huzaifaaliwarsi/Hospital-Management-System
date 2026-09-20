import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Search, RotateCcw, LogIn, Eye } from 'lucide-react';
import { Select, TextInput } from '../../components/forms/FormControls';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { PanelBadge } from '../../components/common/PanelBadge';
import { DepartmentService, fetchDepartments } from '../../services/departmentService';
import { Department } from '../../types/department';
import { fetchAdmissions, AdmissionRecord } from '../../services/admissionService';
import { CheckInAdmissionModal } from './CheckInAdmissionModal';
import { AdmissionDetailModal } from './AdmissionDetailModal';

interface PlannedAdmissionsViewProps {
  title: string;
  subtitle: string;
  /** Check-In page shows the Check-In action; Planned Admissions page is read/handoff-review only. */
  showCheckIn?: boolean;
}

/**
 * Planned/Confirmed admissions handed off from Front Desk (§2.9) — shared
 * by `planned_admissions` (review/handoff) and `admission_check_in`
 * (assign bed → go Active). Same list, different primary action, same
 * consolidation pattern used throughout the Front Desk build.
 */
export const PlannedAdmissionsView: React.FC<PlannedAdmissionsViewProps> = ({ title, subtitle, showCheckIn = false }) => {
  const [allDepartments, setAllDepartments] = useState<Department[]>(() => DepartmentService.getDepartments());
  useEffect(() => {
    fetchDepartments().then(setAllDepartments).catch(() => {});
  }, []);
  const departments = useMemo(() => allDepartments.filter((d) => d.status === 'Active'), [allDepartments]);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<AdmissionRecord | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [planned, confirmed] = await Promise.all([
        fetchAdmissions({ status: 'PLANNED' }),
        fetchAdmissions({ status: 'CONFIRMED' }),
      ]);
      setAdmissions([...planned, ...confirmed]);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load planned admissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return admissions.filter((a) => {
      if (departmentFilter && a.departmentId !== departmentFilter) return false;
      if (q && !(a.patientName.toLowerCase().includes(q) || a.admissionNumber.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [admissions, departmentFilter, searchTerm]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Department"
            placeholder="All Departments"
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          />
          <TextInput label="Search" icon={<Search className="h-3.5 w-3.5" />} placeholder="Patient name, admission #…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span className="text-[11px] text-slate-500">{isLoading ? 'Loading…' : `Showing ${filtered.length} record${filtered.length === 1 ? '' : 's'}`}</span>
          <button type="button" onClick={() => { setDepartmentFilter(''); setSearchTerm(''); }} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800">
            <RotateCcw className="h-3 w-3" /> Reset Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading planned admissions…" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No planned admissions" description="No planned admissions are waiting handoff from Front Desk." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Admission #', 'Patient', 'Department', 'Doctor', 'Expected', 'Status', 'Actions'].map((h) => (
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
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {a.payerType === 'Corporate / Panel' ? <PanelBadge /> : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Self-Pay</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.departmentName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{a.doctorName || 'Not Assigned'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{a.expectedAt || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">{a.status}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {showCheckIn && (
                          <button type="button" title="Check In" onClick={() => setCheckInTarget(a)} className="p-1.5 rounded-md text-[#08775A] hover:bg-[#effaf5]">
                            <LogIn className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button type="button" title="View" onClick={() => setDetailId(a.id)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100">
                          <Eye className="h-3.5 w-3.5" />
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

      {checkInTarget && (
        <CheckInAdmissionModal admission={checkInTarget} onClose={() => setCheckInTarget(null)} onCheckedIn={() => { setCheckInTarget(null); load(); }} />
      )}
      {detailId && <AdmissionDetailModal admissionId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
};
