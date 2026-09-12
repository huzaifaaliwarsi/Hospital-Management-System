import React from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  Building,
  HeartHandshake,
  Calendar,
  Shield,
  Clock,
  Printer,
  Edit2,
  RefreshCw,
  FileText,
  Activity,
  CreditCard,
  Pill,
} from 'lucide-react';
import { Patient, PatientStatus } from '../../../types/patient';

interface PatientDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onEdit: (patient: Patient) => void;
  onChangeStatus: (patient: Patient) => void;
  onPrintDossier: (patient: Patient) => void;
}

export const PatientDetailDrawer: React.FC<PatientDetailDrawerProps> = ({
  isOpen,
  onClose,
  patient,
  onEdit,
  onChangeStatus,
  onPrintDossier,
}) => {
  if (!isOpen || !patient) return null;

  const renderStatusBadge = (status: PatientStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Inactive
          </span>
        );
      case 'DECEASED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-100 border border-slate-700">
            Deceased
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-2xl w-full bg-white shadow-2xl flex flex-col z-10 border-l border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#effaf5] border border-[#c2e7db] text-[#08775A] flex items-center justify-center font-bold text-base">
              {patient.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{patient.fullName}</h2>
                {renderStatusBadge(patient.status)}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                <span>Permanent MR:</span>
                <span className="text-[#08775A] font-bold bg-[#effaf5] px-1.5 py-0.2 rounded-sm border border-[#c2e7db]">
                  {patient.mrNumber}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="text-slate-500">
            Registered: <strong className="text-slate-700">{patient.registrationDate}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrintDossier(patient)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition-colors cursor-pointer"
              title="Print Patient Identity Dossier"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Dossier</span>
            </button>
            <button
              onClick={() => {
                onEdit(patient);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-700 font-medium transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
            <button
              onClick={() => onChangeStatus(patient)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Status</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5 text-sm">
          {/* Card: Identity & Demographics */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
              <User className="w-4 h-4 text-[#08775A]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Demographic Identity
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Full Name</span>
                <span className="font-semibold text-slate-800 text-sm">{patient.fullName}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Father / Guardian</span>
                <span className="font-medium text-slate-800">
                  {patient.fatherGuardianName ? (
                    <>
                      {patient.fatherGuardianName}{' '}
                      <span className="text-slate-400 font-normal">
                        ({patient.guardianRelation || 'Guardian'})
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Gender</span>
                <span className="font-medium text-slate-800">{patient.gender}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Age</span>
                <span className="font-medium text-slate-800">
                  {patient.age} Years{' '}
                  {patient.ageIsEstimated && (
                    <span className="text-amber-600 font-normal">(Estimated)</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Date of Birth</span>
                <span className="font-medium text-slate-800">
                  {patient.dateOfBirth || 'Not Recorded'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Blood Group</span>
                <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-sm inline-block">
                  {patient.bloodGroup}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Pakistani CNIC</span>
                <span className="font-mono font-medium text-slate-800">
                  {patient.cnic || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Passport Number</span>
                <span className="font-mono font-medium text-slate-800">
                  {patient.passportNumber || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Contact & Address */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
              <Phone className="w-4 h-4 text-[#08775A]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Contact & Address
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Primary Phone</span>
                <span className="font-mono font-semibold text-slate-900 text-sm">
                  {patient.primaryPhone}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Alternate Phone</span>
                <span className="font-mono text-slate-700">
                  {patient.alternatePhone || '—'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block mb-0.5">Email</span>
                <span className="text-slate-800">{patient.email || '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block mb-0.5">Address</span>
                <span className="text-slate-800">
                  {[
                    patient.addressLine1,
                    patient.addressLine2,
                    patient.city,
                    patient.province,
                    patient.country,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'No residential address recorded'}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Payer & Panel */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
              <Building className="w-4 h-4 text-[#08775A]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Payer Classification
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Payer Type</span>
                {patient.payerType === 'Corporate / Panel' ? (
                  <span className="font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-sm inline-block">
                    Corporate / Panel
                  </span>
                ) : (
                  <span className="font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-sm inline-block">
                    Self Pay
                  </span>
                )}
              </div>
              {patient.payerType === 'Corporate / Panel' && (
                <>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Panel Member / Card ID</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {patient.panelMemberId || '—'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block mb-0.5">Authorized Corporate Entity</span>
                    <span className="font-medium text-slate-800">
                      {patient.panelName || 'Corporate Insurance Partner'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Card: Emergency Contact */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
              <HeartHandshake className="w-4 h-4 text-[#08775A]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Emergency Contact
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Name</span>
                <span className="font-medium text-slate-800">
                  {patient.emergencyContactName || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Relationship</span>
                <span className="font-medium text-slate-800">
                  {patient.emergencyContactRelation || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Phone</span>
                <span className="font-mono font-medium text-slate-800">
                  {patient.emergencyContactPhone || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Governance & Accountability */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
              <Clock className="w-4 h-4 text-[#08775A]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Accountability & Registry Audit
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
              <div>
                <span className="text-slate-400 block">Created By</span>
                <span className="font-semibold text-slate-800">{patient.createdBy}</span>
                <span className="text-[11px] text-slate-400 block font-mono">
                  {patient.createdAt ? new Date(patient.createdAt).toLocaleString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Last Updated By</span>
                <span className="font-semibold text-slate-800">{patient.updatedBy}</span>
                <span className="text-[11px] text-slate-400 block font-mono">
                  {patient.updatedAt ? new Date(patient.updatedAt).toLocaleString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Last Clinical Visit</span>
                <span className="font-medium text-slate-700">
                  {patient.lastVisitDate ? (
                    <span className="font-mono">{patient.lastVisitDate}</span>
                  ) : (
                    <span className="italic text-slate-400">Never visited</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Registry Status</span>
                <span className="font-semibold text-slate-800">{patient.status}</span>
              </div>
            </div>
          </div>

          {/* FUTURE CLINICAL MODULE INTEGRATION PLACEHOLDERS */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Activity className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Connected Hospital Services (Read-Only Summary)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>OPD & Encounters</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Linked to permanent MR #{patient.mrNumber}. Records will populate once OPD / Emergency is connected.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ledger & Billing</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Payer: {patient.payerType}. Billing history will attach to this MR upon billing counter invoice creation.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-1">
                  <Pill className="w-3.5 h-3.5 text-slate-400" />
                  <span>Pharmacy & Labs</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Dispensation and diagnostic order history linked seamlessly to this patient registry entry.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
