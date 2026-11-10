import React from 'react';
import { X, Printer, Building, Phone, Mail, MapPin, CheckCircle2, Shield } from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';

interface PrintHospitalProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: HospitalProfile;
}

export const PrintHospitalProfileModal: React.FC<PrintHospitalProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isConfigured = (val?: string | null) => Boolean(val && val.trim().length > 0);

  const addressParts = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.province,
    profile.postalCode,
    profile.country,
  ].filter((p) => p && p.trim().length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:static print:bg-white"
    >
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Toolbar (hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2eae5] bg-[#f8faf9] print:hidden">
          <div className="flex items-center gap-2.5">
            <Printer className="h-5 w-5 text-[#08775A]" />
            <div>
              <h3 className="text-sm font-bold text-[#111827]">Hospital Profile Dossier</h3>
              <p className="text-[11px] text-[#52665e]">Official Institutional Governance & Specification Record</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#129b70] hover:bg-[#08775A] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Dossier</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="p-8 overflow-y-auto flex-1 space-y-6 text-slate-900 print:overflow-visible print:p-0">
          {/* Header of Dossier */}
          <div className="flex items-start justify-between border-b-2 border-[#129b70] pb-6 gap-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                {profile.logo ? (
                  <img
                    src={profile.logo}
                    alt={profile.name}
                    className="h-16 w-16 object-contain rounded-xl border border-[#c2e7db] p-1.5"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-[#effaf5] border border-[#c2e7db] flex flex-col items-center justify-center text-[#08775A]">
                    <span className="text-lg font-extrabold leading-none">CSS</span>
                    <span className="text-[9px] font-bold text-[#149e75]">HMS</span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{profile.name}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Institutional Master Profile &amp; Governance Specification
                </p>
                <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-2">
                  <span>
                    <strong>Type:</strong> {profile.hospitalType || 'Not configured'}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Status:</strong> {profile.status}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Currency:</strong> {profile.currency || 'PKR'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-500 shrink-0 space-y-0.5">
              <p className="font-semibold text-slate-800">Hospital Administration</p>
              <p>Created: {profile.createdAt || 'Not configured'} ({profile.createdBy || 'Not configured'})</p>
              <p>Updated: {profile.updatedAt || 'Not configured'} ({profile.updatedBy || 'Not configured'})</p>
            </div>
          </div>

          {/* Section: Identity & Licensing */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#08775A] border-b border-slate-200 pb-1 mb-2">
              1. Institutional Identity &amp; Licensing
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Registration No.</span>
                <span className="font-medium text-slate-800">{profile.registrationNumber || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">License No.</span>
                <span className="font-medium text-slate-800">{profile.licenseNumber || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Accreditation Body</span>
                <span className="font-medium text-slate-800">{profile.accreditationBody || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Accreditation No.</span>
                <span className="font-medium text-slate-800">{profile.accreditationNumber || '—'}</span>
              </div>
            </div>
          </div>

          {/* Section: Contact & Communications */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#08775A] border-b border-slate-200 pb-1 mb-2">
              2. Contact &amp; Communications
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Primary Phone</span>
                <span className="font-medium text-slate-800">{profile.primaryPhone || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Alternate Phone</span>
                <span className="font-medium text-slate-800">{profile.alternatePhone || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Emergency Hotline</span>
                <span className="font-bold text-rose-700">{profile.emergencyPhone || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Admin Email</span>
                <span className="font-medium text-slate-800">{profile.primaryEmail || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Secondary Email</span>
                <span className="font-medium text-slate-800">{profile.secondaryEmail || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Website</span>
                <span className="font-medium text-slate-800">{profile.website || '—'}</span>
              </div>
            </div>
          </div>

          {/* Section: Address & Campus */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#08775A] border-b border-slate-200 pb-1 mb-2">
              3. Address &amp; Physical Location
            </h2>
            <div className="text-xs">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">Facility Address</span>
              <span className="font-medium text-slate-800">
                {addressParts.length > 0 ? addressParts.join(', ') : 'Not configured'}
              </span>
            </div>
          </div>

          {/* Section: Operational Settings */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#08775A] border-b border-slate-200 pb-1 mb-2">
              4. Operational Parameters &amp; OPD Timetable
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-3">
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Currency</span>
                <span className="font-medium text-slate-800">{profile.currency || 'PKR'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Timezone</span>
                <span className="font-medium text-slate-800">{profile.timezone || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Working Mode</span>
                <span className="font-medium text-slate-800">{profile.workingMode || 'Not configured'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Emergency Dept</span>
                <span className="font-medium text-slate-800">
                  {profile.emergencyEnabled && profile.emergencyMode
                    ? profile.emergencyMode
                    : profile.emergencyEnabled
                    ? 'Enabled'
                    : 'Not configured'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">OPD Timings</span>
                <span className="font-medium text-slate-800">
                  {profile.opdOpenTime && profile.opdCloseTime ? `${profile.opdOpenTime} – ${profile.opdCloseTime}` : 'Not configured'}
                </span>
              </div>
            </div>

            {/* Timetable compact row */}
            <div className="grid grid-cols-7 gap-1 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
              {profile.workingHours.map((wh) => (
                <div key={wh.day} className="p-1">
                  <span className="font-bold block text-slate-700">{wh.day.slice(0, 3)}</span>
                  <span className={wh.isOpen ? 'text-[#08775A] font-semibold' : 'text-slate-400'}>
                    {wh.isOpen ? (wh.openTime && wh.closeTime ? `${wh.openTime}-${wh.closeTime}` : 'Open') : 'Closed'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Fiscal & Legal Profile */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#08775A] border-b border-slate-200 pb-1 mb-2">
              5. Fiscal &amp; Billing Profile
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Legal Name</span>
                <span className="font-medium text-slate-800">{profile.legalBusinessName || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Tax / NTN</span>
                <span className="font-medium text-slate-800">{profile.taxNumber || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Invoice Prefix</span>
                <span className="font-mono font-bold text-[#08775A]">{profile.invoicePrefix || 'INV'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Receipt Prefix</span>
                <span className="font-mono font-bold text-[#08775A]">{profile.receiptPrefix || 'REC'}</span>
              </div>
            </div>
          </div>

          {/* Footer of Dossier */}
          <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
            <span>CH Sharif and Saeed Hospital — Global HMS Enterprise System</span>
            <span>Document Authentication Code: CSS-DOSS-{Date.now().toString(36).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
