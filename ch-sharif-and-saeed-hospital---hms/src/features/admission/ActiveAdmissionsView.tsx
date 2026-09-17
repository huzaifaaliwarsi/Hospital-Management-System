import React, { useEffect, useMemo, useState } from 'react';
import { Users, Search, RotateCcw, Eye } from 'lucide-react';
import { Select, TextInput } from '../../components/forms/FormControls';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { PanelBadge } from '../../components/common/PanelBadge';
import { DepartmentService } from '../../services/departmentService';
import { StaffUserService } from '../../services/staffUserService';
import { fetchAdmissions, AdmissionRecord } from '../../services/admissionService';
import { AdmissionDetailModal } from './AdmissionDetailModal';

interface ActiveAdmissionsViewProps {
  title: string;
  subtitle: string;
  initialTab?: 'overview' | 'services' | 'medication' | 'pharmacy' | 'bed' | 'clearances';
}

/**
 * Shared "every Active admission" list, reused for `active_admissions`,
 * `hospital_services_procedures`, `medication_fulfillment_mode`,
 * `pharmacy_requests`, and `discharge_clearances` — same consolidation
 * pattern as Front Desk's `HospitalInvoicesView`. Every row opens
 * `AdmissionDetailModal`, pre-selected to the tab relevant to whichever
 * nav item was clicked, but every tab stays reachable.
 */
export const ActiveAdmissionsView: React.FC<ActiveAdmissionsViewProps> = ({ title, subtitle, initialTab = 'overview' }) => {
  const departments = useMemo(() => DepartmentService.getDepartments().filter((d) => d.status === 'Active'), []);
  const doctors = useMemo(() => StaffUserService.getStaffUsers().filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'), []);

  const [departmentFilter, setDepartmentFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    return admissions.filter((a) => {
      if (departmentFilter && a.departmentId !== departmentFilter) return false;
      if (doctorFilter && a.doctorId !== doctorFilter) return false;
      if (q && !(a.patientName.toLowerCase().includes(q) || a.admissionNumber.toLowerCase().includes(q) || a.patientMrNumber.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [admissions, departmentFilter, doctorFilter, searchTerm]);

  const resetFilters = () => {
    setDepartmentFilter('');
    setDoctorFilter('');
    setSearchTerm('');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Department"
            placeholder="All Departments"
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          />
          <Select
            label="Doctor"
            placeholder="All Doctors"
            options={doctors.map((d) => ({ label: d.fullName, value: d.id }))}
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
          />
          <TextInput
            label="Search"
            icon={<Search className="h-3.5 w-3.5" />}
            placeholder="Patient name, MRN, admission #…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span className="text-[11px] text-slate-500">
            {isLoading ? 'Loading…' : `Showing ${filtered.length} record${filtered.length === 1 ? '' : 's'}`}
          </span>
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800">
            <RotateCcw className="h-3 w-3" /> Reset Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading active admissions…" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No active admissions" description="No admissions match the selected filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Admission #', 'Patient', 'Department', 'Doctor', 'Bed', 'Medication Mode', 'Actions'].map((h) => (
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
                        {a.payerType === 'Corporate / Panel' ? (
                          <PanelBadge />
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Self-Pay</span>
                        )}
                        <span className="text-[10px] text-slate-400">{a.patientMrNumber}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.departmentName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{a.doctorName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.bedLabel || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${a.medicationMode === 'HOSPITAL_MANAGED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {a.medicationMode === 'HOSPITAL_MANAGED' ? 'Hospital Managed' : 'Self'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button
                        type="button"
                        title="Open"
                        onClick={() => setDetailId(a.id)}
                        className="p-1.5 rounded-md text-[#08775A] hover:bg-[#effaf5]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailId && (
        <AdmissionDetailModal admissionId={detailId} initialTab={initialTab} onClose={() => setDetailId(null)} onChanged={load} />
      )}
    </div>
  );
};
