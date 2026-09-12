import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  Department,
  DepartmentHeadOption,
  DepartmentImportRow,
  DepartmentImportValidationResult,
} from '../../../types/department';
import { DepartmentService } from '../../../services/departmentService';
import { SAMPLE_IMPORT_BATCH_DATA } from './departmentMockData';

interface ImportDepartmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedDepartments: Department[]) => void;
  existingDepartments: Department[];
  headOptions: DepartmentHeadOption[];
}

export const ImportDepartmentsModal: React.FC<ImportDepartmentsModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingDepartments,
  headOptions,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'completed'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [validationResults, setValidationResults] = useState<
    DepartmentImportValidationResult[]
  >([]);
  const [importedCount, setImportedCount] = useState<number>(0);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    DepartmentService.downloadTemplate();
  };

  const parseCSVText = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      alert('The uploaded file appears to be empty or does not contain data rows.');
      return;
    }

    const headers = lines[0]
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));

    const rows: DepartmentImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV split supporting quoted items
      const values: string[] = [];
      let inQuotes = false;
      let currentVal = '';
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim());

      const rowObj: any = {};
      headers.forEach((hdr, idx) => {
        rowObj[hdr] = (values[idx] || '').replace(/^"|"$/g, '');
      });

      rows.push(rowObj);
    }

    const results = DepartmentService.validateImportRows(
      rows,
      existingDepartments,
      headOptions
    );
    setValidationResults(results);
    setStep('preview');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      parseCSVText(text);
    };
    reader.readAsText(file);
  };

  const handleLoadSampleBatch = () => {
    setFileName('Sample_Hospital_Departments_Batch.csv');
    parseCSVText(SAMPLE_IMPORT_BATCH_DATA);
  };

  const validRows = validationResults.filter((r) => r.status === 'Valid');
  const invalidRows = validationResults.filter((r) => r.status === 'Invalid');
  const duplicateRows = validationResults.filter((r) => r.status === 'Duplicate');

  const handleConfirmImport = () => {
    const departmentsToImport = validRows
      .map((r) => r.convertedDepartment)
      .filter((d): d is Department => !!d);

    if (departmentsToImport.length === 0) {
      alert('There are no valid rows to import.');
      return;
    }

    onImportSuccess(departmentsToImport);
    setImportedCount(departmentsToImport.length);
    setStep('completed');
  };

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setValidationResults([]);
    setImportedCount(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#effaf5] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#08775A] text-white shadow-xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Import Departments from Excel / CSV
              </h3>
              <p className="text-xs text-slate-500">
                Batch register hospital departments with automated schema and duplication validation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Template Download Prompt */}
              <div className="flex items-center justify-between rounded-xl border border-[#c2e7db] bg-[#effaf5]/60 p-4 text-xs">
                <div>
                  <h4 className="font-bold text-[#08775A]">1. Download Official Excel Template</h4>
                  <p className="text-slate-600 mt-0.5">
                    Preformatted with all required columns: department code, name, type, head, and capability flags.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 rounded-lg bg-white border border-[#08775A] px-3.5 py-2 text-xs font-semibold text-[#08775A] hover:bg-[#effaf5] transition-colors shadow-2xs shrink-0"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">
                  2. Upload Prepared Spreadsheet (.xlsx / .csv)
                </h4>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#08775A] bg-slate-50/70 p-8 text-center cursor-pointer transition-all hover:bg-white"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200/60 group-hover:bg-[#effaf5] text-slate-500 group-hover:text-[#08775A] transition-colors">
                    <Upload className="h-6 w-6" />
                  </div>
                  <span className="mt-3 font-semibold text-xs text-slate-700 group-hover:text-[#08775A]">
                    Click to select CSV / Excel file or drag &amp; drop
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    Supports standardized CSV with UTF-8 character encoding
                  </span>
                </div>
              </div>

              {/* Sample Batch Quick-Tester */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#08775A]" />
                  <span className="text-slate-600">
                    Want to test the validation engine immediately?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSampleBatch}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#08775A] hover:underline"
                >
                  <span>Load Sample Test Batch (5 rows)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* Validation Summary Bar */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-slate-800">
                    File: <span className="font-normal text-slate-600">{fileName}</span>
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {validRows.length} Valid
                    </span>
                    <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {invalidRows.length} Invalid
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {duplicateRows.length} Duplicate
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium text-[11px]"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Choose Another File</span>
                </button>
              </div>

              {/* Preview Table */}
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#effaf5] text-[11px] font-bold text-[#08775A] border-b border-[#c2e7db]">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Department Name</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Validation Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {validationResults.map((res) => (
                      <tr
                        key={res.rowNumber}
                        className={
                          res.status === 'Valid'
                            ? 'hover:bg-slate-50/80'
                            : 'bg-rose-50/30 hover:bg-rose-50/50'
                        }
                      >
                        <td className="p-2.5 font-mono text-slate-500">{res.rowNumber}</td>
                        <td className="p-2.5">
                          {res.status === 'Valid' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              Valid
                            </span>
                          )}
                          {res.status === 'Invalid' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <AlertCircle className="h-3 w-3" />
                              Invalid
                            </span>
                          )}
                          {res.status === 'Duplicate' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <AlertTriangle className="h-3 w-3" />
                              Duplicate
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">
                          {res.data.department_code || '—'}
                        </td>
                        <td className="p-2.5 font-medium text-slate-800">
                          {res.data.department_name || '—'}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {res.data.department_type || '—'}
                        </td>
                        <td className="p-2.5">
                          {res.status === 'Valid' ? (
                            <span className="text-emerald-700 font-medium">Ready to import</span>
                          ) : (
                            <span className="text-rose-600 font-medium">{res.errorMessage}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {invalidRows.length > 0 || duplicateRows.length > 0 ? (
                <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Note: Only the <span className="font-bold">{validRows.length} valid row(s)</span> will be imported. Invalid and duplicate rows will be safely excluded.
                </p>
              ) : null}
            </div>
          )}

          {step === 'completed' && (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-[#08775A]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Departments Imported Successfully
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  {importedCount} new department(s) have been registered and added to the hospital directory.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-[#08775A] px-6 py-2 text-xs font-semibold text-white hover:bg-[#0e7d5a] transition-colors shadow-xs"
                >
                  Done &amp; View Departments
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (for preview and upload states) */}
        {step === 'preview' && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={validRows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[#08775A] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0e7d5a] disabled:opacity-50 transition-colors shadow-xs"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Confirm Import ({validRows.length} Valid Rows)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
