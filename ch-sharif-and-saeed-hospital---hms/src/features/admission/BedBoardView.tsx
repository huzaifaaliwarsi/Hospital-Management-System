import React, { useMemo, useState } from 'react';
import { LayoutGrid, User } from 'lucide-react';
import { WardsRoomsBedsService } from '../../services/wardsRoomsBedsService';
import type { Bed } from '../../types/wardsRoomsBeds';
import { AdmissionDetailModal } from './AdmissionDetailModal';

const OCCUPANCY_STYLE: Record<string, string> = {
  Available: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  Occupied: 'bg-rose-50 border-rose-200 text-rose-800',
  Reserved: 'bg-amber-50 border-amber-200 text-amber-800',
  Maintenance: 'bg-slate-100 border-slate-300 text-slate-500',
};

/**
 * Bed Board / Transfers — pure read/render over `WardsRoomsBedsService`'s
 * already-primed cache (backend already cross-references the active
 * admission occupying each bed, `setup.service.ts`'s `decorateBed`), so
 * this page needs zero new backend calls. Clicking an occupied bed opens
 * the admission's detail modal, pre-selected to the Bed Transfer tab.
 */
export const BedBoardView: React.FC = () => {
  const beds = useMemo(() => WardsRoomsBedsService.getBeds(), []);
  const wards = useMemo(() => WardsRoomsBedsService.getWards(), []);
  const rooms = useMemo(() => WardsRoomsBedsService.getRooms(), []);
  const [detailId, setDetailId] = useState<string | null>(null);

  const occupied = beds.filter((b) => b.occupancyStatus === 'Occupied').length;
  const available = beds.filter((b) => b.occupancyStatus === 'Available').length;

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bed Board / Transfers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {beds.length} beds • {occupied} occupied • {available} available
          </p>
        </div>
      </div>

      {beds.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
          No beds configured yet — add wards/rooms/beds from Hospital Management.
        </div>
      ) : (
        wards.map((ward) => {
          const wardRooms = rooms.filter((r) => r.wardId === ward.id);
          if (wardRooms.length === 0) return null;
          return (
            <div key={ward.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">{ward.name}</h3>
              <div className="space-y-3">
                {wardRooms.map((room) => {
                  const roomBeds = beds.filter((b) => b.roomId === room.id);
                  if (roomBeds.length === 0) return null;
                  return (
                    <div key={room.id}>
                      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">{room.name}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {roomBeds.map((bed: Bed) => (
                          <button
                            key={bed.id}
                            type="button"
                            disabled={!bed.admissionId}
                            onClick={() => bed.admissionId && setDetailId(bed.admissionId)}
                            className={`p-2.5 rounded-lg border text-left transition-colors ${OCCUPANCY_STYLE[bed.occupancyStatus] || 'bg-slate-50 border-slate-200 text-slate-600'} ${bed.admissionId ? 'hover:shadow-xs cursor-pointer' : 'cursor-default'}`}
                          >
                            <span className="block text-xs font-bold">{bed.bedNumber}</span>
                            <span className="block text-[10px] mt-0.5">{bed.occupancyStatus}</span>
                            {bed.currentPatientName && (
                              <span className="flex items-center gap-1 text-[10px] mt-1 truncate">
                                <User className="h-2.5 w-2.5 shrink-0" /> {bed.currentPatientName}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {detailId && <AdmissionDetailModal admissionId={detailId} initialTab="bed" onClose={() => setDetailId(null)} />}
    </div>
  );
};
