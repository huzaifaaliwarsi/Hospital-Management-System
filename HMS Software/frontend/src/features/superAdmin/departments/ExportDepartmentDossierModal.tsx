import React, { useState } from 'react';
import {
  X,
  Printer,
  FileDown,
  FileSpreadsheet,
  Building2,
  Loader2,
} from 'lucide-react';
import { Department, DepartmentFilterState } from '../../../types/department';
import { User } from '../../../types';
import { formatDisplayDate } from '../../../utils/dateConstants';
import {
  getHospitalProfile,
  getProfileFieldValue,
} from '../../../services/hospitalProfileService';
import {
  downloadDepartmentPDF,
  downloadDepartmentExcel,
  formatDepartmentCapabilities,
} from '../../../services/departmentExportService';
import { useToast } from '../../../context/ToastContext';

interface ExportDepartmentDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  filters: DepartmentFilterState;
  currentUser: User | null;
}

export const ExportDepartmentDossierModal: React.FC<ExportDepartmentDossierModalProps> = ({
  isOpen,
  onClose,
  departments,
  filters,
  currentUser,
}) => {
  const toast = useToast();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  if (!isOpen) return null;

  const profile = getHospitalProfile();
  const hospitalName = profile.name || 'CH Sharif and Saeed Hospital';
  const regNumber = getProfileFieldValue(profile.registrationNumber);
  const taxNumber = getProfileFieldValue(profile.taxNumber);
  const phone = getProfileFieldValue(profile.primaryPhone);

  const generatedByName = currentUser?.name || 'Prof. Dr. Tariq Saeed';
  const generatedByRole = currentUser?.role || 'Super Admin';
  const generatedBy = `${generatedByName} (${generatedByRole})`;

  const now = new Date();
  const generatedOn = `${formatDisplayDate(now)}, ${now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPdf(true);
      await downloadDepartmentPDF(departments, filters, currentUser);
      toast.success('Department PDF downloaded successfully.', 'Export Complete');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      toast.error('Unable to generate export. Please try again.', 'Export Failed');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setIsDownloadingExcel(true);
      await downloadDepartmentExcel(departments, filters, currentUser);
      toast.success('Department Excel file downloaded successfully.', 'Export Complete');
    } catch (err) {
      console.error('Failed to generate Excel:', err);
      toast.error('Unable to generate export. Please try again.', 'Export Failed');
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const activeFiltersSummary: string[] = [];
  if (filters.searchTerm.trim()) activeFiltersSummary.push(`Search: "${filters.searchTerm.trim()}"`);
  if (filters.type !== 'All') activeFiltersSummary.push(`Type: ${filters.type}`);
  if (filters.status !== 'All') activeFiltersSummary.push(`Status: ${filters.status}`);
  if (filters.capability !== 'All') activeFiltersSummary.push(`Access: ${filters.capability}`);
  if (activeFiltersSummary.length === 0) activeFiltersSummary.push('All Departments (Unfiltered)');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150 print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-6 print:border-none print:shadow-none print:rounded-none">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#effaf5] px-6 py-3.5 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-[#08775A]">Official Export Dossier Preview</span>
            <span className="text-slate-400 text-xs">• {departments.length} records in scope</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Action 1: Download PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloadingPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#c2e7db] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#08775A] hover:bg-[#effaf5] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {isDownloadingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#08775A]" />
              ) : (
                <FileDown className="h-3.5 w-3.5 text-[#08775A]" />
              )}
              <span>{isDownloadingPdf ? 'Downloading PDF...' : 'Download PDF'}</span>
            </button>

            {/* Action 2: Download Excel */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isDownloadingExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {isDownloadingExcel ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-600" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5 text-slate-600" />
              )}
              <span>{isDownloadingExcel ? 'Downloading Excel...' : 'Download Excel'}</span>
            </button>

            {/* Action 3: Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#08775A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0e7d5a] transition-colors shadow-2xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors ml-1 cursor-pointer"
              title="Close Preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 space-y-6 max-h-[calc(85vh-100px)] overflow-y-auto print:max-h-none print:overflow-visible print:p-4">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-[#08775A] pb-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#08775A] text-white shadow-xs">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900">
                  {hospitalName}
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  Executive Hospital Management System • Central Administrative Governance
                </p>
                {/* Non-fabricated Hospital Metadata */}
                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                  <span>Reg No: <strong className="font-semibold text-slate-700">{regNumber}</strong></span>
                  <span>•</span>
                  <span>Tax / NTN: <strong className="font-semibold text-slate-700">{taxNumber}</strong></span>
                  <span>•</span>
                  <span>Phone: <strong className="font-semibold text-slate-700">{phone}</strong></span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded bg-[#effaf5] border border-[#c2e7db] text-xs font-bold text-[#08775A] uppercase tracking-wider">
                Department Directory
              </span>
              <div className="text-[11px] text-slate-500 mt-1">
                Total Listed: <span className="font-bold text-slate-800">{departments.length}</span>
              </div>
            </div>
          </div>

          {/* Report Metadata Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Generated By</span>
              <span className="font-semibold text-slate-800">{generatedBy}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Generated On</span>
              <span className="text-slate-700">{generatedOn}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Applied Filters</span>
              <span className="text-slate-700">{activeFiltersSummary.join(' • ')}</span>
            </div>
          </div>

          {/* Table (Strictly 9 approved report columns) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#effaf5] text-[#08775A] border-y border-[#c2e7db] text-[11px] font-bold">
                  <th className="py-2.5 px-3">Department Code</th>
                  <th className="py-2.5 px-3">Department Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Head / In-charge</th>
                  <th className="py-2.5 px-3">Location / Extension</th>
                  <th className="py-2.5 px-3">Operational Access</th>
                  <th className="py-2.5 px-2 text-center">Docs</th>
                  <th className="py-2.5 px-2 text-center">Staff</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#08775A]">{d.code}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{d.name}</td>
                    <td className="py-2.5 px-3 text-slate-700">{d.type}</td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">{d.headName || 'Not Assigned'}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {d.location || 'N/A'}{d.contactExtension ? ` (Ext. ${d.contactExtension})` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {formatDepartmentCapabilities(d)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-800">{d.doctorCount ?? 0}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-800">{d.staffCount ?? 0}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Metadata & Confidentiality Notice */}
          <div className="border-t border-slate-200 pt-6 mt-8 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              <span>Official Record • {hospitalName} Information Governance</span>
              <div className="text-[10px] text-slate-400">
                Confidentiality Notice: Intended strictly for authenticated hospital administrative usage.
              </div>
            </div>
            <div className="text-right">
              <span className="font-semibold text-slate-700">Official Dossier</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
