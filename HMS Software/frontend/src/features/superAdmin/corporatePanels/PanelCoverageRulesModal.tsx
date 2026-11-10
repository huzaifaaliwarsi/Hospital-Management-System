import React, { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Stethoscope,
  Globe,
  ShieldCheck,
  History,
  Calendar,
  Layers,
  FileText,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Modal } from "../../../components/common/Modal";
import { TextInput, Select } from "../../../components/forms/FormControls";
import {
  CorporatePanel,
  PanelDiscountRule,
  PanelRuleHistory,
  fetchPanelRuleHistory,
  replaceDiscountRules,
} from "../../../services/panelService";
import { fetchServices } from "../../../services/serviceRatesService";
import { fetchDepartments } from "../../../services/departmentService";
import { HospitalService } from "../../../types/serviceRates";
import { Department } from "../../../types/department";
import { toErrorMessage } from "../../../utils/apiErrors";
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from "../../../utils/formatters";

type RuleRow = Omit<PanelDiscountRule, "scope"> & {
  key: string;
  scope: "GLOBAL" | "DEPARTMENT" | "SERVICE" | "MULTIPLE_SERVICES";
  serviceRateIds?: string[];
};

const scopes = [
  { value: "GLOBAL", label: "Overall / Global Fallback (All Services)" },
  { value: "DEPARTMENT", label: "Department Level (Hospital Dept, PICU, Pharmacy)" },
  { value: "SERVICE", label: "Specific Service / Procedure (Single)" },
  { value: "MULTIPLE_SERVICES", label: "Multiple Services / Procedures (Bulk Selection)" },
];

function MultiServiceSelector({
  services,
  departments,
  selectedIds,
  onChange,
}: {
  services: HospitalService[];
  departments: Department[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [filterText, setFilterText] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const activeServices = services.filter(
    (s) => s.status === "Active" || selectedIds.includes(s.id),
  );

  const filtered = activeServices.filter((s) => {
    const matchesText =
      !filterText.trim() ||
      s.name.toLowerCase().includes(filterText.toLowerCase()) ||
      s.code.toLowerCase().includes(filterText.toLowerCase());
    const matchesDept = !deptFilter || s.departmentId === deptFilter;
    return matchesText && matchesDept;
  });

  const toggleService = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAllFiltered = () => {
    const newIds = Array.from(new Set([...selectedIds, ...filtered.map((f) => f.id)]));
    onChange(newIds);
  };

  const deselectAllFiltered = () => {
    const filteredIdSet = new Set(filtered.map((f) => f.id));
    onChange(selectedIds.filter((id) => !filteredIdSet.has(id)));
  };

  const selectedObjects = activeServices.filter((s) => selectedIds.includes(s.id));

  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 space-y-2.5 mt-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <Layers size={14} className="text-[#08775A]" />
          <span>Select Multiple Services Covered Under This Rule</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            {selectedIds.length} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAllFiltered}
            className="text-[11px] font-semibold text-[#08775A] hover:underline cursor-pointer"
          >
            Select All Filtered ({filtered.length})
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={deselectAllFiltered}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            Clear Selected
          </button>
        </div>
      </div>

      {/* Selected tags */}
      {selectedObjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-slate-200 max-h-24 overflow-y-auto">
          {selectedObjects.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium"
            >
              <span>{s.code} - {s.name}</span>
              <button
                type="button"
                onClick={() => toggleService(s.id)}
                className="hover:text-rose-600 rounded-full p-0.5 cursor-pointer font-bold"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Filter inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search service name or code..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#08775A]"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#08775A]"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Checkbox list */}
      <div className="border border-slate-200 bg-white rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-3 text-center text-xs text-slate-400">
            No services match the filter criteria.
          </div>
        ) : (
          filtered.map((s) => {
            const isChecked = selectedIds.includes(s.id);
            return (
              <label
                key={s.id}
                className={`flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer text-xs transition-colors ${
                  isChecked ? "bg-emerald-50/50" : ""
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleService(s.id)}
                    className="h-3.5 w-3.5 text-[#08775A] rounded border-slate-300 focus:ring-[#08775A] cursor-pointer"
                  />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800">{s.name}</span>
                    <span className="ml-1.5 font-mono text-[10.5px] text-slate-500">({s.code})</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 shrink-0 font-mono">
                  Rs. {Number(s.standardRate ?? (s as any).price ?? 0).toLocaleString()}
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

const coverageTypes = [
  { value: "FULL", label: "Full Coverage (100% Panel Pays)" },
  { value: "PERCENTAGE", label: "Percentage Split (% Panel Pays)" },
  { value: "FIXED_PATIENT_SHARE", label: "Fixed Co-Pay (Patient Pays PKR)" },
  { value: "NOT_COVERED", label: "Not Covered (Patient Pays 100%)" },
];

const getRuleCoverageTypes = (currentVal?: string) => {
  if (currentVal === "LEGACY_DISCOUNT") {
    return [
      ...coverageTypes,
      { value: "LEGACY_DISCOUNT", label: "Legacy hospital discount (read-only)" },
    ];
  }
  return coverageTypes;
};

export function PanelCoverageRulesModal({
  panel,
  onClose,
  onSaved,
}: {
  panel: CorporatePanel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<RuleRow[]>(() =>
    panel.discountRules.map((r) => ({
      ...r,
      key: r.id,
      scope: (r.scope as any) || "GLOBAL",
      serviceRateIds: r.serviceRateId ? [r.serviceRateId] : [],
    })),
  );
  const [services, setServices] = useState<HospitalService[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState<PanelRuleHistory[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setError("");
    try {
      setHistory(await fetchPanelRuleHistory(panel.id));
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    Promise.all([fetchServices(), fetchDepartments()])
      .then(([s, d]) => {
        if (!cancelled) {
          setServices(s);
          setDepartments(d);
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(toErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);

  const update = (key: string, patch: Partial<RuleRow>) =>
    setRows((current) =>
      current.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  const add = () =>
    setRows((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        id: "",
        scope: "GLOBAL",
        serviceRateId: null,
        serviceRateIds: [],
        departmentId: null,
        coverageType: "FULL",
        discountPercent: 0,
        isActive: true,
        effectiveFrom: new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Karachi",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
      },
    ]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (
      rows.some(
        (r) =>
          !r.effectiveFrom ||
          (r.scope === "SERVICE" && !r.serviceRateId) ||
          (r.scope === "MULTIPLE_SERVICES" && (!r.serviceRateIds || r.serviceRateIds.length === 0)) ||
          (r.scope === "DEPARTMENT" && !r.departmentId),
      )
    ) {
      setError("Each rule needs its target (department, single service, or multiple services) and effective start date.");
      return;
    }
    if (
      rows.some(
        (r) =>
          (r.coverageType === "PERCENTAGE" && r.coveragePercent == null) ||
          (r.coverageType === "FIXED_PATIENT_SHARE" &&
            r.fixedPatientShare == null),
      )
    ) {
      setError(
        "Enter the coverage percentage or fixed patient share for each applicable rule.",
      );
      return;
    }
    setSaving(true);
    try {
      const rulesToSave: any[] = [];
      for (const r of rows) {
        const baseRule = {
          coverageType: r.coverageType,
          discountPercent:
            r.coverageType === "LEGACY_DISCOUNT" ? r.discountPercent : 0,
          coveragePercent:
            r.coverageType === "PERCENTAGE" ? r.coveragePercent : undefined,
          fixedPatientShare:
            r.coverageType === "FIXED_PATIENT_SHARE"
              ? r.fixedPatientShare
              : undefined,
          contractRate:
            (r.scope === "SERVICE" || r.scope === "MULTIPLE_SERVICES") && r.coverageType !== "LEGACY_DISCOUNT"
              ? r.contractRate
              : undefined,
          capAmount: r.capAmount,
          preauthorizationRequired: r.preauthorizationRequired,
          notes: r.notes,
          isActive: r.isActive,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo || undefined,
        };

        if (r.scope === "MULTIPLE_SERVICES" && r.serviceRateIds && r.serviceRateIds.length > 0) {
          for (const sId of r.serviceRateIds) {
            rulesToSave.push({
              ...baseRule,
              scope: "SERVICE",
              serviceRateId: sId,
              departmentId: null,
            });
          }
        } else {
          rulesToSave.push({
            ...baseRule,
            scope: r.scope === "MULTIPLE_SERVICES" ? "SERVICE" : r.scope,
            serviceRateId: r.scope === "SERVICE" ? r.serviceRateId : null,
            departmentId: r.scope === "DEPARTMENT" ? r.departmentId : null,
          });
        }
      }

      await replaceDiscountRules(panel.id, rulesToSave);
      onSaved();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!saving) onClose();
      }}
      title={
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#08775A] border border-emerald-200 flex items-center justify-center shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <div className="text-base font-bold text-slate-800 flex items-center gap-2">
              Coverage & Tariffs
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                {panel.code}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Organization: <span className="font-semibold text-slate-700">{panel.name}</span>
            </div>
          </div>
        </div>
      }
      maxWidth="4xl"
      closeOnBackdropClick={false}
    >
      <form onSubmit={save} className="space-y-5">
        {/* Top Info Banner */}
        <div className="bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 border border-emerald-200/80 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-[#08775A] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-bold text-slate-900">Priority Evaluation:</span> Specific{" "}
              <strong>Service rules</strong> take precedence over <strong>Department rules</strong>, followed by{" "}
              <strong>Global fallback</strong>. If no rule matches, standard patient rates apply. Saved changes apply
              immediately to future charges without modifying finalized bills.
            </div>
          </div>
          <button
            type="button"
            disabled={historyLoading}
            onClick={() => (history ? setHistory(null) : void loadHistory())}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <History size={14} className="text-[#08775A]" />
            {historyLoading
              ? "Loading..."
              : history
                ? "Hide History"
                : "View Saved History"}
          </button>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
            <Loader2 size={16} className="animate-spin text-[#08775A]" />
            <span>Loading services and department directory...</span>
          </div>
        )}

        {loadError && (
          <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="font-bold underline hover:text-rose-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Saved Rule History Drawer */}
        {history && (
          <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Audit Trail (Latest 500 Saved Rules)
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Unsaved edits not shown
              </span>
            </div>
            <div className="overflow-auto max-h-56">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/70 text-slate-600 uppercase text-[10px] tracking-wider font-semibold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Scope & Target</th>
                    <th className="p-2.5">Coverage / Tariff</th>
                    <th className="p-2.5">Effective Dates</th>
                    <th className="p-2.5">Created By</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-2.5 font-medium text-slate-800">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold mr-1.5">
                          {h.scope}
                        </span>
                        {h.targetName}
                      </td>
                      <td className="p-2.5 text-slate-700">
                        <span className="font-semibold">
                          {coverageTypes.find((t) => t.value === h.coverageType)?.label || h.coverageType}
                        </span>
                        {h.coverageType === "PERCENTAGE" && ` (${h.coveragePercent}%)`}
                        {h.coverageType === "FIXED_PATIENT_SHARE" && ` (Rs. ${h.fixedPatientShare})`}
                        {h.contractRate != null && (
                          <span className="block text-[11px] text-emerald-700 font-medium">
                            Tariff: Rs. {h.contractRate.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-600 whitespace-nowrap">
                        {formatDateDDMMYYYY(h.effectiveFrom)} →{" "}
                        {h.effectiveTo ? formatDateDDMMYYYY(h.effectiveTo) : "Open-ended"}
                      </td>
                      <td className="p-2.5 text-slate-600">
                        <div className="font-medium text-slate-700">{h.createdByLabel}</div>
                        <div className="text-[10px] text-slate-400">{formatDateTimeDDMMYYYY(h.createdAt)}</div>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            h.archivedAt
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : h.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {h.archivedAt ? "Archived" : h.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 && (
                <p className="p-4 text-center text-xs text-slate-500">No saved rule history found for this panel.</p>
              )}
            </div>
          </div>
        )}

        {/* Rule Cards List */}
        <fieldset
          disabled={loading || saving || !!loadError}
          className="space-y-4"
        >
          {rows.length === 0 && (
            <div className="p-8 text-center bg-slate-50/80 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
              <Layers className="mx-auto text-slate-400" size={32} />
              <div className="text-sm font-bold text-slate-700">No coverage rules configured</div>
              <div className="text-xs text-slate-500 max-w-md mx-auto">
                Without rules, all services will be 100% payable by the patient. Add a rule below to specify panel coverage.
              </div>
            </div>
          )}

          {rows.map((r, i) => {
            const isDepartment = r.scope === "DEPARTMENT";
            const isService = r.scope === "SERVICE";
            const isMultipleServices = r.scope === "MULTIPLE_SERVICES";
            const isGlobal = r.scope === "GLOBAL";

            return (
              <section
                key={r.key}
                aria-label={`Coverage rule ${i + 1}`}
                className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
              >
                {/* Rule Header Bar */}
                <div className="bg-gradient-to-r from-slate-50/90 to-slate-100/60 px-4 py-3 border-b border-slate-200/70 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#08775A] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      #{i + 1}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                      Rule {i + 1}
                    </h3>

                    {/* Scope Badge */}
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                        isDepartment
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : isService
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : isMultipleServices
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {isDepartment && <Building2 size={12} />}
                      {isService && <Stethoscope size={12} />}
                      {isMultipleServices && <Layers size={12} />}
                      {isGlobal && <Globe size={12} />}
                      {isDepartment
                        ? "Department Level"
                        : isService
                          ? "Specific Service"
                          : isMultipleServices
                            ? `Multiple Services (${r.serviceRateIds?.length || 0})`
                            : "Overall / Global"}
                    </span>

                    {/* Coverage Badge */}
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                        r.coverageType === "FULL"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : r.coverageType === "PERCENTAGE"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : r.coverageType === "FIXED_PATIENT_SHARE"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {r.coverageType === "FULL" && (
                        <>
                          <CheckCircle2 size={12} />
                          100% Full Panel Coverage
                        </>
                      )}
                      {r.coverageType === "PERCENTAGE" && `${r.coveragePercent ?? 0}% Panel Pays`}
                      {r.coverageType === "FIXED_PATIENT_SHARE" && `Rs. ${r.fixedPatientShare ?? 0} Patient Co-Pay`}
                      {r.coverageType === "NOT_COVERED" && "Not Covered (Patient 100%)"}
                    </span>

                    {/* Preauthorization Required Pill */}
                    {r.preauthorizationRequired && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <ShieldCheck size={12} />
                        Pre-Auth Req.
                      </span>
                    )}

                    {!r.isActive && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    aria-label={`Remove rule ${i + 1}`}
                    onClick={() =>
                      setRows((all) => all.filter((x) => x.key !== r.key))
                    }
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Delete rule"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Row 1: Scope & Target Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      id={`${r.key}-scope`}
                      label="Rule Scope *"
                      options={scopes}
                      value={r.scope}
                      onChange={(e) =>
                        update(r.key, {
                          scope: e.target.value as RuleRow["scope"],
                          serviceRateId: null,
                          serviceRateIds: [],
                          departmentId: null,
                          contractRate: undefined,
                        })
                      }
                    />

                    {isDepartment && (
                      <Select
                        id={`${r.key}-department`}
                        label="Department *"
                        value={r.departmentId ?? ""}
                        options={[
                          { value: "", label: "-- Select Department --" },
                          ...departments
                            .filter(
                              (d) =>
                                d.status === "Active" || d.id === r.departmentId,
                            )
                            .map((d) => ({
                              value: d.id,
                              label: `${d.name}${d.status !== "Active" ? " (inactive)" : ""}`,
                            })),
                        ]}
                        onChange={(e) =>
                          update(r.key, { departmentId: e.target.value || null })
                        }
                      />
                    )}

                    {isService && (
                      <Select
                        id={`${r.key}-service`}
                        label="Specific Service *"
                        value={r.serviceRateId ?? ""}
                        options={[
                          { value: "", label: "-- Select Specific Service --" },
                          ...services
                            .filter(
                              (s) =>
                                s.status === "Active" || s.id === r.serviceRateId,
                            )
                            .map((s) => ({
                              value: s.id,
                              label: `${s.code} - ${s.name}${s.status !== "Active" ? " (inactive)" : ""}`,
                            })),
                        ]}
                        onChange={(e) =>
                          update(r.key, { serviceRateId: e.target.value || null })
                        }
                      />
                    )}

                    {isMultipleServices && (
                      <div className="flex flex-col justify-center">
                        <label className="text-xs font-semibold text-slate-700 mb-1 opacity-0 pointer-events-none">
                          Target
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-900 font-medium">
                          <Layers size={15} className="text-indigo-600 shrink-0" />
                          <span>Bulk selection: select all services covered under this rule below.</span>
                        </div>
                      </div>
                    )}

                    {isGlobal && (
                      <div className="flex flex-col justify-center">
                        <label className="text-xs font-semibold text-slate-700 mb-1 opacity-0 pointer-events-none">
                          Target
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                          <Globe size={15} className="text-amber-600 shrink-0" />
                          <span>Fallback rule applied across all hospital services when no specific rule matches.</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Multiple Services Selector component */}
                  {isMultipleServices && (
                    <MultiServiceSelector
                      services={services}
                      departments={departments}
                      selectedIds={r.serviceRateIds || []}
                      onChange={(ids) => update(r.key, { serviceRateIds: ids })}
                    />
                  )}

                  {/* Row 2: Coverage Type & Coverage Specification */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      id={`${r.key}-type`}
                      label="Coverage Type *"
                      options={getRuleCoverageTypes(r.coverageType)}
                      value={r.coverageType}
                      onChange={(e) =>
                        update(r.key, {
                          coverageType: e.target.value as RuleRow["coverageType"],
                          coveragePercent: undefined,
                          fixedPatientShare: undefined,
                          discountPercent: 0,
                          contractRate: undefined,
                          capAmount: undefined,
                        })
                      }
                    />

                    {r.coverageType === "FULL" && (
                      <div className="flex flex-col justify-center">
                        <label className="text-xs font-semibold text-slate-700 mb-1 opacity-0 pointer-events-none">
                          Coverage Specification
                        </label>
                        <div className="flex items-center gap-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span><strong>100% Full Coverage:</strong> Company covers total charge. Patient pays PKR 0.</span>
                        </div>
                      </div>
                    )}

                    {r.coverageType === "PERCENTAGE" && (
                      <TextInput
                        id={`${r.key}-percentage`}
                        label="Panel Coverage % *"
                        placeholder="e.g. 80 (Company pays 80%, patient pays 20%)"
                        hint="Percentage of total bill paid by panel. Remainder is patient co-pay."
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={r.coveragePercent ?? ""}
                        onChange={(e) =>
                          update(r.key, {
                            coveragePercent:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    )}

                    {r.coverageType === "FIXED_PATIENT_SHARE" && (
                      <TextInput
                        id={`${r.key}-copay`}
                        label="Patient Fixed Co-Pay (PKR) *"
                        placeholder="e.g. 500 (Patient pays Rs. 500 fixed at desk)"
                        hint="Fixed amount paid by patient per service. Panel covers remaining balance."
                        type="number"
                        min={0}
                        step="0.01"
                        value={r.fixedPatientShare ?? ""}
                        onChange={(e) =>
                          update(r.key, {
                            fixedPatientShare:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    )}

                    {r.coverageType === "NOT_COVERED" && (
                      <div className="flex flex-col justify-center">
                        <label className="text-xs font-semibold text-slate-700 mb-1 opacity-0 pointer-events-none">
                          Coverage Specification
                        </label>
                        <div className="flex items-center gap-2 p-2.5 bg-rose-50/70 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                          <AlertCircle size={16} className="text-rose-600 shrink-0" />
                          <span><strong>Not Covered:</strong> Company pays 0%. Patient pays 100% of standard tariff.</span>
                        </div>
                      </div>
                    )}

                    {r.coverageType === "LEGACY_DISCOUNT" && (
                      <TextInput
                        id={`${r.key}-discount`}
                        label="Hospital Discount %"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={r.discountPercent}
                        onChange={(e) =>
                          update(r.key, { discountPercent: Number(e.target.value) })
                        }
                      />
                    )}
                  </div>

                  {/* Row 3: Negotiated Tariff & Max Cap Limit */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(isService || isMultipleServices) && r.coverageType !== "LEGACY_DISCOUNT" ? (
                      <TextInput
                        id={`${r.key}-tariff`}
                        label="Agreed Corporate Tariff / Rate (PKR, optional)"
                        placeholder="e.g. 1500 (Special negotiated price per item)"
                        hint="Custom negotiated rate for this panel. Leave empty to use standard hospital rate."
                        type="number"
                        min={0}
                        step="0.01"
                        value={r.contractRate ?? ""}
                        onChange={(e) =>
                          update(r.key, {
                            contractRate:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      <div>
                        {["FULL", "PERCENTAGE", "FIXED_PATIENT_SHARE"].includes(
                          r.coverageType ?? "",
                        ) ? (
                          <TextInput
                            id={`${r.key}-cap`}
                            label="Max Panel Coverage Limit / Cap (PKR, optional)"
                            placeholder="e.g. 5000 (Maximum amount panel will pay per item)"
                            hint="Upper ceiling panel will pay. Any amount exceeding this cap is paid by patient."
                            type="number"
                            min={0}
                            step="0.01"
                            value={r.capAmount ?? ""}
                            onChange={(e) =>
                              update(r.key, {
                                capAmount:
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                              })
                            }
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-2">
                            <FileText size={15} className="text-slate-400 shrink-0" />
                            <span>No financial cap required for excluded services.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isService &&
                      r.coverageType !== "LEGACY_DISCOUNT" &&
                      ["FULL", "PERCENTAGE", "FIXED_PATIENT_SHARE"].includes(
                        r.coverageType ?? "",
                      ) && (
                        <TextInput
                          id={`${r.key}-cap`}
                          label="Max Panel Coverage Limit / Cap (PKR, optional)"
                          placeholder="e.g. 5000 (Maximum amount panel will pay per item)"
                          hint="Upper ceiling panel will pay. Any amount exceeding this cap is paid by patient."
                          type="number"
                          min={0}
                          step="0.01"
                          value={r.capAmount ?? ""}
                          onChange={(e) =>
                            update(r.key, {
                              capAmount:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                        />
                      )}
                  </div>

                  {/* Row 4: Validity Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      id={`${r.key}-from`}
                      label="Effective From (Start Date) *"
                      placeholder="DD/MM/YYYY"
                      type="date"
                      value={r.effectiveFrom}
                      onChange={(e) =>
                        update(r.key, { effectiveFrom: e.target.value })
                      }
                      hint={
                        r.effectiveFrom
                          ? `Active from: ${formatDateDDMMYYYY(r.effectiveFrom)}`
                          : undefined
                      }
                    />

                    <TextInput
                      id={`${r.key}-to`}
                      label="Effective To (End Date, optional)"
                      placeholder="DD/MM/YYYY"
                      type="date"
                      min={r.effectiveFrom}
                      value={r.effectiveTo ?? ""}
                      onChange={(e) =>
                        update(r.key, {
                          effectiveTo: e.target.value || undefined,
                        })
                      }
                      hint={
                        r.effectiveTo
                          ? `Expires on: ${formatDateDDMMYYYY(r.effectiveTo)}`
                          : "Open-ended (no expiry date)"
                      }
                    />
                  </div>

                  {/* Row 5: Notes */}
                  <div>
                    <TextInput
                      id={`${r.key}-notes`}
                      label="Contract / Policy Notes (Optional)"
                      placeholder="e.g. Valid only for regular OPD consultations or executive cadre"
                      value={r.notes ?? ""}
                      onChange={(e) => update(r.key, { notes: e.target.value })}
                    />
                  </div>
                </div>

                {/* Card Footer Bar */}
                <div className="bg-slate-50/70 px-4 sm:px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-[#08775A] focus:ring-[#08775A] border-slate-300 cursor-pointer"
                        checked={r.isActive !== false}
                        onChange={(e) =>
                          update(r.key, { isActive: e.target.checked })
                        }
                      />
                      <span>Active Rule</span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-[#08775A] focus:ring-[#08775A] border-slate-300 cursor-pointer"
                        checked={!!r.preauthorizationRequired}
                        onChange={(e) =>
                          update(r.key, {
                            preauthorizationRequired: e.target.checked,
                          })
                        }
                      />
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-amber-600" />
                        Prior Authorization Required (Requires approval letter from corporate)
                      </span>
                    </label>
                  </div>
                </div>
              </section>
            );
          })}

          {/* Add Another Coverage Rule Button */}
          <button
            type="button"
            onClick={add}
            className="w-full py-3.5 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/70 text-[#08775A] rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <Plus size={16} />
            <span>Add Another Coverage Rule</span>
          </button>
        </fieldset>

        {/* Modal Bottom Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="text-xs text-slate-500 font-medium">
            {rows.length} coverage rule{rows.length === 1 ? "" : "s"} configured
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading || !!loadError}
              className="px-5 py-2 bg-[#08775A] hover:bg-[#065f46] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving Rules...</span>
                </>
              ) : (
                <span>Save Coverage Rules</span>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
