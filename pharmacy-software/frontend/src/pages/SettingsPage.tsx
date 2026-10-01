import React, { useEffect, useState } from 'react';
import {
  Loader2,
  Save,
  Percent,
  Scissors,
  CalendarClock,
  ShieldCheck,
  ShieldAlert,
  Printer,
} from 'lucide-react';
import { pharmacyApi, PharmacySettings } from '../services/pharmacyApi';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';

type FormState = {
  highValueApprovalEnabled: boolean;
  highValueThreshold: string;
  defaultTaxPercent: string;
  maxDiscountPercent: string;
  nearExpiryWindowDays: string;
  receiptHeaderText: string;
  receiptFooterText: string;
};

function toForm(s: PharmacySettings): FormState {
  return {
    highValueApprovalEnabled: s.highValueApprovalEnabled,
    highValueThreshold: String(s.highValueThreshold),
    defaultTaxPercent: String(s.defaultTaxPercent),
    maxDiscountPercent: String(s.maxDiscountPercent),
    nearExpiryWindowDays: String(s.nearExpiryWindowDays),
    receiptHeaderText: s.receiptHeaderText ?? '',
    receiptFooterText: s.receiptFooterText ?? '',
  };
}

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<PharmacySettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    pharmacyApi
      .getPharmacySettings()
      .then((s) => {
        setSettings(s);
        setForm(toForm(s));
      })
      .catch(() => toast.error('Failed to load pharmacy settings.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const updated = await pharmacyApi.updatePharmacySettings({
        highValueApprovalEnabled: form.highValueApprovalEnabled,
        highValueThreshold: Number(form.highValueThreshold) || 0,
        defaultTaxPercent: Number(form.defaultTaxPercent) || 0,
        maxDiscountPercent: Number(form.maxDiscountPercent) || 0,
        nearExpiryWindowDays: Number(form.nearExpiryWindowDays) || 90,
        receiptHeaderText: form.receiptHeaderText || undefined,
        receiptFooterText: form.receiptFooterText || undefined,
      });
      setSettings(updated);
      setForm(toForm(updated));
      toast.success('Pharmacy settings saved.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form || !settings) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#0e7d5a]" />
        <p className="text-sm font-medium">Loading pharmacy settings…</p>
      </div>
    );
  }

  const kpis: KpiItem[] = [
    { label: 'Default Tax', value: `${form.defaultTaxPercent}%`, icon: Percent, subtitle: 'Applied to new medicines', tone: 'info' },
    {
      label: 'Discount Cap',
      value: Number(form.maxDiscountPercent) > 0 ? `${form.maxDiscountPercent}%` : 'No Cap',
      icon: Scissors,
      subtitle: 'Max POS discount allowed',
      tone: Number(form.maxDiscountPercent) > 0 ? 'default' : 'warning',
    },
    { label: 'Near-Expiry Window', value: `${form.nearExpiryWindowDays}d`, icon: CalendarClock, subtitle: 'Flags batches expiring soon', tone: 'default' },
    {
      label: 'High-Value Approval',
      value: form.highValueApprovalEnabled ? 'Enabled' : 'Disabled',
      icon: form.highValueApprovalEnabled ? ShieldCheck : ShieldAlert,
      subtitle: form.highValueApprovalEnabled ? `Threshold PKR ${form.highValueThreshold}` : 'No gate on HMS dispense',
      tone: form.highValueApprovalEnabled ? 'success' : 'warning',
    },
  ];

  return (
    <div className="p-5 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Pharmacy Settings</h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Management Policy
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Tax/discount defaults, stock & expiry window, high-value approval and receipt print — configured here, never hardcoded.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* KPI Summary */}
      <PharmacyKpiHeader items={kpis} />

      <form onSubmit={handleSave} className="space-y-5">
        {/* Tax & Discount */}
        <SettingsCard icon={Percent} iconTone="blue" title="Tax & Discount Policy" hint="Controls what new medicines default to, and the ceiling POS sales can discount up to.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Default Tax % (new medicines)" hint="Pre-fills new Medicine Master entries when left blank.">
              <input type="number" min={0} max={100} step="0.01" value={form.defaultTaxPercent} onChange={(e) => setForm({ ...form, defaultTaxPercent: e.target.value })} className="input" />
            </Field>
            <Field label="Max Discount % (POS cap)" hint="0 = no cap. Blocks a sale whose total discount exceeds this percent of subtotal.">
              <input type="number" min={0} max={100} step="0.01" value={form.maxDiscountPercent} onChange={(e) => setForm({ ...form, maxDiscountPercent: e.target.value })} className="input" />
            </Field>
          </div>
        </SettingsCard>

        {/* Stock & Expiry */}
        <SettingsCard icon={CalendarClock} iconTone="emerald" title="Stock & Expiry Policy" hint="Drives the 'Near Expiry' flag used across Dashboard, Medicine Stock and Batch screens.">
          <Field label="Near-Expiry Window (days)" hint="Batches expiring within this many days are flagged 'Near Expiry'.">
            <input type="number" min={1} max={3650} value={form.nearExpiryWindowDays} onChange={(e) => setForm({ ...form, nearExpiryWindowDays: e.target.value })} className="input max-w-[12rem]" />
          </Field>
        </SettingsCard>

        {/* High-Value Approval */}
        <SettingsCard icon={ShieldCheck} iconTone="amber" title="High-Value Medicine Approval" hint="Also editable from HMS Requests → High-Value Settings; both write the same policy row.">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none mb-4">
            <input type="checkbox" checked={form.highValueApprovalEnabled} onChange={(e) => setForm({ ...form, highValueApprovalEnabled: e.target.checked })} className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4" />
            Require approval before dispensing high-value HMS requests
          </label>
          <Field label="Threshold (PKR)" hint="Request/invoice total at or above this amount needs approval before dispense.">
            <input type="number" min={0} step="0.01" disabled={!form.highValueApprovalEnabled} value={form.highValueThreshold} onChange={(e) => setForm({ ...form, highValueThreshold: e.target.value })} className="input max-w-[14rem] disabled:opacity-50 disabled:bg-slate-50" />
          </Field>
        </SettingsCard>

        {/* Receipt */}
        <SettingsCard icon={Printer} iconTone="sky" title="Receipt / Invoice Print" hint="Printed at the top and bottom of POS and HMS pharmacy invoices.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Receipt Header Text">
              <input maxLength={200} value={form.receiptHeaderText} onChange={(e) => setForm({ ...form, receiptHeaderText: e.target.value })} className="input" placeholder="e.g. CH Sharif & Saeed Hospital — Pharmacy" />
            </Field>
            <Field label="Receipt Footer Text">
              <input maxLength={200} value={form.receiptFooterText} onChange={(e) => setForm({ ...form, receiptFooterText: e.target.value })} className="input" placeholder="e.g. Thank you — medicines once dispensed are non-returnable." />
            </Field>
          </div>
        </SettingsCard>

        <div className="flex items-center justify-between pt-1 pb-4">
          <p className="text-[11px] text-slate-400">Last updated {new Date(settings.updatedAt).toLocaleString('en-GB')}</p>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-60 transition-colors cursor-pointer">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
      <style>{`.input { width: 100%; height: 2.25rem; padding: 0 0.75rem; font-size: 0.75rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; color: #0f172a; } .input:focus { outline: none; box-shadow: 0 0 0 1px #08775A; border-color: #08775A; }`}</style>
    </div>
  );
};

const toneClasses: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
};

const SettingsCard: React.FC<{ icon: React.ElementType; iconTone: keyof typeof toneClasses; title: string; hint?: string; children: React.ReactNode }> = ({
  icon: Icon,
  iconTone,
  title,
  hint,
  children,
}) => (
  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
    <div className="flex items-start gap-3 pb-4 border-b border-slate-100 mb-4">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${toneClasses[iconTone]}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
    </div>
    {children}
  </div>
);

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
  </div>
);
