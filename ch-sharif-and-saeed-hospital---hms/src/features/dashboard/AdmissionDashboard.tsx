import React, { useEffect, useMemo, useState } from 'react';
import {
  Bed,
  Users,
  Activity,
  CheckCircle2,
  Clock,
  ArrowLeftRight,
  Loader2,
  AlertCircle,
  Building2,
  DoorOpen,
  LogIn,
  Eye,
  Calendar,
  Layers,
  Sparkles,
  UserCheck,
  RotateCw,
} from 'lucide-react';
import { PanelBadge } from '../../components/common/PanelBadge';
import { useRouter } from '../../context/RouterContext';
import { fetchAdmissions, AdmissionRecord } from '../../services/admissionService';
import { WardsRoomsBedsService, fetchWardHierarchy } from '../../services/wardsRoomsBedsService';
import { Ward, Room, Bed as WardBed } from '../../types/wardsRoomsBeds';
import { CheckInAdmissionModal } from '../admission/CheckInAdmissionModal';
import { AdmissionDetailModal } from '../admission/AdmissionDetailModal';
import { formatDateTimeDDMMYYYY } from '../../utils/formatters';

function formatDisplayDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return formatDateTimeDDMMYYYY(iso) || '—';
}

export const AdmissionDashboard: React.FC = () => {
  const { navigate } = useRouter();

  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [hierarchy, setHierarchy] = useState<{ wards: Ward[]; rooms: Room[]; beds: WardBed[] }>({
    wards: WardsRoomsBedsService.getWards(),
    rooms: WardsRoomsBedsService.getRooms(),
    beds: WardsRoomsBedsService.getBeds(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [checkInTarget, setCheckInTarget] = useState<AdmissionRecord | null>(null);
  const [detailAdmissionId, setDetailAdmissionId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [admissionsRes, hierarchyRes] = await Promise.all([
        fetchAdmissions(),
        fetchWardHierarchy().catch(() => ({
          wards: WardsRoomsBedsService.getWards(),
          rooms: WardsRoomsBedsService.getRooms(),
          beds: WardsRoomsBedsService.getBeds(),
        })),
      ]);
      setAdmissions(admissionsRes);
      setHierarchy(hierarchyRes);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load admission dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const { wards, rooms, beds } = hierarchy;

  // Admission subsets
  const plannedAdmissions = useMemo(
    () => admissions.filter((a) => a.status === 'PLANNED' || a.status === 'CONFIRMED'),
    [admissions]
  );
  const activeAdmissions = useMemo(
    () => admissions.filter((a) => a.status === 'ACTIVE' || a.status === 'DISCHARGE_PENDING'),
    [admissions]
  );

  // Global KPIs
  const occupiedBedsCount = beds.filter((b) => b.occupancyStatus === 'Occupied').length;
  const availableBedsCount = beds.filter((b) => b.occupancyStatus === 'Available').length;
  const overallOccupancyRate = beds.length > 0 ? Math.round((occupiedBedsCount / beds.length) * 100) : 0;

  // Computed per-ward statistics
  const wardCardsData = useMemo(() => {
    const list = wards.map((ward) => {
      const wardRooms = rooms.filter((r) => r.wardId === ward.id);
      const wardBeds = beds.filter((b) => b.wardId === ward.id);

      const totalRooms = wardRooms.length;
      // Room considered occupied/in-use if at least one bed in it is occupied
      const occupiedRooms = wardRooms.filter((r) =>
        wardBeds.some((b) => b.roomId === r.id && b.occupancyStatus === 'Occupied')
      ).length;

      const totalBeds = wardBeds.length;
      const occupiedBeds = wardBeds.filter((b) => b.occupancyStatus === 'Occupied').length;
      const availableBeds = wardBeds.filter((b) => b.occupancyStatus === 'Available').length;
      const maintenanceBeds = wardBeds.filter(
        (b) => b.occupancyStatus === 'Maintenance' || b.occupancyStatus === 'Reserved'
      ).length;

      const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      return {
        ward,
        totalRooms,
        occupiedRooms,
        totalBeds,
        occupiedBeds,
        availableBeds,
        maintenanceBeds,
        occupancyPercent,
      };
    });

    // Standalone rooms (rooms without parent ward)
    const standaloneRooms = rooms.filter((r) => !r.wardId);
    if (standaloneRooms.length > 0) {
      const standaloneBeds = beds.filter((b) => !b.wardId);
      const totalRooms = standaloneRooms.length;
      const occupiedRooms = standaloneRooms.filter((r) =>
        standaloneBeds.some((b) => b.roomId === r.id && b.occupancyStatus === 'Occupied')
      ).length;
      const totalBeds = standaloneBeds.length;
      const occupiedBeds = standaloneBeds.filter((b) => b.occupancyStatus === 'Occupied').length;
      const availableBeds = standaloneBeds.filter((b) => b.occupancyStatus === 'Available').length;
      const maintenanceBeds = standaloneBeds.filter(
        (b) => b.occupancyStatus === 'Maintenance' || b.occupancyStatus === 'Reserved'
      ).length;
      const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      list.push({
        ward: {
          id: 'standalone',
          code: 'STANDALONE',
          name: 'Private & Standalone Rooms',
          departmentId: '',
          departmentName: 'General',
          wardType: 'Private',
          floor: 'Various',
          genderPolicy: undefined,
          status: 'Active',
          roomCount: totalRooms,
          bedCount: totalBeds,
          availableBeds: availableBeds,
          historicalAdmissionCount: 0,
          createdBy: 'System',
          createdAt: '',
          updatedBy: 'System',
          updatedAt: '',
        },
        totalRooms,
        occupiedRooms,
        totalBeds,
        occupiedBeds,
        availableBeds,
        maintenanceBeds,
        occupancyPercent,
      });
    }

    return list;
  }, [wards, rooms, beds]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#effaf5] border border-[#c2e7db] text-[#08775A] flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Admission & Inpatient Dashboard</h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
                Live Ward Stay Management
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
              <span>Census: <strong className="text-slate-800">{activeAdmissions.length} Admitted</strong></span>
              <span className="text-slate-300">•</span>
              <span>Available Beds: <strong className="text-emerald-700">{availableBedsCount}</strong> / {beds.length}</span>
              <span className="text-slate-300">•</span>
              <span>Planned Arrivals: <strong className="text-blue-700">{plannedAdmissions.length}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="h-8.5 px-3 rounded-lg border border-[#c2e7db] bg-[#effaf5] hover:bg-[#d8f1e7] text-[#08775A] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-2xs"
            title="Refresh live admission data"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Syncing...' : 'Live Sync'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admission/discharged_patients')}
            className="h-8.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="h-3.5 w-3.5 text-[#08775A]" />
            <span>Discharged Patients</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admission/admission_check_in')}
            className="h-8.5 px-3.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Check-In Queue ({plannedAdmissions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admission/bed_board_transfers')}
            className="h-8.5 px-4 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Bed Board & Transfers</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" /> {loadError}
        </div>
      )}

      {/* Global Quick Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0">
            <Bed className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-slate-900 leading-none">{beds.length} Beds</p>
            <p className="text-[11px] text-slate-500 mt-1">Total Hospital Beds</p>
            <p className="text-[10px] text-slate-400">Across {wards.length} wards</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-emerald-800 leading-none">{availableBedsCount} Free</p>
            <p className="text-[11px] text-slate-500 mt-1">Available Beds</p>
            <p className="text-[10px] text-slate-400">Ready for admission</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-blue-800 leading-none">{plannedAdmissions.length} Incoming</p>
            <p className="text-[11px] text-slate-500 mt-1">Planned Admissions</p>
            <p className="text-[10px] text-slate-400">Awaiting check-in</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Users className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-purple-800 leading-none">
              {occupiedBedsCount} ({overallOccupancyRate}%)
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Occupied Beds</p>
            <p className="text-[10px] text-slate-400">{activeAdmissions.length} active stays</p>
          </div>
        </div>
      </div>

      {/* Ward Cards Section — User requirement: "cards ma ward name or usma jitna room or bed hain phir wo dikha neecha jesa room 6/10 is trh" */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#08775A]" />
            <h2 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
              Wards Overview & Bed Occupancy
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {wardCardsData.length} Ward{wardCardsData.length === 1 ? '' : 's'} Configured
          </span>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-[#08775A]" />
            <span className="text-xs font-medium">Loading ward cards…</span>
          </div>
        ) : wardCardsData.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            No wards configured yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wardCardsData.map((item) => {
              const { ward, totalRooms, occupiedRooms, totalBeds, occupiedBeds, availableBeds, maintenanceBeds, occupancyPercent } = item;

              // Occupancy color bar
              const barColor =
                occupancyPercent >= 90
                  ? 'bg-rose-500'
                  : occupancyPercent >= 70
                  ? 'bg-amber-500'
                  : 'bg-[#08775A]';

              return (
                <div
                  key={ward.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-[#08775A]/40 transition-all p-4 flex flex-col justify-between"
                >
                  {/* Card Header: Ward Name & Badges */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900">{ward.name}</h3>
                          {ward.code && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-semibold">
                              {ward.code}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {ward.departmentName || 'General Ward'} {ward.floor ? `• ${ward.floor}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {ward.wardType && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {ward.wardType}
                          </span>
                        )}
                        {ward.genderPolicy && ward.genderPolicy !== 'Not Applicable' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            {ward.genderPolicy}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Room & Bed Ratio Blocks — "room 6/10 is trh" */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                      {/* Room Block */}
                      <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100 flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-md bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
                          <DoorOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rooms</p>
                          <p className="text-sm font-bold text-slate-900 leading-tight">
                            {occupiedRooms} / {totalRooms}
                          </p>
                          <p className="text-[9px] text-slate-400">In use / Total</p>
                        </div>
                      </div>

                      {/* Bed Block */}
                      <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100 flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-md bg-emerald-100/70 text-[#08775A] flex items-center justify-center shrink-0">
                          <Bed className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Beds</p>
                          <p className="text-sm font-bold text-slate-900 leading-tight">
                            {occupiedBeds} / {totalBeds}
                          </p>
                          <p className="text-[9px] text-slate-400">Occupied / Total</p>
                        </div>
                      </div>
                    </div>

                    {/* Occupancy Progress Bar */}
                    <div className="mt-3.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Occupancy</span>
                        <span className="font-bold text-slate-800">{occupancyPercent}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all duration-300`}
                          style={{ width: `${Math.min(100, occupancyPercent)}%` }}
                        />
                      </div>
                    </div>

                    {/* Bed Status Breakdown Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-2 text-[10px]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-medium border border-rose-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        {occupiedBeds} Occupied
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {availableBeds} Free
                      </span>
                      {maintenanceBeds > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium border border-amber-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          {maintenanceBeds} Maint
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {availableBeds > 0 ? (
                        <span className="text-emerald-700 font-semibold">{availableBeds} beds ready</span>
                      ) : (
                        <span className="text-rose-600 font-semibold">Ward Full</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/admission/bed_board_transfers')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#08775A] hover:text-[#065f46] hover:underline"
                    >
                      <ArrowLeftRight className="h-3 w-3" /> Bed Board
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two Column Grid: Planned Admissions ("jo banda aarha ha") and Active Admissions ("isi trh active ka bhi") */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Planned / Incoming Admissions Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-blue-50/50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Planned Admissions (Incoming)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    {plannedAdmissions.length}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">Awaiting arrival and bed check-in</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/admission/planned_admissions')}
              className="text-[11px] font-semibold text-blue-700 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="p-3 divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[460px]">
            {isLoading ? (
              <div className="p-8 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-xs">Loading planned admissions…</span>
              </div>
            ) : plannedAdmissions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No incoming planned admissions right now.
              </div>
            ) : (
              plannedAdmissions.slice(0, 6).map((a) => (
                <div
                  key={a.id}
                  className="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 hover:bg-slate-50/70 p-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{a.patientName}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {a.patientMrNumber || a.admissionNumber}
                      </span>
                      {a.payerType === 'Corporate / Panel' && <PanelBadge />}
                    </div>

                    <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700">{a.departmentName}</span>
                      <span>•</span>
                      <span>Dr. {a.doctorName || 'Unassigned'}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                        <Calendar className="h-3 w-3" />
                        Expected: {formatDisplayDateTime(a.expectedAt || a.createdAtIso)}
                      </span>
                      {a.bedLabel ? (
                        <span className="font-medium text-slate-700">Bed: {a.bedLabel}</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Bed Unassigned</span>
                      )}
                    </div>

                    {a.diagnosis && (
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">
                        Dx: {a.diagnosis}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCheckInTarget(a)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#08775A] hover:bg-[#065f46] text-white rounded text-[11px] font-semibold shadow-2xs transition-colors"
                    >
                      <LogIn className="h-3 w-3" /> Check-In
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailAdmissionId(a.id)}
                      className="text-[10px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                    >
                      <Eye className="h-3 w-3" /> View
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Inpatients Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-emerald-50/50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 text-[#08775A] flex items-center justify-center shrink-0">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Active Inpatients
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {activeAdmissions.length}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">Currently admitted in hospital beds</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/admission/active_admissions')}
              className="text-[11px] font-semibold text-[#08775A] hover:underline"
            >
              View All
            </button>
          </div>

          <div className="p-3 divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[460px]">
            {isLoading ? (
              <div className="p-8 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-[#08775A]" />
                <span className="text-xs">Loading active inpatients…</span>
              </div>
            ) : activeAdmissions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No active inpatients right now.
              </div>
            ) : (
              activeAdmissions.slice(0, 6).map((a) => (
                <div
                  key={a.id}
                  className="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 hover:bg-slate-50/70 p-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{a.patientName}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {a.admissionNumber}
                      </span>
                      {a.payerType === 'Corporate / Panel' && <PanelBadge />}
                    </div>

                    <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#08775A]">{a.bedLabel || 'Bed Assigned'}</span>
                      <span>•</span>
                      <span>{a.departmentName}</span>
                      <span>•</span>
                      <span>Dr. {a.doctorName || 'Assigned'}</span>
                    </div>

                    <div className="flex items-center gap-2.5 mt-1 text-[10px] text-slate-500 flex-wrap">
                      <span className="text-slate-500">
                        Admitted: {formatDisplayDateTime(a.admittedAt || a.createdAtIso)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          a.medicationMode === 'HOSPITAL_MANAGED'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {a.medicationMode === 'HOSPITAL_MANAGED' ? 'Hospital Managed' : 'Self Med'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDetailAdmissionId(a.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold shadow-2xs transition-colors"
                    >
                      <Eye className="h-3 w-3 text-[#08775A]" /> Manage Stay
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/admission/bed_board_transfers')}
                      className="text-[10px] font-medium text-slate-500 hover:text-[#08775A] flex items-center gap-0.5"
                    >
                      <ArrowLeftRight className="h-3 w-3" /> Bed
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Interactive Modals */}
      {checkInTarget && (
        <CheckInAdmissionModal
          admission={checkInTarget}
          onClose={() => setCheckInTarget(null)}
          onCheckedIn={() => {
            setCheckInTarget(null);
            load();
          }}
        />
      )}

      {detailAdmissionId && (
        <AdmissionDetailModal
          admissionId={detailAdmissionId}
          onClose={() => setDetailAdmissionId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
};
