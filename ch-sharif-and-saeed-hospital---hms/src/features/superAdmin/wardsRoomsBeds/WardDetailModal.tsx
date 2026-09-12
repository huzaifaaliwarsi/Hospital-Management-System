import React from 'react';
import {
  X,
  LayoutGrid,
  Building,
  Bed,
  CheckCircle2,
  Users,
  Edit2,
  PowerOff,
  Power,
  ShieldCheck,
} from 'lucide-react';
import { Ward, Room } from '../../../types/wardsRoomsBeds';

interface WardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ward: Ward | null;
  rooms: Room[];
  onEdit: (ward: Ward) => void;
  onToggleStatus: (ward: Ward) => void;
}

export const WardDetailModal: React.FC<WardDetailModalProps> = ({
  isOpen,
  onClose,
  ward,
  rooms,
  onEdit,
  onToggleStatus,
}) => {
  if (!isOpen || !ward) return null;

  const wardRooms = rooms.filter((r) => r.wardId === ward.id);

  return (
    <div
      id="ward-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="ward-detail-modal-content"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#08775A] flex items-center justify-center font-bold">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  {ward.code}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    ward.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {ward.status}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">{ward.name}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          {/* Top Meta Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Department
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1">
                {ward.departmentName}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Type: {ward.wardType}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Physical Location
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1">
                {ward.floor || 'Floor: N/A'}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                {ward.location || 'Wing: Main Block'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Gender Policy
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1">
                {ward.genderPolicy || 'None (All)'}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Admission Protocol
              </span>
            </div>
          </div>

          {/* Capacity Breakdown */}
          <div className="bg-[#effaf5] border border-[#c2e7db] rounded-xl p-4">
            <span className="text-[11px] font-bold text-[#08775A] uppercase tracking-wider block mb-3">
              Ward Capacity Summary
            </span>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-[#c2e7db]">
                <div className="text-lg font-bold text-slate-800">{ward.roomCount}</div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">Rooms</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#c2e7db]">
                <div className="text-lg font-bold text-slate-800">{ward.bedCount}</div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Beds</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#c2e7db]">
                <div className="text-lg font-bold text-emerald-700">{ward.availableBeds ?? 0}</div>
                <div className="text-[10px] font-semibold text-emerald-700 uppercase">Available</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#c2e7db]">
                <div className="text-lg font-bold text-indigo-700">
                  {(ward.bedCount ?? 0) - (ward.availableBeds ?? 0)}
                </div>
                <div className="text-[10px] font-semibold text-indigo-700 uppercase">Occupied/Maint</div>
              </div>
            </div>
          </div>

          {/* Rooms in Ward List */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Configured Rooms in this Ward ({wardRooms.length})
            </span>
            {wardRooms.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 italic text-center">
                No rooms configured yet in this ward.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2 px-3">Room Code</th>
                      <th className="py-2 px-3">Room #</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-center">Capacity</th>
                      <th className="py-2 px-3 text-right">Daily Rate</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {wardRooms.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{r.code}</td>
                        <td className="py-2 px-3 text-slate-700">{r.roomNumber}</td>
                        <td className="py-2 px-3 text-slate-800 font-medium">{r.name}</td>
                        <td className="py-2 px-3 text-slate-600">{r.roomType}</td>
                        <td className="py-2 px-3 text-center font-semibold text-slate-700">
                          {r.bedsConfigured} / {r.capacity}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">
                          PKR {(r.dailyRoomRate ?? 0).toLocaleString('en-PK')}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Audit Trail */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 space-y-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>Created By:</span>
              <span className="font-semibold text-slate-700">{ward.createdBy}</span>
            </div>
            <div className="flex justify-between">
              <span>Created At:</span>
              <span className="font-medium text-slate-700">{ward.createdAt}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated By:</span>
              <span className="font-semibold text-slate-700">{ward.updatedBy}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated At:</span>
              <span className="font-medium text-slate-700">{ward.updatedAt}</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              onClick={() => onToggleStatus(ward)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                ward.status === 'Active'
                  ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {ward.status === 'Active' ? (
                <>
                  <PowerOff className="w-3.5 h-3.5" />
                  Deactivate Ward
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5" />
                  Activate Ward
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
                  onEdit(ward);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Ward
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
