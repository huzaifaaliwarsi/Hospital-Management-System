import React from 'react';
import { X, Printer, Shield, Building, Phone, MapPin, User, FileText } from 'lucide-react';
import { Patient } from '../../../types/patient';
import { getHospitalProfile, getProfileFieldValue } from '../../../services/hospitalProfileService';

interface PatientDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

export const PatientDossierModal: React.FC<PatientDossierModalProps> = ({
  isOpen,
  onClose,
  patient,
}) => {
  if (!isOpen || !patient) return null;

  const profile = getHospitalProfile();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none">
        {/* Modal Toolbar (hidden in print) */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileText className="w-4 h-4 text-[#08775A]" />
            <span className="font-semibold text-slate-800">Master Patient Identity Dossier</span>
            <span>• {patient.mrNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#08775A] hover:bg-[#07664d] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dossier Document Content (styled for clean print and preview) */}
        <div className="overflow-y-auto p-8 text-slate-800 space-y-6 flex-1 text-sm bg-white">
          {/* Hospital Letterhead Header */}
          <div className="border-b-2 border-[#08775A] pb-4 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                {profile.name || 'CH Sharif and Saeed Hospital'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Executive Hospital Information System • Master Patient Identity Record
              </p>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                <span>Reg No: {getProfileFieldValue(profile.registrationNumber)}</span>
                <span>NTN/Tax: {getProfileFieldValue(profile.taxNumber)}</span>
                <span>Ph: {getProfileFieldValue(profile.primaryPhone)}</span>
              </div>
            </div>

            {/* MR Number Box */}
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Permanent Identity #
              </div>
              <div className="text-xl font-mono font-black text-[#08775A] tracking-wider">
                {patient.mrNumber}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Reg: {patient.registrationDate}
              </div>
            </div>
          </div>

          {/* Primary Patient Identification Card Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">
                Patient Legal Name
              </span>
              <div className="text-lg font-bold text-slate-900">{patient.fullName}</div>
              {patient.fatherGuardianName && (
                <div className="text-xs text-slate-500">
                  {patient.guardianRelation || 'S/O, D/O, W/O'}:{' '}
                  <strong className="text-slate-700">{patient.fatherGuardianName}</strong>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-center">
                <span className="text-slate-400 text-[10px] block uppercase font-bold">Gender</span>
                <span className="font-bold text-slate-800">{patient.gender}</span>
              </div>
              <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-center">
                <span className="text-slate-400 text-[10px] block uppercase font-bold">Age</span>
                <span className="font-bold text-slate-800">
                  {patient.age}y {patient.ageIsEstimated && '(est)'}
                </span>
              </div>
              <div className="px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-center bg-rose-50">
                <span className="text-rose-500 text-[10px] block uppercase font-bold">Blood</span>
                <span className="font-bold text-rose-700">{patient.bloodGroup}</span>
              </div>
            </div>
          </div>

          {/* Identification Details Table */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#08775A]" />
                <span>Civil Identity</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">CNIC / Form-B:</span>
                <span className="font-mono font-semibold text-slate-800">{patient.cnic || 'Not on file'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Passport Number:</span>
                <span className="font-mono font-semibold text-slate-800">{patient.passportNumber || '—'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Date of Birth:</span>
                <span className="font-semibold text-slate-800">{patient.dateOfBirth || 'Unrecorded'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Registry Status:</span>
                <span className="font-bold text-[#08775A]">{patient.status}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#08775A]" />
                <span>Contact Channels</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Primary Phone:</span>
                <span className="font-mono font-bold text-slate-900">{patient.primaryPhone}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Alternate Phone:</span>
                <span className="font-mono text-slate-700">{patient.alternatePhone || '—'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-800 truncate max-w-[180px]">{patient.email || '—'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Emergency Contact:</span>
                <span className="text-slate-800 font-medium">
                  {patient.emergencyContactName ? `${patient.emergencyContactName} (${patient.emergencyContactPhone})` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Address & Payer Information */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#08775A]" />
                <span>Residential Address</span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                {[
                  patient.addressLine1,
                  patient.addressLine2,
                  patient.city,
                  patient.province,
                  patient.country,
                ]
                  .filter(Boolean)
                  .join(', ') || 'No residential address recorded.'}
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#08775A]" />
                <span>Payer & Financial Class</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Payer Type:</span>
                <span className="font-bold text-slate-900">{patient.payerType}</span>
              </div>
              {patient.payerType === 'Corporate / Panel' && (
                <>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500">Corporate Panel:</span>
                    <span className="font-semibold text-blue-800">{patient.panelName}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500">Card / Member ID:</span>
                    <span className="font-mono font-bold text-slate-900">{patient.panelMemberId}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Accountability Footnote */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              <span>Created By: <strong>{patient.createdBy}</strong></span>
              <span className="mx-2">•</span>
              <span>Updated By: <strong>{patient.updatedBy}</strong></span>
            </div>
            <div className="text-right">
              <span>This document represents the master electronic identity of the patient.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
