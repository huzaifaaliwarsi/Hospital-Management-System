import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import {
  ImportedStaffRow,
  StaffImportValidationResult,
} from '../../../types/staffUser';
import { StaffUserService } from '../../../services/staffUserService';
import { Department } from '../../../types/department';
import { useAuth } from '../../../context/AuthContext';

interface StaffUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
}

export const StaffUserImportModal: React.FC<StaffUserImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<StaffImportValidationResult | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    importedCount: number;
    generatedCredentials: {
      employeeCode: string;
      fullName: string;
      portal: string;
      role: string;
      username: string;
      temporaryPassword: string;
    }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    StaffUserService.generateImportTemplate();
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      setError('Please upload a valid Excel file (.xlsx or .xls).');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setParsing(true);

    try {
      const results = await StaffUserService.parseAndValidateImport(selectedFile);
      setValidationResult(results);
    } catch (err: any) {
      setError(err.message || 'Failed to parse Excel file.');
    } finally {
      setParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleCommitImport = async () => {
    if (!validationResult) return;
    const validRows = validationResult.rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setError('No valid rows available to import.');
      return;
    }

    const result = await StaffUserService.commitImport(validRows, currentUser);
    if (result.failures.length > 0) {
      setError(`${result.failures.length} row(s) failed to import:\n${result.failures.join('\n')}`);
    }
    setImportResult(result);
    onSuccess();
  };

  const handleDownloadCredentials = () => {
    if (importResult && importResult.generatedCredentials.length > 0) {
      StaffUserService.downloadTemporaryCredentials(importResult.generatedCredentials);
    }
  };

  const validCount = validationResult?.validRows || 0;
  const invalidCount = validationResult?.invalidRows || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-[#e2eae5] overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-[#f6f8f7] border-b border-[#e2eae5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#e7f6f1] text-[#129b70] flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#111827] text-base">Import Staff Directory from Excel</h3>
              <p className="text-xs text-[#52665e]">
                Batch import hospital employees with automatic validation and credential provisioning.
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
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
          {importResult ? (
            /* Step 3: Completed State */
            <div className="space-y-5 py-4">
              <div className="p-5 bg-[#e7f6f1] border border-[#c2e7db] rounded-2xl flex items-start gap-4">
                <ShieldCheck className="h-7 w-7 text-[#0e7d5a] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-[#0e7d5a]">
                    Staff Import Completed Successfully
                  </h4>
                  <p className="text-xs text-[#52665e] mt-1 leading-relaxed">
                    Successfully imported <strong className="text-[#111827]">{importResult.importedCount}</strong> staff
                    records into the hospital master catalog.
                  </p>
                </div>
              </div>

              {/* Download Credentials Notice */}
              {importResult.generatedCredentials.length > 0 && (
                <div className="bg-[#f6f8f7] border border-[#e2eae5] p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-xs text-[#111827]">
                        Temporary Credentials Provisioned ({importResult.generatedCredentials.length})
                      </h5>
                      <p className="text-xs text-[#52665e] mt-0.5">
                        Download the credentials file containing secure initial passwords for newly created portal users.
                      </p>
                    </div>
                    <button
                      onClick={handleDownloadCredentials}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#129b70] hover:bg-[#0e7d5a] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Credentials Excel</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-semibold rounded-lg cursor-pointer"
                >
                  Close & View Directory
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Download Template Callout */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-[#f6f8f7] border border-[#e2eae5] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-[#e2eae5] text-[#129b70]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#111827]">Download Official Excel Template</h4>
                    <p className="text-[11px] text-[#52665e]">
                      Includes sample rows, reference department codes, and portal role lists.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#e7f6f1] text-[#0e7d5a] border border-[#c2e7db] font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <Download className="h-4 w-4 text-[#129b70]" />
                  <span>Download .xlsx Template</span>
                </button>
              </div>

              {/* Step 2: Upload Zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#c2e7db] hover:border-[#129b70] bg-[#fbfcfb] hover:bg-[#e7f6f1]/20 rounded-2xl p-6 text-center cursor-pointer transition-colors"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  accept=".xlsx,.xls"
                  className="hidden"
                />
                <div className="h-10 w-10 bg-[#e7f6f1] text-[#129b70] rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="font-bold text-[#111827]">
                  {file ? file.name : 'Click to browse or drag and drop your Excel file'}
                </p>
                <p className="text-[11px] text-[#8b9e95] mt-1">Supports Microsoft Excel (.xlsx, .xls)</p>
              </div>

              {parsing && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>Parsing and validating Excel worksheet rows...</span>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Validation Summary & Preview Table */}
              {validationResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-xs text-[#111827]">
                        Validation Preview ({validationResult.totalRows} rows parsed)
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e7f6f1] text-[#0e7d5a]">
                        <CheckCircle2 className="h-3 w-3" />
                        {validCount} Ready
                      </span>
                      {invalidCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          {invalidCount} Invalid
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-[#e2eae5] rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-[#f6f8f7] border-b border-[#e2eae5] text-[#52665e] font-semibold">
                          <th className="py-2 px-3">Row</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Emp Code</th>
                          <th className="py-2 px-3">Full Name</th>
                          <th className="py-2 px-3">Department</th>
                          <th className="py-2 px-3">Portal / Access</th>
                          <th className="py-2 px-3">Issues</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2eae5]/60">
                        {validationResult.rows.map((row: ImportedStaffRow) => (
                          <tr
                            key={row.rowNumber}
                            className={row.isValid ? 'hover:bg-[#fbfcfb]' : 'bg-red-50/40'}
                          >
                            <td className="py-2 px-3 font-mono font-medium text-slate-500">
                              #{row.rowNumber}
                            </td>
                            <td className="py-2 px-3">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[#0e7d5a] font-semibold">
                                  <CheckCircle2 className="h-3 w-3" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                  <AlertCircle className="h-3 w-3" /> Invalid
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono font-semibold">
                              {row.employeeCode || '—'}
                            </td>
                            <td className="py-2 px-3 font-medium text-[#111827]">
                              {row.fullName || '—'}
                            </td>
                            <td className="py-2 px-3 text-[#52665e]">
                              {row.departmentCode || '—'}
                            </td>
                            <td className="py-2 px-3">
                              {row.accessType === 'PORTAL_USER' ? (
                                <span className="text-[#0e7d5a] font-medium">
                                  {row.assignedPortal?.toUpperCase()}
                                </span>
                              ) : (
                                <span className="text-[#8b9e95]">Directory Only</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-red-600 font-medium">
                              {row.errors.length > 0 ? row.errors.join('; ') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-[#e2eae5] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setValidationResult(null);
                      }}
                      className="text-xs text-[#52665e] hover:text-[#111827] cursor-pointer"
                    >
                      Clear & Upload Different File
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-2 text-xs font-semibold text-[#52665e] hover:bg-[#e2eae5] rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCommitImport}
                        disabled={validCount === 0}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg shadow-sm cursor-pointer"
                      >
                        <span>Commit Import ({validCount} Staff)</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
