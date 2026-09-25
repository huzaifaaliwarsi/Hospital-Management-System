import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCheck,
  CheckCircle2,
  RefreshCw,
  Search,
  RotateCcw,
  Calendar,
  Building2,
  FileText,
  Printer,
  Eye,
  Clock,
  Users,
  ShieldCheck,
  ArrowRight,
  Filter,
  Check,
  X,
} from 'lucide-react';
import { PanelBadge } from '../../components/common/PanelBadge';
import { Modal } from '../../components/common/Modal';
import { useRouter } from '../../context/RouterContext';
import { AdmissionRecord, fetchAdmissions } from '../../services/admissionService';
import { DepartmentService, fetchDepartments } from '../../services/departmentService';
import { Department } from '../../types/department';
import { AdmissionDetailModal } from '../admission/AdmissionDetailModal';
import { AdmissionLedgerModal } from '../frontDesk/admissionRecords/AdmissionLedgerModal';
import { formatPKR, formatDateTimeDDMMYYYY } from '../../utils/formatters';

function formatDisplayDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return formatDateTimeDDMMYYYY(iso) || '—';
}

function computeStayDuration(admittedAt?: string | null, dischargedAt?: string | null): string {
  if (!admittedAt || !dischargedAt) return '—';
  const start = new Date(admittedAt).getTime();
  const end = new Date(dischargedAt).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return '—';
  const diffHours = Math.round((end - start) / (1000 * 60 * 60));
  if (diffHours < 24) {
    return `${Math.max(1, diffHours)} hr${diffHours === 1 ? '' : 's'}`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
}

export const DischargedPatientsView: React.FC = () => {
  const { navigate, currentPortal } = useRouter();

  const [patients, setPatients] = useState<AdmissionRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>(() => DepartmentService.getDepartments());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [payerFilter, setPayerFilter] = useState<'ALL' | 'Corporate / Panel' | 'Self Pay'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Modals
  const [detailAdmissionId, setDetailAdmissionId] = useState<string | null>(null);
  const [ledgerAdmissionId, setLedgerAdmissionId] = useState<string | null>(null);
  const [printSlipPatient, setPrintSlipPatient] = useState<AdmissionRecord | null>(null);

  const load = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError(null);

    try {
      const [admissionsRes, deptRes] = await Promise.all([
        fetchAdmissions({ status: 'DISCHARGED' }),
        fetchDepartments().catch(() => DepartmentService.getDepartments()),
      ]);
      setPatients(admissionsRes);
      setDepartments(deptRes.filter((d) => d.status === 'Active'));
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load discharged patients.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Compute Summary Statistics
  const totalDischarged = patients.length;
  const todayStr = new Date().toDateString();

  const dischargedToday = useMemo(() => {
    return patients.filter((p) => {
      if (!p.dischargedAt) return false;
      const d = new Date(p.dischargedAt);
      return !isNaN(d.getTime()) && d.toDateString() === todayStr;
    }).length;
  }, [patients, todayStr]);

  const panelDischarged = useMemo(() => {
    return patients.filter((p) => p.payerType === 'Corporate / Panel').length;
  }, [patients]);

  const selfPayDischarged = totalDischarged - panelDischarged;

  // Average stay calculation in days
  const avgStayDays = useMemo(() => {
    const valid = patients.filter((p) => p.admittedAt && p.dischargedAt);
    if (valid.length === 0) return 0;
    const totalHours = valid.reduce((sum, p) => {
      const start = new Date(p.admittedAt).getTime();
      const end = new Date(p.dischargedAt).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        return sum + (end - start) / (1000 * 60 * 60);
      }
      return sum;
    }, 0);
    return Math.round((totalHours / valid.length / 24) * 10) / 10;
  }, [patients]);

  // Filter Logic
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = startOfToday - 30 * 24 * 60 * 60 * 1000;

    return patients.filter((p) => {
      // Department filter
      if (departmentFilter !== 'ALL' && p.departmentId !== departmentFilter) {
        return false;
      }

      // Payer filter
      if (payerFilter !== 'ALL' && p.payerType !== payerFilter) {
        return false;
      }

      // Time filter
      if (timeFilter !== 'ALL' && p.dischargedAt) {
        const dischargeTime = new Date(p.dischargedAt).getTime();
        if (timeFilter === 'TODAY' && dischargeTime < startOfToday) return false;
        if (timeFilter === 'WEEK' && dischargeTime < sevenDaysAgo) return false;
        if (timeFilter === 'MONTH' && dischargeTime < thirtyDaysAgo) return false;
      }

      // Search term
      if (term) {
        const matchesName = p.patientName.toLowerCase().includes(term);
        const matchesMr = p.patientMrNumber.toLowerCase().includes(term);
        const matchesAdm = p.admissionNumber.toLowerCase().includes(term);
        const matchesDept = p.departmentName.toLowerCase().includes(term);
        const matchesDoc = (p.doctorName || '').toLowerCase().includes(term);
        const matchesBed = (p.bedLabel || '').toLowerCase().includes(term);
        const matchesDx = (p.diagnosis || '').toLowerCase().includes(term);

        if (!matchesName && !matchesMr && !matchesAdm && !matchesDept && !matchesDoc && !matchesBed && !matchesDx) {
          return false;
        }
      }

      return true;
    });
  }, [patients, search, departmentFilter, payerFilter, timeFilter]);

  const hasActiveFilters =
    search.trim() !== '' ||
    departmentFilter !== 'ALL' ||
    payerFilter !== 'ALL' ||
    timeFilter !== 'ALL';

  const resetFilters = () => {
    setSearch('');
    setDepartmentFilter('ALL');
    setPayerFilter('ALL');
    setTimeFilter('ALL');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center font-bold">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Discharged Patients</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical record of completed admissions, length of stay, and patient billing ledgers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#08775A]' : ''}`} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          {currentPortal === 'admission' ? (
            <button
              type="button"
              onClick={() => navigate('/admission/final_discharge')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Final Discharge Queue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/front-desk/admissions')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Users className="h-3.5 w-3.5" /> Admission Records
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-medium">
          {loadError}
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 leading-none">{totalDischarged}</p>
            <p className="text-[11px] text-slate-500 mt-1">Total Discharges</p>
            <p className="text-[10px] text-slate-400">All-time completed stays</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold text-blue-800 leading-none">{dischargedToday}</p>
            <p className="text-[11px] text-slate-500 mt-1">Discharged Today</p>
            <p className="text-[10px] text-slate-400">Patients freed today</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold text-purple-800 leading-none">
              {avgStayDays} {avgStayDays === 1 ? 'Day' : 'Days'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Avg. Length of Stay</p>
            <p className="text-[10px] text-slate-400">From check-in to exit</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-base font-bold text-amber-900 leading-none">{panelDischarged}</p>
              <span className="text-[10px] font-bold text-slate-500">/ {selfPayDischarged} Self</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Panel vs Self-Pay</p>
            <p className="text-[10px] text-slate-400">Corporate coverage ratio</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Patient Name, MR #, Admission #, Doctor, Diagnosis…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A] focus:border-[#08775A] bg-slate-50/50"
            />
          </div>

          {/* Department Filter */}
          <div className="md:col-span-3">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A] bg-white text-slate-700"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payer Filter */}
          <div className="md:col-span-3">
            <select
              value={payerFilter}
              onChange={(e) => setPayerFilter(e.target.value as any)}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A] bg-white text-slate-700"
            >
              <option value="ALL">All Payer Types</option>
              <option value="Corporate / Panel">Corporate / Panel Only</option>
              <option value="Self Pay">Self Pay Only</option>
            </select>
          </div>
        </div>

        {/* Time Chips & Summary Line */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">Discharge Time:</span>

            <button
              type="button"
              onClick={() => setTimeFilter('ALL')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                timeFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Time
            </button>

            <button
              type="button"
              onClick={() => setTimeFilter('TODAY')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                timeFilter === 'TODAY'
                  ? 'bg-[#08775A] text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Today ({dischargedToday})
            </button>

            <button
              type="button"
              onClick={() => setTimeFilter('WEEK')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                timeFilter === 'WEEK'
                  ? 'bg-[#08775A] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Last 7 Days
            </button>

            <button
              type="button"
              onClick={() => setTimeFilter('MONTH')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                timeFilter === 'MONTH'
                  ? 'bg-[#08775A] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              This Month
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500">
              Showing <span className="font-bold text-slate-800">{filtered.length}</span> of {totalDischarged} records
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline"
              >
                <RotateCcw className="h-3 w-3" /> Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Discharged Patients Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-[#08775A]" />
            <span className="text-xs font-medium">Loading discharged patients…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">No discharged patient records found</p>
            <p className="text-xs text-slate-500 mt-1">
              {hasActiveFilters
                ? 'Try adjusting your search query or filters.'
                : 'Completed discharges will automatically be archived here.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                <RotateCcw className="h-3 w-3" /> Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[300px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-2xs text-slate-600 font-semibold">
                <tr>
                  <th className="text-left px-3.5 py-3 whitespace-nowrap">Admission #</th>
                  <th className="text-left px-3.5 py-3 whitespace-nowrap">Patient &amp; MR #</th>
                  <th className="text-left px-3.5 py-3 whitespace-nowrap">Department &amp; Doctor</th>
                  <th className="text-left px-3.5 py-3 whitespace-nowrap">Discharged Bed</th>
                  <th className="text-left px-3.5 py-3 whitespace-nowrap">Admission Timeline</th>
                  <th className="text-left px-3.5 py-3 whitespace-nowrap">Stay Length</th>
                  <th className="text-left px-3.5 py-3 whitespace-nowrap">Medication</th>
                  <th className="text-right px-3.5 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((patient) => {
                  const duration = computeStayDuration(patient.admittedAt || patient.createdAtIso, patient.dischargedAt);

                  return (
                    <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Admission Number */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-mono font-semibold text-slate-700">
                        {patient.admissionNumber}
                      </td>

                      {/* Patient Name & MR # */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{patient.patientName}</span>
                          {patient.payerType === 'Corporate / Panel' && <PanelBadge />}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">{patient.patientMrNumber}</div>
                        {patient.diagnosis && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1 max-w-[180px]">
                            {patient.diagnosis}
                          </div>
                        )}
                      </td>

                      {/* Department & Doctor */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{patient.departmentName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Dr. {patient.doctorName || 'Assigned'}</div>
                      </td>

                      {/* Bed Label */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="font-medium text-slate-700">{patient.bedLabel || 'Bed Released'}</span>
                      </td>

                      {/* Timeline */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="text-[11px] text-slate-700">
                          <span className="text-slate-400">Adm: </span>
                          {formatDisplayDateTime(patient.admittedAt || patient.createdAtIso)}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                          <span className="text-slate-400">Dis: </span>
                          {formatDisplayDateTime(patient.dischargedAt)}
                        </div>
                      </td>

                      {/* Stay Length */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {duration}
                        </span>
                      </td>

                      {/* Medication Mode */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            patient.medicationMode === 'HOSPITAL_MANAGED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {patient.medicationMode === 'HOSPITAL_MANAGED' ? 'Hospital' : 'Self'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailAdmissionId(patient.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md shadow-2xs transition-colors"
                            title="View Stay Details"
                          >
                            <Eye className="h-3 w-3 text-[#08775A]" /> View Details
                          </button>

                          <button
                            type="button"
                            onClick={() => setLedgerAdmissionId(patient.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#08775A] bg-[#effaf5] hover:bg-[#d8f3e5] border border-[#08775A]/20 rounded-md transition-colors"
                            title="View Billing Ledger"
                          >
                            <FileText className="h-3 w-3" /> Ledger
                          </button>

                          <button
                            type="button"
                            onClick={() => setPrintSlipPatient(patient)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                            title="Print Discharge Summary Slip"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {detailAdmissionId && (
        <AdmissionDetailModal
          admissionId={detailAdmissionId}
          initialTab="overview"
          onClose={() => setDetailAdmissionId(null)}
          onChanged={() => load()}
        />
      )}

      {ledgerAdmissionId && (
        <AdmissionLedgerModal
          admissionId={ledgerAdmissionId}
          readOnly
          onClose={() => setLedgerAdmissionId(null)}
        />
      )}

      {/* Printable Discharge Summary Slip Modal */}
      {printSlipPatient && (
        <Modal
          isOpen
          onClose={() => setPrintSlipPatient(null)}
          title={`Discharge Summary Slip — ${printSlipPatient.admissionNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            {/* Slip Paper Preview */}
            <div
              id="discharge-slip-content"
              className="p-5 bg-white border border-slate-300 rounded-xl space-y-4 text-xs font-sans shadow-xs"
            >
              {/* Slip Header */}
              <div className="text-center pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  CH Sharif &amp; Saeed Hospital
                </h3>
                <p className="text-[10px] text-slate-500">Inpatient Discharge Summary Slip</p>
                <div className="mt-1 font-mono text-[10px] font-bold text-slate-700">
                  Admission #{printSlipPatient.admissionNumber}
                </div>
              </div>

              {/* Patient Block */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">PATIENT NAME</span>
                  <span className="font-bold text-slate-900">{printSlipPatient.patientName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">MR NUMBER</span>
                  <span className="font-mono font-bold text-slate-900">{printSlipPatient.patientMrNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">DEPARTMENT</span>
                  <span className="text-slate-800">{printSlipPatient.departmentName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ATTENDING DOCTOR</span>
                  <span className="text-slate-800">Dr. {printSlipPatient.doctorName || 'Assigned'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">PAYER TYPE</span>
                  <span className="font-semibold text-slate-800">{printSlipPatient.payerType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">LAST BED / WARD</span>
                  <span className="text-slate-800">{printSlipPatient.bedLabel || 'Bed Released'}</span>
                </div>
              </div>

              {/* Admission & Discharge Timestamps */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">ADMITTED AT</span>
                  <span className="font-medium text-slate-800">
                    {formatDisplayDateTime(printSlipPatient.admittedAt || printSlipPatient.createdAtIso)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">DISCHARGED AT</span>
                  <span className="font-medium text-emerald-800">
                    {formatDisplayDateTime(printSlipPatient.dischargedAt)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px]">TOTAL STAY DURATION</span>
                  <span className="font-bold text-slate-900">
                    {computeStayDuration(printSlipPatient.admittedAt || printSlipPatient.createdAtIso, printSlipPatient.dischargedAt)}
                  </span>
                </div>
              </div>

              {printSlipPatient.diagnosis && (
                <div className="pb-3 border-b border-slate-100">
                  <span className="text-slate-400 block text-[10px]">DIAGNOSIS</span>
                  <p className="text-slate-800 italic mt-0.5">{printSlipPatient.diagnosis}</p>
                </div>
              )}

              {/* Clearance Status */}
              <div>
                <span className="text-slate-400 block text-[10px] mb-1">MANDATORY DISCHARGE CLEARANCES</span>
                <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center font-bold">
                  <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                    Clinical: CLEARED
                  </div>
                  <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                    Billing: CLEARED
                  </div>
                  <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                    Pharmacy: CLEARED
                  </div>
                </div>
              </div>

              {/* Slip Sign-off */}
              <div className="pt-4 flex items-center justify-between text-[10px] text-slate-400">
                <span>Discharge Authorized</span>
                <span>Hospital Officer Signature</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPrintSlipPatient(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" /> Print Slip
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
