import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  Printer,
  Download,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { StaffUser, StaffUserFilterState } from '../../../types/staffUser';
import { useAuth } from '../../../context/AuthContext';
import {
  downloadStaffUsersPDF,
  downloadStaffUsersExcel,
  formatFilterSummary,
} from '../../../services/staffUserExportService';

interface StaffUserExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredStaff: StaffUser[];
  filters: StaffUserFilterState;
  onPrintDirect: () => void;
}

export const StaffUserExportModal: React.FC<StaffUserExportModalProps> = ({
  isOpen,
  onClose,
  filteredStaff,
  filters,
  onPrintDirect,
}) => {
  const { currentUser } = useAuth();
  const [downloading, setDownloading] = useState<'excel' | 'pdf' | null>(null);

  if (!isOpen) return null;

  const handleExportExcel = async () => {
    try {
      setDownloading('excel');
      await downloadStaffUsersExcel(filteredStaff, filters, currentUser);
    } finally {
      setDownloading(null);
    }
  };

  const handleExportPDF = async () => {
    try {
      setDownloading('pdf');
      await downloadStaffUsersPDF(filteredStaff, filters, currentUser);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#e2eae5] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#f6f8f7] border-b border-[#e2eae5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#e7f6f1] text-[#129b70] flex items-center justify-center">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#111827] text-sm">Export Staff Directory</h3>
              <p className="text-xs text-[#52665e]">
                Official hospital operational roster and workstation assignments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8b9e95] hover:text-[#111827] hover:bg-[#e2eae5] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Scope Card */}
          <div className="p-4 bg-[#f6f8f7] border border-[#e2eae5] rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between font-semibold text-[#111827]">
              <span>Export Record Scope:</span>
              <span className="px-2 py-0.5 bg-[#e7f6f1] text-[#0e7d5a] rounded-md font-bold">
                {filteredStaff.length} Staff Members
              </span>
            </div>
            <div className="text-[11px] text-[#52665e] flex items-start gap-1.5 pt-1 border-t border-[#e2eae5]/80">
              <Filter className="h-3.5 w-3.5 text-[#8b9e95] shrink-0 mt-0.5" />
              <span>
                <strong>Applied Filters:</strong> {formatFilterSummary(filters)}
              </span>
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-3 bg-[#e7f6f1]/60 border border-[#c2e7db] rounded-xl flex items-start gap-2.5 text-xs text-[#0e7d5a]">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-[#129b70]" />
            <p className="text-[11px] leading-relaxed">
              <strong>Zero-Password Security Standard:</strong> Exported files strictly omit
              passwords, session keys, and authentication tokens in compliance with healthcare data
              protection policies.
            </p>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            {/* 1. Excel */}
            <button
              onClick={handleExportExcel}
              disabled={downloading !== null}
              className="w-full p-3.5 bg-white hover:bg-[#f6f8f7] border border-[#e2eae5] hover:border-[#129b70] rounded-xl flex items-center justify-between transition-colors group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#111827]">
                    Download Microsoft Excel (.xlsx)
                  </h4>
                  <p className="text-[11px] text-[#52665e]">
                    Multi-sheet workbook: Staff Directory roster + Hospital Export Information.
                  </p>
                </div>
              </div>
              <Download className="h-4 w-4 text-[#8b9e95] group-hover:text-[#129b70] transition-colors" />
            </button>

            {/* 2. PDF */}
            <button
              onClick={handleExportPDF}
              disabled={downloading !== null}
              className="w-full p-3.5 bg-white hover:bg-[#f6f8f7] border border-[#e2eae5] hover:border-[#129b70] rounded-xl flex items-center justify-between transition-colors group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 rounded-lg text-rose-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#111827]">
                    Download Official Document (.pdf)
                  </h4>
                  <p className="text-[11px] text-[#52665e]">
                    Executive landscape A4 format with hospital header, metadata, and page stamps.
                  </p>
                </div>
              </div>
              <Download className="h-4 w-4 text-[#8b9e95] group-hover:text-[#129b70] transition-colors" />
            </button>

            {/* 3. Direct Print */}
            <button
              onClick={() => {
                onClose();
                onPrintDirect();
              }}
              disabled={downloading !== null}
              className="w-full p-3.5 bg-white hover:bg-[#f6f8f7] border border-[#e2eae5] hover:border-[#129b70] rounded-xl flex items-center justify-between transition-colors group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-50 rounded-lg text-sky-700">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#111827]">
                    Print Hospital Staff Roll
                  </h4>
                  <p className="text-[11px] text-[#52665e]">
                    Send directory view directly to hospital network printers or system print preview.
                  </p>
                </div>
              </div>
              <Printer className="h-4 w-4 text-[#8b9e95] group-hover:text-[#129b70] transition-colors" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#f6f8f7] border-t border-[#e2eae5] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#52665e] hover:bg-[#e2eae5] rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
