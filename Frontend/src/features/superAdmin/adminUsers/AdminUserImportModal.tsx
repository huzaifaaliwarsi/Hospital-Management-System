import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Copy,
  Key,
  Info,
  Shield,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ImportedAdminRow, AdminUser, AdminUserStatus } from '../../../types/adminUser';
import { AdminUserService } from '../../../services/adminUserService';
import { User } from '../../../types';

interface AdminUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onImportComplete: () => void;
}

export const AdminUserImportModal: React.FC<AdminUserImportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onImportComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedRows, setStagedRows] = useState<ImportedAdminRow[]>([]);
  const [importStep, setImportStep] = useState<'upload' | 'credentials'>('upload');
  const [generatedCredentials, setGeneratedCredentials] = useState<
    { fullName: string; username: string; tempPassword: string }[]
  >([]);
  const [isCopied, setIsCopied] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        full_name: 'Dr. Sarah Tariq',
        employee_code: 'EMP-ADM-10',
        username: 'sarah.tariq',
        email: 'sarah.tariq@sharif-saeed.hospital',
        phone: '+92 300 1122334',
        status: 'ACTIVE',
      },
      {
        full_name: 'Muhammad Asif',
        employee_code: 'EMP-ADM-11',
        username: 'asif.finance',
        email: 'asif.finance@sharif-saeed.hospital',
        phone: '+92 321 4455667',
        status: 'ACTIVE',
      },
      {
        full_name: 'Noreen Akhtar',
        employee_code: 'EMP-ADM-12',
        username: 'noreen.admin',
        email: 'noreen.akhtar@sharif-saeed.hospital',
        phone: '+92 333 7788990',
        status: 'ACTIVE',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!cols'] = [
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 32 },
      { wch: 18 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Admin_Import_Template');
    XLSX.writeFile(wb, 'Hospital_Admin_Import_Template.xlsx');
  };

  const loadSampleDataDirectly = () => {
    const sampleData = [
      {
        full_name: 'Dr. Sarah Tariq',
        employee_code: 'EMP-ADM-10',
        username: 'sarah.tariq',
        email: 'sarah.tariq@sharif-saeed.hospital',
        phone: '+92 300 1122334',
        status: 'ACTIVE' as AdminUserStatus,
      },
      {
        full_name: 'Muhammad Asif',
        employee_code: 'EMP-ADM-11',
        username: 'asif.finance',
        email: 'asif.finance@sharif-saeed.hospital',
        phone: '+92 321 4455667',
        status: 'ACTIVE' as AdminUserStatus,
      },
      {
        full_name: 'Noreen Akhtar',
        employee_code: 'EMP-ADM-12',
        username: 'noreen.admin',
        email: 'noreen.akhtar@sharif-saeed.hospital',
        phone: '+92 333 7788990',
        status: 'ACTIVE' as AdminUserStatus,
      },
    ];

    parseRawRows(sampleData);
  };

  const parseRawRows = (rows: Record<string, unknown>[]) => {
    const existing = AdminUserService.getAdminUsers();
    const stagedUsernames = new Set<string>();
    const stagedEmails = new Set<string>();

    const processed: ImportedAdminRow[] = rows.map((r, idx) => {
      const fullName = String(r.full_name || r.name || r['Full Name'] || '').trim();
      const employeeCode = String(r.employee_code || r['Employee Code'] || '').trim();
      const username = String(r.username || r['Username'] || '').trim().toLowerCase();
      const email = String(r.email || r['Email'] || '').trim().toLowerCase();
      const phone = String(r.phone || r['Phone'] || '').trim();
      const statusRaw = String(r.status || r['Status'] || 'ACTIVE').trim().toUpperCase();
      const status: AdminUserStatus =
        statusRaw === 'INACTIVE' ? 'INACTIVE' : statusRaw === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';

      const validation = AdminUserService.validateImportRow(
        { fullName, username, email, status },
        existing,
        stagedUsernames,
        stagedEmails
      );

      if (username) stagedUsernames.add(username);
      if (email) stagedEmails.add(email);

      return {
        rowNumber: idx + 1,
        fullName,
        employeeCode,
        username,
        email,
        phone,
        status,
        isValid: validation.isValid,
        errors: validation.errors,
      };
    });

    setStagedRows(processed);
    setUploadError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        if (!raw || raw.length === 0) {
          setUploadError('The selected spreadsheet does not contain any readable records.');
          return;
        }

        parseRawRows(raw);
      } catch (err) {
        setUploadError('Failed to parse file. Please upload a valid .xlsx or .csv template.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    const valid = stagedRows.filter((r) => r.isValid);
    if (valid.length === 0) return;

    try {
      const result = await AdminUserService.executeAdminImport(valid, currentUser);
      if (result.failures.length > 0) {
        setUploadError(`${result.failures.length} row(s) failed to import:\n${result.failures.join('\n')}`);
      }
      setGeneratedCredentials(result.credentials);
      setImportStep('credentials');
      await onImportComplete();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setUploadError(err.message);
      } else {
        setUploadError('Failed to execute import.');
      }
    }
  };

  const copyCredentialsToClipboard = () => {
    const text = generatedCredentials
      .map(
        (c) =>
          `Name: ${c.fullName}\nUsername: ${c.username}\nTemporary Password: ${c.tempPassword}\nRole: Hospital Administrator\n---`
      )
      .join('\n');

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const downloadCredentialsSheet = () => {
    const rows = generatedCredentials.map((c) => ({
      'Full Name': c.fullName,
      'Username': c.username,
      'Temporary Password': c.tempPassword,
      'Assigned Role': 'Hospital Administrator (Admin)',
      'Security Policy': 'Password change required on first sign-in',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 20 }, { wch: 22 }, { wch: 32 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Admin_Credentials');
    XLSX.writeFile(wb, 'Issued_Admin_Temporary_Credentials.xlsx');
  };

  const validCount = stagedRows.filter((r) => r.isValid).length;
  const invalidCount = stagedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        id="admin-user-import-modal"
        className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 transition-all"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#08775A]/20 text-[#2dd4bf]">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Import Hospital Administrators
              </h2>
              <p className="text-[11px] text-slate-300">
                Batch onboarding of standard Admin accounts from spreadsheet
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

        {/* Notice Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center gap-2 text-xs text-amber-900">
          <Shield className="h-4 w-4 shrink-0 text-amber-700" />
          <span>
            <strong>Security Notice:</strong> All imported accounts are provisioned exclusively with the standard <strong>Admin</strong> role. Super Admin accounts cannot be provisioned through bulk imports.
          </span>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {importStep === 'upload' ? (
            <>
              {/* Upload Drop Zone & Template Download */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    Official Admin Import Template
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Columns: full_name, employee_code, username, email, phone, status
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={downloadSampleTemplate}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#08775A] bg-[#effaf5] hover:bg-[#c2e7db]/40 border border-[#c2e7db] rounded-lg transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Template</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadSampleDataDirectly}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Load Demo Batch</span>
                  </button>
                </div>
              </div>

              {/* Upload Trigger */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#149E75] bg-slate-50/50 hover:bg-emerald-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all"
              >
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-800">
                  Click to select or drag & drop Excel / CSV file
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Supports .xlsx, .xls, and .csv formats
                </div>
              </div>

              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Staged Rows Preview Table */}
              {stagedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Staged Records Preview ({stagedRows.length} Rows)
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-700 font-semibold">
                        ✓ {validCount} Valid
                      </span>
                      {invalidCount > 0 && (
                        <span className="text-rose-600 font-semibold">
                          ✕ {invalidCount} Errors
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Full Name</th>
                          <th className="py-2 px-3">Username</th>
                          <th className="py-2 px-3">Email</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Validation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stagedRows.map((r) => (
                          <tr
                            key={r.rowNumber}
                            className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}
                          >
                            <td className="py-1.5 px-3 font-mono text-slate-400">
                              {r.rowNumber}
                            </td>
                            <td className="py-1.5 px-3 font-semibold text-slate-800">
                              {r.fullName || <span className="text-rose-500 italic">Missing</span>}
                            </td>
                            <td className="py-1.5 px-3 font-mono text-slate-600">
                              {r.username || <span className="text-rose-500 italic">Missing</span>}
                            </td>
                            <td className="py-1.5 px-3 text-slate-600">
                              {r.email}
                            </td>
                            <td className="py-1.5 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                                {r.status}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                                  <CheckCircle2 className="h-3 w-3" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                                  <AlertTriangle className="h-3 w-3" /> {r.errors.join(', ')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Temporary Credentials Screen */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Successfully Imported {generatedCredentials.length} Admin Users!</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Unique temporary passwords were automatically generated. Copy or download these credentials immediately to distribute to administrators.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Generated Temporary Credentials
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyCredentialsToClipboard}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{isCopied ? 'Copied to Clipboard!' : 'Copy All'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadCredentialsSheet}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#08775A] bg-[#effaf5] hover:bg-[#c2e7db]/40 border border-[#c2e7db] rounded-lg transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Excel</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Admin Name</th>
                      <th className="py-2 px-3">Username</th>
                      <th className="py-2 px-3">Temporary Password</th>
                      <th className="py-2 px-3">Assigned Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {generatedCredentials.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {c.fullName}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">
                          {c.username}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-[#08775A]">
                          {c.tempPassword}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                            Admin
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-end gap-2.5">
          {importStep === 'upload' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={validCount === 0}
                onClick={handleExecuteImport}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065e46] disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Import {validCount} Valid Admins</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065e46] rounded-xl shadow-xs transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
