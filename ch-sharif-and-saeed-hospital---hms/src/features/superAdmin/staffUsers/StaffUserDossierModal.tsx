import React from 'react';
import { X, Printer, ShieldCheck, Building2, User, Briefcase, KeyRound, Activity } from 'lucide-react';
import { StaffUser } from '../../../types/staffUser';
import {
  getHospitalProfile,
  getProfileFieldValue,
} from '../../../services/hospitalProfileService';
import { formatDisplayDate } from '../../../utils/dateConstants';

interface StaffUserDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffUser | null;
}

export const StaffUserDossierModal: React.FC<StaffUserDossierModalProps> = ({
  isOpen,
  onClose,
  staff,
}) => {
  if (!isOpen || !staff) return null;

  const profile = getHospitalProfile();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const printTimestamp = `${formatDisplayDate(now)}, ${timeStr}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-[#e2eae5] overflow-hidden my-8 flex flex-col">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="px-6 py-4 bg-[#f6f8f7] border-b border-[#e2eae5] flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-[#129b70]" />
            <span className="font-bold text-sm text-[#111827]">Staff Employee Dossier</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#129b70] hover:bg-[#0e7d5a] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Dossier</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8b9e95] hover:text-[#111827] hover:bg-[#e2eae5] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Dossier Sheet */}
        <div className="p-8 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 space-y-6 text-xs text-[#111827]">
          {/* Hospital Letterhead */}
          <div className="border-b-2 border-[#129b70] pb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#111827] tracking-tight">
                {profile.name || 'CH Sharif and Saeed Hospital'}
              </h2>
              <p className="text-xs text-[#52665e] mt-0.5">
                Executive Hospital Information System • Human Resources & Workstation Directory
              </p>
              <p className="text-[11px] text-[#8b9e95] mt-1">
                Reg No: {getProfileFieldValue(profile.registrationNumber)} | NTN/Tax:{' '}
                {getProfileFieldValue(profile.taxNumber)} | Phone:{' '}
                {getProfileFieldValue(profile.primaryPhone)}
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block bg-[#e7f6f1] text-[#0e7d5a] border border-[#c2e7db] px-3 py-1 rounded-md font-bold text-xs">
                OFFICIAL STAFF RECORD
              </div>
              <p className="text-[10px] text-[#8b9e95] mt-1 font-mono">
                Printed: {printTimestamp}
              </p>
            </div>
          </div>

          {/* Employee Header */}
          <div className="bg-[#f6f8f7] p-4 rounded-xl border border-[#e2eae5] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-[#0e7d5a] font-bold">
                {staff.employeeCode}
              </span>
              <h3 className="text-lg font-bold text-[#111827]">{staff.fullName}</h3>
              <p className="text-xs text-[#52665e]">
                {staff.designation} • {staff.departmentName}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                  staff.status === 'ACTIVE'
                    ? 'bg-[#e7f6f1] text-[#0e7d5a] border border-[#c2e7db]'
                    : staff.status === 'SUSPENDED'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                STATUS: {staff.status}
              </span>
              <p className="text-[11px] text-[#52665e] mt-1 font-mono">ID: {staff.id}</p>
            </div>
          </div>

          {/* Section 1: Personal Particulars */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#52665e] border-b border-[#e2eae5] pb-1">
              Personal Particulars
            </h4>
            <div className="grid grid-cols-3 gap-3 p-3 bg-white border border-[#e2eae5] rounded-lg">
              <div>
                <span className="text-[10px] text-[#8b9e95] block uppercase">Full Legal Name</span>
                <span className="font-semibold">{staff.fullName}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8b9e95] block uppercase">Father / Guardian</span>
                <span className="font-medium">{staff.fatherGuardianName || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8b9e95] block uppercase">National ID (CNIC)</span>
                <span className="font-mono font-medium">{staff.cnic || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8b9e95] block uppercase">Primary Phone</span>
                <span className="font-medium">{staff.phone}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8b9e95] block uppercase">Alternate Phone</span>
                <span className="font-medium">{staff.alternatePhone || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8b9e95] block uppercase">Official Email</span>
                <span className="font-medium">{staff.email || '—'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Department & Employment */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#52665e] border-b border-[#e2eae5] pb-1">
              Departmental Placement & Classification
            </h4>
            <div className="grid grid-cols-3 gap-3 p-3 bg-white border border-[#e2eae5] rounded-lg">
              <div>
                <span className="text-[10px] text-[#8b9e95] block uppercase">Assigned Department</span>
                <span className="font-semibold text-[#111827]">{staff.departmentName}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8b9e95] block uppercase">Designation</span>
                <span className="font-semibold">{staff.designation}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8b9e95] block uppercase">Staff Category</span>
                <span className="font-medium">{staff.staffCategory}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Workstation Entitlements */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#52665e] border-b border-[#e2eae5] pb-1">
              Workstation Entitlements & Access Control
            </h4>
            <div className="p-3 bg-white border border-[#e2eae5] rounded-lg space-y-2">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[10px] text-[#8b9e95] block uppercase">Access Type</span>
                  <span className="font-semibold">
                    {staff.accessType === 'PORTAL_USER'
                      ? 'Portal User (Sign-in Enabled)'
                      : 'Staff Record Only'}
                  </span>
                </div>
                {staff.accessType === 'PORTAL_USER' && (
                  <>
                    <div>
                      <span className="text-[10px] text-[#8b9e95] block uppercase">
                        Designated Portal
                      </span>
                      <span className="font-bold uppercase text-[#0e7d5a]">
                        {staff.assignedPortal} Portal
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8b9e95] block uppercase">Staff Role</span>
                      <span className="font-medium">{staff.staffRole || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8b9e95] block uppercase">Workstation Username</span>
                      <span className="font-mono font-medium">{staff.username}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8b9e95] block uppercase">Last Activity Login</span>
                      <span className="font-medium">{staff.lastLoginAt || 'Never'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8b9e95] block uppercase">
                        Recorded Activity Count
                      </span>
                      <span className="font-bold">{staff.linkedActivityCount} actions</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Verification Stamps */}
          <div className="pt-6 border-t border-[#e2eae5] grid grid-cols-3 gap-6 text-[11px] text-[#52665e]">
            <div className="border-t border-slate-300 pt-2 text-center">
              <span>Prepared by HR / Admin</span>
              <p className="font-mono text-[10px] text-[#8b9e95] mt-1">{staff.createdBy}</p>
            </div>
            <div className="border-t border-slate-300 pt-2 text-center">
              <span>Department Head Signature</span>
              <p className="font-mono text-[10px] text-[#8b9e95] mt-1">Authorized Clearance</p>
            </div>
            <div className="border-t border-slate-300 pt-2 text-center">
              <span>Executive Hospital Stamp</span>
              <p className="font-mono text-[10px] text-[#8b9e95] mt-1">Sharif & Saeed Hospital</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
