import React from 'react';
import {
  X,
  Building,
  Bed as BedIcon,
  CheckCircle2,
  Users,
  Edit2,
  PowerOff,
  Power,
} from 'lucide-react';
import { Room, Bed } from '../../../types/wardsRoomsBeds';

interface RoomDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  beds: Bed[];
  onEdit: (room: Room) => void;
  onToggleStatus: (room: Room) => void;
}

export const RoomDetailModal: React.FC<RoomDetailModalProps> = ({
  isOpen,
  onClose,
  room,
  beds,
  onEdit,
  onToggleStatus,
}) => {
  if (!isOpen || !room) return null;

  const roomBeds = beds.filter((b) => b.roomId === room.id);

  return (
    <div
      id="room-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="room-detail-modal-content"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  {room.code}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    room.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {room.status}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                Room {room.roomNumber} — {room.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-slate-700">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Parent Ward & Dept
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1">{room.wardName}</div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Dept: {room.departmentName}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Type & Capacity
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1">
                {room.roomType} Room
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Capacity: {room.capacity} Bed(s)
              </span>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                Standard Daily Tariff
              </span>
              <div className="text-base font-bold text-emerald-900 mt-1">
                PKR {(room.dailyRoomRate ?? 0).toLocaleString('en-PK')}
              </div>
              <span className="text-[11px] text-emerald-700 block mt-0.5">
                Per Room / Day
              </span>
            </div>
          </div>

          {/* Beds list in this room */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Configured Beds ({roomBeds.length} of {room.capacity} capacity)
            </span>
            {roomBeds.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 italic text-center">
                No beds configured yet in this room.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2 px-3">Bed Code</th>
                      <th className="py-2 px-3">Bed Number</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-right">Daily Rate</th>
                      <th className="py-2 px-3 text-center">Occupancy</th>
                      <th className="py-2 px-3">Admitted Patient</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roomBeds.map((b) => (
                      <tr key={b.id}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{b.code}</td>
                        <td className="py-2 px-3 text-slate-700 font-medium">{b.bedNumber}</td>
                        <td className="py-2 px-3 text-slate-600">{b.bedType}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">
                          PKR {(b.dailyBedRate ?? b.dailyRate ?? 0).toLocaleString('en-PK')}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              b.occupancyStatus === 'Available'
                                ? 'bg-emerald-50 text-emerald-700'
                                : b.occupancyStatus === 'Occupied'
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {b.occupancyStatus}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {b.currentPatientName ? (
                            <span className="font-semibold text-indigo-900">
                              {b.currentPatientName} (MRN: {b.currentPatientMrn})
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Audit */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 space-y-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>Created By:</span>
              <span className="font-semibold text-slate-700">{room.createdBy}</span>
            </div>
            <div className="flex justify-between">
              <span>Created At:</span>
              <span className="font-medium text-slate-700">{room.createdAt}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated By:</span>
              <span className="font-semibold text-slate-700">{room.updatedBy}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated At:</span>
              <span className="font-medium text-slate-700">{room.updatedAt}</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              onClick={() => onToggleStatus(room)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                room.status === 'Active'
                  ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {room.status === 'Active' ? (
                <>
                  <PowerOff className="w-3.5 h-3.5" />
                  Deactivate Room
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5" />
                  Activate Room
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onClose();
                  onEdit(room);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Room
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
