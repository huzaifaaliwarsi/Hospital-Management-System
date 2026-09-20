import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertCircle, User, Layers, Plus, Minus, Info, Sparkles } from 'lucide-react';
import { Bed, BedFormValues, Ward, Room } from '../../../types/wardsRoomsBeds';
import {
  WardsRoomsBedsService,
  VALID_BED_TYPES,
  getNextBedNumbers,
} from '../../../services/wardsRoomsBedsService';

interface BedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: BedFormValues) => void;
  bed?: Bed | null;
  wards: Ward[];
  rooms: Room[];
  beds?: Bed[];
}

export const BedModal: React.FC<BedModalProps> = ({
  isOpen,
  onClose,
  onSave,
  bed,
  wards,
  rooms,
  beds = [],
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

  // Batch creation / expansion states
  const [quantity, setQuantity] = useState<number>(1);
  const [numberingPrefix, setNumberingPrefix] = useState<string>('Bed ');
  const [additionalBeds, setAdditionalBeds] = useState<number>(0);

  const [codeError, setCodeError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Active room and its existing beds
  const currentRoom = useMemo(() => {
    return rooms.find((r) => r.id === formValues.roomId);
  }, [rooms, formValues.roomId]);

  const roomBeds = useMemo(() => {
    if (!formValues.roomId) return [];
    return beds.filter((b) => b.roomId === formValues.roomId);
  }, [beds, formValues.roomId]);

  const roomCapacity = currentRoom?.capacity ?? 0;
  const configuredCount = roomBeds.length;
  const remainingCapacity = Math.max(0, roomCapacity - configuredCount);

  // Generated bed names preview for Add mode
  const previewAddNames = useMemo(() => {
    if (quantity <= 1) return [];
    return getNextBedNumbers(roomBeds, quantity, numberingPrefix.trim() ? `${numberingPrefix.trim()} ` : 'Bed ');
  }, [roomBeds, quantity, numberingPrefix]);

  // Generated bed names preview for Edit mode (additional beds)
  const previewEditNames = useMemo(() => {
    if (additionalBeds <= 0) return [];
    return getNextBedNumbers(roomBeds, additionalBeds, 'Bed ');
  }, [roomBeds, additionalBeds]);

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
      setQuantity(1);
      setAdditionalBeds(0);
      setCodeError(null);
      setErrors({});
    } else {
      const initialWardId = wards.find((w) => w.status === 'Active')?.id || wards[0]?.id || '';
      setSelectedWardId(initialWardId);
      const initialRoom = rooms.find((r) => r.wardId === initialWardId && r.status === 'Active') || rooms[0];

      const initialRoomBeds = initialRoom ? beds.filter((b) => b.roomId === initialRoom.id) : [];
      const defaultNextBedName = getNextBedNumbers(initialRoomBeds, 1, 'Bed ')[0] || 'Bed 1';

      setFormValues({
        code: '',
        bedNumber: defaultNextBedName,
        roomId: initialRoom?.id || '',
        bedType: 'Standard',
        dailyBedRate: initialRoom?.dailyRoomRate ? Math.round(initialRoom.dailyRoomRate / Math.max(1, initialRoom.capacity)) : 2000,
        occupancyStatus: 'Available',
        operationalStatus: 'Active',
      });
      setQuantity(1);
      setNumberingPrefix('Bed ');
      setAdditionalBeds(0);
      setCodeError(null);
      setErrors({});
    }
  }, [bed, isOpen, wards, rooms]);

  if (!isOpen) return null;

  const handleWardChange = (wardId: string) => {
    setSelectedWardId(wardId);
    const roomsInWard = rooms.filter((r) => r.wardId === wardId);
    const defaultRoom = roomsInWard[0];
    const newRoomId = defaultRoom?.id || '';
    const newRoomBeds = beds.filter((b) => b.roomId === newRoomId);
    const defaultNextName = getNextBedNumbers(newRoomBeds, 1, 'Bed ')[0] || 'Bed 1';

    setFormValues((prev) => ({
      ...prev,
      roomId: newRoomId,
      bedNumber: defaultNextName,
      dailyBedRate: defaultRoom?.dailyRoomRate
        ? Math.round(defaultRoom.dailyRoomRate / Math.max(1, defaultRoom.capacity))
        : prev.dailyBedRate,
    }));
  };

  const handleRoomChange = (roomId: string) => {
    const r = rooms.find((x) => x.id === roomId);
    const targetRoomBeds = beds.filter((b) => b.roomId === roomId);
    const defaultNextName = getNextBedNumbers(targetRoomBeds, 1, 'Bed ')[0] || 'Bed 1';

    setFormValues((prev) => ({
      ...prev,
      roomId,
      bedNumber: defaultNextName,
      dailyBedRate: r ? Math.round(r.dailyRoomRate / Math.max(1, r.capacity)) : prev.dailyBedRate,
    }));
  };

  const handleCodeChange = (val: string) => {
    const upper = val.toUpperCase().replace(/\s+/g, '-');
    setFormValues((prev) => ({ ...prev, code: upper }));

    // Code is optional — left blank, the backend auto-generates a unique one.
    if (!upper) {
      setCodeError(null);
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

    if (formValues.code.trim()) {
      const check = WardsRoomsBedsService.validateBedCode(formValues.code, bed?.id);
      if (!check.isValid) {
        newErrors.code = check.message || 'Duplicate or invalid code.';
      }
    }

    if (!isEditing && quantity > 1) {
      // Multiple beds: prefix will name them, bedNumber is derived
      if (!numberingPrefix.trim()) {
        newErrors.numberingPrefix = 'Numbering prefix is required.';
      }
    } else {
      if (!formValues.bedNumber.trim()) {
        newErrors.bedNumber = 'Bed number is required.';
      }
    }

    if (!formValues.roomId) {
      newErrors.roomId = 'Room assignment is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      ...formValues,
      bedNumber: (!isEditing && quantity > 1 && previewAddNames.length > 0)
        ? previewAddNames[0]
        : formValues.bedNumber.trim(),
      quantity: isEditing ? 1 : Math.max(1, quantity),
      additionalBeds: isEditing ? Math.max(0, additionalBeds) : 0,
      numberingPrefix: numberingPrefix.trim() || 'Bed ',
      dailyBedRate: currentRoom?.dailyRoomRate ?? formValues.dailyBedRate ?? 0,
      occupancyStatus: isOccupied ? bed!.occupancyStatus : 'Available',
      operationalStatus: 'Active',
    });
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
              {isEditing ? 'Edit Bed Record' : 'Add Hospital Bed(s)'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing
                ? 'Update bed information or expand room bed capacity'
                : 'Configure room allocation and specify bed quantity'}
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
          {/* Ward and Room Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ward Selector */}
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

            {/* Room Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Room <span className="text-rose-500">*</span>
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
                      {r.roomNumber} - {r.name} (Cap: {r.bedsConfigured ?? 0}/{r.capacity})
                    </option>
                  ))
                )}
              </select>
              {errors.roomId && (
                <p className="text-[11px] text-rose-600 mt-1">{errors.roomId}</p>
              )}
            </div>
          </div>

          {/* Room Capacity Status Banner */}
          {currentRoom && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-900">
                <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Room <strong>{currentRoom.roomNumber} ({currentRoom.name})</strong> — Capacity:{' '}
                  <strong>{currentRoom.capacity}</strong> beds | Configured:{' '}
                  <strong>{configuredCount}</strong> beds
                  {remainingCapacity > 0 ? (
                    <span className="text-emerald-700 font-semibold ml-1">
                      ({remainingCapacity} available)
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold ml-1">
                      (Room at full capacity)
                    </span>
                  )}
                  <span className="block text-[11px] text-emerald-800 mt-0.5">
                    Room Daily Rate: <strong>PKR {(currentRoom.dailyRoomRate ?? 0).toLocaleString('en-PK')}</strong>/day (Stay charges apply per room tariff)
                  </span>
                </span>
              </div>
              {!isEditing && remainingCapacity > 0 && quantity !== remainingCapacity && (
                <button
                  type="button"
                  onClick={() => setQuantity(remainingCapacity)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors shadow-2xs whitespace-nowrap self-start"
                >
                  Set Quantity to {remainingCapacity}
                </button>
              )}
            </div>
          )}

          {/* ADD MODE: Quantity Selector */}
          {!isEditing && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-800">
                    Bed Quantity (Kitne Beds Add Karne Hain?) <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Choose how many beds to batch create for this room
                  </p>
                </div>
                {/* Quantity Stepper */}
                <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    id="bed-quantity-input"
                    type="number"
                    min="1"
                    max="50"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 text-center text-xs font-bold text-slate-800 focus:outline-hidden py-1"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Quantity Pills */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-medium text-slate-400">Quick Select:</span>
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuantity(num)}
                    className={`px-2 py-0.5 text-xs font-semibold rounded-md border transition-colors ${
                      quantity === num
                        ? 'bg-[#08775A] text-white border-[#08775A]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {num} {num === 1 ? 'Bed' : 'Beds'}
                  </button>
                ))}
              </div>

              {/* Batch Creation Preview Banner */}
              {quantity > 1 && (
                <div className="p-3 bg-teal-50 border border-teal-200/80 rounded-lg text-xs text-teal-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-teal-800">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Auto-Generating {quantity} Sequential Beds:</span>
                  </div>
                  <div className="font-mono text-[11px] font-semibold text-teal-700 bg-white/70 px-2.5 py-1.5 rounded border border-teal-200">
                    {previewAddNames.slice(0, 6).join(', ')}
                    {previewAddNames.length > 6 ? ` + ${previewAddNames.length - 6} more` : ''}
                  </div>
                  {currentRoom && configuredCount + quantity > roomCapacity && (
                    <p className="text-[11px] text-teal-700 flex items-center gap-1 mt-1">
                      <Info className="w-3 h-3 shrink-0" />
                      Room capacity ({roomCapacity}) will auto-expand to {configuredCount + quantity} to accommodate these beds.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bed Code & Number / Prefix Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bed Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bed Code
              </label>
              <input
                id="bed-form-code"
                type="text"
                value={formValues.code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="e.g. BED-101-A (optional — auto-generated)"
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

            {/* Bed Number / Naming Prefix */}
            <div>
              {!isEditing && quantity > 1 ? (
                <>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Naming Prefix <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="bed-form-prefix"
                    type="text"
                    value={numberingPrefix}
                    onChange={(e) => setNumberingPrefix(e.target.value)}
                    placeholder="e.g. Bed or Bed- or RM-101-B"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                  />
                  {errors.numberingPrefix && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.numberingPrefix}
                    </p>
                  )}
                </>
              ) : (
                <>
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
                    placeholder="e.g. Bed-101-A or Bed 1"
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
                </>
              )}
            </div>
          </div>

          {/* Bed Type and Room Tariff Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
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

            {/* Room Tariff Info (Bed charges apply from room tariff) */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Room Tariff:</span>
              <span className="text-xs font-bold text-[#08775A]">
                PKR {(currentRoom?.dailyRoomRate ?? 0).toLocaleString('en-PK')} / day
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Bed charges apply directly from parent room tariff
              </span>
            </div>
          </div>

          {/* EDIT MODE: Expand Room Bed Quantity Section */}
          {isEditing && (
            <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                    <Layers className="w-4 h-4 text-sky-600" />
                    <span>Room Capacity & Bed Quantity Expansion</span>
                  </div>
                  <p className="text-[11px] text-sky-700 mt-0.5">
                    Need to add more beds to this room? Increase quantity here
                  </p>
                </div>

                {/* Additional Beds Stepper */}
                <div className="flex items-center border border-sky-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setAdditionalBeds((b) => Math.max(0, b - 1))}
                    disabled={additionalBeds <= 0}
                    className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-12 text-center text-xs font-bold text-sky-900 py-1">
                    +{additionalBeds}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdditionalBeds((b) => b + 1)}
                    className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Pills for Adding More Beds */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-sky-700">Add More Beds:</span>
                {[1, 2, 3, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setAdditionalBeds(num)}
                    className={`px-2 py-0.5 text-xs font-semibold rounded-md border transition-colors ${
                      additionalBeds === num
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-sky-800 border-sky-200 hover:bg-sky-100'
                    }`}
                  >
                    +{num} {num === 1 ? 'Bed' : 'Beds'}
                  </button>
                ))}
                {additionalBeds > 0 && (
                  <button
                    type="button"
                    onClick={() => setAdditionalBeds(0)}
                    className="px-2 py-0.5 text-xs font-semibold rounded-md text-slate-500 hover:text-slate-700 underline ml-auto"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Additional Beds Preview */}
              {additionalBeds > 0 && (
                <div className="p-2.5 bg-white/90 border border-sky-200 rounded-lg text-xs text-sky-900 space-y-1">
                  <div className="font-semibold text-sky-800">
                    Will update <strong>{formValues.bedNumber}</strong>, plus create{' '}
                    <strong>{additionalBeds}</strong> additional bed(s):
                  </div>
                  <div className="font-mono text-[11px] font-bold text-sky-700">
                    {previewEditNames.join(', ')}
                  </div>
                  {currentRoom && configuredCount + additionalBeds > roomCapacity && (
                    <p className="text-[11px] text-sky-700 flex items-center gap-1 mt-1">
                      <Info className="w-3 h-3 shrink-0" />
                      Room capacity ({roomCapacity}) will automatically increase to {configuredCount + additionalBeds}.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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
              {isEditing
                ? additionalBeds > 0
                  ? `Update & Add ${additionalBeds} Bed(s)`
                  : 'Update Bed'
                : quantity > 1
                ? `Create ${quantity} Beds`
                : 'Save Bed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
