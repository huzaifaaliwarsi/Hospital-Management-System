import React, { useEffect, useState, useMemo } from 'react';
import {
  Loader2,
  Plus,
  X,
  BookOpen,
  Banknote,
  Search,
  Building2,
  Phone,
  User,
  CreditCard,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { formatPKR, formatNumber, formatDateTime, formatDate } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import { PharmacyDataTable, Column } from '../components/PharmacyDataTable';

const emptyForm = { code: '', name: '', contactPerson: '', phone: '', paymentTermsDays: '0' };

export const VendorsPage: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Ledger state
  const [ledgerVendor, setLedgerVendor] = useState<any | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Payment state
  const [payVendor, setPayVendor] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'ONLINE'>('CASH');
  const [payReference, setPayReference] = useState('');
  const [paying, setPaying] = useState(false);

  // Filter state for main list
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE' | 'SETTLED'>('ALL');

  const load = () => {
    setLoading(true);
    apiClient
      .get('/vendors')
      .then((r) => setRows(r.data.data))
      .catch(() => toast.error('Failed to load vendors directory.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Top KPI calculations
  const totalVendors = rows.length;
  const totalPayable = rows.reduce((s, v) => s + Number(v.currentPayable || 0), 0);
  const vendorsWithDue = rows.filter((v) => Number(v.currentPayable) > 0).length;
  const fullySettled = rows.filter((v) => Number(v.currentPayable) <= 0).length;

  const kpis: KpiItem[] = [
    {
      label: 'Total Vendors',
      value: totalVendors,
      icon: Building2,
      subtitle: `${vendorsWithDue} with outstanding balance`,
      tone: 'info',
    },
    {
      label: 'Total Payable Due',
      value: formatPKR(totalPayable),
      icon: Banknote,
      subtitle: 'Net supplier liabilities',
      tone: totalPayable > 0 ? 'danger' : 'success',
    },
    {
      label: 'Accounts with Due',
      value: vendorsWithDue,
      icon: AlertCircle,
      subtitle: 'Requiring disbursement',
      tone: 'warning',
    },
    {
      label: 'Settled Accounts',
      value: fullySettled,
      icon: CheckCircle2,
      subtitle: 'Zero outstanding balance',
      tone: 'success',
    },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Vendor Code and Name are required.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/vendors', {
        ...form,
        paymentTermsDays: Number(form.paymentTermsDays) || 0,
      });
      toast.success(`Vendor "${form.name}" created successfully.`);
      setShowAdd(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to create vendor.');
    } finally {
      setSaving(false);
    }
  };

  const openLedger = async (vendor: any) => {
    setLoadingLedger(true);
    setLedgerVendor({ vendor, entries: [], currentPayable: vendor.currentPayable });
    try {
      const res = await apiClient.get(`/vendors/${vendor.id}/ledger`);
      setLedgerVendor(res.data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to fetch vendor ledger.');
    } finally {
      setLoadingLedger(false);
    }
  };

  const openPayModal = (vendor: any) => {
    const due = Number(vendor.currentPayable || 0);
    if (due <= 0) {
      toast.error(`Vendor "${vendor.name}" has no outstanding balance — account is already settled.`);
      return;
    }
    setPayVendor(vendor);
    setPayAmount(String(due));
    setPayReference(`VND-PAY-${String(Date.now()).slice(-4)}`);
    setPayMethod('CASH');
  };

  const handlePay = async () => {
    if (!payVendor) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    setPaying(true);
    try {
      await apiClient.post(`/vendors/${payVendor.id}/pay`, {
        amount,
        method: payMethod,
      });
      toast.success(`Payment of ${formatPKR(amount)} recorded for ${payVendor.name}.`);
      setPayVendor(null);
      setPayAmount('');
      load();
      // If ledger is open for this vendor, refresh it
      if (ledgerVendor && ledgerVendor.vendor.id === payVendor.id) {
        openLedger(payVendor);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to record vendor payment.');
    } finally {
      setPaying(false);
    }
  };

  // Filtered rows for main table
  const filteredVendors = useMemo(() => {
    return rows.filter((v) => {
      const due = Number(v.currentPayable || 0);
      if (statusFilter === 'DUE') return due > 0;
      if (statusFilter === 'SETTLED') return due <= 0;
      return true;
    });
  }, [rows, statusFilter]);

  // Main Vendor Columns
  const columns: Column<any>[] = [
    {
      key: 'code',
      header: 'Vendor Code',
      width: '140px',
      render: (v) => (
        <span className="font-bold text-slate-900 text-xs tracking-wider whitespace-nowrap">
          {v.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Vendor Name',
      render: (v) => (
        <span className="font-bold text-slate-900 text-xs whitespace-nowrap">{v.name}</span>
      ),
    },
    {
      key: 'contactPerson',
      header: 'Contact Person',
      width: '160px',
      render: (v) => (
        <span className="text-xs text-slate-700 whitespace-nowrap">
          {v.contactPerson || <span className="text-slate-400 font-sans">—</span>}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Phone / Email',
      render: (v) => (
        <div className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-700">
          {v.phone ? (
            <div className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{v.phone}</span>
            </div>
          ) : (
            <span className="text-slate-400 font-sans">—</span>
          )}
          {v.email && (
            <span className="text-slate-500 font-sans">
              ({v.email})
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'paymentTermsDays',
      header: 'Credit Terms',
      width: '140px',
      render: (v) => (
        <span className="text-xs text-slate-700 font-medium whitespace-nowrap">
          {v.paymentTermsDays > 0 ? `Net ${v.paymentTermsDays} Days` : 'Immediate / COD'}
        </span>
      ),
    },
    {
      key: 'currentPayable',
      header: 'Current Payable (PKR)',
      align: 'right',
      render: (v) => {
        const amt = Number(v.currentPayable || 0);
        return (
          <span
            className={`font-bold text-xs whitespace-nowrap ${
              amt > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {formatPKR(amt)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '130px',
      render: (v) => {
        const amt = Number(v.currentPayable || 0);
        return amt > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0" /> Payable Due
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0e7d5a] whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-[#0e7d5a] shrink-0" /> Settled
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: '140px',
      render: (v) => (
        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
          <button
            type="button"
            onClick={() => openLedger(v)}
            title="Inspect Vendor Ledger Statement"
            className="px-2 py-0.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
          >
            <BookOpen className="h-3 w-3" /> Ledger
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => openPayModal(v)}
              title="Record Disbursement Payment"
              className="px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Banknote className="h-3 w-3 text-emerald-600" /> Pay
            </button>
          )}
        </div>
      ),
    },
  ];

  // Ledger Modal Calculations
  const ledgerEntries: any[] = ledgerVendor?.entries || [];
  const chronological = [...ledgerEntries].reverse();
  let running = 0;
  const withRunningBalance = chronological.map((e) => {
    const signed =
      e.entryType === 'PURCHASE_CREDIT' || (e.entryType === 'ADJUSTMENT' && Number(e.amount) >= 0)
        ? Number(e.amount)
        : -Math.abs(Number(e.amount));
    running += signed;
    return { ...e, computedRunningBalance: running };
  });

  const displayLedgerEntries = [...withRunningBalance]
    .reverse()
    .filter((e) => !ledgerTypeFilter || e.entryType === ledgerTypeFilter)
    .filter((e) => {
      if (!ledgerSearch.trim()) return true;
      const s = ledgerSearch.toLowerCase();
      const ref = (e.referenceId || e.description || '').toLowerCase();
      return ref.includes(s);
    });

  const ledgerTotalBilled = ledgerEntries
    .filter((e) => e.entryType === 'PURCHASE_CREDIT' || (e.entryType === 'ADJUSTMENT' && Number(e.amount) >= 0))
    .reduce((s, e) => s + Number(e.amount), 0);

  const ledgerTotalPaid = ledgerEntries
    .filter((e) => e.entryType === 'PAYMENT')
    .reduce((s, e) => s + Number(e.amount), 0);

  const ledgerTotalReturns = ledgerEntries
    .filter((e) => e.entryType === 'RETURN_CREDIT' || (e.entryType === 'ADJUSTMENT' && Number(e.amount) < 0))
    .reduce((s, e) => s + Math.abs(Number(e.amount)), 0);

  const ledgerNetClosing = Number(ledgerVendor?.currentPayable ?? running);

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-[1700px] mx-auto">
      {/* Page Title & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Vendor Directory &amp; Ledger
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              Pharmacy Store
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete vendor master, double-entry statement ledger, disbursements, and credit terms.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add New Vendor
          </button>
        )}
      </div>

      {/* Top Summary Metric Cards */}
      <PharmacyKpiHeader items={kpis} />

      {/* Main Vendor Directory Table */}
      <PharmacyDataTable
        columns={columns}
        data={filteredVendors}
        loading={loading}
        title="Vendor Accounts & Payables Register"
        badge="Active Vendors"
        exportFileName="vendor_accounts"
        searchPlaceholder="Search vendor by code, name, phone, or contact…"
        searchFilter={(v, q) =>
          v.code.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          (v.contactPerson && v.contactPerson.toLowerCase().includes(q)) ||
          (v.phone && v.phone.toLowerCase().includes(q))
        }
        onRefresh={load}
        onApplyFilters={load}
        onResetFilters={() => {
          setStatusFilter('ALL');
          load();
        }}
        filterControls={
          <div className="w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full h-8.5 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
            >
              <option value="ALL">All Vendor Accounts</option>
              <option value="DUE">With Due Balance</option>
              <option value="SETTLED">Fully Settled</option>
            </select>
          </div>
        }
        emptyTitle="No Vendors Found"
        emptyDescription="No vendor matches your search criteria. Click 'Add New Vendor' to create one."
      />

      {/* ═════════════════════════════════════════════════════════════
          VENDOR LEDGER DRAWER / MODAL
          ═════════════════════════════════════════════════════════════ */}
      {ledgerVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none">
            {/* Top Modal Bar (Hidden on print) */}
            <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0 print:hidden">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <BookOpen className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">
                      {ledgerVendor.vendor?.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      [{ledgerVendor.vendor?.code}]
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Vendor Ledger &amp; Running Statement · CH Sharif &amp; Saeed Hospital Pharmacy
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Statement
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openPayModal(ledgerVendor.vendor)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Banknote className="h-3.5 w-3.5 text-emerald-700" /> Pay Vendor
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLedgerVendor(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-slate-50/60 print:p-0 print:bg-white print:overflow-visible">
              {/* Distinctive Dark Green Banner (Hospital Theme) */}
              <div className="bg-gradient-to-r from-[#0a4636] to-[#08775A] text-white p-5 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-300">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-extrabold tracking-tight">
                        {ledgerVendor.vendor?.name}
                      </h2>
                      <span className="font-mono text-xs bg-white/20 px-2 py-0.5 rounded font-bold">
                        {ledgerVendor.vendor?.code}
                      </span>
                    </div>
                    <div className="text-xs text-emerald-100/90 flex flex-wrap items-center gap-3 mt-1">
                      {ledgerVendor.vendor?.contactPerson && (
                        <span>Contact: <strong>{ledgerVendor.vendor.contactPerson}</strong></span>
                      )}
                      {ledgerVendor.vendor?.phone && (
                        <span>Phone: <strong className="font-mono">{ledgerVendor.vendor.phone}</strong></span>
                      )}
                      <span>
                        Terms: <strong>{ledgerVendor.vendor?.paymentTermsDays > 0 ? `Net ${ledgerVendor.vendor.paymentTermsDays} Days` : 'COD'}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right bg-white/10 px-4 py-2.5 rounded-xl border border-white/15">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                    Net Outstanding Balance
                  </div>
                  <div className="text-xl font-black tabular-nums mt-0.5">
                    {formatPKR(ledgerNetClosing)}
                  </div>
                </div>
              </div>

              {/* 4 Ledger Metric Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Total Invoiced (Cr)
                  </div>
                  <div className="text-base font-extrabold text-slate-900 tabular-nums mt-0.5">
                    {formatPKR(ledgerTotalBilled)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Purchases billed</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Total Paid (Dr)
                  </div>
                  <div className="text-base font-extrabold text-emerald-700 tabular-nums mt-0.5">
                    {formatPKR(ledgerTotalPaid)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Payments disbursed</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Returns &amp; Credits
                  </div>
                  <div className="text-base font-extrabold text-slate-700 tabular-nums mt-0.5">
                    {formatPKR(ledgerTotalReturns)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Debit notes / returns</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Closing Balance
                  </div>
                  <div
                    className={`text-base font-extrabold tabular-nums mt-0.5 ${
                      ledgerNetClosing > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatPKR(ledgerNetClosing)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {ledgerNetClosing > 0 ? 'Payable liability' : 'Account settled'}
                  </div>
                </div>
              </div>

              {/* Ledger Filter Toolbar (Hidden on print) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search voucher ref, notes, description…"
                    className="flex-1 h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={ledgerTypeFilter}
                    onChange={(e) => setLedgerTypeFilter(e.target.value)}
                    className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                  >
                    <option value="">All Voucher Types</option>
                    <option value="PURCHASE_CREDIT">Purchases / Bills (Cr)</option>
                    <option value="PAYMENT">Disbursements / Payments (Dr)</option>
                    <option value="RETURN_CREDIT">Returns (Debit Notes)</option>
                    <option value="ADJUSTMENT">Adjustments</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => openLedger(ledgerVendor.vendor)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title="Refresh Ledger"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Double-Entry Ledger Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#f1f5f9] select-none sticky top-0 z-10 border-b border-slate-300 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12 border-r border-slate-300">#</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">Date &amp; Time</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">Voucher / Ref #</th>
                        <th className="py-2.5 px-3.5 border-r border-slate-300">Particulars / Details</th>
                        <th className="py-2.5 px-3.5 text-right border-r border-slate-300 text-emerald-800">
                          Debit (Dr - Paid)
                        </th>
                        <th className="py-2.5 px-3.5 text-right border-r border-slate-300 text-rose-800">
                          Credit (Cr - Billed)
                        </th>
                        <th className="py-2.5 px-3.5 text-right font-black text-slate-900">
                          Running Balance (PKR)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingLedger ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-600" />
                            Loading vendor ledger transactions…
                          </td>
                        </tr>
                      ) : displayLedgerEntries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            No ledger transactions recorded yet for this vendor.
                          </td>
                        </tr>
                      ) : (
                        displayLedgerEntries.map((entry, idx) => {
                          const isCredit =
                            entry.entryType === 'PURCHASE_CREDIT' ||
                            (entry.entryType === 'ADJUSTMENT' && Number(entry.amount) >= 0);
                          const isDebit =
                            entry.entryType === 'PAYMENT' ||
                            entry.entryType === 'RETURN_CREDIT' ||
                            (entry.entryType === 'ADJUSTMENT' && Number(entry.amount) < 0);
                          const amt = Math.abs(Number(entry.amount));

                          return (
                            <tr key={entry.id || idx} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] bg-slate-50/50 border-r border-slate-200">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap border-r border-slate-200">
                                {formatDateTime(entry.createdAt)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap border-r border-slate-200">
                                {entry.referenceId || entry.id.slice(0, 8).toUpperCase()}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-800 border-r border-slate-200">
                                <div className="font-semibold">
                                  {entry.entryType === 'PURCHASE_CREDIT'
                                    ? 'Stock Inward / Purchase Order'
                                    : entry.entryType === 'PAYMENT'
                                    ? 'Vendor Payment Disbursement'
                                    : entry.entryType === 'RETURN_CREDIT'
                                    ? 'Purchase Return (Debit Note)'
                                    : 'Approved Adjustment'}
                                </div>
                                {entry.description && (
                                  <div className="text-[11px] text-slate-500 mt-0.5">{entry.description}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-bold tabular-nums text-emerald-700 border-r border-slate-200">
                                {isDebit ? formatPKR(amt) : '—'}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-bold tabular-nums text-rose-700 border-r border-slate-200">
                                {isCredit ? formatPKR(amt) : '—'}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-extrabold tabular-nums text-slate-950">
                                {formatPKR(entry.computedRunningBalance ?? entry.runningBalance)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="bg-[#f8fafc] border-t-2 border-slate-300 font-bold text-xs text-slate-900">
                      <tr>
                        <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-slate-600">
                          Total Summary Movements:
                        </td>
                        <td className="py-3 px-3.5 text-right text-emerald-800 tabular-nums">
                          {formatPKR(ledgerTotalPaid)}
                        </td>
                        <td className="py-3 px-3.5 text-right text-rose-800 tabular-nums">
                          {formatPKR(ledgerTotalBilled)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-black tabular-nums text-sm text-slate-950">
                          {formatPKR(ledgerNetClosing)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Print Footer Stamp (Only shown when printing) */}
              <div className="hidden print:grid grid-cols-3 gap-6 pt-12 text-center text-xs text-slate-700">
                <div className="border-t border-slate-400 pt-1">Prepared by Accountant</div>
                <div className="border-t border-slate-400 pt-1">Verified by Pharmacy Manager</div>
                <div className="border-t border-slate-400 pt-1">Authorized Vendor Signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════
          ADD VENDOR MODAL
          ═════════════════════════════════════════════════════════════ */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-400" />
                Add New Pharmacy Vendor
              </h3>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vendor Code *
                  </label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. VND-004"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Credit Terms (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.paymentTermsDays}
                    onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Vendor Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Getz Pharma Distribution"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-semibold focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    placeholder="e.g. Tariq Mehmood"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0300-1234567"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 transition-colors flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════
          RECORD PAYMENT MODAL
          ═════════════════════════════════════════════════════════════ */}
      {payVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-400" />
                Pay Vendor — {payVendor.name}
              </h3>
              <button
                type="button"
                onClick={() => setPayVendor(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Total Current Due:</div>
                <div className="text-lg font-extrabold text-rose-700 tabular-nums">
                  {formatPKR(payVendor.currentPayable)}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Amount (PKR) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={Number(payVendor.currentPayable)}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                >
                  <option value="CASH">Cash Disbursement</option>
                  <option value="CARD">Bank / POS Card</option>
                  <option value="ONLINE">Online Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Voucher / Cheque Reference (Optional)
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. CHQ-92819"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full h-10 font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                  Confirm Vendor Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
