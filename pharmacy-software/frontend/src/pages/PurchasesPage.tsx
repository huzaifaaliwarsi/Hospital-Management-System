import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Plus, Trash2, Loader2, PackagePlus, FileSpreadsheet, Layers, DollarSign, Calendar, Building2 } from 'lucide-react';
import apiClient from '../services/apiClient';
import { pharmacyApi, MedicineRow } from '../services/pharmacyApi';
import { formatPKR, formatNumber } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';

interface Line {
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  unitCost: string;
  discountAmount: string;
  taxAmount: string;
}

const emptyLine = (): Line => ({
  medicineId: '',
  batchNumber: '',
  expiryDate: '',
  quantity: '',
  unitCost: '',
  discountAmount: '0',
  taxAmount: '0',
});

export const PurchasesPage: React.FC = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<MedicineRow[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [paymentType, setPaymentType] = useState<'CASH' | 'CARD' | 'ONLINE' | ''>('');
  const [paidNow, setPaidNow] = useState('0');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Dual Synchronized Scrollbars
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const syncTopToBottom = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const syncBottomToTop = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  useEffect(() => {
    apiClient.get('/vendors').then((r) => setVendors(r.data.data || []));
    pharmacyApi.listMedicines().then((meds) => setMedicines(meds || []));
  }, []);

  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const total = useMemo(
    () =>
      lines.reduce(
        (s, l) =>
          s +
          (Number(l.quantity) || 0) * (Number(l.unitCost) || 0) -
          (Number(l.discountAmount) || 0) +
          (Number(l.taxAmount) || 0),
        0
      ),
    [lines]
  );

  const selectedVendorObj = useMemo(() => vendors.find((v) => v.id === vendorId), [vendors, vendorId]);

  const kpis: KpiItem[] = [
    {
      label: 'Consignment Total',
      value: formatPKR(total),
      icon: DollarSign,
      subtitle: 'Net inward valuation',
      tone: 'default',
    },
    {
      label: 'Selected Vendor',
      value: selectedVendorObj ? selectedVendorObj.name : 'None Selected',
      icon: Building2,
      subtitle: selectedVendorObj ? `Credit: Net ${selectedVendorObj.paymentTermsDays || 0} Days` : 'Choose vendor below',
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
      subtitle: 'Invoice date for FEFO lot',
      tone: 'default',
    },
  ];

  const handleSubmit = async () => {
    if (!vendorId) return toast.error('Select a vendor.');
    if (!purchaseDate) return toast.error('Purchase date is required.');
    const validLines = lines.filter(
      (l) => l.medicineId && l.batchNumber && l.expiryDate && Number(l.quantity) > 0
    );
    if (validLines.length === 0)
      return toast.error('Add at least one valid line (medicine, batch, expiry, quantity).');

    setSaving(true);
    try {
      await apiClient.post('/vendors/purchases', {
        vendorId,
        purchaseDate,
        vendorInvoiceNo: vendorInvoiceNo || undefined,
        paymentType: paymentType || undefined,
        paidNow: Number(paidNow) || 0,
        post: true,
        lines: validLines.map((l) => ({
          medicineId: l.medicineId,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost) || 0,
          discountAmount: Number(l.discountAmount) || 0,
          taxAmount: Number(l.taxAmount) || 0,
        })),
      });
      toast.success('Purchase consignment posted — stock balances and vendor ledger updated.');
      setLines([emptyLine()]);
      setVendorInvoiceNo('');
      setPaidNow('0');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to post purchase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-[1700px] mx-auto">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Purchase &amp; Goods Receiving (GRN)
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              Stock In Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Receive vendor stock consignments, allocate FEFO batch numbers and expiries, and record credit payables.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <PharmacyKpiHeader items={kpis} />

      {/* Vendor & Invoice Metadata Box */}
      <div className="bg-white rounded-2xl border border-slate-300/80 p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Field label="Vendor / Supplier *">
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="w-full h-8.5 px-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
          >
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Purchase / Inward Date *">
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full h-8.5 px-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
          />
        </Field>
        <Field label="Vendor Invoice / Bill No">
          <input
            value={vendorInvoiceNo}
            onChange={(e) => setVendorInvoiceNo(e.target.value)}
            placeholder="e.g. INV-90412"
            className="w-full h-8.5 px-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
          />
        </Field>
        <Field label="Payment Settlement Type">
          <select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as any)}
            className="w-full h-8.5 px-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
          >
            <option value="">Credit on Ledger (Pay Later)</option>
            <option value="CASH">Cash Settlement</option>
            <option value="CARD">Card Payment</option>
            <option value="ONLINE">Bank Transfer</option>
          </select>
        </Field>
      </div>

      {/* Main Line Items Table */}
      <div className="bg-white rounded-2xl border border-slate-300/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Dark Emerald Header Strip */}
        <div className="bg-[#0e5944] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-4 w-4 text-emerald-300" />
            <span className="font-bold text-xs sm:text-sm tracking-tight text-white whitespace-nowrap">
              Inward Consignment Line Items
            </span>
            <span className="text-[10px] font-semibold bg-emerald-700/60 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
              FEFO Lot Inwards
            </span>
          </div>

          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" /> Add Medicine Line
          </button>
        </div>

        {/* ── TOP HORIZONTAL SCROLLER ── */}
        <div
          ref={topScrollRef}
          onScroll={syncTopToBottom}
          className="overflow-x-auto overflow-y-hidden h-2 bg-slate-100 border-b border-slate-200 scrollbar-thin"
        >
          <div style={{ width: '1360px', height: '1px' }} />
        </div>

        {/* ── MAIN TABLE CONTAINER ── */}
        <div
          ref={bottomScrollRef}
          onScroll={syncBottomToTop}
          className="overflow-x-auto max-h-[calc(100vh-420px)] scrollbar-thin"
        >
          <table className="w-full min-w-[1360px] border-collapse text-left text-xs">
            <thead className="bg-[#f8fafc] text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200 uppercase tracking-wider select-none text-xs">
              <tr>
                <th className="py-3 px-3 text-center border-r border-slate-200 w-14 whitespace-nowrap">#</th>
                <th className="py-3 px-4 text-left border-r border-slate-200 min-w-[300px] whitespace-nowrap">
                  Medicine Item *
                </th>
                <th className="py-3 px-4 text-left border-r border-slate-200 w-40 whitespace-nowrap">
                  Batch No *
                </th>
                <th className="py-3 px-4 text-left border-r border-slate-200 w-40 whitespace-nowrap">
                  Expiry Date *
                </th>
                <th className="py-3 px-4 text-right border-r border-slate-200 w-32 whitespace-nowrap">
                  Inward Qty *
                </th>
                <th className="py-3 px-4 text-right border-r border-slate-200 w-36 whitespace-nowrap">
                  Unit Cost (PKR)
                </th>
                <th className="py-3 px-4 text-right border-r border-slate-200 w-32 whitespace-nowrap">
                  Discount (PKR)
                </th>
                <th className="py-3 px-4 text-right border-r border-slate-200 w-32 whitespace-nowrap">
                  Tax (PKR)
                </th>
                <th className="py-3 px-4 text-right border-r border-slate-200 w-40 whitespace-nowrap">
                  Net Line Value
                </th>
                <th className="py-3 px-3 text-center w-16 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l, idx) => {
                const lineTotal =
                  (Number(l.quantity) || 0) * (Number(l.unitCost) || 0) -
                  (Number(l.discountAmount) || 0) +
                  (Number(l.taxAmount) || 0);

                return (
                  <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="py-2 px-3 text-center border-r border-slate-100 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      <select
                        value={l.medicineId}
                        onChange={(e) => updateLine(idx, { medicineId: e.target.value })}
                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
                      >
                        <option value="">Select medicine from formulary…</option>
                        {medicines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.code})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      <input
                        value={l.batchNumber}
                        onChange={(e) => updateLine(idx, { batchNumber: e.target.value })}
                        placeholder="e.g. B-994"
                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      <input
                        type="date"
                        value={l.expiryDate}
                        onChange={(e) => updateLine(idx, { expiryDate: e.target.value })}
                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      <input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                        placeholder="0"
                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-right font-bold font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      <input
                        type="number"
                        min={0}
                        value={l.unitCost}
                        onChange={(e) => updateLine(idx, { unitCost: e.target.value })}
                        placeholder="0"
                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      <input
                        type="number"
                        min={0}
                        value={l.discountAmount}
                        onChange={(e) => updateLine(idx, { discountAmount: e.target.value })}
                        placeholder="0"
                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                      />
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      <input
                        type="number"
                        min={0}
                        value={l.taxAmount}
                        onChange={(e) => updateLine(idx, { taxAmount: e.target.value })}
                        placeholder="0"
                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                      />
                    </td>
                    <td className="py-2 px-3 text-right border-r border-slate-100 font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                      {formatPKR(lineTotal)}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove Line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer of Table */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={addLine}
            className="font-bold text-[#0e7d5a] hover:text-[#0c6b50] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Another Medicine Line
          </button>
          <span className="text-slate-500 font-medium">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'} in this consignment
          </span>
        </div>
      </div>

      {/* Consignment Finalization & Submission */}
      <div className="bg-white rounded-2xl border border-slate-300/80 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Net Consignment Valuation
            </div>
            <div className="text-xl font-bold font-mono text-[#0e7d5a] mt-0.5">
              {formatPKR(total)}
            </div>
          </div>

          <div className="w-48">
            <Field label="Paid Now Amount (PKR)">
              <input
                type="number"
                value={paidNow}
                onChange={(e) => setPaidNow(e.target.value)}
                placeholder="0"
                className="w-full h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
              />
            </Field>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="h-10 px-6 text-xs font-semibold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl shadow-xs disabled:opacity-60 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Post Consignment to Stock &amp; Ledger
        </button>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
    {children}
  </div>
);
