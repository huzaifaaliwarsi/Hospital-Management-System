import React, { useState, useEffect, useMemo } from 'react';
import { Coins, Plus, Loader2, AlertTriangle, CheckCircle2, AlertCircle, Percent } from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import {
  CommissionRule,
  CommissionRuleFormValues,
  CommissionRuleType,
  CommissionBasis,
  CommissionTaxMethod,
  fetchCommissionRules,
  createCommissionRule,
} from '../../../services/commissionService';
import { StaffUserService } from '../../../services/staffUserService';
import { ServiceRatesService } from '../../../services/serviceRatesService';
import { getHospitalCurrentDate, formatDateISO } from '../../../utils/dateConstants';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput, Select } from '../../../components/forms/FormControls';

const emptyForm = (): CommissionRuleFormValues => ({
  staffId: '',
  serviceRateId: '',
  ruleType: 'PERCENTAGE',
  rate: '',
  basis: 'NET',
  commissionTaxMethod: '',
  commissionTaxValue: '',
  effectiveFrom: formatDateISO(getHospitalCurrentDate()),
});

/**
 * v7.2 Doctor Commission (HMS_V7.2_NEW_REQUIREMENTS.md §2.7) — the backend
 * `/commission/rules` endpoint already existed pre-v7.2 (Fixed/% rules,
 * Gross/Net basis); this is the first real frontend for it, plus the new
 * Commission Tax fields. Each rule is effective-dated — adding a new one
 * for the same doctor/service does not edit history in place.
 */
export const DoctorCommissionView: React.FC = () => {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doctorFilter, setDoctorFilter] = useState<string>('All');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<CommissionRuleFormValues>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const doctors = useMemo(() => StaffUserService.getStaffUsers().filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'), []);
  const services = useMemo(() => ServiceRatesService.getServices().filter((s) => s.status === 'Active'), []);

  const loadRules = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRules(await fetchCommissionRules());
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load doctor commission rules.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const filteredRules = useMemo(() => {
    if (doctorFilter === 'All') return rules;
    return rules.filter((r) => r.staffId === doctorFilter);
  }, [rules, doctorFilter]);

  const handleOpenAdd = () => {
    setFormValues(emptyForm());
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.staffId) {
      setFormError('Select a doctor.');
      return;
    }
    if (formValues.rate === '' || Number(formValues.rate) <= 0) {
      setFormError('Rate must be greater than zero.');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await createCommissionRule(formValues);
      setToast({ message: 'Commission rule saved.', type: 'success' });
      setIsFormOpen(false);
      await loadRules();
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to save commission rule.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading doctor commission rules…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-rose-700 font-medium">{loadError}</p>
        <button type="button" onClick={loadRules} className="px-4 py-2 bg-[#08775A] hover:bg-[#0e7d5a] text-white text-xs font-semibold rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-xs ${
            toast.type === 'success' ? 'bg-[#effaf5] border-[#c2e7db] text-[#08775A]' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-xs font-bold opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">Doctor Commission</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">v7.2</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Fixed/% commission rules per doctor (optionally per service), Gross/Net basis, and Commission Tax — a stream fully
            independent of Salary Tax. Doctor-Sponsored Discounts are deducted from commission payable at billing time.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          disabled={doctors.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#149E75] hover:bg-[#08775A] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0 disabled:opacity-50"
          title={doctors.length === 0 ? 'No active doctors found in Staff Users' : undefined}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Commission Rule</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500">Doctor:</span>
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
        >
          <option value="All">All Doctors</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">Doctor</th>
                <th className="py-2.5 px-4">Service</th>
                <th className="py-2.5 px-4">Rule</th>
                <th className="py-2.5 px-4">Basis</th>
                <th className="py-2.5 px-4">Commission Tax</th>
                <th className="py-2.5 px-4">Effective From</th>
                <th className="py-2.5 px-4">Effective To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRules.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-4 font-bold text-slate-900">{r.doctorName}</td>
                  <td className="py-2.5 px-4">{r.serviceName || <span className="text-slate-400 italic">All Services (default)</span>}</td>
                  <td className="py-2.5 px-4 font-mono font-semibold">
                    {r.ruleType === 'PERCENTAGE' ? `${r.rate}%` : formatPKR(r.rate)}
                  </td>
                  <td className="py-2.5 px-4">{r.basis === 'GROSS' ? 'Gross' : 'Net'}</td>
                  <td className="py-2.5 px-4">
                    {r.commissionTaxMethod ? (
                      <span className="text-amber-700 font-semibold">
                        {r.commissionTaxMethod === 'PERCENTAGE' ? `${r.commissionTaxValue}%` : formatPKR(r.commissionTaxValue || 0)}
                      </span>
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">{r.effectiveFrom}</td>
                  <td className="py-2.5 px-4">{r.effectiveTo || <span className="text-emerald-600 font-semibold">Current</span>}</td>
                </tr>
              ))}

              {filteredRules.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Coins className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <span className="font-semibold text-xs text-slate-700 block">No commission rules configured yet.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Add Doctor Commission Rule" maxWidth="lg">
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">{formError}</div>
          )}
          <Select
            label="Doctor"
            required
            options={doctors.map((d) => ({ label: `${d.fullName} (${d.designation})`, value: d.id }))}
            value={formValues.staffId}
            onChange={(e) => setFormValues({ ...formValues, staffId: e.target.value })}
          />
          <Select
            label="Service (optional — leave blank for this doctor's default rule)"
            options={services.map((s) => ({ label: s.name, value: s.id }))}
            value={formValues.serviceRateId}
            onChange={(e) => setFormValues({ ...formValues, serviceRateId: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Rule Type"
              options={[
                { label: 'Percentage', value: 'PERCENTAGE' },
                { label: 'Fixed Per Service', value: 'FIXED_PER_SERVICE' },
              ]}
              value={formValues.ruleType}
              onChange={(e) => setFormValues({ ...formValues, ruleType: e.target.value as CommissionRuleType })}
            />
            <NumberInput
              label={formValues.ruleType === 'PERCENTAGE' ? 'Rate (%)' : 'Rate (PKR per service)'}
              required
              min={0}
              step={formValues.ruleType === 'PERCENTAGE' ? 0.5 : 50}
              value={formValues.rate}
              onChange={(e) => setFormValues({ ...formValues, rate: e.target.value === '' ? '' : Number(e.target.value) })}
            />
          </div>
          <Select
            label="Commission Basis"
            hint="Gross = before discounts. Net = after discounts."
            options={[
              { label: 'Net (after discount)', value: 'NET' },
              { label: 'Gross', value: 'GROSS' },
            ]}
            value={formValues.basis}
            onChange={(e) => setFormValues({ ...formValues, basis: e.target.value as CommissionBasis })}
          />
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-3 flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5" /> Commission Tax (optional, independent of Salary Tax)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Tax Method"
                options={[
                  { label: 'No Tax', value: '' },
                  { label: 'Percentage', value: 'PERCENTAGE' },
                  { label: 'Fixed Amount', value: 'FIXED' },
                ]}
                value={formValues.commissionTaxMethod}
                onChange={(e) => setFormValues({ ...formValues, commissionTaxMethod: e.target.value as CommissionTaxMethod })}
              />
              <NumberInput
                label={formValues.commissionTaxMethod === 'PERCENTAGE' ? 'Tax Value (%)' : 'Tax Value (PKR)'}
                disabled={!formValues.commissionTaxMethod}
                min={0}
                step={formValues.commissionTaxMethod === 'PERCENTAGE' ? 0.5 : 100}
                value={formValues.commissionTaxValue}
                onChange={(e) => setFormValues({ ...formValues, commissionTaxValue: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
          </div>
          <TextInput
            label="Effective From"
            type="date"
            required
            value={formValues.effectiveFrom}
            onChange={(e) => setFormValues({ ...formValues, effectiveFrom: e.target.value })}
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
              className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save Commission Rule'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
