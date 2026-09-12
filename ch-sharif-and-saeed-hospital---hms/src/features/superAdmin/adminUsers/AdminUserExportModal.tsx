import React from 'react';
import {
  X,
  FileDown,
  FileSpreadsheet,
  Printer,
  FileText,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { AdminUser, AdminUserFilterState } from '../../../types/adminUser';
import { User } from '../../../types';
import {
  downloadAdminUsersPDF,
  downloadAdminUsersExcel,
  printAdminUsers,
} from '../../../services/adminUserExportService';

interface AdminUserExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AdminUser[];
  filters: AdminUserFilterState;
  currentUser: User | null;
  onOpenDossierPreview: () => void;
}

export const AdminUserExportModal: React.FC<AdminUserExportModalProps> = ({
  isOpen,
  onClose,
  users,
  filters,
  currentUser,
  onOpenDossierPreview,
}) => {
  if (!isOpen) return null;

  const handleDownloadPDF = async () => {
    onClose();
    await downloadAdminUsersPDF(users, filters, currentUser);
  };

  const handleDownloadExcel = () => {
    onClose();
    downloadAdminUsersExcel(users, filters, currentUser);
  };

  const handlePrint = () => {
    onClose();
    printAdminUsers(users, filters, currentUser);
  };

  const handleDossier = () => {
    onClose();
    onOpenDossierPreview();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="admin-export-modal"
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden transition-all"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#08775A]/20 text-[#2dd4bf]">
              <FileDown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Export Administrative Directory
              </h2>
              <p className="text-[11px] text-slate-300">
                Official documents generated with hospital executive credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-5 space-y-3">
          <div className="text-xs text-slate-500 mb-2">
            Selected batch contains <strong>{users.length}</strong> matching administrative user records.
          </div>

          {/* Option 1: PDF */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-[#149E75] bg-white hover:bg-emerald-50/40 flex items-start gap-3 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-[#08775A] group-hover:text-white transition-colors">
              <FileDown className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#08775A] flex items-center justify-between">
                <span>Download Official PDF Document</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                  Landscape A4
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Formatted institutional document with registration credentials, filter metadata, and executive confidentiality banner.
              </div>
            </div>
          </button>

          {/* Option 2: Excel */}
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-[#149E75] bg-white hover:bg-emerald-50/40 flex items-start gap-3 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-[#08775A] group-hover:text-white transition-colors">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#08775A] flex items-center justify-between">
                <span>Download Spreadsheet (.xlsx)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                  2 Worksheets
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Structured Excel workbook with &quot;Admin Users&quot; catalog and &quot;Export Information&quot; audit sheet.
              </div>
            </div>
          </button>

          {/* Option 3: Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-[#149E75] bg-white hover:bg-emerald-50/40 flex items-start gap-3 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-sky-100 text-sky-800 group-hover:bg-[#08775A] group-hover:text-white transition-colors">
              <Printer className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#08775A] flex items-center justify-between">
                <span>Print Directory Roll</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                  Print Window
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Opens clean printable preview window with optimized landscape layout.
              </div>
            </div>
          </button>

          {/* Option 4: Dossier Preview */}
          <button
            type="button"
            onClick={handleDossier}
            className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-[#149E75] bg-white hover:bg-emerald-50/40 flex items-start gap-3 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-800 group-hover:bg-[#08775A] group-hover:text-white transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#08775A] flex items-center justify-between">
                <span>Preview Governance Dossier</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                  Inspection View
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Interactive in-portal inspection of the governance roll before dispatch.
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
