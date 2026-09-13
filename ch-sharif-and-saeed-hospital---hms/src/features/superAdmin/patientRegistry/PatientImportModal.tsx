import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import {
  Patient,
  ImportPatientRowResult,
  ImportSummary,
} from '../../../types/patient';
import {
  validateImportRow,
  commitBatchPatients,
  getAllPatients,
} from '../../../services/patientRegistryService';
import {
  downloadPatientImportTemplate,
  downloadImportErrorRows,
} from '../../../services/patientExportService';
import { User } from '../../../types';

interface PatientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (summary: ImportSummary) => void;
  currentUser: User | null;
}

export const PatientImportModal: React.FC<PatientImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  currentUser,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ImportPatientRowResult[]>([]);
  const [isCommitted, setIsCommitted] = useState(false);
  const [commitSummary, setCommitSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setIsCommitted(false);
    setCommitSummary(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        // Use first sheet
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const existing = getAllPatients();
        const stagedPatients: Patient[] = [];
        const validatedRows: ImportPatientRowResult[] = [];

        rawJson.forEach((row, index) => {
          const rowResult = validateImportRow(row, index + 2, existing, stagedPatients);
          validatedRows.push(rowResult);
          if (rowResult.patient && rowResult.status === 'VALID') {
            stagedPatients.push(rowResult.patient);
          }
        });

        setResults(validatedRows);
      } catch (err) {
        console.error('Error parsing Excel import file:', err);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const validCount = results.filter((r) => r.status === 'VALID').length;
  const possibleDupCount = results.filter((r) => r.status === 'POSSIBLE_DUPLICATE').length;
  const exactDupCount = results.filter((r) => r.status === 'EXACT_DUPLICATE').length;
  const invalidCount = results.filter((r) => r.status === 'INVALID').length;
  const errorRows = results.filter((r) => r.status === 'INVALID' || r.status === 'EXACT_DUPLICATE');

  const handleConfirmImport = async () => {
    // Only import valid rows (or possible duplicates if staff proceeds)
    const rowsToCommit = results.filter(
      (r) => r.status === 'VALID' || r.status === 'POSSIBLE_DUPLICATE'
    );
    const summary = await commitBatchPatients(rowsToCommit, currentUser);
    setIsCommitted(true);
    setCommitSummary(summary);
    onImportComplete(summary);
  };

  const handleReset = () => {
    setFile(null);
    setResults([]);
    setIsCommitted(false);
    setCommitSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#effaf5] border border-[#c2e7db] text-[#08775A] flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Import Patients from Excel</h2>
              <p className="text-xs text-slate-500">
                Batch register patients with auto-assigned permanent MR numbers and duplicate detection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1 text-sm">
          {/* Step 1: Download Standard Template Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6 text-[#08775A] shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Official Patient Import Template
                </h4>
                <p className="text-xs text-emerald-700">
                  Includes required column headers, formatting rules, and corporate panel codes.
                </p>
              </div>
            </div>
            <button
              onClick={downloadPatientImportTemplate}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-emerald-100 text-[#08775A] border border-emerald-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel Template</span>
            </button>
          </div>

          {/* Upload Area */}
          {!file && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-[#08775A] bg-slate-50 hover:bg-[#effaf5]/30 rounded-2xl p-8 text-center transition-all cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-slate-200/70 group-hover:bg-[#c2e7db] text-slate-600 group-hover:text-[#08775A] flex items-center justify-center mx-auto mb-3 transition-colors">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                Drag and drop your Excel spreadsheet here
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-3">
                Supports .xlsx, .xls, and .csv files. Permanent MR numbers will be auto-generated sequentially.
              </p>
              <span className="inline-block px-3 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 shadow-2xs">
                Browse Files
              </span>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="w-8 h-8 text-[#08775A] animate-spin mx-auto mb-2" />
              <p className="text-sm font-medium">Validating patient data and checking duplicates...</p>
            </div>
          )}

          {/* File Loaded & Triage Preview */}
          {file && !isProcessing && (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#08775A]" />
                  <span className="font-semibold text-slate-800">{file.name}</span>
                  <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                {!isCommitted && (
                  <button
                    onClick={handleReset}
                    className="text-slate-500 hover:text-red-600 font-medium"
                  >
                    Change File
                  </button>
                )}
              </div>

              {/* KPI Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-lg font-bold text-emerald-800">{validCount}</div>
                  <div className="text-xs font-medium text-emerald-700">Valid Rows</div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-lg font-bold text-amber-800">{possibleDupCount}</div>
                  <div className="text-xs font-medium text-amber-700">Possible Matches</div>
                </div>

                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="text-lg font-bold text-red-800">{exactDupCount}</div>
                  <div className="text-xs font-medium text-red-700">Exact Duplicates (Skipped)</div>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="text-lg font-bold text-rose-800">{invalidCount}</div>
                  <div className="text-xs font-medium text-rose-700">Failed / Errors</div>
                </div>
              </div>

              {/* Error download button if errors exist */}
              {errorRows.length > 0 && !isCommitted && (
                <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>
                      {errorRows.length} rows have errors or exact duplicates that cannot be imported.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadImportErrorRows(errorRows)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download Error Rows (.xlsx)</span>
                  </button>
                </div>
              )}

              {/* Staged Rows Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Rows Preview ({results.length})</span>
                  <span className="font-normal text-slate-500 lowercase">Showing validation status</span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/50 sticky top-0 border-b border-slate-200 text-slate-500 font-semibold">
                      <tr>
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Patient Name</th>
                        <th className="py-2 px-3">Phone</th>
                        <th className="py-2 px-3">CNIC</th>
                        <th className="py-2 px-3">Payer</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Remarks / Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map((r) => (
                        <tr
                          key={r.rowNumber}
                          className={`hover:bg-slate-50 ${
                            r.status === 'EXACT_DUPLICATE' || r.status === 'INVALID'
                              ? 'bg-red-50/40'
                              : r.status === 'POSSIBLE_DUPLICATE'
                              ? 'bg-amber-50/30'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-mono text-slate-500">#{r.rowNumber}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {r.data['full_name'] || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {r.data['primary_phone'] || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {r.data['cnic'] || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {r.data['payer_type'] || 'Self Pay'}
                          </td>
                          <td className="py-2 px-3">
                            {r.status === 'VALID' && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                              </span>
                            )}
                            {r.status === 'EXACT_DUPLICATE' && (
                              <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                                <ShieldAlert className="w-3.5 h-3.5" /> Duplicate
                              </span>
                            )}
                            {r.status === 'POSSIBLE_DUPLICATE' && (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5" /> Possible Match
                              </span>
                            )}
                            {r.status === 'INVALID' && (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                                <AlertCircle className="w-3.5 h-3.5" /> Invalid
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-500 max-w-xs truncate">
                            {r.errors.length > 0 ? (
                              <span className="text-red-600 font-medium" title={r.errors.join('; ')}>
                                {r.errors.join('; ')}
                              </span>
                            ) : (
                              <span className="text-slate-400">Ready for MR allocation</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Commit Success Banner */}
              {isCommitted && commitSummary && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Import Completed Successfully!</span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    Created <strong>{commitSummary.patientsCreated}</strong> new patients with
                    permanent MR numbers. Skipped <strong>{commitSummary.duplicatesSkipped}</strong> exact duplicates.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-xs text-slate-500">
            {isCommitted ? (
              <span>Records saved to Master Patient Registry.</span>
            ) : file ? (
              <span>
                <strong>{validCount}</strong> valid patient(s) ready to import.
              </span>
            ) : (
              <span>Choose or drop an Excel spreadsheet to begin.</span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors border border-slate-300 bg-white"
            >
              {isCommitted ? 'Close' : 'Cancel'}
            </button>
            {!isCommitted && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!file || validCount === 0 || isProcessing}
                className="px-5 py-2 text-sm font-medium text-white bg-[#08775A] hover:bg-[#07664d] rounded-lg transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Import {validCount} Patients
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
