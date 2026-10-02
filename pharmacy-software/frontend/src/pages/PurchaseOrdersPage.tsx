import React, { useEffect, useState } from 'react';
import {
  Plus,
  Loader2,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  X,
  Printer,
  MessageCircle,
  PackageCheck,
  Ban,
  Hash,
  Building2,
  Calendar,
  FileText,
  Trash2,
  Package,
} from 'lucide-react';
import { pharmacyApi, MedicineRow, Unit } from '../services/pharmacyApi';
import { formatNumber } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import { PharmacyDataTable, Column } from '../components/PharmacyDataTable';
import { AddVendorModal } from '../components/AddVendorModal';
import { AddMedicineModal } from '../components/AddMedicineModal';
import type { StockInPrefill } from './StockInPage';

interface OrderLineForm {
  medicineId: string;
  requiredUnitId: string;
  requiredQty: string;
  lineNotes: string;
}
const emptyLine = (): OrderLineForm => ({ medicineId: '', requiredUnitId: '', requiredQty: '', lineNotes: '' });

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-50 text-amber-800 border-amber-200',
  CONVERTED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

interface Props {
  canEdit: boolean;
  /** "Receive / Convert to Stock In" — pre-fills the real Stock-In form and switches the caller to that page. */
  onConvert: (prefill: StockInPrefill) => void;
}

/**
 * Purchase Orders — the simple procurement reminder/order screen (what we
 * want to order). Medicine + required quantity/unit + vendor + notes/
 * urgency, printable/WhatsApp-shareable. Creating or editing one NEVER
 * touches stock, batches, cost, payment or the vendor ledger — that only
 * happens in the separate "New Purchase / Stock In" workflow (what we
 * actually received), optionally pre-filled from here via "Receive / Convert
 * to Stock In". A Purchase Order is never mandatory before a Stock In.
 */
export const PurchaseOrdersPage: React.FC<Props> = ({ canEdit, onConvert }) => {
  const toast = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<MedicineRow[]>([]);
  const [unitCatalog, setUnitCatalog] = useState<Unit[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [nextOrderCode, setNextOrderCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [addMedicineForLineIdx, setAddMedicineForLineIdx] = useState<number | null>(null);
  const [printingOrder, setPrintingOrder] = useState<any | null>(null);

  const [vendorId, setVendorId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [isUrgent, setIsUrgent] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<OrderLineForm[]>([emptyLine()]);

  const load = () => {
    setLoading(true);
    pharmacyApi
      .listPurchaseOrders()
      .then(setOrders)
      .catch(() => toast.error('Failed to load purchase orders.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    pharmacyApi.listVendors().then(setVendors).catch(() => {});
    pharmacyApi.listMedicines().then((meds) => setMedicines(meds || [])).catch(() => {});
    pharmacyApi.listUnits().then(setUnitCatalog).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setVendorId('');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setIsUrgent(false);
    setNotes('');
    setLines([emptyLine()]);
    setShowCreate(true);
    pharmacyApi.getNextPurchaseOrderCode().then(setNextOrderCode).catch(() => setNextOrderCode(''));
  };

  const updateLine = (idx: number, patch: Partial<OrderLineForm>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const handleSelectMedicine = (idx: number, medicineId: string) => {
    if (medicineId === '__add__') {
      setAddMedicineForLineIdx(idx);
      return;
    }
    const med = medicines.find((m) => m.id === medicineId);
    let defaultUnit = med?.baseUnitId || '';
    if (med?.packagingLevels && med.packagingLevels.length > 0) {
      const purchLevel = med.packagingLevels.find((l) => l.isPurchaseUnit);
      if (purchLevel) defaultUnit = purchLevel.unitId;
    }

    setLines((prev) => {
      const updated = prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              medicineId,
              requiredQty: l.requiredQty && Number(l.requiredQty) > 0 ? l.requiredQty : '1',
              requiredUnitId: defaultUnit || l.requiredUnitId || (unitCatalog[0]?.id ?? ''),
            }
          : l
      );
      if (idx === prev.length - 1 && medicineId) {
        return [...updated, emptyLine()];
      }
      return updated;
    });
  };

  const getUnitsForMedicine = (medId: string) => {
    if (!medId) return unitCatalog;
    const med = medicines.find((m) => m.id === medId);
    if (!med) return unitCatalog;

    const baseUnitId = med.baseUnitId;
    const baseUnitName = med.unit || med.baseUnit?.name || 'Base Unit';
    const medUnits: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    if (baseUnitId) {
      seen.add(baseUnitId);
      medUnits.push({ id: baseUnitId, name: `${baseUnitName} (Base Unit)` });
    }
    if (med.packagingLevels && med.packagingLevels.length > 0) {
      for (const lvl of med.packagingLevels) {
        if (seen.has(lvl.unitId)) continue;
        seen.add(lvl.unitId);
        const u = unitCatalog.find((uc) => uc.id === lvl.unitId) || (lvl as any).unit;
        const uName = u?.name || 'Pack';
        medUnits.push({
          id: lvl.unitId,
          name: `${uName} (${lvl.conversionToBase} ${baseUnitName}s)`,
        });
      }
    }
    return medUnits.length > 0 ? medUnits : unitCatalog;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return toast.error('Please select a vendor.');
    const validLines = lines.filter((l) => l.medicineId && l.requiredUnitId && Number(l.requiredQty) > 0);
    if (validLines.length === 0) return toast.error('Add at least one medicine line with a quantity.');
    setSaving(true);
    try {
      await pharmacyApi.createPurchaseOrder({
        vendorId,
        orderDate,
        isUrgent,
        notes: notes.trim() || undefined,
        lines: validLines.map((l) => ({
          medicineId: l.medicineId,
          requiredUnitId: l.requiredUnitId,
          requiredQty: Number(l.requiredQty),
          lineNotes: l.lineNotes.trim() || undefined,
        })),
      });
      toast.success('Purchase order created.');
      setShowCreate(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to create purchase order.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (order: any) => {
    try {
      await pharmacyApi.cancelPurchaseOrder(order.id);
      toast.success(`Purchase order ${order.orderNumber} cancelled.`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to cancel purchase order.');
    }
  };

  const handleConvert = async (order: any) => {
    try {
      await pharmacyApi.markPurchaseOrderConverted(order.id);
      onConvert({
        vendorId: order.vendorId,
        sourcePurchaseOrderId: order.id,
        lines: order.lines.map((l: any) => ({ medicineId: l.medicineId, quantity: String(l.requiredQty) })),
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to convert purchase order.');
    }
  };

  const handlePrint = (order: any) => {
    setPrintingOrder(order);
    setTimeout(() => window.print(), 50);
  };

  const handleWhatsApp = (order: any) => {
    const itemLines = (order.lines || [])
      .map((l: any) => `• ${l.medicine?.name ?? 'Medicine'} — ${formatNumber(Number(l.requiredQty))} ${l.requiredUnit?.name ?? ''}${l.lineNotes ? ` (${l.lineNotes})` : ''}`)
      .join('\n');
    const text =
      `*Purchase Order ${order.orderNumber}*\n` +
      `Vendor: ${order.vendor?.name ?? ''}\n` +
      `Date: ${String(order.orderDate).slice(0, 10)}${order.isUrgent ? '\n*URGENT*' : ''}\n\n` +
      `Items:\n${itemLines}` +
      (order.notes ? `\n\nNotes: ${order.notes}` : '');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const openCount = orders.filter((o) => o.status === 'OPEN').length;
  const urgentCount = orders.filter((o) => o.status === 'OPEN' && o.isUrgent).length;
  const convertedCount = orders.filter((o) => o.status === 'CONVERTED').length;

  const kpis: KpiItem[] = [
    { label: 'Open Requests', value: openCount, icon: ClipboardList, subtitle: 'Awaiting receiving', tone: 'warning' },
    { label: 'Urgent', value: urgentCount, icon: AlertTriangle, subtitle: 'Flagged urgent & open', tone: urgentCount > 0 ? 'warning' : 'default' },
    { label: 'Converted to Stock In', value: convertedCount, icon: CheckCircle2, subtitle: 'Already received/processed', tone: 'success' },
    { label: 'Total Requests', value: orders.length, icon: Hash, subtitle: 'All-time record count', tone: 'info' },
  ];

  const columns: Column<any>[] = [
    {
      key: 'orderNumber',
      header: 'Order Ref',
      width: '120px',
      render: (o) => <span className="font-bold text-slate-900 text-xs font-mono whitespace-nowrap">{o.orderNumber}</span>,
    },
    {
      key: 'orderDate',
      header: 'Date',
      width: '110px',
      render: (o) => <span className="text-xs text-slate-700 whitespace-nowrap">{String(o.orderDate).slice(0, 10)}</span>,
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (o) => <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">{o.vendor?.name ?? '—'}</span>,
    },
    {
      key: 'items',
      header: 'Items',
      render: (o) => (
        <div className="text-xs text-slate-600 max-w-xs truncate" title={(o.lines || []).map((l: any) => l.medicine?.name).join(', ')}>
          {(o.lines || []).length} item(s) — {(o.lines || []).slice(0, 2).map((l: any) => l.medicine?.name).join(', ')}
          {(o.lines || []).length > 2 ? '…' : ''}
        </div>
      ),
    },
    {
      key: 'isUrgent',
      header: 'Urgency',
      width: '90px',
      align: 'center',
      render: (o) =>
        o.isUrgent ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md">
            <AlertTriangle className="h-3 w-3" /> Urgent
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">Normal</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (o) => (
        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md border ${STATUS_STYLE[o.status] ?? ''}`}>{o.status}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: '220px',
      render: (o) => (
        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
          <button type="button" onClick={() => handlePrint(o)} title="Print" className="p-1.5 text-slate-500 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer">
            <Printer className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => handleWhatsApp(o)} title="Share via WhatsApp" className="p-1.5 text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 rounded-md transition-colors cursor-pointer">
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
          {canEdit && o.status === 'OPEN' && (
            <>
              <button
                type="button"
                onClick={() => handleConvert(o)}
                title="Receive / Convert to Stock In"
                className="px-2 py-1 text-[11px] font-semibold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              >
                <PackageCheck className="h-3 w-3" /> Receive
              </button>
              <button type="button" onClick={() => handleCancel(o)} title="Cancel" className="p-1.5 text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 rounded-md transition-colors cursor-pointer">
                <Ban className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const inputCls = 'w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]';
  const labelCls = 'block font-semibold text-slate-700 mb-1 text-xs';

  return (
    <>
      <div className="p-4 sm:p-6 space-y-4 max-w-[1360px] mx-auto font-sans print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#0e7d5a]" />
                Purchase Orders
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0e7d5a] border border-emerald-200/70">Procurement Reminder</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              What we want to order — medicine, quantity and vendor, printable or shareable via WhatsApp. No stock, cost or ledger impact.
            </p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New Purchase Order
            </button>
          )}
        </div>

        <PharmacyKpiHeader items={kpis} />

        <PharmacyDataTable
          columns={columns}
          data={orders}
          loading={loading}
          title="Purchase Order Register"
          badge={`${orders.length} Total`}
          exportFileName="purchase_orders"
          searchPlaceholder="Search by order ref or vendor…"
          searchFilter={(o, q) => o.orderNumber.toLowerCase().includes(q) || (o.vendor?.name ?? '').toLowerCase().includes(q)}
          onRefresh={load}
          emptyTitle="No purchase orders yet"
          emptyDescription='Click "New Purchase Order" to flag a medicine that needs reordering.'
        />
      </div>

      {/* ── Create Purchase Order modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0c6b50] to-[#0e7d5a] text-white flex items-center justify-center shadow-xs">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">New Purchase Order</h3>
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#0e7d5a] border border-emerald-200/80">
                      #{nextOrderCode || 'PREQ-…'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Procurement requisition &amp; vendor order reminder (no inventory cost/stock posted)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-2 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Top Details Card */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Vendor Selection (6 cols) */}
                  <div className="sm:col-span-6">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Vendor / Supplier *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddVendorModal(true)}
                        className="text-[11px] font-semibold text-[#0e7d5a] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" /> New Vendor
                      </button>
                    </div>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <select
                        value={vendorId}
                        onChange={(e) => setVendorId(e.target.value)}
                        className="w-full h-9.5 pl-9 pr-3 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#0e7d5a] cursor-pointer"
                      >
                        <option value="">Select vendor…</option>
                        {vendors.filter((v) => v.isActive !== false).map((v) => (
                          <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Order Date (3 cols) */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Order Date *
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="date"
                        value={orderDate}
                        onChange={(e) => setOrderDate(e.target.value)}
                        className="w-full h-9.5 pl-9 pr-3 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#0e7d5a]"
                      />
                    </div>
                  </div>

                  {/* Priority Toggle (3 cols) */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Priority Level
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsUrgent(!isUrgent)}
                      className={`w-full h-9.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isUrgent
                          ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                      }`}
                    >
                      <AlertTriangle className={`h-3.5 w-3.5 ${isUrgent ? 'text-rose-600' : 'text-slate-400'}`} />
                      <span>{isUrgent ? 'Urgent Requisition' : 'Standard Priority'}</span>
                    </button>
                  </div>
                </div>

                {/* Order-level note */}
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Delivery instructions / requisition notes (optional)..."
                    className="w-full h-8.5 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-[#0e7d5a]" />
                      Medicines Required
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {lines.filter((l) => l.medicineId).length} item{lines.filter((l) => l.medicineId).length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#0e7d5a] bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Medicine Line</span>
                  </button>
                </div>

                {/* Table Layout for Line Items */}
                <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                          <th className="py-2.5 px-3 min-w-[220px]">Medicine / Product</th>
                          <th className="py-2.5 px-3 w-28 text-center">Stock Info</th>
                          <th className="py-2.5 px-3 w-24 text-right">Order Qty</th>
                          <th className="py-2.5 px-3 w-40">Pack Unit</th>
                          <th className="py-2.5 px-3 min-w-[160px]">Line Remarks</th>
                          <th className="py-2.5 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lines.map((l, idx) => {
                          const med = medicines.find((m) => m.id === l.medicineId);
                          const availableUnits = getUnitsForMedicine(l.medicineId);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              {/* # */}
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400 text-xs">
                                {idx + 1}
                              </td>

                              {/* Medicine Select */}
                              <td className="py-2.5 px-3">
                                <select
                                  value={l.medicineId}
                                  onChange={(e) => handleSelectMedicine(idx, e.target.value)}
                                  className="w-full h-8.5 px-2.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold text-slate-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                                >
                                  <option value="">Select medicine…</option>
                                  {medicines.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.code})
                                    </option>
                                  ))}
                                  <option value="__add__">+ Add New Medicine…</option>
                                </select>
                              </td>

                              {/* Stock Info */}
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {med ? (
                                  med.isOutOfStock ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                      Out of Stock
                                    </span>
                                  ) : med.isLowStock ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                      Low ({med.currentStock} {med.unit})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-slate-600">
                                      {med.currentStock} {med.unit}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-300 text-[10px]">—</span>
                                )}
                              </td>

                              {/* Qty */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="number"
                                  min={0}
                                  value={l.requiredQty}
                                  onChange={(e) => updateLine(idx, { requiredQty: e.target.value })}
                                  placeholder="0"
                                  className="w-full h-8.5 px-2.5 text-xs text-right font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                                />
                              </td>

                              {/* Unit */}
                              <td className="py-2.5 px-3">
                                <select
                                  value={l.requiredUnitId}
                                  onChange={(e) => updateLine(idx, { requiredUnitId: e.target.value })}
                                  className="w-full h-8.5 px-2 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                                >
                                  <option value="">Select unit…</option>
                                  {availableUnits.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Line Note */}
                              <td className="py-2.5 px-3">
                                <input
                                  value={l.lineNotes}
                                  onChange={(e) => updateLine(idx, { lineNotes: e.target.value })}
                                  placeholder="Note (optional)"
                                  className="w-full h-8 px-2.5 text-[11px] bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                                />
                              </td>

                              {/* Delete */}
                              <td className="py-2.5 px-2 text-center">
                                {lines.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeLine(idx)}
                                    title="Remove item"
                                    className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer mx-auto"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Row Button at Table Footer */}
                  <div className="p-2.5 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={addLine}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-[#0e7d5a] hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Add Another Medicine</span>
                    </button>
                    <div className="text-[11px] font-semibold text-slate-500">
                      Total Ordered Units:{' '}
                      <span className="font-bold text-slate-800">
                        {lines.reduce((sum, l) => sum + (Number(l.requiredQty) || 0), 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Action Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  ℹ️ Reminder only — stock and vendor balance are posted when received via Stock In.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 font-bold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl shadow-xs disabled:opacity-60 transition-all flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span>Save Purchase Order</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddVendorModal
        open={showAddVendorModal}
        onClose={() => setShowAddVendorModal(false)}
        onCreated={(v) => {
          setVendors((prev) => [...prev, v]);
          setVendorId(v.id);
        }}
      />

      <AddMedicineModal
        open={addMedicineForLineIdx !== null}
        onClose={() => setAddMedicineForLineIdx(null)}
        units={unitCatalog}
        onUnitCreated={(u) => setUnitCatalog((prev) => [...prev, u])}
        onCreated={(med) => {
          setMedicines((prev) => [...prev, med]);
          if (addMedicineForLineIdx !== null) updateLine(addMedicineForLineIdx, { medicineId: med.id });
          setAddMedicineForLineIdx(null);
        }}
      />

      {/* ── Print view (screen-hidden; shown only by window.print()) ── */}
      {printingOrder && (
        <div className="hidden print:block p-8 text-slate-900 font-sans">
          <h1 className="text-lg font-bold mb-0.5 flex items-center gap-2">
            Purchase Order {printingOrder.isUrgent && <span className="text-rose-600 text-sm">(URGENT)</span>}
          </h1>
          <p className="text-xs text-slate-500 mb-4">CH Sharif &amp; Saeed Hospital Pharmacy</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-4 border-b border-slate-300 pb-3">
            <div><span className="font-semibold">Order Ref:</span> {printingOrder.orderNumber}</div>
            <div><span className="font-semibold">Date:</span> {String(printingOrder.orderDate).slice(0, 10)}</div>
            <div><span className="font-semibold">Vendor:</span> {printingOrder.vendor?.name}</div>
            <div><span className="font-semibold">Contact:</span> {printingOrder.vendor?.phone || '—'}</div>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-400 text-left">
                <th className="py-1 pr-2">Medicine</th>
                <th className="py-1 pr-2 text-right">Required Qty</th>
                <th className="py-1 pr-2">Unit</th>
                <th className="py-1">Note</th>
              </tr>
            </thead>
            <tbody>
              {(printingOrder.lines || []).map((l: any) => (
                <tr key={l.id} className="border-b border-slate-200">
                  <td className="py-1 pr-2">{l.medicine?.name}</td>
                  <td className="py-1 pr-2 text-right">{formatNumber(Number(l.requiredQty))}</td>
                  <td className="py-1 pr-2">{l.requiredUnit?.name}</td>
                  <td className="py-1">{l.lineNotes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {printingOrder.notes && <div className="mt-3 text-xs"><span className="font-semibold">Notes:</span> {printingOrder.notes}</div>}
          <div className="mt-12 grid grid-cols-2 gap-6 text-center text-xs text-slate-700">
            <div className="border-t border-slate-400 pt-1">Requested By</div>
            <div className="border-t border-slate-400 pt-1">Vendor Acknowledgement</div>
          </div>
        </div>
      )}
    </>
  );
};
