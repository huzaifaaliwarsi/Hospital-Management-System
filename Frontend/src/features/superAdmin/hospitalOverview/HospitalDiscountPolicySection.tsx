import React, { useState, useEffect, useMemo } from 'react';
import {
  Percent,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  Sliders,
  Search,
  RefreshCw,
  Save,
  CheckSquare,
  Square,
  HelpCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';
import { HospitalService } from '../../../types/serviceRates';
import { Department } from '../../../types/department';
import { ServiceRatesService, fetchServices } from '../../../services/serviceRatesService';
import { fetchDepartments } from '../../../services/departmentService';
import { useToast } from '../../../context/ToastContext';

interface HospitalDiscountPolicySectionProps {
  profile: HospitalProfile;
  onSaveProfile: (updatedProfile: HospitalProfile) => Promise<void>;
}

export const HospitalDiscountPolicySection: React.FC<HospitalDiscountPolicySectionProps> = ({
  profile,
  onSaveProfile,
}) => {
  const toast = useToast();

  // ── Hospital-wide Policy Form State ──────────────────────────────
  const [discountOverallAllowed, setDiscountOverallAllowed] = useState<boolean>(
    profile.discountOverallAllowed !== false
  );
  const [discountApprovalRequired, setDiscountApprovalRequired] = useState<boolean>(
    profile.discountApprovalRequired !== false
  );
  const [discountMaxPercent, setDiscountMaxPercent] = useState<number>(
    typeof profile.discountMaxPercentThreshold === 'number'
      ? profile.discountMaxPercentThreshold
      : 15
  );
  const [discountMaxAmount, setDiscountMaxAmount] = useState<number>(
    typeof profile.discountMaxAmountThreshold === 'number'
      ? profile.discountMaxAmountThreshold
      : 1500
  );
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  // Sync state if profile prop changes
  useEffect(() => {
    setDiscountOverallAllowed(profile.discountOverallAllowed !== false);
    setDiscountApprovalRequired(profile.discountApprovalRequired !== false);
    setDiscountMaxPercent(
      typeof profile.discountMaxPercentThreshold === 'number'
        ? profile.discountMaxPercentThreshold
        : 15
    );
    setDiscountMaxAmount(
      typeof profile.discountMaxAmountThreshold === 'number'
        ? profile.discountMaxAmountThreshold
        : 1500
    );
  }, [profile]);

  // ── Services & Departments State ─────────────────────────────────
  const [services, setServices] = useState<HospitalService[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [togglingDeptId, setTogglingDeptId] = useState<string | null>(null);
  const [togglingServiceId, setTogglingServiceId] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // ── Filter State for Single Services ─────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'ALLOWED' | 'BLOCKED'>('ALL');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // ── Load Catalog ─────────────────────────────────────────────────
  const loadCatalogData = React.useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const [fetchedServices, fetchedDepts] = await Promise.all([
        fetchServices(),
        fetchDepartments().catch(() => []),
      ]);
      setServices(fetchedServices);
      setDepartments(fetchedDepts.filter((d) => d.status === 'Active'));
    } catch {
      toast.error('Failed to load services or departments');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCatalogData();
  }, [loadCatalogData]);

  // ── Handle Save Policy ───────────────────────────────────────────
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPolicy(true);
    try {
      const updated: HospitalProfile = {
        ...profile,
        discountOverallAllowed,
        discountApprovalRequired,
        discountMaxPercentThreshold: Number(discountMaxPercent) || 0,
        discountMaxAmountThreshold: Number(discountMaxAmount) || 0,
      };
      await onSaveProfile(updated);
      toast.success('Hospital discount policy updated successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update hospital discount policy');
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // ── Global Enable/Disable All Services ───────────────────────────
  const handleToggleAllServices = async (allow: boolean) => {
    setIsBulkProcessing(true);
    try {
      const res = await ServiceRatesService.updateBulkDiscount({
        scope: 'ALL',
        discountAllowed: allow,
      });
      setServices((prev) => prev.map((s) => ({ ...s, discountAllowed: allow })));
      toast.success(
        `Discounts ${allow ? 'enabled' : 'disabled'} across all ${res.count} hospital services.`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update all services');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // ── Department Wise Toggle ───────────────────────────────────────
  const handleToggleDepartment = async (deptId: string, deptName: string, targetAllowed: boolean) => {
    setTogglingDeptId(deptId);
    try {
      const res = await ServiceRatesService.updateBulkDiscount({
        scope: 'DEPARTMENT',
        departmentId: deptId,
        discountAllowed: targetAllowed,
      });
      setServices((prev) =>
        prev.map((s) => (s.departmentId === deptId ? { ...s, discountAllowed: targetAllowed } : s))
      );
      toast.success(
        `Discounts ${targetAllowed ? 'enabled' : 'disabled'} for all ${res.count} services in ${deptName}.`
      );
    } catch (err: any) {
      toast.error(err?.message || `Failed to update ${deptName} discounts`);
    } finally {
      setTogglingDeptId(null);
    }
  };

  // ── Single Service Toggle ────────────────────────────────────────
  const handleToggleSingleService = async (service: HospitalService) => {
    const nextVal = !service.discountAllowed;
    setTogglingServiceId(service.id);
    try {
      await ServiceRatesService.updateBulkDiscount({
        scope: 'SERVICE',
        serviceRateIds: [service.id],
        discountAllowed: nextVal,
      });
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, discountAllowed: nextVal } : s))
      );
      toast.success(`Discount ${nextVal ? 'allowed' : 'blocked'} on "${service.name}".`);
    } catch (err: any) {
      toast.error(err?.message || `Failed to update service "${service.name}"`);
    } finally {
      setTogglingServiceId(null);
    }
  };

  // ── Bulk Toggle for Selected Services ────────────────────────────
  const handleBulkToggleSelected = async (targetAllowed: boolean) => {
    if (selectedServiceIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const res = await ServiceRatesService.updateBulkDiscount({
        scope: 'SERVICE',
        serviceRateIds: selectedServiceIds,
        discountAllowed: targetAllowed,
      });
      setServices((prev) =>
        prev.map((s) => (selectedServiceIds.includes(s.id) ? { ...s, discountAllowed: targetAllowed } : s))
      );
      toast.success(
        `Discounts ${targetAllowed ? 'enabled' : 'disabled'} on ${res.count} selected services.`
      );
      setSelectedServiceIds([]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update selected services');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // ── Department Aggregates ────────────────────────────────────────
  const deptStats = useMemo(() => {
    return departments.map((dept) => {
      const deptServices = services.filter((s) => s.departmentId === dept.id);
      const totalCount = deptServices.length;
      const allowedCount = deptServices.filter((s) => s.discountAllowed).length;
      return {
        department: dept,
        totalCount,
        allowedCount,
        allAllowed: totalCount > 0 && allowedCount === totalCount,
        noneAllowed: totalCount > 0 && allowedCount === 0,
        partial: allowedCount > 0 && allowedCount < totalCount,
      };
    });
  }, [departments, services]);

  // ── Filtered Single Services List ────────────────────────────────
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (selectedDeptFilter !== 'ALL' && s.departmentId !== selectedDeptFilter) {
        return false;
      }
      if (selectedStatusFilter === 'ALLOWED' && !s.discountAllowed) {
        return false;
      }
      if (selectedStatusFilter === 'BLOCKED' && s.discountAllowed) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchCode = s.code.toLowerCase().includes(q);
        const matchName = s.name.toLowerCase().includes(q);
        const matchDept = s.departmentName.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchDept) return false;
      }
      return true;
    });
  }, [services, selectedDeptFilter, selectedStatusFilter, searchTerm]);

  const allFilteredSelected =
    filteredServices.length > 0 &&
    filteredServices.every((s) => selectedServiceIds.includes(s.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const idsToRemove = new Set(filteredServices.map((s) => s.id));
      setSelectedServiceIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
    } else {
      const idsToAdd = filteredServices.map((s) => s.id);
      setSelectedServiceIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Hospital-Wide Overall Discount Policy (Sab Service Par) ──── */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-[#e2eae5] gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111827]">
                Hospital-Wide Discount Governance (Sab Services Par)
              </h3>
              <p className="text-[11px] text-[#52665e]">
                Configure maximum front-desk discount limits, Admin approval thresholds, and hospital-wide eligibility.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={() => handleToggleAllServices(true)}
              className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold cursor-pointer transition-colors"
            >
              Allow on All Services
            </button>
            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={() => handleToggleAllServices(false)}
              className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-semibold cursor-pointer transition-colors"
            >
              Block on All Services
            </button>
          </div>
        </div>

        <form onSubmit={handleSavePolicy} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Master Hospital Switch */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-slate-900 block">
                  Hospital Discounts Master Switch
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  When turned OFF, no discretionary discounts can be applied anywhere in the hospital.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiscountOverallAllowed(!discountOverallAllowed)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  discountOverallAllowed ? 'bg-[#08775A]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    discountOverallAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Admin Approval Enforcement Switch */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-900 block">
                    Require Admin Approval for High Discounts
                  </label>
                  <span
                    className="cursor-help text-slate-400 hover:text-slate-600"
                    title="When enabled, any discount higher than the % or PKR limit requires an Admin user approval."
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Turn OFF if you want Front Desk staff to apply discounts directly without getting blocked.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiscountApprovalRequired(!discountApprovalRequired)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  discountApprovalRequired ? 'bg-[#08775A]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    discountApprovalRequired ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Threshold Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Max Discount % */}
            <div className="p-4 rounded-xl border border-[#e2eae5] bg-[#fbfdfc] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Front Desk Max Discount Threshold (%)
                </label>
                <span className="text-[10px] text-slate-500">
                  Current: <strong className="text-slate-800">{discountMaxPercent}%</strong>
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountMaxPercent}
                  onChange={(e) => setDiscountMaxPercent(Number(e.target.value))}
                  disabled={!discountApprovalRequired}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#08775A] focus:border-[#08775A] disabled:bg-slate-100 disabled:text-slate-400"
                  placeholder="15"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500 mr-1">Presets:</span>
                {[15, 25, 50, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    disabled={!discountApprovalRequired}
                    onClick={() => setDiscountMaxPercent(val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer ${
                      discountMaxPercent === val
                        ? 'bg-[#effaf5] border-[#c2e7db] text-[#08775A]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {val === 100 ? '100% (No Limit)' : `${val}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Discount Amount */}
            <div className="p-4 rounded-xl border border-[#e2eae5] bg-[#fbfdfc] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Front Desk Max Discount Amount (PKR)
                </label>
                <span className="text-[10px] text-slate-500">
                  Current: <strong className="text-slate-800">Rs. {discountMaxAmount.toLocaleString()}</strong>
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={discountMaxAmount}
                  onChange={(e) => setDiscountMaxAmount(Number(e.target.value))}
                  disabled={!discountApprovalRequired}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#08775A] focus:border-[#08775A] disabled:bg-slate-100 disabled:text-slate-400"
                  placeholder="1500"
                />
                <span className="absolute right-3 top-2 text-[11px] font-bold text-slate-400">PKR</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500 mr-1">Presets:</span>
                {[1500, 5000, 15000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={!discountApprovalRequired}
                    onClick={() => setDiscountMaxAmount(amt)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer ${
                      discountMaxAmount === amt
                        ? 'bg-[#effaf5] border-[#c2e7db] text-[#08775A]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Rs. {amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingPolicy}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#08775A] hover:bg-[#065b44] text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              {isSavingPolicy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Policy…</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Discount Governance Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── 2. Department-Level Discount Permissions (Departments Par) ── */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e2eae5]">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111827]">
                Department-Wise Discount Permissions (Departments Par)
              </h3>
              <p className="text-[11px] text-[#52665e]">
                Quickly enable or disable discounts for entire clinical, ICU, or pharmacy departments.
              </p>
            </div>
          </div>
        </div>

        {isLoadingCatalog ? (
          <div className="py-8 flex items-center justify-center text-slate-500 gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-[#08775A]" />
            <span>Loading department discount mappings…</span>
          </div>
        ) : departments.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No active departments found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {deptStats.map(({ department, totalCount, allowedCount, allAllowed, noneAllowed, partial }) => {
              const isToggling = togglingDeptId === department.id;
              return (
                <div
                  key={department.id}
                  className="p-4 rounded-xl border border-slate-200/90 bg-[#fafcfb] hover:bg-white hover:border-[#c2e7db] transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{department.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                          {department.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Type: {department.type || 'Clinical'}
                      </p>
                    </div>

                    {allAllowed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>All Allowed</span>
                      </span>
                    )}
                    {noneAllowed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3 h-3" />
                        <span>Blocked</span>
                      </span>
                    )}
                    {partial && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <span>Partial ({allowedCount}/{totalCount})</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
                    <span className="text-slate-500">
                      <strong>{allowedCount}</strong> of <strong>{totalCount}</strong> services allowed
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isToggling || totalCount === 0 || allAllowed}
                        onClick={() => handleToggleDepartment(department.id, department.name, true)}
                        className="px-2 py-1 rounded text-[11px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                      >
                        {isToggling ? '...' : 'Allow All'}
                      </button>
                      <button
                        type="button"
                        disabled={isToggling || totalCount === 0 || noneAllowed}
                        onClick={() => handleToggleDepartment(department.id, department.name, false)}
                        className="px-2 py-1 rounded text-[11px] font-bold border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                      >
                        {isToggling ? '...' : 'Block All'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. Single Service Discount Management (Single Par) ────────── */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#e2eae5] gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111827]">
                Single Service Discount Controls (Single Par)
              </h3>
              <p className="text-[11px] text-[#52665e]">
                Search and toggle discount permissions for any individual service or procedure in real-time.
              </p>
            </div>
          </div>

          {selectedServiceIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-semibold">
                {selectedServiceIds.length} selected:
              </span>
              <button
                type="button"
                disabled={isBulkProcessing}
                onClick={() => handleBulkToggleSelected(true)}
                className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold cursor-pointer transition-colors"
              >
                Enable Selected
              </button>
              <button
                type="button"
                disabled={isBulkProcessing}
                onClick={() => handleBulkToggleSelected(false)}
                className="px-2.5 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-bold cursor-pointer transition-colors"
              >
                Disable Selected
              </button>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search service name, code, or department..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-[#08775A] focus:border-[#08775A]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ALLOWED">Discount Allowed Only</option>
              <option value="BLOCKED">Discount Blocked Only</option>
            </select>

            <button
              type="button"
              onClick={loadCatalogData}
              title="Refresh Catalog"
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Single Services Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      className="cursor-pointer text-slate-500 hover:text-slate-800"
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#08775A]" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Service Code</th>
                  <th className="py-2.5 px-3">Service Name</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-right">Standard Rate</th>
                  <th className="py-2.5 px-3 text-center">Discount Allowed</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingCatalog ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#08775A]" />
                        <span>Loading services...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No matching services found.
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((service) => {
                    const isSelected = selectedServiceIds.includes(service.id);
                    const isToggling = togglingServiceId === service.id;
                    return (
                      <tr
                        key={service.id}
                        className={`hover:bg-[#f6faf8] transition-colors ${
                          isSelected ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(service.id)}
                            className="cursor-pointer text-slate-500 hover:text-slate-800"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#08775A]" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                          {service.code}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900">{service.name}</span>
                          {service.category && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {service.category}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {service.departmentName || 'General Hospital'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          Rs. {service.standardRate.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {service.discountAllowed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Allowed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" />
                              <span>Blocked</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleSingleService(service)}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                              service.discountAllowed
                                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {isToggling ? '...' : service.discountAllowed ? 'Block Discount' : 'Allow Discount'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Showing <strong>{filteredServices.length}</strong> of <strong>{services.length}</strong> services
            </span>
            <span>
              Tip: Toggling any service updates its discount eligibility immediately in Walk-In and IPD billing.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
