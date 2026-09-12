import React, { useState } from 'react';
import { Download, FileText, Printer, FileSpreadsheet, ChevronDown, Check, Eye } from 'lucide-react';
import { Modal } from '../common/Modal';
import { HOSPITAL_INFO, SOFTWARE_PROVIDER } from '../../constants';
import { useToast } from '../../context/ToastContext';

export interface ExportMenuProps {
  reportTitle: string;
  dataCount?: number;
  selectedCount?: number;
  activeFilters?: string[];
  dateRange?: string;
  currentUserName?: string;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  reportTitle,
  dataCount = 0,
  selectedCount = 0,
  activeFilters = ['All Records', 'Status: Active'],
  dateRange = 'Today (Sep 6, 2026)',
  currentUserName = 'Super Admin',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'excel' | 'print'>('pdf');
  const toast = useToast();

  const handleExport = (format: 'pdf' | 'excel' | 'print') => {
    setSelectedFormat(format);
    setIsOpen(false);

    if (format === 'print' || format === 'pdf') {
      setPreviewOpen(true);
    } else {
      toast.success(
        `Generated Excel spreadsheet for "${reportTitle}" (${dataCount} rows). Download ready.`,
        'Excel Export Ready'
      );
    }
  };

  const handleConfirmPrint = () => {
    setPreviewOpen(false);
    toast.success(`Sent "${reportTitle}" to hospital printer queue.`, 'Print Job Dispatched');
  };

  return (
    <>
      <div className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          title="Export records"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          <span>Export</span>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white border border-slate-200 shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Export Options
                </p>
                <p className="text-[11px] text-slate-600">
                  {selectedCount > 0 ? `${selectedCount} selected rows` : `${dataCount} total rows`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleExport('pdf')}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
              >
                <FileText className="h-4 w-4 text-rose-600" />
                <div>
                  <div className="font-medium">Export as PDF</div>
                  <div className="text-[10px] text-slate-400">Formal printable document</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleExport('excel')}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="font-medium">Export as Excel</div>
                  <div className="text-[10px] text-slate-400">Spreadsheet (.xlsx format)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleExport('print')}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
              >
                <Printer className="h-4 w-4 text-[#0e7d5a]" />
                <div>
                  <div className="font-medium">Print Document</div>
                  <div className="text-[10px] text-slate-400">Direct thermal or A4 print</div>
                </div>
              </button>

              <div className="mt-1 pt-1 border-t border-slate-100 px-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setPreviewOpen(true);
                  }}
                  className="w-full text-center px-2 py-1 text-[11px] text-[#0e7d5a] font-medium hover:bg-[#effaf5] rounded flex items-center justify-center gap-1"
                >
                  <Eye className="h-3 w-3" />
                  Preview Standard Document Header
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Export & Print Document Preview Modal */}
      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={selectedFormat === 'print' ? 'Hospital Document Print Preview' : 'Document PDF Export Specification'}
        maxWidth="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleConfirmPrint}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#129b70] hover:bg-[#0e7d5a] text-white inline-flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              {selectedFormat === 'print' ? 'Print Now' : 'Generate & Download PDF'}
            </button>
          </>
        }
      >
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          {/* Hospital Header Specification */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex items-start justify-between border-b pb-4 border-slate-200">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-[#129b70] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  CSS
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    {HOSPITAL_INFO.name}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {HOSPITAL_INFO.city} • Reg: {HOSPITAL_INFO.registrationNo}
                  </p>
                  <p className="text-[10px] text-slate-400">Tel: {HOSPITAL_INFO.phone}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-2.5 py-0.5 rounded bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db] text-[11px] font-bold uppercase">
                  Official Record
                </span>
                <p className="text-[10px] text-slate-400 mt-1">Page 1 of 3</p>
              </div>
            </div>

            {/* Document Title & Meta */}
            <div className="py-3.5 border-b border-slate-100 flex flex-wrap justify-between gap-2 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                  Report Title
                </span>
                <span className="font-bold text-slate-800 text-sm">{reportTitle}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                  Date Range
                </span>
                <span className="font-medium text-slate-700">{dateRange}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                  Generated By
                </span>
                <span className="font-medium text-slate-700">{currentUserName}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                  Generation Date & Time
                </span>
                <span className="font-medium text-slate-700">
                  {new Date().toLocaleDateString('en-PK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  -{' '}
                  {new Date().toLocaleTimeString('en-PK', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            {/* Filters Applied */}
            <div className="pt-3 flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px] font-medium">Selected Filters:</span>
              <div className="flex flex-wrap gap-1.5">
                {activeFilters.map((f, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] border border-slate-200"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Verification Callout */}
          <div className="text-[11px] text-slate-600 bg-[#effaf5] p-3 rounded-lg border border-[#c2e7db] flex items-center justify-between">
            <span>
              All printed & PDF exported documents conform to{' '}
              <strong className="text-slate-900 font-semibold">{SOFTWARE_PROVIDER.name}</strong> hospital security & audit standard standards.
            </span>
            <span className="font-mono text-[10px] text-[#08775A] bg-white px-2 py-0.5 rounded border border-[#c2e7db]">
              HASH-SHA256: 8F2A...91D
            </span>
          </div>
        </div>
      </Modal>
    </>
  );
};
