import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertCircle, AlertTriangle, User } from 'lucide-react';
import { Bed, BedFormValues, Ward, Room } from '../../../types/wardsRoomsBeds';
import {
  WardsRoomsBedsService,
  VALID_BED_TYPES,
} from '../../../services/wardsRoomsBedsService';

interface BedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: BedFormValues) => void;
  bed?: Bed | null;
  wards: Ward[];
  rooms: Room[];
}

export const BedModal: React.FC<BedModalProps> = ({
  isOpen,
  onClose,
  onSave,
  bed,
  wards,
  rooms,
}) => {
  const isEditing = !!bed;
  const isOccupied = bed?.occupancyStatus === 'Occupied';

  const [selectedWardId, setSelectedWardId] = useState<string>(
    bed?.wardId || wards[0]?.id || ''
  );

  const availableRooms = useMemo(() => {
    return rooms.filter((r) => r.wardId === selectedWardId);
  }, [rooms, selectedWardId]);

  const [formValues, setFormValues] = useState<BedFormValues>({
    code: '',
    bedNumber: '',
    roomId: '',
    bedType: 'Standard',
    dailyBedRate: 2000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
  });

  const [codeError, setCodeError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (bed) {
      setSelectedWardId(bed.wardId);
      setFormValues({
        code: bed.code,
        bedNumber: bed.bedNumber,
        roomId: bed.roomId,
        bedType: bed.bedType,
        dailyBedRate: bed.dailyBedRate ?? bed.dailyRate ?? 2000,
        occupancyStatus: bed.occupancyStatus,
        operationalStatus: bed.operationalStatus,
      });
      setCodeError(null);
      setErrors({});
    } else {
      const initialWardId = wards.find((w) => w.status === 'Active')?.id || wards[0]?.id || '';
      setSelectedWardId(initialWardId);
      const initialRoom = rooms.find((r) => r.wardId === initialWardId && r.status === 'Active');

      setFormValues({
        code: '',
        bedNumber: '',
        roomId: initialRoom?.id || '',
        bedType: 'Standard',
        dailyBedRate: initialRoom?.dailyRoomRate ? Math.round(initialRoom.dailyRoomRate / initialRoom.capacity) : 2000,
        occupancyStatus: 'Available',
        operationalStatus: 'Active',
      });
      setCodeError(null);
      setErrors({});
    }
  }, [bed, isOpen, wards, rooms]);

  if (!isOpen) return null;

  const handleWardChange = (wardId: string) => {
    setSelectedWardId(wardId);
    const roomsInWard = rooms.filter((r) => r.wardId === wardId);
    const defaultRoom = roomsInWard[0];
    setFormValues((prev) => ({
      ...prev,
      roomId: defaultRoom?.id || '',
      dailyBedRate: defaultRoom?.dailyRoomRate
        ? Math.round(defaultRoom.dailyRoomRate / defaultRoom.capacity)
        : prev.dailyBedRate,
    }));
  };

  const handleRoomChange = (roomId: string) => {
    const r = rooms.find((x) => x.id === roomId);
    setFormValues((prev) => ({
      ...prev,
      roomId,
      dailyBedRate: r ? Math.round(r.dailyRoomRate / r.capacity) : prev.dailyBedRate,
    }));
  };

  const handleCodeChange = (val: string) => {
    const upper = val.toUpperCase().replace(/\s+/g, '-');
    setFormValues((prev) => ({ ...prev, code: upper }));

    if (!upper) {
      setCodeError('Bed code is required.');
      return;
    }
    const check = WardsRoomsBedsService.validateBedCode(upper, bed?.id);
    if (!check.isValid) {
      setCodeError(check.message || 'Invalid code.');
    } else {
      setCodeError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formValues.code.trim()) {
      newErrors.code = 'Bed code is required.';
    } else {
      const check = WardsRoomsBedsService.validateBedCode(formValues.code, bed?.id);
      if (!check.isValid) {
        newErrors.code = check.message || 'Duplicate or invalid code.';
      }
    }

    if (!formValues.bedNumber.trim()) {
      newErrors.bedNumber = 'Bed number is required.';
    }

    if (!formValues.roomId) {
      newErrors.roomId = 'Room assignment is required.';
    }

    if (formValues.dailyBedRate < 0 || isNaN(formValues.dailyBedRate)) {
      newErrors.dailyBedRate = 'Daily rate cannot be negative.';
    }

    if (isOccupied && formValues.operationalStatus === 'Out of Service') {
      newErrors.operationalStatus = 'Cannot take bed out of service while occupied.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formValues);
  };

  return (
    <div
      id="bed-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="bed-modal-content"
        className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {isEditing ? 'Edit Bed Record' : 'Add New Hospital Bed'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure room allocation, bed specification, and daily tariff
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Occupied Warning Banner */}
        {isOccupied && bed && (
          <div className="p-3.5 bg-indigo-50 border-b border-indigo-200 text-xs text-indigo-900 flex items-start gap-2.5">
            <User className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Bed Currently Occupied:</span> Admitted patient{' '}
              <strong>{bed.currentPatientName}</strong> (MRN: {bed.currentPatientMrn || 'N/A'})
              since {bed.admissionDate || 'N/A'}. Occupancy status is governed strictly by the admission
              discharge cycle.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bed Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bed Code <span className="text-rose-500">*</span>
              </label>
              <input
                id="bed-form-code"
                type="text"
                value={formValues.code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="e.g. BED-101-A"
                className={`w-full px-3 py-2 text-xs font-mono font-medium rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-colors ${
                  codeError || errors.code
                    ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500'
                    : 'border-slate-200 focus:ring-[#08775A]/20 focus:border-[#08775A]'
                }`}
              />
              {(codeError || errors.code) && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {codeError || errors.code}
                </p>
              )}
            </div>

            {/* Bed Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bed Number / Identifier <span className="text-rose-500">*</span>
              </label>
              <input
                id="bed-form-number"
                type="text"
                value={formValues.bedNumber}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, bedNumber: e.target.value }))
                }
                placeholder="e.g. Bed-101-A or Bed-01"
                className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-colors ${
                  errors.bedNumber
                    ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500'
                    : 'border-slate-200 focus:ring-[#08775A]/20 focus:border-[#08775A]'
                }`}
              />
              {errors.bedNumber && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.bedNumber}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ward (Cascading selector) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Parent Ward <span className="text-rose-500">*</span>
              </label>
              <select
                id="bed-form-ward"
                value={selectedWardId}
                onChange={(e) => handleWardChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Room (Filtered by selected Ward) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room <span className="text-rose-500">*</span>
              </label>
              <select
                id="bed-form-room"
                value={formValues.roomId}
                onChange={(e) => handleRoomChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                {availableRooms.length === 0 ? (
                  <option value="">No rooms configured in this ward</option>
                ) : (
                  availableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} - {r.name} (Cap: {r.bedsConfigured}/{r.capacity})
                    </option>
                  ))
                )}
              </select>
              {errors.roomId && (
                <p className="text-[11px] text-rose-600 mt-1">{errors.roomId}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bed Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bed Type <span className="text-rose-500">*</span>
              </label>
              <select
                id="bed-form-type"
                value={formValues.bedType}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, bedType: e.target.value as any }))
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                {VALID_BED_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Daily Bed Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Daily Bed Rate (PKR) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  PKR
                </span>
                <input
                  id="bed-form-rate"
                  type="number"
                  min="0"
                  step="50"
                  value={formValues.dailyBedRate}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      dailyBedRate: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full pl-11 pr-3 py-2 text-xs font-bold text-slate-900 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                />
              </div>
            </div>
          </div>

          {/* Occupancy and Operational Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Occupancy Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Occupancy Status
              </label>
              {isOccupied ? (
                <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-800">
                  Occupied (Locked by Active Admission)
                </div>
              ) : (
                <select
                  id="bed-form-occupancy"
                  value={formValues.occupancyStatus}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      occupancyStatus: e.target.value as any,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                >
                  <option value="Available">Available for Admission</option>
                  <option value="Reserved">Reserved for Incoming</option>
                  <option value="Maintenance">Under Cleaning / Sanitization</option>
                </select>
              )}
            </div>

            {/* Operational Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Operational Status
              </label>
              <select
                id="bed-form-operational"
                value={formValues.operationalStatus}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    operationalStatus: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                <option value="Active">Active In Service</option>
                <option value="Out of Service">Out of Service</option>
                <option value="Decommissioned">Decommissioned</option>
              </select>
              {errors.operationalStatus && (
                <p className="text-[11px] text-rose-600 mt-1">{errors.operationalStatus}</p>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              id="bed-modal-cancel-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="bed-modal-submit-btn"
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors"
            >
              {isEditing ? 'Update Bed' : 'Save Bed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
