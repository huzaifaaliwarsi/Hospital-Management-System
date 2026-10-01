import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Loader2,
  PackagePlus,
  DollarSign,
  Calendar,
  Building2,
  Layers,
  FileEdit,
  CheckCircle,
  RotateCcw,
  Receipt,
  CreditCard,
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { pharmacyApi, MedicineRow, MarkupRule } from '../services/pharmacyApi';
import { formatPKR } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import {
  PurchaseLineCard,
  PurchaseLineState,
  emptyPurchaseLine,
  purchaseUnitsFor,
} from '../components/PurchaseLineCard';
import { calcPurchaseLine } from '../utils/purchaseCosting';

export const PurchasesPage: React.FC = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<MedicineRow[]>([]);
  const [markupRules, setMarkupRules] = useState<MarkupRule[]>([]);
  const [defaultMarkupPercent, setDefaultMarkupPercent] = useState(20);
  const [vendorId, setVendorId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [paymentType, setPaymentType] = useState<'CASH' | 'CARD' | 'ONLINE' | ''>('');
  const [paidNow, setPaidNow] = useState('0');
  const [lines, setLines] = useState<PurchaseLineState[]>([emptyPurchaseLine()]);
  const [saving, setSaving] = useState<'draft' | 'post' | null>(null);
  const toast = useToast();

  useEffect(() => {
    apiClient.get('/vendors').then((r) => setVendors(r.data.data || []));
    pharmacyApi.listMedicines().then((meds) => setMedicines(meds || []));
    pharmacyApi.listMarkupRules().then(setMarkupRules).catch(() => {});
    pharmacyApi
      .getPharmacySettings()
      .then((s) => setDefaultMarkupPercent(Number(s.defaultMarkupPercent)))
      .catch(() => {});
  }, []);

  const updateLine = (idx: number, patch: Partial<PurchaseLineState>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyPurchaseLine()]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setVendorId('');
    setVendorInvoiceNo('');
    setPaymentType('');
    setPaidNow('0');
    setLines([emptyPurchaseLine()]);
  };

  // Consignment math
  const lineCalc = (l: PurchaseLineState) => {
    const med = medicines.find((m) => m.id === l.medicineId);
    const defaultLevel = purchaseUnitsFor(med).find((o) => o.unitId === l.purchaseUnitId);
    const conversionToBase =
      l.overridePackaging && l.overrideConversion
        ? Number(l.overrideConversion)
        : Number(defaultLevel?.conversionToBase ?? 1);
    const rule = med?.category
      ? markupRules.find((r) => r.category === med.category && r.isActive)
      : undefined;
    const markupPercent = rule ? Number(rule.markupPercent) : defaultMarkupPercent;
    return calcPurchaseLine({
      purchaseUnitQuantity: Number(l.quantity) || 0,
      unitCost: Number(l.unitCost) || 0,
      discountType: l.discountType,
      discountValue: Number(l.discountValue) || 0,
      taxAmount: Number(l.taxAmount) || 0,
      freightAmount: Number(l.freightAmount) || 0,
      conversionToBase: conversionToBase || 1,
      markupPercent,
    });
  };

  const total = useMemo(
    () => lines.reduce((s, l) => s + lineCalc(l).netPurchaseCost, 0),
    [lines, medicines, markupRules, defaultMarkupPercent]
  );
  const selectedVendorObj = useMemo(
    () => vendors.find((v) => v.id === vendorId),
    [vendors, vendorId]
  );

  const kpis: KpiItem[] = [
    {
      label: 'Consignment Total',
      value: formatPKR(total),
      icon: DollarSign,
      subtitle: 'Net landed cost (after tax/freight)',
      tone: 'default',
    },
    {
      label: 'Selected Vendor',
      value: selectedVendorObj ? selectedVendorObj.name : 'None Selected',
      icon: Building2,
      subtitle: selectedVendorObj
        ? `Credit Terms: Net ${selectedVendorObj.paymentTermsDays || 0} Days`
        : 'Choose vendor below',
      tone: selectedVendorObj ? 'success' : 'warning',
    },
    {
      label: 'Inward Items',
      value: `${lines.length} Lines`,
      icon: Layers,
      subtitle: `${lines.filter((l) => l.medicineId && Number(l.quantity) > 0).length} valid item(s)`,
      tone: 'info',
    },
    {
      label: 'Receiving Date',
      value: purchaseDate,
      icon: Calendar,
      subtitle: 'Invoice date for FEFO stock lot',
      tone: 'default',
    },
  ];

  const buildPayload = (post: boolean) => {
    const validLines = lines.filter(
      (l) => l.medicineId && l.batchNumber && l.expiryDate && l.purchaseUnitId && Number(l.quantity) > 0
    );
    if (validLines.length === 0) return null;
    return {
      vendorId,
      purchaseDate,
      vendorInvoiceNo: vendorInvoiceNo || undefined,
      paymentType: paymentType || undefined,
      paidNow: Number(paidNow) || 0,
      post,
      lines: validLines.map((l) => {
        const defaultLevel = purchaseUnitsFor(medicines.find((m) => m.id === l.medicineId)).find(
          (o) => o.unitId === l.purchaseUnitId
        );
        return {
          medicineId: l.medicineId,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate,
          purchaseUnitId: l.purchaseUnitId,
          purchaseUnitQuantity: Number(l.quantity),
          unitCost: Number(l.unitCost) || 0,
          discountType: l.discountType,
          discountValue: Number(l.discountValue) || 0,
          taxAmount: Number(l.taxAmount) || 0,
          freightAmount: Number(l.freightAmount) || 0,
          finalSaleRate:
            l.priceManuallyAdjusted && l.finalSaleRate ? Number(l.finalSaleRate) : undefined,
          packagingOverride:
            l.overridePackaging && l.overrideConversion
              ? {
                  purchaseUnitConversionToBase: Number(l.overrideConversion),
                  applyToMedicineMasterDefault: l.applyOverrideToDefault,
                }
              : undefined,
        };
      }),
    };
  };

  const handleSubmit = async (post: boolean) => {
    if (!vendorId) return toast.error('Please select a vendor supplier.');
    if (!purchaseDate) return toast.error('Purchase date is required.');
    const payload = buildPayload(post);
    if (!payload)
      return toast.error('Add at least one valid line item (medicine, batch, expiry, unit, quantity).');

    setSaving(post ? 'post' : 'draft');
    try {
      await apiClient.post('/vendors/purchases', payload);
      toast.success(
        post
          ? 'Purchase consignment posted — stock, vendor ledger, and retail prices updated.'
          : 'Purchase saved as draft successfully.'
      );
      resetForm();
      pharmacyApi.listMedicines().then((meds) => setMedicines(meds || []));
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save purchase.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1360px] mx-auto font-sans">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-[#0e7d5a]" />
              Purchase Order &amp; Goods Receiving (GRN)
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0e7d5a] border border-emerald-200/70">
              Stock In Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Record supplier inward consignments, calculate landed packaging costs, and auto-suggest retail selling rates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            title="Reset Form"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* ── Metric Summary Cards ── */}
      <PharmacyKpiHeader items={kpis} />

      {/* ── Vendor & Invoice Metadata Card ── */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 pb-2 border-b border-slate-100">
          <Building2 className="h-4 w-4 text-[#0e7d5a]" />
          <span>Vendor Supplier &amp; Invoice Particulars</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Vendor / Supplier *">
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full h-8.5 px-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] focus:border-[#0e7d5a] cursor-pointer transition-colors"
            >
              <option value="">Select vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.code})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Inward / Bill Date *">
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full h-8.5 px-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] focus:border-[#0e7d5a] transition-colors"
            />
          </Field>

          <Field label="Vendor Bill / Invoice Ref #">
            <input
              value={vendorInvoiceNo}
              onChange={(e) => setVendorInvoiceNo(e.target.value)}
              placeholder="e.g. INV-90412 / DC-332"
              className="w-full h-8.5 px-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] focus:border-[#0e7d5a] transition-colors"
            />
          </Field>

          <Field label="Payment Settlement">
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as any)}
              className="w-full h-8.5 px-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] focus:border-[#0e7d5a] cursor-pointer transition-colors"
            >
              <option value="">Credit on Ledger (Pay Later)</option>
              <option value="CASH">Cash Disbursement</option>
              <option value="CARD">Bank / Card Payment</option>
              <option value="ONLINE">Online Bank Transfer</option>
            </select>
          </Field>
        </div>
      </div>

      {/* ── Consignment Line Items ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#0e7d5a]" />
            <h2 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Consignment Items ({lines.length})
            </h2>
            <span className="text-[10px] font-semibold bg-emerald-50 text-[#0e7d5a] px-2 py-0.5 rounded-md border border-emerald-200/80">
              FEFO Lot Inwards
            </span>
          </div>

          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e7d5a] hover:bg-[#0c6b50] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3]" /> Add Medicine Line
          </button>
        </div>

        {/* Line item cards */}
        {lines.map((l, idx) => (
          <PurchaseLineCard
            key={idx}
            index={idx}
            line={l}
            onChange={(patch) => updateLine(idx, patch)}
            onRemove={() => removeLine(idx)}
            canRemove={lines.length > 1}
            medicines={medicines}
            units={[]}
            markupRules={markupRules}
            defaultMarkupPercent={defaultMarkupPercent}
          />
        ))}

        <button
          type="button"
          onClick={addLine}
          className="w-full py-3 border border-dashed border-slate-300 hover:border-[#0e7d5a] hover:bg-emerald-50/20 rounded-xl text-xs font-bold text-slate-500 hover:text-[#0e7d5a] transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add Another Medicine Line
        </button>
      </div>

      {/* ── Consignment Valuation & Post Bar ── */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky bottom-4 z-20">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
              Net Consignment Valuation
            </div>
            <div className="text-2xl font-black tabular-nums text-[#0e7d5a] mt-0.5">
              {formatPKR(total)}
            </div>
          </div>

          <div className="w-48">
            <label className="block text-[10.5px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <CreditCard className="h-3 w-3 text-slate-400" />
              Paid Now Amount (PKR)
            </label>
            <input
              type="number"
              min={0}
              value={paidNow}
              onChange={(e) => setPaidNow(e.target.value)}
              placeholder="0.00"
              className="w-full h-8 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] focus:border-[#0e7d5a] transition-colors text-right"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={saving !== null}
            className="h-9.5 px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            {saving === 'draft' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileEdit className="h-3.5 w-3.5" />
            )}
            Save as Draft
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={saving !== null}
            className="h-9.5 px-5 text-xs font-bold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            {saving === 'post' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5" />
            )}
            Post Consignment to Stock &amp; Ledger
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">{label}</label>
    {children}
  </div>
);
