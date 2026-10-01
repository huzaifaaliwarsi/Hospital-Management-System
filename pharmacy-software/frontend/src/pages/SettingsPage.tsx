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
  RotateCcw,
  Trash2,
  AlertTriangle,
  X,
  Tags,
  Plus,
  Pencil,
  Check,
} from 'lucide-react';
import { pharmacyApi, PharmacySettings, MedicineCategory } from '../services/pharmacyApi';
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

  // Medicine Categories (Add-Medicine-form fix — database-driven Therapeutic Category master)
  const [categories, setCategories] = useState<MedicineCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDescription, setEditCatDescription] = useState('');
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);

  const loadCategories = () => {
    setLoadingCategories(true);
    pharmacyApi
      .listMedicineCategories()
      .then(setCategories)
      .catch(() => toast.error('Failed to load medicine categories.'))
      .finally(() => setLoadingCategories(false));
  };
  useEffect(loadCategories, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toast.error('Category Name is required.');
      return;
    }
    setAddingCategory(true);
    try {
      const created = await pharmacyApi.createMedicineCategory({ name: newCatName.trim(), description: newCatDescription.trim() || undefined });
      setCategories((prev) => [...prev, created].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)));
      setNewCatName('');
      setNewCatDescription('');
      toast.success(`Category "${created.name}" added.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to add category.');
    } finally {
      setAddingCategory(false);
    }
  };

  const handleToggleCategoryActive = async (cat: MedicineCategory) => {
    setSavingCategoryId(cat.id);
    try {
      const updated = await pharmacyApi.updateMedicineCategory(cat.id, { isActive: !cat.isActive });
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(`"${updated.name}" marked ${updated.isActive ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update category.');
    } finally {
      setSavingCategoryId(null);
    }
  };

  const startEditCategory = (cat: MedicineCategory) => {
    setEditingCategoryId(cat.id);
    setEditCatName(cat.name);
    setEditCatDescription(cat.description ?? '');
  };

  const handleSaveEditCategory = async (id: string) => {
    if (!editCatName.trim()) {
      toast.error('Category Name is required.');
      return;
    }
    setSavingCategoryId(id);
    try {
      const updated = await pharmacyApi.updateMedicineCategory(id, { name: editCatName.trim(), description: editCatDescription.trim() || undefined });
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCategoryId(null);
      toast.success(`Category renamed to "${updated.name}".`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update category.');
    } finally {
      setSavingCategoryId(null);
    }
  };

  // Testing Reset state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetScope, setResetScope] = useState<'transactions_only' | 'complete'>('transactions_only');
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleExecuteReset = async () => {
    if (confirmText !== 'RESET') return;
    setResetting(true);
    try {
      const res = await pharmacyApi.resetTestingData({
        scope: resetScope,
        confirmPhrase: 'RESET',
      });
      setShowResetModal(false);
      setConfirmText('');
      toast.success(
        `Reset complete! Cleared ${res.cleared.invoices} sales, ${res.cleared.purchases} purchases, ${res.cleared.batches} batches.`
      );
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to reset pharmacy data.');
    } finally {
      setResetting(false);
    }
  };

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

        {/* Medicine Categories (Add-Medicine-form fix) */}
        <SettingsCard icon={Tags} iconTone="emerald" title="Medicine Categories" hint="Database-driven Therapeutic Category master. Only Active categories appear on the Add/Edit Medicine form; deactivating one never deletes it or breaks medicines already using it.">
          <form onSubmit={handleAddCategory} className="flex flex-wrap items-end gap-2.5 mb-4 pb-4 border-b border-slate-100">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name</label>
              <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Analgesics" className="input" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
              <input value={newCatDescription} onChange={(e) => setNewCatDescription(e.target.value)} placeholder="e.g. Pain relief medicines" className="input" />
            </div>
            <button type="submit" disabled={addingCategory} className="h-9 shrink-0 flex items-center gap-1.5 px-3.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-60 transition-colors cursor-pointer">
              {addingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add Category
            </button>
          </form>

          {loadingCategories ? (
            <div className="flex items-center gap-2 text-slate-400 py-3 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading categories…</div>
          ) : categories.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No categories yet — add one above.</p>
          ) : (
            <div className="space-y-1.5">
              {categories.map((cat) => (
                <div key={cat.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${cat.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/70'}`}>
                  {editingCategoryId === cat.id ? (
                    <>
                      <input value={editCatName} onChange={(e) => setEditCatName(e.target.value)} className="input h-8 flex-1 min-w-[120px]" />
                      <input value={editCatDescription} onChange={(e) => setEditCatDescription(e.target.value)} placeholder="Description" className="input h-8 flex-1 min-w-[160px]" />
                      <button type="button" onClick={() => handleSaveEditCategory(cat.id)} disabled={savingCategoryId === cat.id} className="h-8 w-8 shrink-0 flex items-center justify-center bg-[#08775A] text-white rounded-lg disabled:opacity-60 cursor-pointer">
                        {savingCategoryId === cat.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button type="button" onClick={() => setEditingCategoryId(null)} className="h-8 w-8 shrink-0 flex items-center justify-center border border-slate-200 text-slate-500 rounded-lg cursor-pointer">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-semibold ${cat.isActive ? 'text-slate-800' : 'text-slate-400'}`}>{cat.name}</span>
                        {cat.description && <span className="text-[11px] text-slate-400 ml-2">{cat.description}</span>}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cat.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button type="button" onClick={() => startEditCategory(cat)} title="Edit" className="h-7 w-7 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleCategoryActive(cat)}
                        disabled={savingCategoryId === cat.id}
                        title={cat.isActive ? 'Deactivate' : 'Activate'}
                        className={`h-7 px-2.5 shrink-0 flex items-center gap-1 text-[11px] font-semibold rounded-lg border cursor-pointer disabled:opacity-60 transition-colors ${
                          cat.isActive ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {savingCategoryId === cat.id ? <Loader2 className="h-3 w-3 animate-spin" /> : cat.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
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

        {/* Reset Testing Data */}
        <SettingsCard
          icon={RotateCcw}
          iconTone="rose"
          title="Reset Testing Data"
          hint="Clear test transactions, sales, and purchases during testing phase."
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-50/50 border border-rose-100">
            <div>
              <p className="text-xs font-bold text-slate-800">Clear Testing Records &amp; Reset Numbers</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Quickly clear all demo/test POS invoices, purchases, stock movements, and ledger entries so you can restart testing with clean counters.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setResetScope('transactions_only');
                setConfirmText('');
                setShowResetModal(true);
              }}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 hover:border-rose-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              Reset Pharmacy Data…
            </button>
          </div>
        </SettingsCard>

        <div className="flex items-center justify-between pt-1 pb-4">
          <p className="text-[11px] text-slate-400">Last updated {new Date(settings.updatedAt).toLocaleString('en-GB')}</p>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-60 transition-colors cursor-pointer">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reset Pharmacy Testing Data</h3>
                  <p className="text-[11px] text-slate-400">Clear test records and reset numbering</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !resetting && setShowResetModal(false)}
                disabled={resetting}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-900">Testing Cleanup Warning</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    This will delete historical test transactions and restart document numbering (e.g. INV-0001, PO-0001). Use this during testing to clean up demo records.
                  </p>
                </div>
              </div>

              {/* Scope Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-2">Select Reset Scope:</label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      resetScope === 'transactions_only'
                        ? 'border-emerald-600 bg-emerald-50/30 ring-1 ring-emerald-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resetScope"
                      checked={resetScope === 'transactions_only'}
                      onChange={() => setResetScope('transactions_only')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Reset Transactions &amp; Stock Only (Recommended)</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Clears all POS sales, purchases, stock movements, batches, and ledger entries. <strong>Keeps your Medicine Catalog &amp; Vendors intact</strong> with zero stock.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      resetScope === 'complete'
                        ? 'border-rose-600 bg-rose-50/30 ring-1 ring-rose-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resetScope"
                      checked={resetScope === 'complete'}
                      onChange={() => setResetScope('complete')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="font-bold text-rose-900">Complete Reset (Everything)</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Wipes all transactions, stock, AND deletes all Medicines, Packaging levels, and Vendors. User accounts &amp; settings are preserved.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Confirmation Phrase */}
              <div className="pt-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Type <span className="font-mono font-bold text-rose-600">RESET</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type RESET"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-mono text-center tracking-widest font-bold focus:outline-none focus:ring-1 focus:ring-rose-500 uppercase"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetting}
                  className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReset}
                  disabled={confirmText !== 'RESET' || resetting}
                  className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {resetting ? 'Resetting Data…' : 'Confirm & Reset Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`.input { width: 100%; height: 2.25rem; padding: 0 0.75rem; font-size: 0.75rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; color: #0f172a; } .input:focus { outline: none; box-shadow: 0 0 0 1px #08775A; border-color: #08775A; }`}</style>
    </div>
  );
};

const toneClasses: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
  rose: 'bg-rose-50 text-rose-600',
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
