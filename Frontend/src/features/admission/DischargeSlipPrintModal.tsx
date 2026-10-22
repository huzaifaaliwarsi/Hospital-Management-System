import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { AdmissionRecord, AdmissionDischargeSummary } from '../../services/admissionService';
import {
  useHospitalProfile,
  formatHospitalAddress,
  fetchHospitalProfile,
  fetchPublicHospitalProfile,
} from '../../services/hospitalProfileService';

interface DischargeSlipPrintModalProps {
  admission: AdmissionRecord;
  summary: AdmissionDischargeSummary;
  onClose: () => void;
}

function parseFatherNameAndCnic(rawFatherName?: string, rawCnic?: string) {
  if (!rawFatherName && !rawCnic) return { fatherName: '—', cnic: '—' };

  let cleanName = (rawFatherName || '').trim();
  let cnic = (rawCnic || '').trim();

  // If father's name contains a CNIC like "[CNIC: 48297-3399883-9]" or "CNIC: 48297-3399883-9"
  const match = cleanName.match(/\[?\s*CNIC[:\s]*([0-9]{5}-[0-9]{7}-[0-9]|[0-9]{13})\s*\]?/i);
  if (match) {
    if (!cnic || cnic === '—') {
      cnic = match[1];
    }
    cleanName = cleanName.replace(match[0], '').trim();
  }

  // Also clean up any loose square brackets or trailing hyphens leftover
  cleanName = cleanName.replace(/\[\s*\]/g, '').replace(/[-–—]\s*$/, '').trim();

  return {
    fatherName: cleanName || '—',
    cnic: cnic || '—',
  };
}

export const DischargeSlipPrintModal: React.FC<DischargeSlipPrintModalProps> = ({
  admission,
  summary,
  onClose,
}) => {
  const profile = useHospitalProfile();
  const { fatherName, cnic } = parseFatherNameAndCnic(admission.patientFatherName, admission.patientCnic);

  useEffect(() => {
    // If profile has not been primed or is missing the name/logo, prime it now
    if (!profile.name || profile.name === 'Not configured' || !profile.logo) {
      fetchHospitalProfile().catch(() => {
        fetchPublicHospitalProfile().catch(() => {});
      });
    }
  }, [profile.name, profile.logo]);

  const handlePrint = () => {
    window.print();
  };

  const outcome = (summary.finalOutcome || 'Discharge').toLowerCase();

  const formattedAddr = formatHospitalAddress(profile);
  const hospitalAddress =
    formattedAddr !== 'Not configured'
      ? formattedAddr
      : profile.addressLine1
        ? [profile.addressLine1, profile.addressLine2, profile.city, profile.province]
            .filter((p) => p && typeof p === 'string' && p.trim().length > 0)
            .join(', ')
        : 'Karachi, Pakistan';

  const phones = [profile.primaryPhone, profile.alternatePhone, profile.emergencyPhone].filter(
    (p) => p && typeof p === 'string' && p.trim().length > 0
  );
  const phoneText = phones.length > 0 ? `Phone: ${phones.join(' / ')}` : '';
  const emailText = profile.primaryEmail ? `Email: ${profile.primaryEmail}` : '';
  const webText = profile.website ? `Web: ${profile.website}` : '';
  const contactDetails = [phoneText, emailText, webText].filter(Boolean).join(' | ');

  const modalContent = (
    <div
      id="discharge-print-portal-root"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto print:block"
    >
      {/* Strict Print Isolation: Hide all parent app and modal elements, print ONLY the discharge form */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm 10mm 10mm 10mm;
        }
        @media print {
          /* 1. Completely hide everything in the document outside this portal */
          body > *:not(#discharge-print-portal-root) {
            display: none !important;
            visibility: hidden !important;
          }
          #root {
            display: none !important;
            visibility: hidden !important;
          }
          /* 2. Hide everything inside this portal by default */
          body * {
            visibility: hidden;
          }
          /* 3. Make ONLY the discharge form visible */
          #printable-discharge-form,
          #printable-discharge-form * {
            visibility: visible !important;
          }
          /* 4. Format root and page layout cleanly */
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          #discharge-print-portal-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            display: block !important;
            z-index: 9999999 !important;
          }
          #discharge-modal-box {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          #discharge-preview-wrapper {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          #printable-discharge-form {
            position: relative !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .discharge-ruled-lines {
            line-height: 24px !important;
            background-image: repeating-linear-gradient(
              to bottom,
              transparent 0px,
              transparent 23px,
              #94a3b8 23px,
              #94a3b8 24px
            ) !important;
            background-size: 100% 24px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .discharge-ruled-lines {
          line-height: 24px;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 23px,
            #cbd5e1 23px,
            #cbd5e1 24px
          );
          background-size: 100% 24px;
        }
      `}</style>

      {/* Container */}
      <div
        id="discharge-modal-box"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:rounded-none"
      >
        {/* Top Control Bar (Hidden in Print) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#08775A] bg-[#effaf5] px-2.5 py-1 rounded-md border border-[#c2e7db]">
              Official Hospital Document
            </span>
            <span className="text-sm font-bold text-slate-800">
              Discharge Form — {admission.admissionNumber} ({admission.patientName})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Discharge Form</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Paper Sheet Preview */}
        <div
          id="discharge-preview-wrapper"
          className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100/70 print:p-0 print:bg-white print:overflow-visible"
        >
          <div
            id="printable-discharge-form"
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            className="bg-white mx-auto max-w-[800px] border border-slate-300 p-8 sm:p-10 text-slate-900 shadow-md print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none font-serif text-[13px] leading-relaxed"
          >
            {/* Header with Circular / Crest Logo and Dynamic Hospital Details */}
            <div className="relative border-b-2 border-slate-800 pb-3 mb-4 min-h-[96px] flex items-center">
              {/* Logo from Hospital Overview */}
              <div className="absolute left-0 top-0 w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
                {profile.logo ? (
                  <img
                    src={profile.logo}
                    alt={profile.name || 'Hospital Logo'}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full rounded-full border-2 border-slate-800 bg-slate-100 flex flex-col items-center justify-center font-bold text-slate-800 font-sans">
                    <span className="text-lg sm:text-xl tracking-wider leading-none">
                      {profile.shortName ? profile.shortName.slice(0, 3).toUpperCase() : 'HMS'}
                    </span>
                    <span className="text-[9px] uppercase tracking-tighter text-slate-500 mt-0.5">Care</span>
                  </div>
                )}
              </div>

              {/* Dynamic Hospital Names and Address Centered */}
              <div className="w-full text-center pl-22 sm:pl-28 pr-4">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide font-sans text-slate-900 uppercase">
                  {profile.name || profile.shortName || 'CH. SHARIF & SAEED HOSPITAL'}
                </h1>
                {(profile.hospitalType || profile.shortName) && (
                  <h2 className="text-xs sm:text-sm font-bold tracking-wider font-sans text-slate-800 uppercase mt-0.5">
                    {profile.hospitalType || profile.shortName}
                  </h2>
                )}
                {hospitalAddress && (
                  <p className="text-[11px] font-sans text-slate-600 mt-1 leading-snug">
                    {hospitalAddress}
                  </p>
                )}
                {contactDetails && (
                  <p className="text-[11px] font-sans font-semibold text-slate-700 mt-0.5">
                    {contactDetails}
                  </p>
                )}
                <h3 className="text-sm sm:text-base font-extrabold font-sans tracking-widest text-slate-900 uppercase mt-2">
                  (DISCHARGE FORM)
                </h3>
              </div>
            </div>

            {/* Patient Demographic & Stay Info Matrix */}
            <div className="grid grid-cols-12 gap-y-2 text-[12.5px] pb-3 border-b border-slate-400">
              {/* Row 1 */}
              <div className="col-span-7 flex items-baseline">
                <span className="font-bold shrink-0">Date of Admission:</span>
                <span className="ml-2 font-mono flex-1 border-b border-dotted border-slate-700 pb-0.5">
                  {admission.admittedAt || admission.createdAt || '—'}
                </span>
              </div>
              <div className="col-span-5 flex items-baseline pl-4">
                <span className="font-bold shrink-0">Ward / Bed:</span>
                <span className="ml-2 flex-1 border-b border-dotted border-slate-700 pb-0.5 truncate">
                  {summary.nicu || [admission.departmentName, admission.bedLabel].filter(Boolean).join(' • ') || '—'}
                </span>
              </div>

              {/* Row 2 */}
              <div className="col-span-7 flex items-baseline">
                <span className="font-bold shrink-0">Date of Discharge:</span>
                <span className="ml-2 font-mono flex-1 border-b border-dotted border-slate-700 pb-0.5 font-bold">
                  {summary.dischargeDate || admission.dischargedAt || new Date().toISOString().slice(0, 10)}
                </span>
              </div>
              <div className="col-span-5 flex items-baseline pl-4">
                <span className="font-bold shrink-0">Weight on Admission:</span>
                <span className="ml-2 flex-1 border-b border-dotted border-slate-700 pb-0.5">
                  {summary.weightOnAdmission || (admission.weightKg ? `${admission.weightKg} kg` : '—')}
                </span>
              </div>

              {/* Row 3 */}
              <div className="col-span-7 flex items-baseline">
                <span className="font-bold shrink-0">Name:</span>
                <span className="ml-2 flex-1 border-b border-dotted border-slate-700 pb-0.5 font-bold text-slate-900">
                  {admission.patientName} {admission.patientMrNumber ? `(${admission.patientMrNumber})` : ''}
                </span>
              </div>
              <div className="col-span-5 flex items-baseline pl-4">
                <span className="font-bold shrink-0">Weight on Discharge:</span>
                <span className="ml-2 flex-1 border-b border-dotted border-slate-700 pb-0.5 font-bold">
                  {summary.weightOnDischarge || '—'}
                </span>
              </div>

              {/* Row 4: Father's Name, CNIC, Age, Gender */}
              <div className="col-span-4 flex items-baseline">
                <span className="font-bold shrink-0">Father's Name:</span>
                <span className="ml-2 flex-1 border-b border-dotted border-slate-700 pb-0.5">
                  {fatherName}
                </span>
              </div>
              <div className="col-span-4 flex items-baseline pl-3">
                <span className="font-bold shrink-0">CNIC:</span>
                <span className="ml-2 font-mono flex-1 border-b border-dotted border-slate-700 pb-0.5">
                  {cnic}
                </span>
              </div>
              <div className="col-span-2 flex items-baseline pl-3">
                <span className="font-bold shrink-0">Age:</span>
                <span className="ml-2 flex-1 border-b border-dotted border-slate-700 pb-0.5">
                  {admission.patientAge || '—'}
                </span>
              </div>
              <div className="col-span-2 flex items-baseline pl-2">
                <span className="font-bold shrink-0">Gender:</span>
                <span className="ml-2 flex-1 border-b border-dotted border-slate-700 pb-0.5">
                  {admission.patientGender || '—'}
                </span>
              </div>

              {/* Row 5 */}
              <div className="col-span-12 flex items-baseline">
                <span className="font-bold shrink-0">Address:</span>
                <span className="ml-2 flex-1 border-b border-dotted border-slate-700 pb-0.5">
                  {(admission.patientAddress || '')
                    .replace(/,\s*Karachi\s*,\s*Sindh\s*,\s*Pakistan\s*$/i, '')
                    .replace(/,\s*Sindh\s*,\s*Pakistan\s*$/i, '')
                    .replace(/,\s*Pakistan\s*$/i, '')
                    .trim() || '—'}
                </span>
              </div>
            </div>

            {/* Numbered Clinical Sections (1 to 8) */}
            <div className="space-y-4 pt-3">
              {/* 1. Final Diagnosis & Associated Diagnoses */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-slate-900 shrink-0">1. Final Diagnosis:</span>
                  <span className="flex-1 border-b border-slate-700 pb-0.5 font-bold text-slate-900">
                    {summary.finalDiagnosis}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2 pl-4">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-800 shrink-0">(a) Ass Diagnosis:</span>
                    <span className="flex-1 border-b border-dotted border-slate-700 pb-0.5">
                      {summary.associatedDiagnosisA || '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-800 shrink-0">(b) Ass Diagnosis:</span>
                    <span className="flex-1 border-b border-dotted border-slate-700 pb-0.5">
                      {summary.associatedDiagnosisB || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. History */}
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">2. History:</span>
                <div className="pl-4 min-h-[48px] discharge-ruled-lines whitespace-pre-wrap text-slate-800">
                  {summary.history || ''}
                </div>
              </div>

              {/* 3. Examination */}
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">3. Examination:</span>
                <div className="pl-4 min-h-[48px] discharge-ruled-lines whitespace-pre-wrap text-slate-800">
                  {summary.examination || ''}
                </div>
              </div>

              {/* 4. Investigations */}
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">4. Investigations:</span>
                <div className="pl-4 min-h-[48px] discharge-ruled-lines whitespace-pre-wrap text-slate-800">
                  {summary.investigations || ''}
                </div>
              </div>

              {/* 5. Summary */}
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">5. Summary:</span>
                <div className="pl-4 min-h-[48px] discharge-ruled-lines whitespace-pre-wrap text-slate-800">
                  {summary.treatmentSummary || ''}
                </div>
              </div>

              {/* 6. Prescription on Discharge */}
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">6. Prescription on Discharge:</span>
                <div className="pl-4 min-h-[72px] discharge-ruled-lines whitespace-pre-wrap font-sans text-xs text-slate-800">
                  {summary.prescriptionOnDischarge || summary.medicinesInstructions || ''}
                </div>
              </div>

              {/* 7. Follow-up Visit */}
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-900 shrink-0 leading-[24px]">7. Follow-up Visit:</span>
                <div className="flex-1 discharge-ruled-lines min-h-[24px] whitespace-pre-wrap text-slate-800">
                  {summary.followUpAdvice || (summary.followUpDate ? `Review on ${summary.followUpDate}` : '')}
                </div>
              </div>

              {/* 8. Final Outcome & Doctor's Signature */}
              <div className="pt-3 border-t-2 border-slate-800 mt-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  {/* Outcome Checkboxes */}
                  <div className="flex items-center gap-6">
                    <span className="font-bold text-slate-900">8. Final outcome:</span>
                    <label className="flex items-center gap-1.5 cursor-default">
                      <span className={`w-4 h-4 border border-slate-800 flex items-center justify-center text-xs font-bold ${outcome === 'died' ? 'bg-slate-900 text-white' : ''}`}>
                        {outcome === 'died' ? '✓' : ''}
                      </span>
                      <span>Died</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-default">
                      <span className={`w-4 h-4 border border-slate-800 flex items-center justify-center text-xs font-bold ${outcome === 'lama' ? 'bg-slate-900 text-white' : ''}`}>
                        {outcome === 'lama' ? '✓' : ''}
                      </span>
                      <span>Lama</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-default">
                      <span className={`w-4 h-4 border border-slate-800 flex items-center justify-center text-xs font-bold ${outcome === 'dor' ? 'bg-slate-900 text-white' : ''}`}>
                        {outcome === 'dor' ? '✓' : ''}
                      </span>
                      <span>DOR</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-default">
                      <span className={`w-4 h-4 border border-slate-800 flex items-center justify-center text-xs font-bold ${outcome === 'discharge' ? 'bg-slate-900 text-white' : ''}`}>
                        {outcome === 'discharge' ? '✓' : ''}
                      </span>
                      <span className="font-bold">Discharge</span>
                    </label>
                  </div>

                  {/* Doctor's Signature & Stamp Box */}
                  <div className="text-right min-w-[220px]">
                    <div className="border-b border-slate-800 pb-1 mb-1">
                      <p className="font-sans font-bold text-xs text-slate-900">
                        {summary.doctorNameSnapshot}
                      </p>
                      <p className="font-sans text-[11px] text-slate-600">
                        {summary.doctorDesignation || summary.doctorDepartmentSnapshot || 'Attending Clinician'}
                        {summary.doctorPmdcNumber ? ` · PMDC: ${summary.doctorPmdcNumber}` : ''}
                      </p>
                    </div>
                    <span className="font-bold text-xs text-slate-800">Doctor's / RMO's Signature</span>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                      Authorized: {summary.authorizedAt}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
