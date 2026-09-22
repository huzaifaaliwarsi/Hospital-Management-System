import React from 'react';
import {
  X,
  Bed as BedIcon,
  Building,
  User,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit2,
  PowerOff,
  Power,
  Stethoscope,
} from 'lucide-react';
import { Bed, Room } from '../../../types/wardsRoomsBeds';

interface BedDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bed: Bed | null;
  rooms?: Room[];
  onEdit: (bed: Bed) => void;
  onToggleOperational: (bed: Bed) => void;
}

export const BedDetailModal: React.FC<BedDetailModalProps> = ({
  isOpen,
  onClose,
  bed,
  rooms = [],
  onEdit,
  onToggleOperational,
}) => {
  if (!isOpen || !bed) return null;

  const isOccupied = bed.occupancyStatus === 'Occupied';

  return (
    <div
      id="bed-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="bed-detail-modal-content"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
              <BedIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  {bed.code}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    bed.occupancyStatus === 'Available'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : bed.occupancyStatus === 'Occupied'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {bed.occupancyStatus}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    bed.operationalStatus === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {bed.operationalStatus}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">{bed.bedNumber}</h2>
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
          {/* Admitted Patient Card if occupied */}
          {isOccupied ? (
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-700" />
                  <span className="font-bold text-indigo-900 text-sm">
                    {bed.currentPatientName}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  MRN: {bed.currentPatientMrn || 'N/A'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-indigo-800 pt-1 border-t border-indigo-100">
                <div>
                  <span className="text-indigo-600">Admission Date: </span>
                  <span className="font-semibold">{bed.admissionDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-indigo-600">Admitting Doctor: </span>
                  <span className="font-semibold">
                    {bed.admittingDoctorName || 'Consultant On Duty'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-indigo-600/80 italic">
                Note: Inpatient occupancy is automatically managed by the clinical admission, transfer, and discharge system.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Bed is currently vacant and sanitized. Ready for incoming patient admission assignment.
              </span>
            </div>
          )}

          {/* Location & Tariff */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Room Allocation
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1">
                {bed.roomId ? `Room ${bed.roomNumber}` : 'Direct Ward Bed'}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">{bed.roomName || 'No parent room'}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Ward & Department
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1">{bed.wardName || 'Standalone (No Ward)'}</div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Dept: {bed.departmentName || 'N/A'}
              </span>
            </div>


          </div>

          {/* Historical link */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
            <span className="text-slate-600 font-medium">Historical Patient Admissions:</span>
            <span className="font-bold text-slate-800">
              {bed.historicalAdmissionCount ?? 0} admission record(s)
            </span>
          </div>

          {/* Audit */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 space-y-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>Created By:</span>
              <span className="font-semibold text-slate-700">{bed.createdBy}</span>
            </div>
            <div className="flex justify-between">
              <span>Created At:</span>
              <span className="font-medium text-slate-700">{bed.createdAt}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated By:</span>
              <span className="font-semibold text-slate-700">{bed.updatedBy}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated At:</span>
              <span className="font-medium text-slate-700">{bed.updatedAt}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              onClick={() => onToggleOperational(bed)}
              disabled={isOccupied}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                isOccupied
                  ? 'text-slate-300 border-slate-200 cursor-not-allowed'
                  : bed.operationalStatus === 'Active'
                  ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {bed.operationalStatus === 'Active' ? (
                <>
                  <PowerOff className="w-3.5 h-3.5" />
                  Take Out of Service
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5" />
                  Return to Active Service
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
                  onEdit(bed);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Bed
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
