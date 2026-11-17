import React, { useEffect, useState, useMemo } from 'react';
import {
  Loader2,
  Eye,
  X,
  Plus,
  Undo2,
  Printer,
  Receipt,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  User,
  Calendar,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryClient, queryKeys } from '../queryClient';
import { usePharmacyUIStore } from '../store/usePharmacyUIStore';
import { pharmacyApi } from '../services/pharmacyApi';
import { formatPKR, formatNumber, formatDateTime } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import { PharmacyDataTable, Column } from '../components/PharmacyDataTable';
import { PharmacyInvoiceModal } from '../components/PharmacyInvoiceModal';

export const InvoicesPage: React.FC = () => {
  const toast = useToast();
  const invoicesUI = usePharmacyUIStore((s) => s.invoices);
  const setInvoicesUI = usePharmacyUIStore((s) => s.setInvoicesState);

  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [modalInitialAction, setModalInitialAction] = useState<'return' | 'payment' | undefined>(undefined);

  // Filters & Pagination - preserved in Zustand across page switches
  const [page, setPage] = useState<number>(invoicesUI.page || 1);
  const [pageSize, setPageSize] = useState<number>(invoicesUI.pageSize || 25);
  const [search, setSearch] = useState<string>(invoicesUI.search || '');
  const [statusFilter, setStatusFilter] = useState<string>(invoicesUI.statusFilter || 'ALL');
  const [channelFilter, setChannelFilter] = useState<string>(invoicesUI.channelFilter || 'ALL');
  const [fromDate, setFromDate] = useState<string>(invoicesUI.fromDate || '');
  const [toDate, setToDate] = useState<string>(invoicesUI.toDate || '');
  const [sortBy, setSortBy] = useState<string>(invoicesUI.sortBy || 'date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(invoicesUI.sortOrder || 'desc');

  useEffect(() => {
    setInvoicesUI({
      page,
      pageSize,
      search,
      statusFilter,
      channelFilter,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    });
  }, [page, pageSize, search, statusFilter, channelFilter, fromDate, toDate, sortBy, sortOrder, setInvoicesUI]);

  // TanStack Query (30s stale time, background SWR, instant revisit from cache)
  const {
    data: queryResult,
    isLoading: loading,
    refetch: reloadInvoices,
  } = useQuery({
    queryKey: queryKeys.invoices.list({
      page,
      limit: pageSize,
      search,
      channel: channelFilter,
      status: statusFilter,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    }),
    queryFn: () =>
      pharmacyApi.listInvoicesPaginated({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        channel: channelFilter === 'ALL' ? undefined : channelFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sortBy,
        sortOrder,
        transactions: true,
      }),
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
  });

  const rows = queryResult?.items || [];
  const total = queryResult?.total || 0;
  const totalPages = queryResult?.totalPages || 1;
  const summary = queryResult?.summary || {
    totalBilling: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    totalInvoices: 0,
  };

  const load = () => {
    reloadInvoices();
  };

  const openInvoiceModal = async (inv: any, action?: 'return' | 'payment') => {
    setModalInitialAction(action);
    const invoiceId = inv.invoiceId || inv.id;
    try {
      const fresh = await pharmacyApi.getInvoiceById(invoiceId);
      setSelectedInvoice(fresh);
    } catch {
      setSelectedInvoice(inv);
    }
  };

  // Top KPI calculations (Server-aggregated across entire filtered database)
  const kpis: KpiItem[] = [
    {
      label: 'Gross Pharmacy Sales',
      value: formatPKR(summary.totalBilling),
      icon: TrendingUp,
      subtitle: `${summary.totalInvoices} distinct invoices in selected period`,
      tone: 'default',
    },
    {
      label: 'Total Collected',
      value: formatPKR(summary.totalCollected),
      icon: CheckCircle2,
      subtitle: 'Settled via cash / card / bank (including installments)',
      tone: 'success',
    },
    {
      label: 'Current Receivables',
      value: formatPKR(summary.totalOutstanding),
      icon: AlertCircle,
      subtitle: 'Pending customer settlement',
      tone: summary.totalOutstanding > 0 ? 'danger' : 'success',
    },
    {
      label: 'Invoices Dispensed',
      value: summary.totalInvoices,
      icon: Receipt,
      subtitle: 'Retail POS & HMS inpatient',
      tone: 'info',
    },
  ];

  const columns: Column<any>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      width: '180px',
      render: (inv) => {
        const type = inv.transactionType || 'Original Sale';
        const isRemaining = type === 'Remaining Collection';
        const isReturn = type.includes('Return') || type.includes('Refund');
        return (
          <div className="space-y-1">
            <div className="font-mono font-bold text-slate-900 text-xs tracking-wider whitespace-nowrap">
              {inv.invoiceNumber}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                  isRemaining
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : isReturn
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {type}
              </span>
              {inv.receiptNumber && (
                <span className="text-[10px] font-mono text-slate-500">
                  {inv.receiptNumber}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'transactionAt',
      header: 'Date & Time',
      width: '160px',
      render: (inv) => (
        <span className="text-xs text-slate-700 whitespace-nowrap">
          {formatDateTime(inv.transactionAt || inv.createdAt)}
        </span>
      ),
    },
    {
      key: 'channel',
      header: 'Channel',
      width: '130px',
      render: (inv) => (
        <span className="text-slate-800 font-medium text-xs whitespace-nowrap">
          {inv.channel === 'HMS_LINKED' ? 'HMS Dispense' : 'Retail POS'}
        </span>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer / Patient',
      render: (inv) => (
        <div className="font-semibold text-slate-900 text-xs whitespace-nowrap">
          {inv.customerName || <span className="text-slate-400 font-normal">Walk-In Customer</span>}
        </div>
      ),
    },
    {
      key: 'collectedByName',
      header: 'Staff / Collector',
      render: (inv) => (
        <div className="text-xs text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{inv.collectedByName || inv.dispensedByUser?.fullName || inv.dispensedByUser?.username || 'Staff'}</span>
        </div>
      ),
    },
    {
      key: 'billingAmount',
      header: 'Billing (PKR)',
      align: 'right',
      render: (inv) => {
        const val = Number(inv.billingAmount != null ? inv.billingAmount : inv.total || 0);
        return (
          <span className="font-bold text-xs text-slate-900 whitespace-nowrap font-mono">
            {val !== 0 ? formatPKR(val) : <span className="text-slate-400 font-normal">Rs 0</span>}
          </span>
        );
      },
    },
    {
      key: 'collectedAmount',
      header: 'Collected (PKR)',
      align: 'right',
      render: (inv) => {
        const val = Number(inv.collectedAmount != null ? inv.collectedAmount : inv.paidTotal || 0);
        return (
          <span className={`font-bold text-xs whitespace-nowrap font-mono ${val < 0 ? 'text-rose-600' : 'text-emerald-800'}`}>
            {val !== 0 ? formatPKR(val) : <span className="text-slate-400 font-normal">Rs 0</span>}
          </span>
        );
      },
    },
    {
      key: 'outstanding',
      header: 'Current Outstanding',
      align: 'right',
      render: (inv) => {
        const out = Number(inv.outstanding || 0);
        return (
          <span
            className={`font-bold text-xs whitespace-nowrap font-mono ${
              out > 0 ? 'text-rose-600' : 'text-slate-400 font-normal'
            }`}
          >
            {out > 0 ? formatPKR(out) : 'PKR 0'}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '130px',
      render: (inv) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              inv.status === 'PAID'
                ? 'bg-[#0e7d5a]'
                : inv.status === 'PARTIALLY_PAID'
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
          />
          <span
            className={
              inv.status === 'PAID'
                ? 'text-[#0e7d5a]'
                : inv.status === 'PARTIALLY_PAID'
                ? 'text-amber-700'
                : 'text-rose-700'
            }
          >
            {inv.status?.replace('_', ' ')}
          </span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: '200px',
      render: (inv) => (
        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => openInvoiceModal(inv)}
            title="View & Print Pharmacy Thermal Slip"
            className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Printer className="h-3 w-3" /> Slip
          </button>

          {inv.channel === 'RETAIL' && Number(inv.outstanding) > 0 && (
            <button
              type="button"
              className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              onClick={() => openInvoiceModal(inv, 'payment')}
              title="Collect Remaining Payment"
            >
              <CreditCard className="h-3 w-3" /> Collect
            </button>
          )}

          {inv.channel === 'RETAIL' && Number(inv.paidTotal || inv.collectedAmount || 0) > 0 && (
            <button
              type="button"
              onClick={() => openInvoiceModal(inv, 'return')}
              title="Return items & issue refund"
              className="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Undo2 className="h-3 w-3" /> Refund
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-[1700px] mx-auto">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sales &amp; Dispensing Invoices
          </h1>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            Billing Registry
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Every POS retail bill, HMS inpatient dispense, payment settlement, and thermal slip printout.
        </p>
      </div>

      {/* KPI Metric Header */}
      <PharmacyKpiHeader items={kpis} />

      {/* Main Table */}
      <PharmacyDataTable
        columns={columns}
        data={rows}
        loading={loading}
        title="Sales Invoices Register"
        badge="Active Invoices"
        exportFileName="pharmacy_sales_invoices"
        searchPlaceholder="Search by invoice #, patient/customer name, or pharmacist…"
        serverPagination={{
          page,
          pageSize,
          total,
          totalPages,
          onPageChange: (p) => setPage(p),
          onPageSizeChange: (s) => {
            setPageSize(s);
            setPage(1);
          },
          searchValue: search,
          onSearchChange: (q) => {
            setSearch(q);
            setPage(1);
          },
          sortBy,
          sortOrder,
          onSortChange: (f, o) => {
            setSortBy(f);
            setSortOrder(o);
            setPage(1);
          },
        }}
        onRefresh={load}
        onApplyFilters={load}
        onResetFilters={() => {
          setChannelFilter('ALL');
          setStatusFilter('ALL');
          setFromDate('');
          setToDate('');
          setSearch('');
          setPage(1);
          load();
        }}
        filterControls={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
              />
            </div>

            <div className="w-36">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="w-full h-8.5 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
              >
                <option value="ALL">All Channels</option>
                <option value="RETAIL">Retail POS</option>
                <option value="HMS_LINKED">HMS Dispense</option>
              </select>
            </div>

            <div className="w-36">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-8.5 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Fully Paid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="UNPAID">Unpaid Due</option>
              </select>
            </div>
          </div>
        }
        emptyTitle="No Invoices Found"
        emptyDescription="No sales or dispense records match your filters."
      />

      {/* Full-featured Pharmacy Invoice & Thermal Slip Modal */}
      {selectedInvoice && (
        <PharmacyInvoiceModal
          invoice={selectedInvoice}
          initialAction={modalInitialAction}
          onClose={() => {
            setSelectedInvoice(null);
            setModalInitialAction(undefined);
          }}
          onUpdated={(updated) => {
            setSelectedInvoice(updated);
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.pos.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.medicines.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.financial.all });
          }}
        />
      )}
    </div>
  );
};
