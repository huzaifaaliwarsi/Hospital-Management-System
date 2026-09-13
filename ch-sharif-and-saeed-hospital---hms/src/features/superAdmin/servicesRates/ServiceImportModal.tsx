import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ServiceImportRow,
  ServiceImportValidationResult,
  HospitalService,
} from '../../../types/serviceRates';
import { User } from '../../../types';
import { ServiceRatesService } from '../../../services/serviceRatesService';
import { downloadServicesImportTemplate } from '../../../services/serviceRatesExportService';

interface ServiceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
  existingServices: HospitalService[];
  currentUser: User | null;
}

export const ServiceImportModal: React.FC<ServiceImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  existingServices,
  currentUser,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] =
    useState<ServiceImportValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'valid' | 'invalid'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        const result = ServiceRatesService.validateImportRows(json, existingServices);
        setValidationResult(result);
      } catch (err) {
        console.error('Failed to parse Excel file:', err);
        alert('Could not parse the selected spreadsheet. Please ensure it is a valid Excel or CSV file.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const [isImporting, setIsImporting] = useState(false);

  const handleCommit = async () => {
    if (!validationResult || validationResult.validRows.length === 0) return;
    setIsImporting(true);
    try {
      const { imported, failures } = await ServiceRatesService.importServices(validationResult.validRows, currentUser);
      if (failures.length > 0) {
        alert(`Imported ${imported} service(s). ${failures.length} row(s) failed:\n${failures.join('\n')}`);
      }
      onImportComplete(imported);
    } finally {
      setIsImporting(false);
    }
  };

  const allRows = validationResult
    ? [...validationResult.validRows, ...validationResult.invalidRows].sort(
        (a, b) => a.rowNumber - b.rowNumber
      )
    : [];

  const displayRows =
    activeTab === 'valid'
      ? validationResult?.validRows || []
      : activeTab === 'invalid'
      ? validationResult?.invalidRows || []
      : allRows;

  return (
    <div
      id="service-import-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="service-import-modal-content"
        className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#08775A] flex items-center justify-center font-bold">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Bulk Import Charge Master Services
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload Excel spreadsheet with automatic clinical validation and error reporting
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Template Download Prompt */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-[#08775A]" />
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Standard Excel Import Template
                </div>
                <div className="text-[11px] text-slate-500">
                  Includes formatted columns: service_code, service_name, department_code, standard_rate, etc.
                </div>
              </div>
            </div>
            <button
              id="download-services-template-btn"
              onClick={downloadServicesImportTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#08775A] bg-white border border-[#c2e7db] rounded-lg hover:bg-[#effaf5] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template (.xlsx)
            </button>
          </div>

          {/* Upload Dropzone */}
          {!validationResult ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer hover:border-[#08775A] hover:bg-emerald-50/20 transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-emerald-50 text-slate-500 group-hover:text-[#08775A] flex items-center justify-center mx-auto mb-3 transition-colors">
                <FileUp className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                Click to browse or drag and drop spreadsheet
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Supports Excel (.xlsx, .xls) and CSV files
              </p>
            </div>
          ) : (
            /* Validation Results View */
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <div className="text-lg font-bold text-slate-800">
                    {validationResult.totalRows}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">
                    Total Rows
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-lg font-bold text-emerald-700">
                    {validationResult.validRows.length}
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase">
                    Valid & Ready
                  </div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                  <div className="text-lg font-bold text-rose-700">
                    {validationResult.invalidRows.length}
                  </div>
                  <div className="text-[11px] font-semibold text-rose-700 uppercase">
                    Errors Found
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center justify-between border-b border-slate-200">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                      activeTab === 'all'
                        ? 'border-[#08775A] text-[#08775A]'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    All Rows ({allRows.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('valid')}
                    className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                      activeTab === 'valid'
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Valid Only ({validationResult.validRows.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('invalid')}
                    className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                      activeTab === 'invalid'
                        ? 'border-rose-600 text-rose-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Invalid Only ({validationResult.invalidRows.length})
                  </button>
                </div>

                <button
                  onClick={() => {
                    setFile(null);
                    setValidationResult(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline pb-2"
                >
                  Upload Different File
                </button>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Service Name</th>
                      <th className="py-2.5 px-3">Dept Code</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={row.isValid ? 'bg-white' : 'bg-rose-50/40'}
                      >
                        <td className="py-2 px-3 font-mono text-slate-500">
                          #{row.rowNumber}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {row.serviceCode || '—'}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">
                          {row.serviceName || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {row.departmentCode || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{row.category || '—'}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">
                          PKR {(row.standardRate ?? 0).toLocaleString('en-PK')}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{row.status}</td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Valid
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              {row.errors.map((err, i) => (
                                <span
                                  key={i}
                                  className="text-[11px] text-rose-600 flex items-center gap-1 leading-tight"
                                >
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  {err}
                                </span>
                              ))}
                            </div>
                          )}
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/60 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          {validationResult && (
            <button
              id="commit-services-import-btn"
              onClick={handleCommit}
              disabled={validationResult.validRows.length === 0 || isImporting}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                validationResult.validRows.length > 0 && !isImporting
                  ? 'bg-[#08775A] hover:bg-[#065f46] text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Upload className="w-4 h-4" />
              {isImporting ? 'Importing…' : `Commit Import (${validationResult.validRows.length} Valid Records)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
