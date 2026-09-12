import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import {
  Download,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Copy,
  ArrowRight,
  RefreshCw,
  FileCheck,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../common/StatusBadge';
import { cn } from '../../utils/formatters';

export interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName?: string;
  templateFileName?: string;
  onImportComplete?: (count: number) => void;
}

type Step = 'select' | 'validating' | 'preview' | 'completed';

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  onClose,
  entityName = 'Patients / Items',
  templateFileName = 'hospital_import_template.xlsx',
  onImportComplete,
}) => {
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState<string | null>(null);
  const toast = useToast();

  const mockPreviewRows = [
    {
      row: 2,
      identifier: 'MRN-2026-901',
      title: 'Zainab Bibi',
      extra: '0300 1234567 • General OPD',
      status: 'valid' as const,
      message: 'All fields validated',
    },
    {
      row: 3,
      identifier: 'MRN-2026-902',
      title: 'Rashid Mahmood',
      extra: '0321 8765432 • Cardiology',
      status: 'valid' as const,
      message: 'All fields validated',
    },
    {
      row: 4,
      identifier: 'MRN-2026-903',
      title: 'Missing Contact',
      extra: 'Invalid Phone Number • Pediatrics',
      status: 'invalid' as const,
      message: 'Validation error: Phone number must be 11 digits',
    },
    {
      row: 5,
      identifier: 'MRN-2026-904',
      title: 'Muhammad Tariq Khan',
      extra: 'CNIC: 35202-1928371-1',
      status: 'duplicate' as const,
      message: 'Duplicate record: CNIC already exists in hospital registry',
    },
    {
      row: 6,
      identifier: 'MRN-2026-905',
      title: 'Kulsoom Akram',
      extra: '0333 4455667 • Orthopedics',
      status: 'valid' as const,
      message: 'All fields validated',
    },
  ];

  const handleDownloadTemplate = () => {
    toast.info(`Downloading official Excel template: ${templateFileName}`, 'Template Download');
  };

  const handleSimulateUpload = () => {
    setFileName('CHSS_Data_Batch_2026.xlsx');
    setStep('validating');

    setTimeout(() => {
      setStep('preview');
      toast.success('Excel sheet parsed and validated successfully', 'Validation Complete');
    }, 1200);
  };

  const handleConfirmImport = () => {
    setStep('completed');
    toast.success('3 valid records added to system registry', 'Import Successful');
    onImportComplete?.(3);
  };

  const handleReset = () => {
    setStep('select');
    setFileName(null);
  };

  const handleModalClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={`Batch Excel Import — ${entityName}`}
      subtitle="Follow the step-by-step hospital protocol to upload bulk records safely"
      maxWidth="3xl"
      footer={
        <>
          {step === 'select' && (
            <>
              <button
                type="button"
                onClick={handleModalClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSimulateUpload}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#149E75] hover:bg-[#08775A] text-white inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload & Validate
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Back / Choose Another
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#149E75] hover:bg-[#08775A] text-white inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <FileCheck className="h-3.5 w-3.5" />
                Confirm Import (3 Valid Rows)
              </button>
            </>
          )}

          {step === 'completed' && (
            <button
              type="button"
              onClick={handleModalClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#149E75] hover:bg-[#08775A] text-white transition-colors"
            >
              Done & Close
            </button>
          )}
        </>
      }
    >
      {/* Wizard Steps Tracker */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 text-xs font-medium">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold',
              step === 'select'
                ? 'bg-[#149E75] text-white'
                : 'bg-[#dff5ea] text-[#08775A]'
            )}
          >
            1
          </span>
          <span className={step === 'select' ? 'font-bold text-slate-900' : 'text-slate-500'}>
            Select & Upload
          </span>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300" />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold',
              step === 'preview'
                ? 'bg-[#149E75] text-white'
                : step === 'completed'
                ? 'bg-[#dff5ea] text-[#08775A]'
                : 'bg-slate-100 text-slate-500'
            )}
          >
            2
          </span>
          <span className={step === 'preview' ? 'font-bold text-slate-900' : 'text-slate-500'}>
            Validation & Preview
          </span>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300" />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold',
              step === 'completed'
                ? 'bg-[#149E75] text-white'
                : 'bg-slate-100 text-slate-500'
            )}
          >
            3
          </span>
          <span className={step === 'completed' ? 'font-bold text-slate-900' : 'text-slate-500'}>
            Result Summary
          </span>
        </div>
      </div>

      {/* Step 1: Select & Upload */}
      {step === 'select' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-[#effaf5] border border-[#c2e7db] rounded-xl">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-7 w-7 text-[#08775A] shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Required Format & Template
                </p>
                <p className="text-[11px] text-[#08775A]">
                  Please use the verified hospital header structure to avoid validation rejections.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-[#08775A] border border-[#c2e7db] hover:bg-[#dff5ea] transition-colors shadow-2xs shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Download Template (.xlsx)
            </button>
          </div>

          <div
            onClick={handleSimulateUpload}
            className="border-2 border-dashed border-slate-300 hover:border-[#149E75] hover:bg-[#effaf5]/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <Upload className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-800">
              Drag and drop your filled Excel file here, or{' '}
              <span className="text-[#149E75] underline font-semibold">browse your computer</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Supported formats: .XLSX, .XLS, .CSV (Maximum size: 15MB)
            </p>
          </div>
        </div>
      )}

      {/* Validating State */}
      {step === 'validating' && (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <RefreshCw className="h-8 w-8 text-[#149E75] animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-800">
            Validating rows against hospital schema...
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Checking CNIC duplicates, phone formats, and required field integrity.
          </p>
        </div>
      )}

      {/* Step 2: Validation Preview */}
      {step === 'preview' && (
        <div className="space-y-3">
          {/* Summary Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-emerald-800">Valid Rows</p>
                <p className="text-lg font-bold text-emerald-950">3</p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-rose-800">Invalid Rows</p>
                <p className="text-lg font-bold text-rose-950">1</p>
              </div>
              <AlertCircle className="h-6 w-6 text-rose-600" />
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-amber-800">Duplicates</p>
                <p className="text-lg font-bold text-amber-950">1</p>
              </div>
              <Copy className="h-6 w-6 text-amber-600" />
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Identifier</th>
                    <th className="px-3 py-2">Record Title</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Validation Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mockPreviewRows.map((r) => (
                    <tr
                      key={r.row}
                      className={cn(
                        r.status === 'invalid'
                          ? 'bg-rose-50/50'
                          : r.status === 'duplicate'
                          ? 'bg-amber-50/40'
                          : 'hover:bg-slate-50'
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-slate-500">#{r.row}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{r.identifier}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900">{r.title}</div>
                        <div className="text-[10px] text-slate-500">{r.extra}</div>
                      </td>
                      <td className="px-3 py-2">
                        {r.status === 'valid' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3 w-3" /> Valid
                          </span>
                        )}
                        {r.status === 'invalid' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            <AlertCircle className="h-3 w-3" /> Error
                          </span>
                        )}
                        {r.status === 'duplicate' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            <Copy className="h-3 w-3" /> Duplicate
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-600">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            * Note: Invalid and duplicate records will be safely skipped during the batch commit.
          </p>
        </div>
      )}

      {/* Step 3: Result Summary */}
      {step === 'completed' && (
        <div className="py-6 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h4 className="text-base font-bold text-slate-900">
            Batch Import Finalized Successfully!
          </h4>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            3 new records have been committed to the hospital database. 1 invalid row and 1 duplicate row were bypassed in accordance with audit log policy.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-md text-xs font-mono text-slate-700">
            Audit Ticket: AUD-IMP-2026-042 • Logged by Super Admin
          </div>
        </div>
      )}
    </Modal>
  );
};
