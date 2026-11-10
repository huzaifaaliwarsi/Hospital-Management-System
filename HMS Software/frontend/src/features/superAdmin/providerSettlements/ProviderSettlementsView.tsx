import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Landmark,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Calendar,
  Building2,
  TrendingUp,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import {
  ProviderSettlement,
  ProviderSettlementFormValues,
  fetchProviderSettlements,
  createProviderSettlement,
  fetchDepartmentPayablesSummary,
  DepartmentPayablesResponse,
  DepartmentPayableRow,
} from '../../../services/providerSettlementService';
import { OutsourcedProvider, fetchOutsourcedProviders, PAYMENT_METHOD_LABELS, PaymentMethod } from '../../../services/outsourcedProviderService';
import { fetchDepartments } from '../../../services/departmentService';
import { Department } from '../../../types/department';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput, Select, Textarea } from '../../../components/forms/FormControls';
import { useToast } from '../../../context/ToastContext';
import { HospitalKpiHeader, KpiItem } from '../../../components/common/HospitalKpiHeader';

const EMPTY_FORM: ProviderSettlementFormValues = {
  requestKey: '',
  outsourcedProviderId: '',
  departmentId: '',
  periodLabel: '',
  eligibleRealizedAmount: 0,
  settlementAmount: 0,
  status: 'PARTIAL',
  paymentMethod: 'BANK_TRANSFER',
  paymentReference: '',
  representativeName: '',
  representativeDesignation: '',
  remarks: '',
};

type PeriodPreset = 'today' | 'this_week' | 'this_month' | 'custom' | 'all';
type OwnershipFilter = 'ALL' | 'OUTSOURCED' | 'INTERNAL';

export const ProviderSettlementsView: React.FC = () => {
  const toast = useToast();
  const [settlements, setSettlements] = useState<ProviderSettlement[]>([]);
  const [providers, setProviders] = useState<OutsourcedProvider[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [payablesData, setPayablesData] = useState<DepartmentPayablesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPayables, setIsLoadingPayables] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>('All');

  // Settlement Form Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<ProviderSettlementFormValues>(EMPTY_FORM);
  const [settlementBalance, setSettlementBalance] = useState(0);
  const [loadingSettlement, setLoadingSettlement] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load Department Payables Summary
  const payablesRequest = useRef(0);
  const loadPayables = useCallback(async () => {
    const request = ++payablesRequest.current;
    if (periodPreset === 'custom' && (!customFrom || !customTo || customFrom > customTo)) {
      setPayablesData(null);
      setIsLoadingPayables(false);
      return;
    }
    setIsLoadingPayables(true);
    try {
      const res = await fetchDepartmentPayablesSummary({
        preset: periodPreset,
        fromDate: periodPreset === 'custom' ? customFrom : undefined,
        toDate: periodPreset === 'custom' ? customTo : undefined,
        type: ownershipFilter === 'ALL' ? undefined : ownershipFilter,
      });
      if (request === payablesRequest.current) setPayablesData(res);
    } catch (err: any) {
      if (request !== payablesRequest.current) return;
      setPayablesData(null);
      toast.error(err?.response?.data?.error?.message || 'Failed to load department payables.');
    } finally {
      if (request === payablesRequest.current) setIsLoadingPayables(false);
    }
  }, [periodPreset, customFrom, customTo, ownershipFilter]);

  const loadAll = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [settlementRows, providerRows, departmentRows, payables] = await Promise.all([
        fetchProviderSettlements(),
        fetchOutsourcedProviders(),
        fetchDepartments(),
        fetchDepartmentPayablesSummary({
          preset: periodPreset,
          fromDate: periodPreset === 'custom' ? customFrom : undefined,
          toDate: periodPreset === 'custom' ? customTo : undefined,
          type: ownershipFilter === 'ALL' ? undefined : ownershipFilter,
        }),
      ]);
      setSettlements(settlementRows);
      setProviders(providerRows);
      setDepartments(departmentRows);
      setPayablesData(payables);
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load provider settlements.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      loadPayables();
    }
  }, [periodPreset, customFrom, customTo, ownershipFilter]);

  const filteredSettlements = useMemo(() => {
    if (providerFilter === 'All') return settlements;
    return settlements.filter((s) => s.outsourcedProviderId === providerFilter);
  }, [settlements, providerFilter]);

  const activeProviders = providers.filter((p) => p.isActive);
  const selectedProvider = providers.find((p) => p.id === formValues.outsourcedProviderId);
  const remainingEligible = Math.max(0, settlementBalance - formValues.settlementAmount);

  const handleSettleDepartment = async (row: DepartmentPayableRow) => {
    setLoadingSettlement(true);
    try {
      // A voucher always pays today's live balance, even when viewing an older period.
      const current = await fetchDepartmentPayablesSummary({ preset: 'today' });
      const live = current.departments.find(d => d.departmentId === row.departmentId);
      if (!live?.outsourcedProvider?.isActive || live.requiresSettlementReconciliation || live.remainingPayable <= 0) {
        throw new Error(live?.requiresSettlementReconciliation ? 'Reconcile unassigned or mismatched provider vouchers before settling.' : 'No payable balance is available for this provider.');
      }
      setSettlementBalance(live.remainingPayable);
      setFormValues({
        ...EMPTY_FORM,
        requestKey: crypto.randomUUID(),
        outsourcedProviderId: live.outsourcedProvider.id,
        departmentId: live.departmentId,
        periodLabel: 'Balance settlement - ' + live.departmentName,
        eligibleRealizedAmount: live.cumulativeRealized,
        settlementAmount: live.remainingPayable,
        paymentMethod: live.outsourcedProvider.allowedPaymentMethods[0] || 'BANK_TRANSFER',
        status: 'FULL',
      });
      setFormError(null);
      setIsFormOpen(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err.message, 'Settlement unavailable');
    } finally {
      setLoadingSettlement(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.outsourcedProviderId) {
      const msg = 'Select an outsourced provider.';
      setFormError(msg);
      toast.error(msg, 'Validation Error');
      return;
    }
    if (formValues.eligibleRealizedAmount <= 0) {
      const msg = 'Eligible realized amount must be greater than zero.';
      setFormError(msg);
      toast.error(msg, 'Validation Error');
      return;
    }
    if (formValues.settlementAmount <= 0) {
      const msg = 'Settlement amount must be greater than zero.';
      setFormError(msg);
      toast.error(msg, 'Validation Error');
      return;
    }
    if (formValues.settlementAmount > settlementBalance) {
      setFormError('Settlement exceeds the available payable.');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await createProviderSettlement(formValues);
      toast.success('Provider settlement recorded and voucher generated.');
      setIsFormOpen(false);
      await loadAll();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to record settlement.';
      setFormError(msg);
      toast.error(msg, 'Settlement Failed');
    } finally {
      setIsSaving(false);
    }
  };

  const kpis: KpiItem[] = useMemo(() => {
    const k = payablesData?.kpis;
    const totalBilled = k?.totalBilled ?? 0;
    const totalRealized = k?.totalRealized ?? 0;
    const totalSettled = k?.totalSettled ?? 0;
    const totalRemaining = k?.totalRemaining ?? 0;

    return [
      {
        category: 'DEPARTMENT BILLING',
        title: 'Period Billed',
        value: formatPKR(totalBilled),
        icon: Receipt,
        subtitle: `${payablesData?.period?.label || 'Selected period'} gross volume`,
        tone: 'default',
      },
      {
        category: 'COLLECTIONS (ELIGIBLE)',
        title: 'Realized Collections',
        value: formatPKR(totalRealized),
        icon: FileCheck2,
        subtitle: 'Patient and company payments',
        tone: 'info',
      },
      {
        category: 'DISBURSED SETTLEMENTS',
        title: 'Period Settlements',
        value: formatPKR(totalSettled),
        icon: CheckCircle2,
        subtitle: 'Paid to providers / vendors',
        tone: 'success',
      },
      {
        category: 'OUTSTANDING PAYABLES',
        title: 'Remaining Payable',
        value: formatPKR(totalRemaining),
        icon: AlertTriangle,
        subtitle: 'Outstanding at period end',
        tone: totalRemaining > 0 ? 'warning' : 'default',
      },
    ];
  }, [payablesData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin text-[#08775A]" />
        <span>Loading department payables &amp; settlements…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-rose-700 font-medium">{loadError}</p>
        <button
          type="button"
          onClick={loadAll}
          className="px-4 py-2 bg-[#08775A] hover:bg-[#065f46] text-white text-xs font-semibold rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  const deptRows = payablesData?.departments ?? [];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#effaf5] text-[#08775A] border border-[#c2e7db] flex items-center justify-center shadow-2xs">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#123e2b] tracking-tight">Department Payables &amp; Provider Settlements</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#08775A] animate-pulse" />
                  Live Realized Calculations
                </span>
              </div>
              <p className="text-xs text-[#52665e] mt-0.5 max-w-2xl">
                Automatic tracking of outsourced &amp; internal departments collections, payables, and settlement vouchers across daily, weekly, monthly or custom periods.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Use a department?s Settle / Pay button to record a voucher.</p>
        </div>
      </div>

      {/* KPI Header */}
      <HospitalKpiHeader columns="grid-cols-2 sm:grid-cols-4" items={kpis} />

      {/* Date Range & Department Filter Toolbar */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-[#08775A]" />
            Period:
          </span>
          {(
            [
              ['today', 'Daily (Today)'],
              ['this_week', 'Weekly (This Week)'],
              ['this_month', 'Monthly (This Month)'],
              ['custom', 'Custom Range'],
              ['all', 'All Time'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriodPreset(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                periodPreset === key
                  ? 'bg-[#08775A] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}

          {periodPreset === 'custom' && (
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-800"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-800"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#52665e]">Department Type:</span>
          <select
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value as OwnershipFilter)}
            className="text-xs px-3 py-1.5 border border-[#c2e7db] rounded-lg bg-[#fbfdfc] font-medium text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#08775A]"
          >
            <option value="ALL">All Departments</option>
            <option value="OUTSOURCED">Outsourced Only</option>
            <option value="INTERNAL">Internal Only</option>
          </select>
        </div>
      </div>

      {/* SECTION 1: Department Payables Summary Table */}
      <div className="bg-white rounded-xl border border-[#e2eae5] shadow-2xs overflow-hidden flex flex-col">
        <div className="bg-[#08775A] text-white px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#c2e7db]" />
            <span className="font-bold text-xs tracking-wide">Department Payables Summary</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#effaf5] text-[#08775A]">
              {payablesData?.period?.label || 'Period'}
            </span>
          </div>
          {isLoadingPayables && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-100">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Calculating...</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#effaf5] border-b border-[#c2e7db] text-[11px] font-bold text-[#08775A] select-none sticky top-0 z-10">
                <th className="py-2.5 px-3 text-center border-r border-[#c2e7db]/60 w-10">#</th>
                <th className="py-2.5 px-4 border-r border-[#c2e7db]/60">Department</th>
                <th className="py-2.5 px-3 border-r border-[#c2e7db]/60 text-center">Fulfillment</th>
                <th className="py-2.5 px-4 border-r border-[#c2e7db]/60">Linked Vendor / Provider</th>
                <th className="py-2.5 px-3 text-center border-r border-[#c2e7db]/60">Services</th>
                <th className="py-2.5 px-4 text-right border-r border-[#c2e7db]/60">Period Billed</th>
                <th className="py-2.5 px-4 text-right border-r border-[#c2e7db]/60">Period Collections</th>
                <th className="py-2.5 px-4 text-right border-r border-[#c2e7db]/60">Period Settlements</th>
                <th className="py-2.5 px-4 text-right border-r border-[#c2e7db]/60">Closing Balance</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2eae5] text-slate-700">
              {deptRows.map((d, idx) => {
                const isEven = idx % 2 === 0;
                const isOutsourced = d.fulfillmentOwnership === 'OUTSOURCED';
                return (
                  <tr
                    key={d.departmentId}
                    className={`transition-colors border-b border-[#e2eae5] ${
                      isEven ? 'bg-white' : 'bg-[#fbfdfc]'
                    } hover:bg-[#e7f6f1]/40`}
                  >
                    <td className="py-2.5 px-3 text-center border-r border-[#e2eae5] text-[#52665e] font-mono text-[11px] bg-[#effaf5]/20">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-[#123e2b] border-r border-[#e2eae5]">
                      {d.departmentName}
                      <span className="block text-[10px] text-slate-400 font-mono font-normal">{d.departmentCode}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center border-r border-[#e2eae5]">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isOutsourced
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {isOutsourced ? 'Outsourced' : 'Internal'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 border-r border-[#e2eae5]">
                      {d.outsourcedProvider ? (
                        <div>
                          <span className="font-bold text-slate-800">{d.outsourcedProvider.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {d.outsourcedProvider.code} {d.outsourcedProvider.settlementCycle ? `· ${d.outsourcedProvider.settlementCycle}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">In-House Department</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center border-r border-[#e2eae5] font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {d.servicesCount}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-800 border-r border-[#e2eae5]">
                      {formatPKR(d.periodBilled)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-[#08775A] border-r border-[#e2eae5]">
                      {formatPKR(d.periodRealized)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#52665e] border-r border-[#e2eae5]">
                      {formatPKR(d.periodSettled)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold border-r border-[#e2eae5]">
                      <span className={d.remainingPayable > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                        {formatPKR(d.closingBalance)}
                      </span>
                      <span className="block text-[10px] text-slate-500">Opening: {formatPKR(d.openingBalance)}</span>
                      {d.requiresSettlementReconciliation && <span className="block text-[10px] text-amber-700">Provider vouchers need reconciliation</span>}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isOutsourced && d.outsourcedProvider ? (
                        <button
                          type="button"
                          onClick={() => handleSettleDepartment(d)}
                          disabled={loadingSettlement || d.requiresSettlementReconciliation || !d.outsourcedProvider.isActive}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-[#08775A] hover:bg-[#065f46] text-white rounded-md text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>Settle / Pay</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">Internal Operations</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {deptRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-[#52665e]">
                    <Building2 className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                    <span>No departments match the selected filter.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Provider Settlements Vouchers Ledger */}
      <div className="bg-white rounded-xl border border-[#e2eae5] shadow-2xs overflow-hidden flex flex-col">
        <div className="bg-[#123e2b] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-[#c2e7db]" />
            <span className="font-bold text-xs tracking-wide">Settlement Vouchers History Ledger</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#effaf5] text-[#08775A]">
              {filteredSettlements.length} Vouchers
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-100 font-medium">Filter by Provider:</span>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="text-xs px-2.5 py-1 border border-emerald-700 rounded-md bg-[#0e5944] text-white font-medium focus:outline-hidden"
            >
              <option value="All">All Providers</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#effaf5] border-b border-[#c2e7db] text-[11px] font-bold text-[#08775A] select-none sticky top-0 z-10">
                <th className="py-2.5 px-3 text-center border-r border-[#c2e7db]/60 w-12">#</th>
                <th className="py-2.5 px-4 border-r border-[#c2e7db]/60">Provider</th>
                <th className="py-2.5 px-4 border-r border-[#c2e7db]/60">Department</th>
                <th className="py-2.5 px-4 border-r border-[#c2e7db]/60">Period</th>
                <th className="py-2.5 px-4 text-right border-r border-[#c2e7db]/60">Eligible Realized</th>
                <th className="py-2.5 px-4 text-right border-r border-[#c2e7db]/60">Already Settled</th>
                <th className="py-2.5 px-4 text-right border-r border-[#c2e7db]/60">This Settlement</th>
                <th className="py-2.5 px-4 text-right border-r border-[#c2e7db]/60">Remaining</th>
                <th className="py-2.5 px-4 border-r border-[#c2e7db]/60">Status</th>
                <th className="py-2.5 px-4 border-r border-[#c2e7db]/60">Method / Ref</th>
                <th className="py-2.5 px-4">Settled By / At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2eae5] text-slate-700">
              {filteredSettlements.map((s, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={s.id}
                    className={`transition-colors border-b border-[#e2eae5] ${
                      isEven ? 'bg-white' : 'bg-[#fbfdfc]'
                    } hover:bg-[#e7f6f1]/40`}
                  >
                    <td className="py-2.5 px-3 text-center border-r border-[#e2eae5] text-[#52665e] font-mono text-[11px] bg-[#effaf5]/20">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-[#123e2b] border-r border-[#e2eae5]">
                      {s.providerName} <span className="text-[#52665e] font-mono font-normal">({s.providerCode})</span>
                    </td>
                    <td className="py-2.5 px-4 border-r border-[#e2eae5]">{s.departmentName || '—'}</td>
                    <td className="py-2.5 px-4 border-r border-[#e2eae5] text-[11px] text-slate-600">{s.periodLabel || '—'}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800 border-r border-[#e2eae5]">
                      {formatPKR(s.eligibleRealizedAmount)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#52665e] border-r border-[#e2eae5]">
                      {formatPKR(s.alreadySettledAmount)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-[#08775A] border-r border-[#e2eae5]">
                      {formatPKR(s.settlementAmount)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-700 border-r border-[#e2eae5]">
                      {formatPKR(s.remainingAfter)}
                    </td>
                    <td className="py-2.5 px-4 border-r border-[#e2eae5]">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === 'FULL'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {s.status === 'FULL' ? 'Fully Settled' : 'Partially Settled'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 border-r border-[#e2eae5]">
                      {PAYMENT_METHOD_LABELS[s.paymentMethod]}
                      {s.paymentReference && <span className="text-[#52665e] font-mono"> · {s.paymentReference}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-[11px] text-[#52665e]">
                      <span className="font-semibold text-slate-800">{s.settledBy}</span>
                      <br />
                      <span className="font-mono">{s.settledAt}</span>
                    </td>
                  </tr>
                );
              })}

              {filteredSettlements.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-[#52665e]">
                    <Landmark className="h-8 w-8 text-[#52665e]/40 mx-auto mb-2" />
                    <span className="font-semibold text-xs text-[#123e2b] block">No settlements recorded yet.</span>
                    <span className="text-[11px] text-slate-400">
                      Use the "Settle / Pay" button above to record payments against realized department collections.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Settlement Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Record Provider Settlement Voucher" maxWidth="2xl">
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">{formError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Outsourced Provider"
              required
              options={activeProviders.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id }))}
              disabled
              value={formValues.outsourcedProviderId}
              onChange={(e) => setFormValues({ ...formValues, outsourcedProviderId: e.target.value })}
            />
            <Select
              label="Department"
              disabled
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
              value={formValues.departmentId}
              onChange={(e) => setFormValues({ ...formValues, departmentId: e.target.value })}
            />
          </div>
          {selectedProvider && (
            <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              Allowed methods: {selectedProvider.allowedPaymentMethods.map((m) => PAYMENT_METHOD_LABELS[m]).join(', ') || 'Any'}
              {selectedProvider.settlementCycle && <> · Settlement cycle: {selectedProvider.settlementCycle}</>}
            </div>
          )}
          <TextInput
            label="Period Label"
            placeholder="e.g. October 2026 or Today"
            value={formValues.periodLabel}
            onChange={(e) => setFormValues({ ...formValues, periodLabel: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberInput
              label="Eligible Realized Amount (PKR)"
              hint="Cumulative collections calculated by the server."
              readOnly
              required
              min={0}
              step={0.01}
              placeholder="0"
              value={formValues.eligibleRealizedAmount === 0 ? '' : formValues.eligibleRealizedAmount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setFormValues({ ...formValues, eligibleRealizedAmount: e.target.value === '' ? 0 : Number(e.target.value) || 0 })}
            />
            <NumberInput
              label="Settlement Amount (PKR)"
              hint={formValues.paymentMethod === 'CASH' ? 'Paid from Main Fund; available cash is checked before posting.' : 'Record the provider payment made by this method; physical cash is unchanged.'}
              required
              min={0.01}
              max={settlementBalance}
              step={0.01}
              placeholder="0"
              value={formValues.settlementAmount === 0 ? '' : formValues.settlementAmount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setFormValues({ ...formValues, settlementAmount: e.target.value === '' ? 0 : Number(e.target.value) || 0 })}
            />
          </div>
          <div className="text-[11px] text-slate-500">
            Available now: {formatPKR(settlementBalance)}. Remaining after this voucher:{' '}
            <strong className="text-slate-800">{formatPKR(remainingEligible)}</strong>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Settlement Status"
              disabled
              options={[
                { label: 'Full Settlement', value: 'FULL' },
                { label: 'Partial Settlement', value: 'PARTIAL' },
              ]}
              value={formValues.settlementAmount >= settlementBalance ? 'FULL' : 'PARTIAL'}
              onChange={(e) => setFormValues({ ...formValues, status: e.target.value as 'FULL' | 'PARTIAL' })}
            />
            <Select
              label="Payment Method"
              options={(selectedProvider?.allowedPaymentMethods.length ? selectedProvider.allowedPaymentMethods : Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((v) => ({ label: PAYMENT_METHOD_LABELS[v], value: v }))}
              value={formValues.paymentMethod}
              onChange={(e) => setFormValues({ ...formValues, paymentMethod: e.target.value as PaymentMethod })}
            />
          </div>
          <TextInput
            label="Payment Reference / Cheque No."
            placeholder="e.g. Bank slip or transaction ID"
            value={formValues.paymentReference}
            onChange={(e) => setFormValues({ ...formValues, paymentReference: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="Representative Name"
              placeholder="Vendor rep who received payment"
              value={formValues.representativeName}
              onChange={(e) => setFormValues({ ...formValues, representativeName: e.target.value })}
            />
            <TextInput
              label="Representative Designation"
              placeholder="e.g. Accounts Officer / Collector"
              value={formValues.representativeDesignation}
              onChange={(e) => setFormValues({ ...formValues, representativeDesignation: e.target.value })}
            />
          </div>
          <Textarea
            label="Remarks / Notes"
            rows={2}
            placeholder="Any settlement voucher notes or audit comments..."
            value={formValues.remarks}
            onChange={(e) => setFormValues({ ...formValues, remarks: e.target.value })}
          />
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              {isSaving ? 'Posting…' : 'Post Settlement & Generate Voucher'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
