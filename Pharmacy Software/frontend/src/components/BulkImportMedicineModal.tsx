import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Layers,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { pharmacyApi, BulkImportItem, BulkImportResponse } from '../services/pharmacyApi';
import {
  downloadSampleTemplate,
  parseExcelFile,
  ParseResult,
} from '../utils/excelImportExport';
import { useToast } from '../context/ToastContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkImportMedicineModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResponse, setImportResponse] = useState<BulkImportResponse | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!open) return null;

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    setImportResponse(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast.error('Please upload an Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setImportResponse(null);

    try {
      const res = await parseExcelFile(selectedFile);
      setParseResult(res);
      if (res.validItems.length === 0) {
        toast.warning('No valid medicine rows found in this file. Please check template.');
      } else {
        toast.success(`Parsed ${res.validItems.length} medicine records.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse Excel file.');
      setFile(null);
      setParseResult(null);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (!parseResult || parseResult.validItems.length === 0) {
      toast.error('No valid items to import.');
      return;
    }

    setImporting(true);
    try {
      const res = await pharmacyApi.bulkImportMedicines(parseResult.validItems);
      setImportResponse(res);
      if (res.failedCount === 0) {
        toast.success(`Successfully processed ${res.createdCount + res.updatedCount} medicines!`);
      } else {
        toast.warning(`Imported ${res.createdCount + res.updatedCount} items, ${res.failedCount} had errors.`);
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to complete bulk import.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#08775A] flex items-center justify-center font-bold">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Bulk Import Formulary &amp; Stock</h3>
              <p className="text-xs text-slate-400">
                Import medicines, packaging hierarchies, barcodes, and opening stock via Excel (.xlsx)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Step 1: Download Standard Template Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
            <div className="space-y-0.5">
              <div className="font-semibold text-emerald-950 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#08775A]" />
                Official 19-Column Excel Format Ready
              </div>
              <p className="text-[11.5px] text-emerald-800">
                Download the verified template with pre-filled examples (Panadol, Amoxil Syrup, Face Mask) and instructions.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Download Template (.xlsx)
            </button>
          </div>

          {/* Step 2: Upload Area or Results */}
          {!importResponse ? (
            <div className="space-y-4">
              {!parseResult ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-[#08775A] bg-emerald-50/40'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
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
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#08775A] flex items-center justify-center mx-auto mb-3">
                    {parsing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    {parsing ? 'Reading and verifying Excel file...' : 'Click to select or drag & drop your Excel file here'}
                  </h4>
                  <p className="text-slate-400 text-xs">Supports Excel (.xlsx, .xls) and CSV files</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File info bar */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
                      <div>
                        <span className="font-bold text-slate-800">{file?.name}</span>
                        <div className="text-[11px] text-slate-400">
                          {parseResult.validItems.length} valid medicines detected &bull; {parseResult.invalidRows.length} errors
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Upload Different File
                    </button>
                  </div>

                  {/* Invalid rows warning */}
                  {parseResult.invalidRows.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-xs text-amber-950">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        {parseResult.invalidRows.length} row(s) have missing required data and will be skipped:
                      </div>
                      <div className="max-h-24 overflow-y-auto space-y-1 text-[11px]">
                        {parseResult.invalidRows.map((inv, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="font-semibold text-amber-800">Row {inv.rowNumber}:</span>
                            <span>{inv.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview Table of Valid Items */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">Preview Data ({parseResult.validItems.length} Items)</span>
                      <span className="text-[11px] text-slate-400">Showing first 10 rows</span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs overflow-x-auto max-h-64">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Medicine Name</th>
                            <th className="py-2.5 px-3">Strength</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3">Base Unit</th>
                            <th className="py-2.5 px-3">Inner Pack</th>
                            <th className="py-2.5 px-3">Purchase Unit</th>
                            <th className="py-2.5 px-3">Sale Price</th>
                            <th className="py-2.5 px-3">Opening Qty</th>
                            <th className="py-2.5 px-3">Batch No</th>
                            <th className="py-2.5 px-3">Expiry</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parseResult.validItems.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-3 font-semibold text-slate-900">{row.name}</td>
                              <td className="py-2 px-3 text-slate-600">{row.strength || '—'}</td>
                              <td className="py-2 px-3 text-slate-600">{row.category || '—'}</td>
                              <td className="py-2 px-3 font-medium text-emerald-800">{row.baseUnit}</td>
                              <td className="py-2 px-3 text-slate-600">
                                {row.innerPackUnit ? `${row.innerPackUnit} (${row.baseUnitsPerInnerPack || 1})` : '—'}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {row.defaultPurchaseUnit} ({row.baseUnitsPerPurchaseUnit || 1})
                              </td>
                              <td className="py-2 px-3 text-slate-900 font-medium">Rs {row.defaultSalePrice || 0}</td>
                              <td className="py-2 px-3 font-semibold text-emerald-700">{row.openingStockQty || 0}</td>
                              <td className="py-2 px-3 text-slate-600">{row.batchNumber || '—'}</td>
                              <td className="py-2 px-3 text-slate-600">{row.expiryDate || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Step 3: Import Results Screen */
            <div className="space-y-5 py-4">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#08775A] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Bulk Import Completed</h4>
                <p className="text-xs text-slate-500">Formulary catalog and inventory records updated successfully</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{importResponse.createdCount}</div>
                  <div className="text-[11px] text-slate-500 font-medium">New Medicines Created</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-2xl font-bold text-blue-700">{importResponse.updatedCount}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Medicines Updated</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className={`text-2xl font-bold ${importResponse.failedCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {importResponse.failedCount}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">Errors / Skipped</div>
                </div>
              </div>

              {importResponse.errors.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                  <div className="font-bold text-xs flex items-center gap-1.5 text-rose-950">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                    Failed Rows Details ({importResponse.errors.length}):
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-[11px]">
                    {importResponse.errors.map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="font-semibold text-rose-800">Row {err.row}:</span>
                        <span>
                          {err.medicine} — {err.error}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium text-xs transition-colors cursor-pointer"
          >
            {importResponse ? 'Close' : 'Cancel'}
          </button>

          {!importResponse && parseResult && parseResult.validItems.length > 0 && (
            <button
              type="button"
              disabled={importing}
              onClick={handleExecuteImport}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#08775A] hover:bg-[#065f48] text-white font-semibold text-xs shadow-md shadow-emerald-900/10 transition-colors cursor-pointer disabled:opacity-60"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing Medicines...
                </>
              ) : (
                <>
                  Import {parseResult.validItems.length} Medicines Now
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

