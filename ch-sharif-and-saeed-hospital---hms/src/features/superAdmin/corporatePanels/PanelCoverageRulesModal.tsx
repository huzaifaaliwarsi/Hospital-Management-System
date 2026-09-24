import React, { useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
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

type RuleRow = PanelDiscountRule & { key: string };
const scopes = [
  { value: "DEPARTMENT", label: "Department (e.g. OPD, ER, Lab, Radiology)" },
  { value: "SERVICE", label: "Specific Service (e.g. CBC, Ultrasound, Consultation)" },
  { value: "GLOBAL", label: "Global (All Hospital Services)" },
];

const coverageTypes = [
  { value: "FULL", label: "Full Coverage (100% Panel Pays)" },
  { value: "PERCENTAGE", label: "Percentage Coverage (% Panel Pays)" },
  { value: "FIXED_PATIENT_SHARE", label: "Fixed Patient Share (Patient Pays Fixed PKR)" },
  { value: "NOT_COVERED", label: "Not Covered (0% Panel, Patient Pays All)" },
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
    panel.discountRules.map((r) => ({ ...r, key: r.id })),
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
        scope: "DEPARTMENT",
        serviceRateId: null,
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
          (r.scope === "DEPARTMENT" && !r.departmentId),
      )
    ) {
      setError("Each rule needs its target and effective start date.");
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
      await replaceDiscountRules(
        panel.id,
        rows.map(({ id, key, ...r }) => ({
          ...r,
          serviceRateId: r.scope === "SERVICE" ? r.serviceRateId : null,
          departmentId: r.scope === "DEPARTMENT" ? r.departmentId : null,
          discountPercent:
            r.coverageType === "LEGACY_DISCOUNT" ? r.discountPercent : 0,
          coveragePercent:
            r.coverageType === "PERCENTAGE" ? r.coveragePercent : undefined,
          fixedPatientShare:
            r.coverageType === "FIXED_PATIENT_SHARE"
              ? r.fixedPatientShare
              : undefined,
          contractRate:
            r.scope === "SERVICE" && r.coverageType !== "LEGACY_DISCOUNT"
              ? r.contractRate
              : undefined,
        })),
      );
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
      title={`Coverage & Tariffs - ${panel.name}`}
      maxWidth="xl"
      closeOnBackdropClick={false}
    >
      <form onSubmit={save} className="space-y-4">
        <p className="text-xs text-slate-600">
          Service rules take priority over department rules, then global
          fallback. No match means the patient pays the full eligible amount.
          Saved changes apply to future charges; previous billed amounts remain
          unchanged.
        </p>
        {loading && (
          <p role="status" className="text-sm">
            Loading services and departments...
          </p>
        )}
        {loadError && (
          <div role="alert" className="p-3 bg-rose-50 text-rose-700 text-sm">
            {loadError}{" "}
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="underline"
            >
              Retry
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="p-3 bg-rose-50 text-rose-700 text-sm">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={historyLoading}
          onClick={() => (history ? setHistory(null) : void loadHistory())}
          className="text-xs text-emerald-700 underline"
        >
          {historyLoading
            ? "Loading history..."
            : history
              ? "Hide saved history"
              : "View saved rule history"}
        </button>
        {history && (
          <div className="overflow-auto max-h-64 border rounded-lg">
            <p className="p-2 text-xs text-slate-500">
              Latest 500 saved rule records. Unsaved changes are not included.
            </p>
            <table className="w-full text-xs text-left">
              <thead>
                <tr>
                  <th className="p-2">Target / coverage</th>
                  <th className="p-2">Effective dates</th>
                  <th className="p-2">Saved by / at</th>
                  <th className="p-2">Version</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="p-2">
                      {h.scope}: {h.targetName}
                      <br />
                      {
                        coverageTypes.find((t) => t.value === h.coverageType)
                          ?.label
                      }
                      {h.coverageType === "PERCENTAGE"
                        ? ` (${h.coveragePercent}%)`
                        : h.coverageType === "FIXED_PATIENT_SHARE"
                          ? ` (PKR ${h.fixedPatientShare})`
                          : ""}
                      {h.contractRate != null
                        ? ` / tariff PKR ${h.contractRate}`
                        : ""}
                    </td>
                    <td className="p-2">
                      {formatDateDDMMYYYY(h.effectiveFrom)} - {h.effectiveTo ? formatDateDDMMYYYY(h.effectiveTo) : "Open-ended"}
                    </td>
                    <td className="p-2">
                      {h.createdByLabel}
                      <br />
                      {formatDateTimeDDMMYYYY(h.createdAt)}
                    </td>
                    <td className="p-2">
                      {h.archivedAt
                        ? "Archived"
                        : h.isActive
                          ? "Current / active"
                          : "Current / inactive"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && (
              <p className="p-3 text-sm">No saved rule history.</p>
            )}
          </div>
        )}
        <fieldset
          disabled={loading || saving || !!loadError}
          className="space-y-4"
        >
          {rows.length === 0 && (
            <p className="p-4 bg-slate-50 text-sm">
              No coverage rules. All services are patient payable.
            </p>
          )}
          {rows.map((r, i) => (
            <section
              key={r.key}
              aria-label={`Coverage rule ${i + 1}`}
              className="p-4 border border-slate-200 rounded-xl bg-white shadow-xs space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#effaf5] text-[#08775A] font-bold text-xs flex items-center justify-center border border-[#c2e7db]">
                    {i + 1}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800">
                    Rule {i + 1}
                  </h3>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {r.scope === 'DEPARTMENT' ? 'Department Level' : r.scope === 'SERVICE' ? 'Service Level' : 'Global Fallback'}
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    r.coverageType === 'FULL' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : r.coverageType === 'PERCENTAGE'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : r.coverageType === 'FIXED_PATIENT_SHARE'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {r.coverageType === 'FULL' && '100% Full Panel Coverage'}
                    {r.coverageType === 'PERCENTAGE' && `${r.coveragePercent ?? 0}% Panel Pays`}
                    {r.coverageType === 'FIXED_PATIENT_SHARE' && `Rs. ${r.fixedPatientShare ?? 0} Patient Co-Pay`}
                    {r.coverageType === 'NOT_COVERED' && 'Not Covered (Patient Pays 100%)'}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Remove rule ${i + 1}`}
                  onClick={() =>
                    setRows((all) => all.filter((x) => x.key !== r.key))
                  }
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Delete rule"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Grid Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  id={`${r.key}-scope`}
                  label="Rule Scope *"
                  options={scopes}
                  value={r.scope}
                  onChange={(e) =>
                    update(r.key, {
                      scope: e.target.value as RuleRow["scope"],
                      serviceRateId: null,
                      departmentId: null,
                      contractRate: undefined,
                    })
                  }
                />

                {r.scope === "SERVICE" && (
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

                {r.scope === "DEPARTMENT" && (
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

                {r.scope === "GLOBAL" && (
                  <div className="flex items-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                    Applies as fallback across all hospital services when no specific department or service rule matches.
                  </div>
                )}

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

                {r.coverageType === "PERCENTAGE" && (
                  <TextInput
                    id={`${r.key}-percentage`}
                    label="Panel Coverage % *"
                    placeholder="e.g. 80 (Company pays 80%, patient pays 20%)"
                    hint="Enter percentage of total bill covered by company (0 - 100%)."
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
                    label="Patient Fixed Share / Co-Pay (PKR) *"
                    placeholder="e.g. 500 (Patient pays Rs. 500 fixed at counter)"
                    hint="Fixed PKR amount patient must pay per service. Panel pays the rest."
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

                {r.coverageType === "FULL" && (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>Full Coverage: Company covers 100% of this cost. Patient pays PKR 0.</span>
                  </div>
                )}

                {r.coverageType === "NOT_COVERED" && (
                  <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    <span>Not Covered: Company pays 0%. Patient pays full standard charges.</span>
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

                {r.scope === "SERVICE" && r.coverageType !== "LEGACY_DISCOUNT" && (
                  <TextInput
                    id={`${r.key}-tariff`}
                    label="Agreed Corporate Tariff / Rate (PKR, optional)"
                    placeholder="e.g. 1500 (Special negotiated price for this panel)"
                    hint="Special negotiated rate with panel. Leave empty to use standard hospital rate."
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
                )}

                {["FULL", "PERCENTAGE", "FIXED_PATIENT_SHARE"].includes(
                  r.coverageType ?? "",
                ) && (
                  <TextInput
                    id={`${r.key}-cap`}
                    label="Max Panel Coverage Limit / Cap (PKR, optional)"
                    placeholder="e.g. 5000 (Maximum amount panel will pay per item)"
                    hint="Cap: Maximum amount company will pay. Any amount above this cap is paid by the patient."
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

                <TextInput
                  id={`${r.key}-from`}
                  label="Effective From (Start Date) *"
                  placeholder="DD/MM/YYYY"
                  lang="en-GB"
                  type="date"
                  value={r.effectiveFrom}
                  onChange={(e) =>
                    update(r.key, { effectiveFrom: e.target.value })
                  }
                  hint={r.effectiveFrom ? `Active from: ${formatDateDDMMYYYY(r.effectiveFrom)}` : undefined}
                />

                <TextInput
                  id={`${r.key}-to`}
                  label="Effective To (End Date, optional)"
                  placeholder="DD/MM/YYYY"
                  lang="en-GB"
                  type="date"
                  min={r.effectiveFrom}
                  value={r.effectiveTo ?? ""}
                  onChange={(e) =>
                    update(r.key, { effectiveTo: e.target.value || undefined })
                  }
                  hint={r.effectiveTo ? `Expires on: ${formatDateDDMMYYYY(r.effectiveTo)}` : "Open-ended (no expiry date)"}
                />

                <div className="sm:col-span-2">
                  <TextInput
                    id={`${r.key}-notes`}
                    label="Contract / Policy Notes (Optional)"
                    placeholder="e.g. Valid only for regular OPD consultations or executive cadre"
                    value={r.notes ?? ""}
                    onChange={(e) => update(r.key, { notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100 text-xs">
                <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-[#08775A] focus:ring-[#08775A] border-slate-300"
                    checked={r.isActive !== false}
                    onChange={(e) =>
                      update(r.key, { isActive: e.target.checked })
                    }
                  />
                  <span>Active Rule</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-[#08775A] focus:ring-[#08775A] border-slate-300"
                    checked={!!r.preauthorizationRequired}
                    onChange={(e) =>
                      update(r.key, {
                        preauthorizationRequired: e.target.checked,
                      })
                    }
                  />
                  <span>Prior Authorization Required (Requires approval letter from company)</span>
                </label>
              </div>
            </section>
          ))}
          <button
            type="button"
            onClick={add}
            className="flex gap-2 items-center text-emerald-700 text-sm font-semibold"
          >
            <Plus size={16} /> Add coverage rule
          </button>
        </fieldset>
        <div className="flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="px-4 py-2 border rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading || !!loadError}
            className="px-4 py-2 bg-emerald-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save coverage rules"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
