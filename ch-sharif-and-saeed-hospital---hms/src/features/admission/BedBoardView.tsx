import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid,
  Bed as BedIcon,
  Search,
  RotateCcw,
  RefreshCw,
  DoorOpen,
  Building2,
  CheckCircle2,
  Clock,
  LogIn,
  Layers,
} from 'lucide-react';
import { PanelBadge } from '../../components/common/PanelBadge';
import { Modal } from '../../components/common/Modal';
import { useRouter } from '../../context/RouterContext';
import { fetchAdmissions, AdmissionRecord } from '../../services/admissionService';
import { WardsRoomsBedsService, fetchWardHierarchy } from '../../services/wardsRoomsBedsService';
import type { Ward, Room, Bed } from '../../types/wardsRoomsBeds';
import { AdmissionDetailModal } from './AdmissionDetailModal';
import { CheckInAdmissionModal } from './CheckInAdmissionModal';
import { formatDateTimeDDMMYYYY } from '../../utils/formatters';

function formatDisplayDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return formatDateTimeDDMMYYYY(iso) || '—';
}

export const BedBoardView: React.FC = () => {
  const { navigate } = useRouter();

  const [wards, setWards] = useState<Ward[]>(() => WardsRoomsBedsService.getWards());
  const [rooms, setRooms] = useState<Room[]>(() => WardsRoomsBedsService.getRooms());
  const [beds, setBeds] = useState<Bed[]>(() => WardsRoomsBedsService.getBeds());
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWardFilter, setSelectedWardFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'Available' | 'Occupied' | 'Maintenance'>('ALL');

  // Modals
  const [detailAdmissionId, setDetailAdmissionId] = useState<string | null>(null);
  const [assignTargetBed, setAssignTargetBed] = useState<Bed | null>(null);
  const [checkInTargetAdmission, setCheckInTargetAdmission] = useState<AdmissionRecord | null>(null);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [hierarchyRes, admissionsRes] = await Promise.all([
        fetchWardHierarchy(),
        fetchAdmissions(),
      ]);
      setWards(hierarchyRes.wards);
      setRooms(hierarchyRes.rooms);
      setBeds(hierarchyRes.beds);
      setAdmissions(admissionsRes);
    } catch (err) {
      console.error('Failed to refresh bed board data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map admissions by bedId for quick lookup
  const admissionByBedId = useMemo(() => {
    const map = new Map<string, AdmissionRecord>();
    for (const a of admissions) {
      if (a.bedId && (a.status === 'ACTIVE' || a.status === 'DISCHARGE_PENDING' || a.status === 'CONFIRMED' || a.status === 'PLANNED')) {
        map.set(a.bedId, a);
      }
    }
    return map;
  }, [admissions]);

  // Planned admissions awaiting bed check-in
  const plannedAdmissions = useMemo(
    () => admissions.filter((a) => a.status === 'PLANNED' || a.status === 'CONFIRMED'),
    [admissions]
  );

  // Stats
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.occupancyStatus === 'Occupied').length;
  const availableBeds = beds.filter((b) => b.occupancyStatus === 'Available').length;
  const maintenanceBeds = beds.filter((b) => b.occupancyStatus === 'Maintenance' || b.operationalStatus === 'Cleaning' || b.operationalStatus === 'Maintenance').length;

  // Filtered beds
  const filteredBeds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return beds.filter((b) => {
      // Ward filter
      if (selectedWardFilter !== 'ALL' && b.wardId !== selectedWardFilter) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter !== 'ALL') {
        if (selectedStatusFilter === 'Maintenance') {
          if (b.occupancyStatus !== 'Maintenance' && b.operationalStatus !== 'Cleaning' && b.operationalStatus !== 'Maintenance') {
            return false;
          }
        } else if (b.occupancyStatus !== selectedStatusFilter) {
          return false;
        }
      }
      // Text search
      if (q) {
        const matchesBed = b.bedNumber.toLowerCase().includes(q) || b.code.toLowerCase().includes(q);
        const matchesRoom = (b.roomName || '').toLowerCase().includes(q) || (b.roomNumber || '').toLowerCase().includes(q);
        const matchesWard = (b.wardName || '').toLowerCase().includes(q);
        const matchesPatient = (b.currentPatientName || '').toLowerCase().includes(q);
        const adm = admissionByBedId.get(b.id);
        const matchesAdm = adm
          ? adm.patientName.toLowerCase().includes(q) ||
            adm.admissionNumber.toLowerCase().includes(q) ||
            adm.patientMrNumber.toLowerCase().includes(q)
          : false;

        if (!matchesBed && !matchesRoom && !matchesWard && !matchesPatient && !matchesAdm) {
          return false;
        }
      }
      return true;
    });
  }, [beds, searchQuery, selectedWardFilter, selectedStatusFilter, admissionByBedId]);

  // Group filtered beds by Ward and Room
  const groupedStructure = useMemo(() => {
    const wardMap = new Map<
      string,
      {
        ward: Ward | null;
        rooms: Map<string, { room: Room | null; beds: Bed[] }>;
        directBeds: Bed[];
      }
    >();

    // Prepare entries for all wards
    wards.forEach((w) => {
      if (selectedWardFilter === 'ALL' || selectedWardFilter === w.id) {
        wardMap.set(w.id, {
          ward: w,
          rooms: new Map(),
          directBeds: [],
        });
      }
    });

    // Standalone rooms
    const standaloneKey = '__STANDALONE__';
    if (selectedWardFilter === 'ALL' || selectedWardFilter === standaloneKey) {
      wardMap.set(standaloneKey, {
        ward: null,
        rooms: new Map(),
        directBeds: [],
      });
    }

    // Distribute filtered beds
    filteredBeds.forEach((b) => {
      const wardKey = b.wardId && wardMap.has(b.wardId) ? b.wardId : standaloneKey;
      const wardGroup = wardMap.get(wardKey);
      if (!wardGroup) return;

      if (b.roomId) {
        if (!wardGroup.rooms.has(b.roomId)) {
          const roomObj = rooms.find((r) => r.id === b.roomId) || null;
          wardGroup.rooms.set(b.roomId, { room: roomObj, beds: [] });
        }
        wardGroup.rooms.get(b.roomId)!.beds.push(b);
      } else {
        wardGroup.directBeds.push(b);
      }
    });

    return Array.from(wardMap.entries()).filter(([_, group]) => {
      let bedCount = group.directBeds.length;
      group.rooms.forEach((r) => {
        bedCount += r.beds.length;
      });
      return bedCount > 0;
    });
  }, [wards, rooms, filteredBeds, selectedWardFilter]);

  const hasActiveFilters = searchQuery.trim() !== '' || selectedWardFilter !== 'ALL' || selectedStatusFilter !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedWardFilter('ALL');
    setSelectedStatusFilter('ALL');
  };

  // Render a compact, clean Bed Card
  const renderBedCard = (bed: Bed) => {
    const isOccupied = bed.occupancyStatus === 'Occupied';
    const isAvailable = bed.occupancyStatus === 'Available';
    const isReserved = bed.occupancyStatus === 'Reserved';

    const adm = bed.id ? admissionByBedId.get(bed.id) : null;
    const patientName = bed.currentPatientName || adm?.patientName;
    const admissionIdToUse = bed.admissionId || adm?.id;

    // Card styling
    let cardClasses = 'border-slate-200 bg-white hover:border-slate-300';
    let dotColor = 'bg-slate-400';

    if (isOccupied) {
      cardClasses = 'border-rose-200 bg-rose-50/30 hover:border-rose-300 hover:bg-rose-50/60 shadow-2xs';
      dotColor = 'bg-rose-500';
    } else if (isAvailable) {
      cardClasses = 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300 hover:bg-emerald-50/60 shadow-2xs';
      dotColor = 'bg-emerald-500';
    } else if (isReserved) {
      cardClasses = 'border-amber-200 bg-amber-50/30 hover:border-amber-300 hover:bg-amber-50/60 shadow-2xs';
      dotColor = 'bg-amber-500';
    } else {
      cardClasses = 'border-slate-200 bg-slate-50/60 hover:bg-slate-100';
      dotColor = 'bg-slate-400';
    }

    const handleClick = () => {
      if (isOccupied && admissionIdToUse) {
        setDetailAdmissionId(admissionIdToUse);
      } else if (isAvailable) {
        setAssignTargetBed(bed);
      }
    };

    return (
      <div
        key={bed.id}
        onClick={handleClick}
        className={`rounded-lg border p-2.5 flex flex-col justify-between transition-all duration-150 cursor-pointer min-h-[76px] ${cardClasses}`}
        title={
          isOccupied
            ? `Bed ${bed.bedNumber}: Click to manage stay / transfer`
            : isAvailable
            ? `Bed ${bed.bedNumber}: Click to assign planned patient`
            : `Bed ${bed.bedNumber} (${bed.operationalStatus})`
        }
      >
        {/* Top: Bed Number + Dot */}
        <div className="flex items-center justify-between gap-1 leading-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold text-slate-900 truncate">{bed.bedNumber}</span>
            {bed.bedType && bed.bedType !== 'Standard' && (
              <span className="text-[9px] text-slate-400 font-medium">({bed.bedType})</span>
            )}
          </div>
          <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
        </div>

        {/* Content */}
        <div className="mt-1">
          {isOccupied ? (
            <div>
              <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">
                {patientName || 'Admitted'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] font-mono text-slate-500 truncate">
                  {adm?.patientMrNumber || adm?.admissionNumber || 'Inpatient'}
                </span>
                {adm?.payerType === 'Corporate / Panel' && <PanelBadge className="scale-75 origin-left" />}
              </div>
            </div>
          ) : isAvailable ? (
            <div>
              <p className="text-[11px] font-semibold text-emerald-700 leading-tight">Available</p>
              <p className="text-[9px] text-emerald-600/70 mt-0.5">+ Assign</p>
            </div>
          ) : isReserved ? (
            <div>
              <p className="text-[11px] font-semibold text-amber-700 leading-tight">Reserved</p>
              <p className="text-[9px] text-amber-600/70 mt-0.5">Held</p>
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-semibold text-slate-600 leading-tight">
                {bed.operationalStatus || 'Maintenance'}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Out of service</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Compact Top Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center font-bold">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">Bed Board &amp; Transfers</h1>
            <p className="text-[11px] text-slate-500">
              Click any bed: <span className="text-emerald-700 font-semibold">Available</span> to assign patient, or{' '}
              <span className="text-rose-700 font-semibold">Occupied</span> to transfer / view stay.
            </p>
          </div>
        </div>

        {/* Quick inline stats & actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <span className="text-slate-600 font-medium">Total: <b>{totalBeds}</b></span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-semibold">Free: <b>{availableBeds}</b></span>
            <span className="text-slate-300">•</span>
            <span className="text-rose-700 font-semibold">Occupied: <b>{occupiedBeds}</b></span>
            {maintenanceBeds > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">Maint: <b>{maintenanceBeds}</b></span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors"
            title="Refresh Bed Status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#08775A]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Simple, Compact Filter Strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative w-48 sm:w-60">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search bed, patient, room…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A] bg-slate-50/60"
            />
          </div>

          {/* Ward Dropdown */}
          <select
            value={selectedWardFilter}
            onChange={(e) => setSelectedWardFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A] bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Wards</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
            <option value="__STANDALONE__">Standalone Rooms</option>
          </select>

          {/* Status Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('ALL')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                selectedStatusFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('Available')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                selectedStatusFilter === 'Available'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Available ({availableBeds})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('Occupied')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                selectedStatusFilter === 'Occupied'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              Occupied ({occupiedBeds})
            </button>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {/* Main Bed Grid */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin text-[#08775A]" />
          <span className="text-xs">Loading beds…</span>
        </div>
      ) : groupedStructure.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
          No beds found matching your search.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedStructure.map(([wardId, wardData]) => {
            const ward = wardData.ward;
            const wardTitle = ward ? ward.name : 'Standalone / Private Rooms';

            // Counts for this ward
            let wardTotalBeds = wardData.directBeds.length;
            let wardOccupiedBeds = wardData.directBeds.filter((b) => b.occupancyStatus === 'Occupied').length;
            wardData.rooms.forEach((r) => {
              wardTotalBeds += r.beds.length;
              wardOccupiedBeds += r.beds.filter((b) => b.occupancyStatus === 'Occupied').length;
            });

            return (
              <div key={wardId} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Clean Ward Banner */}
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-[#08775A]" />
                    <h2 className="text-xs font-bold text-slate-900">{wardTitle}</h2>
                    {ward?.genderPolicy && ward.genderPolicy !== 'Not Applicable' && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-medium">
                        {ward.genderPolicy}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    <b>{wardOccupiedBeds}</b> / {wardTotalBeds} Beds Occupied
                  </span>
                </div>

                {/* Rooms and Beds */}
                <div className="p-3.5 space-y-3.5">
                  {Array.from(wardData.rooms.entries()).map(([roomId, roomData]) => {
                    const room = roomData.room;
                    const roomName = room ? room.name : `Room ${roomId}`;

                    return (
                      <div key={roomId} className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                          <DoorOpen className="h-3 w-3 text-slate-400" />
                          <span>{roomName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({roomData.beds.length} bed{roomData.beds.length === 1 ? '' : 's'})
                          </span>
                        </div>

                        {/* Beds Grid: 2 cols on mobile, 4 on tablet, 6 on desktop, 8 on wide */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                          {roomData.beds.map((bed) => renderBedCard(bed))}
                        </div>
                      </div>
                    );
                  })}

                  {wardData.directBeds.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                        <Layers className="h-3 w-3 text-slate-400" />
                        <span>Direct Beds</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                        {wardData.directBeds.map((bed) => renderBedCard(bed))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bed Assignment Modal */}
      {assignTargetBed && (
        <Modal
          isOpen
          onClose={() => setAssignTargetBed(null)}
          title={`Assign Bed ${assignTargetBed.bedNumber} (${assignTargetBed.wardName || 'Ward'})`}
          maxWidth="md"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">Select a planned patient awaiting admission to check them in:</p>

            {plannedAdmissions.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-500">
                No planned admissions waiting for check-in.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                {plannedAdmissions.map((p) => (
                  <div key={p.id} className="p-2.5 hover:bg-slate-50 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{p.patientName}</span>
                        <span className="font-mono text-[10px] text-slate-500">({p.patientMrNumber})</span>
                        {p.payerType === 'Corporate / Panel' && <PanelBadge />}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{p.departmentName} • Dr. {p.doctorName || 'Assigned'}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const target = { ...p, bedId: assignTargetBed.id };
                        setAssignTargetBed(null);
                        setCheckInTargetAdmission(target);
                      }}
                      className="px-2.5 py-1 bg-[#08775A] hover:bg-[#065f46] text-white rounded text-xs font-semibold shrink-0"
                    >
                      Check-In
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setAssignTargetBed(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Check-In Modal */}
      {checkInTargetAdmission && (
        <CheckInAdmissionModal
          admission={checkInTargetAdmission}
          onClose={() => setCheckInTargetAdmission(null)}
          onCheckedIn={() => {
            setCheckInTargetAdmission(null);
            loadData();
          }}
        />
      )}

      {/* Stay / Transfer Modal */}
      {detailAdmissionId && (
        <AdmissionDetailModal
          admissionId={detailAdmissionId}
          initialTab="bed"
          onClose={() => setDetailAdmissionId(null)}
          onChanged={() => loadData()}
        />
      )}
    </div>
  );
};
