import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Patient, PatientStatus, PATIENT_STATUSES } from '../../../types/patient';

interface PatientStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onConfirmStatus: (patientId: string, newStatus: PatientStatus) => void;
}

export const PatientStatusModal: React.FC<PatientStatusModalProps> = ({
  isOpen,
  onClose,
  patient,
  onConfirmStatus,
}) => {
  if (!isOpen || !patient) return null;

  const [selectedStatus, setSelectedStatus] = useState<PatientStatus>(patient.status);
  const [deceasedConfirmed, setDeceasedConfirmed] = useState(false);

  const isDeceasedSelected = selectedStatus === 'DECEASED';

  const handleConfirm = () => {
    if (isDeceasedSelected && !deceasedConfirmed) {
      return;
    }
    onConfirmStatus(patient.id, selectedStatus);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Update Patient Status</h3>
            <p className="text-xs text-slate-500 font-mono">
              MR: <strong className="text-[#08775A]">{patient.mrNumber}</strong> • {patient.fullName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Registry Status
            </label>
            <div className="space-y-2">
              {PATIENT_STATUSES.map((st) => (
                <label
                  key={st}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedStatus === st
                      ? st === 'DECEASED'
                        ? 'border-slate-800 bg-slate-900 text-white font-semibold'
                        : st === 'ACTIVE'
                        ? 'border-[#08775A] bg-[#effaf5] text-[#08775A] font-semibold'
                        : 'border-slate-400 bg-slate-100 text-slate-800 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="patientStatus"
                      value={st}
                      checked={selectedStatus === st}
                      onChange={() => {
                        setSelectedStatus(st);
                        if (st !== 'DECEASED') setDeceasedConfirmed(false);
                      }}
                      className="text-[#08775A] focus:ring-[#08775A]"
                    />
                    <span>{st}</span>
                  </div>
                  <span className="text-xs font-normal opacity-80">
                    {st === 'ACTIVE'
                      ? 'Normal clinical workflows'
                      : st === 'INACTIVE'
                      ? 'Temporarily suspended'
                      : 'Formal medico-legal closure'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Deceased Confirmation Warning Box */}
          {isDeceasedSelected && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-900 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-red-800 mb-0.5">
                    Medico-Legal Status Notice
                  </div>
                  <p className="text-red-700 leading-relaxed">
                    Marking a patient as Deceased will flag this MR across all hospital
                    information system encounters and prevent new clinical visits or ward admissions.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-red-900 cursor-pointer pt-2 border-t border-red-200/80">
                <input
                  type="checkbox"
                  checked={deceasedConfirmed}
                  onChange={(e) => setDeceasedConfirmed(e.target.checked)}
                  className="mt-0.5 rounded-sm text-red-600 focus:ring-red-500"
                />
                <span className="font-medium leading-tight">
                  I confirm that I have verified official death documentation / clinical mortality
                  certificate for this patient.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2.5 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors border border-slate-300 bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeceasedSelected && !deceasedConfirmed}
            className="px-4 py-2 text-sm font-medium text-white bg-[#08775A] hover:bg-[#07664d] rounded-lg transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Update Status
          </button>
        </div>
      </div>
    </div>
  );
};
