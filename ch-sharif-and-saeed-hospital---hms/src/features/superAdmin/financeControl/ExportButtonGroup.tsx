import React from 'react';
import { FileText, FileSpreadsheet, Printer, Table } from 'lucide-react';

interface ExportButtonGroupProps {
  onPdf: () => void;
  onExcel: () => void;
  onPrint: () => void;
  onCsv?: () => void;
  disabled?: boolean;
}

/** Real export actions styled matching professional reporting toolbar (Excel, CSV, PDF, Print). */
export const ExportButtonGroup: React.FC<ExportButtonGroupProps> = ({ onPdf, onExcel, onPrint, onCsv, disabled }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <button
      type="button"
      onClick={onExcel}
      disabled={disabled}
      title="Export to Excel (.xlsx)"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#16a34a] hover:bg-[#15803d] active:bg-[#166534] rounded-md transition-colors disabled:opacity-40 shadow-xs cursor-pointer disabled:cursor-not-allowed"
    >
      <FileSpreadsheet className="h-3.5 w-3.5" />
      <span>Excel</span>
    </button>
    {onCsv && (
      <button
        type="button"
        onClick={onCsv}
        disabled={disabled}
        title="Export to CSV (.csv)"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0891b2] hover:bg-[#0e7490] active:bg-[#155e75] rounded-md transition-colors disabled:opacity-40 shadow-xs cursor-pointer disabled:cursor-not-allowed"
      >
        <Table className="h-3.5 w-3.5" />
        <span>CSV</span>
      </button>
    )}
    <button
      type="button"
      onClick={onPdf}
      disabled={disabled}
      title="Export to PDF (.pdf)"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] rounded-md transition-colors disabled:opacity-40 shadow-xs cursor-pointer disabled:cursor-not-allowed"
    >
      <FileText className="h-3.5 w-3.5" />
      <span>PDF</span>
    </button>
    <button
      type="button"
      onClick={onPrint}
      disabled={disabled}
      title="Print Report"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#475569] hover:bg-[#334155] active:bg-[#1e293b] rounded-md transition-colors disabled:opacity-40 shadow-xs cursor-pointer disabled:cursor-not-allowed"
    >
      <Printer className="h-3.5 w-3.5" />
      <span>Print</span>
    </button>
  </div>
);
