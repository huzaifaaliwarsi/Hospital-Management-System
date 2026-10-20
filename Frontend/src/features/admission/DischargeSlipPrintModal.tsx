import React from 'react';
import { Printer, X } from 'lucide-react';
import { AdmissionRecord, AdmissionDischargeSummary } from '../../services/admissionService';

interface DischargeSlipPrintModalProps {
  admission: AdmissionRecord;
  summary: AdmissionDischargeSummary;
  onClose: () => void;
}

export const DischargeSlipPrintModal: React.FC<DischargeSlipPrintModalProps> = ({
  admission,
  summary,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const outcome = (summary.finalOutcome || 'Discharge').toLowerCase();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Container */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:rounded-none">
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
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Paper Sheet Preview */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100/70 print:p-0 print:bg-white print:overflow-visible">
          <div
            id="printable-discharge-form"
            className="bg-white mx-auto max-w-[800px] border border-slate-300 p-8 sm:p-10 text-slate-900 shadow-md print:shadow-none print:border-none print:p-6 print:m-0 print:max-w-none font-serif text-[13px] leading-relaxed"
          >
            {/* Header with Circular Logo and Clinic Details */}
            <div className="relative border-b-2 border-slate-800 pb-3 mb-4">
              {/* Circular Logo */}
              <div className="absolute left-0 top-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-slate-800 flex items-center justify-center p-1.5 bg-slate-50 text-slate-800 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-current">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3" />
                  <circle cx="48" cy="34" r="12" />
                  <path d="M28,68 C28,52 42,48 54,48 C64,48 74,54 74,68 C74,78 64,84 48,84 C36,84 28,78 28,68 Z" />
                  <circle cx="64" cy="58" r="7" />
                  <path d="M56,76 C56,66 64,64 70,64 C76,64 80,68 80,76 Z" />
                </svg>
              </div>

              {/* Clinic Names and Address Centered */}
              <div className="text-center pl-16 sm:pl-20 pr-4">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide font-sans text-slate-900">
                  CH. SHARIF &amp; SAEED
                </h1>
                <h2 className="text-xs sm:text-sm font-bold tracking-wider font-sans text-slate-800 uppercase mt-0.5">
                  Maternal and Child Care Clinic
                </h2>
                <p className="text-[11px] font-sans text-slate-600 mt-1">
                  B-144, Main Sharah-e-Quaideen, Near Underpass, Karachi.
                </p>
                <p className="text-[11px] font-sans font-semibold text-slate-700">
                  Phone: 0301-6569996
                </p>
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
                <span className="font-bold shrink-0">NICU:</span>
                <span className="ml-2 flex-1 border-b border-dotted border-slate-700 pb-0.5">
                  {summary.nicu || '—'}
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

              {/* Row 4 */}
              <div className="col-span-7 flex items-baseline">
                <span className="font-bold shrink-0">Father's Name:</span>
                <span className="ml-2 flex-1 border-b border-dotted border-slate-700 pb-0.5">
                  {admission.patientFatherName || '—'}
                </span>
              </div>
              <div className="col-span-3 flex items-baseline pl-4">
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
                  {admission.patientAddress || '—'}
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
                <div className="pl-4 min-h-[48px] border-b border-slate-300 pb-1 whitespace-pre-wrap">
                  {summary.history || 'No significant prior medical history noted.'}
                </div>
              </div>

              {/* 3. Examination */}
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">3. Examination:</span>
                <div className="pl-4 min-h-[48px] border-b border-slate-300 pb-1 whitespace-pre-wrap">
                  {summary.examination || `Condition: ${summary.conditionAtDischarge || 'Stable'}`}
                </div>
              </div>

              {/* 4. Investigations */}
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">4. Investigations:</span>
                <div className="pl-4 min-h-[48px] border-b border-slate-300 pb-1 whitespace-pre-wrap">
                  {summary.investigations || 'Routine baseline labs & diagnostics performed.'}
                </div>
              </div>

              {/* 5. Summary */}
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">5. Summary:</span>
                <div className="pl-4 min-h-[60px] border-b border-slate-300 pb-1 whitespace-pre-wrap">
                  {summary.treatmentSummary || 'Patient managed conservatively in ward and responded satisfactorily to treatment.'}
                </div>
              </div>

              {/* 6. Prescription on Discharge */}
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">6. Prescription on Discharge:</span>
                <div className="pl-4 min-h-[60px] border-b border-slate-300 pb-1 whitespace-pre-wrap font-sans text-xs">
                  {summary.prescriptionOnDischarge || summary.medicinesInstructions || 'As per prescription slip.'}
                </div>
              </div>

              {/* 7. Follow-up Visit */}
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-slate-900 shrink-0">7. Follow-up Visit:</span>
                <span className="flex-1 border-b border-slate-700 pb-0.5">
                  {summary.followUpAdvice || (summary.followUpDate ? `Review on ${summary.followUpDate}` : 'In OPD as advised.')}
                </span>
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
};
