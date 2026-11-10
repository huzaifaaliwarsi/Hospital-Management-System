import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  Filter,
  Loader2,
} from 'lucide-react';
import { Patient, PatientFilterState } from '../../../types/patient';
import { User } from '../../../types';
import {
  downloadPatientsPDF,
  downloadPatientsExcel,
  formatPatientFilterSummary,
} from '../../../services/patientExportService';

interface PatientExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  filters: PatientFilterState;
  currentUser: User | null;
}

export const PatientExportModal: React.FC<PatientExportModalProps> = ({
  isOpen,
  onClose,
  patients,
  filters,
  currentUser,
}) => {
  if (!isOpen) return null;

  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const filterSummary = formatPatientFilterSummary(filters);

  const handleExportPdf = async () => {
    setExportingFormat('pdf');
    try {
      await downloadPatientsPDF(patients, filters, currentUser);
    } finally {
      setExportingFormat(null);
      onClose();
    }
  };

  const handleExportExcel = async () => {
    setExportingFormat('excel');
    try {
      await downloadPatientsExcel(patients, filters, currentUser);
    } finally {
      setExportingFormat(null);
      onClose();
    }
  };

  const handlePrint = () => {
    window.print();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#effaf5] border border-[#c2e7db] text-[#08775A] flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Export Patient Registry</h3>
              <p className="text-xs text-slate-500">
                Generate official executive reports respecting current search and filters
              </p>
            </div>
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
          {/* Filter Scope Information */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
              <Filter className="w-3.5 h-3.5 text-[#08775A]" />
              <span>Export Scope ({patients.length} records)</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              <strong>Active Filter:</strong> {filterSummary}
            </p>
          </div>

          {/* Export Options Grid */}
          <div className="space-y-2.5">
            {/* PDF Option */}
            <button
              onClick={handleExportPdf}
              disabled={exportingFormat !== null}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-[#08775A] hover:bg-[#effaf5]/50 transition-all text-left group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">
                    PDF Master Registry Document (.pdf)
                  </div>
                  <div className="text-xs text-slate-500">
                    Hospital letterhead, privacy-hardened without raw CNICs, formatted for executive printing
                  </div>
                </div>
              </div>
              {exportingFormat === 'pdf' ? (
                <Loader2 className="w-4 h-4 text-[#08775A] animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 text-slate-400 group-hover:text-[#08775A] shrink-0" />
              )}
            </button>

            {/* Excel Option */}
            <button
              onClick={handleExportExcel}
              disabled={exportingFormat !== null}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-[#08775A] hover:bg-[#effaf5]/50 transition-all text-left group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">
                    Excel Complete Master Workbook (.xlsx)
                  </div>
                  <div className="text-xs text-slate-500">
                    All demographic, contact, panel, and audit columns with metadata sheet
                  </div>
                </div>
              </div>
              {exportingFormat === 'excel' ? (
                <Loader2 className="w-4 h-4 text-[#08775A] animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 text-slate-400 group-hover:text-[#08775A] shrink-0" />
              )}
            </button>

            {/* Direct Print Option */}
            <button
              onClick={handlePrint}
              disabled={exportingFormat !== null}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-[#08775A] hover:bg-[#effaf5]/50 transition-all text-left group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">
                    Direct Browser Print
                  </div>
                  <div className="text-xs text-slate-500">
                    Sends active registry list directly to connected thermal or document printer
                  </div>
                </div>
              </div>
              <Printer className="w-4 h-4 text-slate-400 group-hover:text-[#08775A] shrink-0" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-end bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors border border-slate-300 bg-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
