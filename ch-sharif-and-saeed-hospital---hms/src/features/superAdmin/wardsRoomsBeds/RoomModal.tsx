import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Room, RoomFormValues, Ward } from '../../../types/wardsRoomsBeds';
import {
  WardsRoomsBedsService,
  VALID_ROOM_TYPES,
} from '../../../services/wardsRoomsBedsService';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: RoomFormValues) => void;
  room?: Room | null;
  wards: Ward[];
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  onSave,
  room,
  wards,
}) => {
  const isEditing = !!room;

  const [formValues, setFormValues] = useState<RoomFormValues>({
    code: '',
    roomNumber: '',
    name: '',
    wardId: wards[0]?.id || '',
    roomType: 'General',
    capacity: 2,
    dailyRoomRate: 3500,
    status: 'Active',
  });

  const [codeError, setCodeError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (room) {
      setFormValues({
        code: room.code,
        roomNumber: room.roomNumber,
        name: room.name,
        wardId: room.wardId,
        roomType: room.roomType,
        capacity: room.capacity,
        dailyRoomRate: room.dailyRoomRate,
        status: room.status,
      });
      setCodeError(null);
      setErrors({});
    } else {
      setFormValues({
        code: '',
        roomNumber: '',
        name: '',
        wardId: wards.find((w) => w.status === 'Active')?.id || wards[0]?.id || '',
        roomType: 'General',
        capacity: 2,
        dailyRoomRate: 3500,
        status: 'Active',
      });
      setCodeError(null);
      setErrors({});
    }
  }, [room, isOpen, wards]);

  if (!isOpen) return null;

  const handleCodeChange = (val: string) => {
    const upper = val.toUpperCase().replace(/\s+/g, '-');
    setFormValues((prev) => ({ ...prev, code: upper }));

    // Code is optional — left blank, the backend auto-generates a unique one.
    if (!upper) {
      setCodeError(null);
      return;
    }
    const check = WardsRoomsBedsService.validateRoomCode(upper, room?.id);
    if (!check.isValid) {
      setCodeError(check.message || 'Invalid code.');
    } else {
      setCodeError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (formValues.code.trim()) {
      const check = WardsRoomsBedsService.validateRoomCode(formValues.code, room?.id);
      if (!check.isValid) {
        newErrors.code = check.message || 'Duplicate or invalid code.';
      }
    }

    if (!formValues.roomNumber.trim()) {
      newErrors.roomNumber = 'Room number is required.';
    }

    if (!formValues.name.trim()) {
      newErrors.name = 'Room name is required.';
    }

    if (!formValues.wardId) {
      newErrors.wardId = 'Parent ward is required.';
    }

    if (formValues.capacity < 1 || isNaN(formValues.capacity)) {
      newErrors.capacity = 'Capacity must be at least 1.';
    }

    if (formValues.dailyRoomRate < 0 || isNaN(formValues.dailyRoomRate)) {
      newErrors.dailyRoomRate = 'Daily rate cannot be negative.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formValues);
  };

  return (
    <div
      id="room-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="room-modal-content"
        className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {isEditing ? 'Edit Room Record' : 'Add Inpatient Room'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign to ward, set bed capacity ceiling, and configure daily tariff
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Room Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Code
              </label>
              <input
                id="room-form-code"
                type="text"
                value={formValues.code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="e.g. RM-MED-101 (optional — auto-generated if blank)"
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

            {/* Room Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="room-form-number"
                type="text"
                value={formValues.roomNumber}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, roomNumber: e.target.value }))
                }
                placeholder="e.g. 101, 102, ICU-01"
                className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-colors ${
                  errors.roomNumber
                    ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500'
                    : 'border-slate-200 focus:ring-[#08775A]/20 focus:border-[#08775A]'
                }`}
              />
              {errors.roomNumber && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.roomNumber}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Room Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="room-form-name"
                type="text"
                value={formValues.name}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Deluxe Room 101"
                className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-colors ${
                  errors.name
                    ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500'
                    : 'border-slate-200 focus:ring-[#08775A]/20 focus:border-[#08775A]'
                }`}
              />
              {errors.name && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Parent Ward */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ward <span className="text-rose-500">*</span>
              </label>
              <select
                id="room-form-ward"
                value={formValues.wardId}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, wardId: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Room Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Type <span className="text-rose-500">*</span>
              </label>
              <select
                id="room-form-type"
                value={formValues.roomType}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, roomType: e.target.value as any }))
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                {VALID_ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bed Capacity Ceiling <span className="text-rose-500">*</span>
              </label>
              <input
                id="room-form-capacity"
                type="number"
                min="1"
                max="20"
                value={formValues.capacity}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    capacity: parseInt(e.target.value) || 1,
                  }))
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              />
              {errors.capacity && (
                <p className="text-[11px] text-rose-600 mt-1">{errors.capacity}</p>
              )}
            </div>

            {/* Daily Room Rate (PKR) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Daily Rate (PKR) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  PKR
                </span>
                <input
                  id="room-form-rate"
                  type="number"
                  min="0"
                  step="50"
                  value={formValues.dailyRoomRate}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      dailyRoomRate: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full pl-11 pr-3 py-2 text-xs font-bold text-slate-900 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-semibold text-slate-700">Room Status</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="roomStatus"
                  value="Active"
                  checked={formValues.status === 'Active'}
                  onChange={() => setFormValues((p) => ({ ...p, status: 'Active' }))}
                  className="text-[#08775A] focus:ring-[#08775A]"
                />
                <span className="text-xs text-slate-700 font-medium">Active (In Use)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="roomStatus"
                  value="Inactive"
                  checked={formValues.status === 'Inactive'}
                  onChange={() => setFormValues((p) => ({ ...p, status: 'Inactive' }))}
                  className="text-slate-500 focus:ring-slate-400"
                />
                <span className="text-xs text-slate-600 font-medium">Inactive (Closed)</span>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              id="room-modal-cancel-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="room-modal-submit-btn"
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors"
            >
              {isEditing ? 'Update Room' : 'Save Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
