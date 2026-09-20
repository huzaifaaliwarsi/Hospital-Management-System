import React, { useEffect, useMemo, useState } from 'react';
import { Bed, Users, Activity, CheckCircle2, Clock, ArrowLeftRight, Loader2, AlertCircle } from 'lucide-react';
import { PanelBadge } from '../../components/common/PanelBadge';
import { useRouter } from '../../context/RouterContext';
import { fetchAdmissions, AdmissionRecord } from '../../services/admissionService';
import { WardsRoomsBedsService } from '../../services/wardsRoomsBedsService';

/**
 * Admission Dashboard — every figure here is real, backed by `/admissions`
 * and the already-primed wards/rooms/beds cache. Previously 100%
 * hardcoded (fake bed counts, fake patient names) — rebuilt the same way
 * `FrontDeskDashboard.tsx` was in an earlier session.
 */
export const AdmissionDashboard: React.FC = () => {
  const { navigate } = useRouter();

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

  const beds = useMemo(() => WardsRoomsBedsService.getBeds(), []);
  const wards = useMemo(() => WardsRoomsBedsService.getWards(), []);

  const activeAdmissions = admissions.filter((a) => a.status === 'ACTIVE');
  const plannedCount = admissions.filter((a) => a.status === 'PLANNED' || a.status === 'CONFIRMED').length;
  const dischargedTodayCount = admissions.filter((a) => {
    if (a.status !== 'DISCHARGED' || !a.dischargedAt) return false;
    return new Date().toDateString() === new Date(a.createdAtIso || a.dischargedAt).toDateString();
  }).length;

  const occupiedBeds = beds.filter((b) => b.occupancyStatus === 'Occupied').length;
  const availableBeds = beds.filter((b) => b.occupancyStatus === 'Available').length;
  const occupancyRate = beds.length > 0 ? Math.round((occupiedBeds / beds.length) * 100) : 0;

  const kpis = [
    { title: 'Total Hospital Beds', value: `${beds.length} Beds`, sub: `Across ${wards.length} wards`, icon: Bed, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Occupied Beds', value: `${occupiedBeds} (${occupancyRate}%)`, sub: 'Active inpatient census', icon: Users, color: 'text-[#129b70] bg-[#effaf5]' },
    { title: 'Available Beds', value: `${availableBeds} Free`, sub: 'Ready for admissions', icon: CheckCircle2, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Active Admissions', value: `${activeAdmissions.length}`, sub: 'Currently admitted inpatients', icon: Activity, color: 'text-rose-700 bg-rose-50' },
    { title: 'Planned / Confirmed', value: `${plannedCount}`, sub: 'Awaiting check-in from Front Desk', icon: Clock, color: 'text-amber-700 bg-amber-50' },
    { title: "Today's Discharges", value: `${dischargedTodayCount}`, sub: 'Discharged today', icon: CheckCircle2, color: 'text-[#129b70] bg-[#effaf5]' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admission Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Inpatient stay overview — bed occupancy, active admissions, discharge queue.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admission/bed_board_transfers')}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" /> Bed Board
        </button>
      </div>

      {loadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" /> {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.title} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${k.color}`}>
              <k.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 leading-none">{k.value}</p>
              <p className="text-[11px] text-slate-500 mt-1">{k.title}</p>
              <p className="text-[10px] text-slate-400">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Active Inpatients</h3>
          <button type="button" onClick={() => navigate('/admission/active_admissions')} className="text-[11px] font-semibold text-[#08775A] hover:underline">
            View All
          </button>
        </div>
        {isLoading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-xs">Loading…</span>
          </div>
        ) : activeAdmissions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No active inpatients right now.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Admission #', 'Patient', 'Department', 'Doctor', 'Bed', 'Medication Mode'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeAdmissions.slice(0, 8).map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-slate-700">{a.admissionNumber}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{a.patientName}</div>
                      {a.payerType === 'Corporate / Panel' && <PanelBadge className="mt-0.5" />}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{a.departmentName}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">{a.doctorName || 'Not Assigned'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{a.bedLabel || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${a.medicationMode === 'HOSPITAL_MANAGED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {a.medicationMode === 'HOSPITAL_MANAGED' ? 'Hospital Managed' : 'Self'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
