import React, { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Loader2,
  AlertCircle,
  Wallet,
  RotateCcw,
  FileSpreadsheet,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Select } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { fetchPaymentRequests, PaymentRequestRecord, PaymentRequestStatus } from '../../../services/paymentRequestService';
import { CollectPaymentRequestModal } from './CollectPaymentRequestModal';
import { PanelBadge } from '../../../components/common/PanelBadge';
import { HospitalKpiHeader } from '../../../components/common/HospitalKpiHeader';

const STATUS_OPTIONS: { label: string; value: PaymentRequestStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Partially Fulfilled', value: 'PARTIALLY_FULFILLED' },
  { label: 'Fulfilled', value: 'FULFILLED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const STATUS_BADGE: Record<PaymentRequestStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border border-amber-200',
  PARTIALLY_FULFILLED: 'bg-blue-50 text-blue-700 border border-blue-200',
  FULFILLED: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border border-rose-200',
};

/**
 * Front Desk queue for `AdmissionPaymentRequest` rows the Admission portal
 * raises (HMS_V7.2_NEW_REQUIREMENTS.md §3.3) — real, backed by
 * `services/paymentRequestService.ts` → `/api/v1/admission-payment-requests*`.
 * Defaults to the active queue (Pending + Partially Fulfilled); pick a
 * status to see the rest.
 */
export const AdmissionPaymentRequestsView: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<PaymentRequestStatus | ''>('');
  const [requests, setRequests] = useState<PaymentRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collectTarget, setCollectTarget] = useState<PaymentRequestRecord | null>(null);

  // Pharmacy pagination states
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRequests(await fetchPaymentRequests(statusFilter || undefined));
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load payment requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const metrics = useMemo(() => {
    return requests.reduce(
      (acc, r) => ({
        count: acc.count + 1,
        totalRequested: acc.totalRequested + r.requestedAmount,
        totalCollected: acc.totalCollected + r.collectedAmount,
        totalRemaining: acc.totalRemaining + r.remainingAmount,
      }),
      { count: 0, totalRequested: 0, totalCollected: 0, totalRemaining: 0 }
    );
  }, [requests]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return requests.slice(start, start + pageSize);
  }, [requests, currentPage, pageSize]);

  const totalPages = Math.ceil(requests.length / pageSize) || 1;

  const handleExportCsv = () => {
    if (requests.length === 0) return;
    const headers = ['#', 'Admission No', 'Patient Name', 'Phone', 'Payer', 'Department', 'Doctor', 'Request Type', 'Requested Amount', 'Collected Amount', 'Remaining Amount', 'Status', 'Requested By'];
    const rows = requests.map((r, idx) => [
      idx + 1,
      `"${r.admissionNumber}"`,
      `"${r.patientName}"`,
      `"${r.patientPhone}"`,
      `"${r.payerType === 'Corporate / Panel' ? 'Panel' : 'Self-Pay'}"`,
      `"${r.departmentName}"`,
      `"${r.doctorName || 'Not Assigned'}"`,
      `"${r.requestType}"`,
      r.requestedAmount,
      r.collectedAmount,
      r.remainingAmount,
      `"${r.status}"`,
      `"${r.requestedByLabel}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admission_payment_requests_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleExportExcel = () => {
    if (requests.length === 0) return;
    const headers = ['#', 'Admission No', 'Patient Name', 'Phone', 'Payer', 'Department', 'Doctor', 'Request Type', 'Requested Amount', 'Collected Amount', 'Remaining Amount', 'Status', 'Requested By'];
    const rowsHtml = requests
      .map(
        (r, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${r.admissionNumber}</td>
        <td>${r.patientName}</td>
        <td>${r.patientPhone}</td>
        <td>${r.payerType === 'Corporate / Panel' ? 'Panel' : 'Self-Pay'}</td>
        <td>${r.departmentName}</td>
        <td>${r.doctorName || 'Not Assigned'}</td>
        <td>${r.requestType}</td>
        <td>${r.requestedAmount}</td>
        <td>${r.collectedAmount}</td>
        <td>${r.remainingAmount}</td>
        <td>${r.status}</td>
        <td>${r.requestedByLabel}</td>
      </tr>
    `,
      )
      .join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/></head>
      <body>
        <h2>Admission Payment Requests Ledger</h2>
        <table border="1">
          <tr style="background:#0e5944;color:#ffffff;font-weight:bold;">
            ${headers.map((h) => `<th>${h}</th>`).join('')}
          </tr>
          ${rowsHtml}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admission_payment_requests_${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150 font-sans">
      {/* Top Banner Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Admission Payment Requests</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Advance / Partial / Final payment requests raised by the Admission Portal — collect against them here.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[#08775A]" /> Refresh
        </button>
      </div>

      {/* Pharmacy Style KPI Header */}
      {!isLoading && !loadError && (
        <HospitalKpiHeader
          cards={[
            {
              title: 'Total Requests',
              value: metrics.count,
              subtitle: 'Admission demand notices',
              icon: CreditCard,
              accentColor: '#08775A',
              category: 'QUEUE VOLUME',
            },
            {
              title: 'Requested Amount',
              value: formatPKR(metrics.totalRequested),
              subtitle: 'Gross payment required',
              icon: Receipt,
              accentColor: '#0284c7',
              category: 'TOTAL DEMAND',
            },
            {
              title: 'Collected Amount',
              value: formatPKR(metrics.totalCollected),
              subtitle: 'Fulfilled at Front Desk',
              icon: CheckCircle2,
              accentColor: '#16a34a',
              category: 'RECEIVED',
            },
            {
              title: 'Remaining Dues',
              value: formatPKR(metrics.totalRemaining),
              subtitle: 'Pending collection',
              icon: Wallet,
              accentColor: '#dc2626',
              category: 'UNPAID BALANCE',
            },
          ]}
        />
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="w-64">
          <Select
            label="Status Filter"
            placeholder="All Requests"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PaymentRequestStatus | '')}
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {requests.length} payment demand record{requests.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Table Container in Pharmacy Design */}
      <div className="bg-white rounded-2xl border border-slate-300/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Dark Emerald Header Strip */}
        <div className="bg-[#0e5944] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-300" />
            <span className="font-bold text-sm tracking-wide">Admission Payment Requests</span>
            <span className="text-[11px] font-semibold text-emerald-200/90 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
              {requests.length} record{requests.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Print Table"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Search in results toolbar */}
        <div className="px-3.5 py-2 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-slate-600 font-medium">records per page</span>
          </div>

          <div className="text-slate-500 font-medium">
            Showing {requests.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, requests.length)} of {requests.length} entries
          </div>
        </div>

        {loadError ? (
          <div className="p-8 flex flex-col items-center gap-2 text-center">
            <AlertCircle className="h-6 w-6 text-rose-500" />
            <p className="text-xs text-rose-700 font-medium">{loadError}</p>
            <button type="button" onClick={load} className="mt-1 text-xs font-semibold text-[#08775A] hover:underline cursor-pointer">
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-[#08775A]" />
            <span className="text-xs">Loading payment requests…</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">No payment requests found for the selected filter.</div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[300px]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f8fafc] text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200 uppercase tracking-wider select-none">
                <tr>
                  <th className="py-3 px-3.5 text-center border-r border-slate-200 w-12 whitespace-nowrap">#</th>
                  <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Admission</th>
                  <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Patient</th>
                  <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Payer</th>
                  <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Department / Doctor</th>
                  <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Type</th>
                  <th className="py-3 px-4 border-r border-slate-200 text-right whitespace-nowrap">Requested</th>
                  <th className="py-3 px-4 border-r border-slate-200 text-right whitespace-nowrap">Collected</th>
                  <th className="py-3 px-4 border-r border-slate-200 text-right whitespace-nowrap">Remaining</th>
                  <th className="py-3 px-4 border-r border-slate-200 text-center whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">Requested By</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedRequests.map((r, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-3.5 text-center border-r border-slate-100 text-slate-500 font-semibold text-xs whitespace-nowrap font-mono">
                        {rowNumber}
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap font-mono font-bold text-slate-900">
                        {r.admissionNumber}
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{r.patientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{r.patientPhone}</div>
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap">
                        {r.payerType === 'Corporate / Panel' ? (
                          <PanelBadge />
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Self-Pay</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap text-slate-600">
                        <span className="font-medium text-slate-800">{r.departmentName}</span>
                        <span className="text-[11px] text-slate-400 block">{r.doctorName || 'Not Assigned'}</span>
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap font-medium text-slate-700">
                        {r.requestType}
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap font-bold text-slate-900 text-right tabular-nums">
                        {formatPKR(r.requestedAmount)}
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap text-emerald-700 font-bold text-right tabular-nums">
                        {formatPKR(r.collectedAmount)}
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap font-bold text-amber-700 text-right tabular-nums">
                        {formatPKR(r.remainingAmount)}
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${STATUS_BADGE[r.status]}`}>
                          {r.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap text-slate-500 text-[11px]">
                        {r.requestedByLabel}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        {(r.status === 'PENDING' || r.status === 'PARTIALLY_FULFILLED') && (
                          <button
                            type="button"
                            title="Collect Payment"
                            onClick={() => setCollectTarget(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#08775A] text-[#08775A] hover:text-white border border-[#c2e7db] hover:border-[#08775A] text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            <Wallet className="h-3 w-3" />
                            <span>Collect</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pharmacy Pagination Footer */}
        {requests.length > 0 && (
          <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, requests.length)} of {requests.length} entries
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-slate-400">…</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded text-xs font-semibold cursor-pointer ${
                          currentPage === p
                            ? 'bg-[#08775A] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
              </div>
              <button
                type="button"
                disabled={currentPage === totalPages || requests.length === 0}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {collectTarget && (
        <CollectPaymentRequestModal
          request={collectTarget}
          onClose={() => setCollectTarget(null)}
          onCollected={() => {
            setCollectTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
};
