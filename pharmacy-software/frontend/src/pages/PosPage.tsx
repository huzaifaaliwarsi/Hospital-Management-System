import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Loader2,
  Printer,
  X,
  Pill,
  Check,
  CreditCard,
  Banknote,
  RotateCcw,
  Sparkles,
  User,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { pharmacyApi, MedicineRow } from '../services/pharmacyApi';
import { formatPKR, formatNumber } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyInvoiceModal } from '../components/PharmacyInvoiceModal';

interface CartLine {
  medicine: MedicineRow;
  quantity: number;
  discountAmount: number;
}

interface PaymentRow {
  method: 'CASH' | 'CARD' | 'ONLINE';
  amount: string;
}

const PAYMENT_METHODS: { value: PaymentRow['method']; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'ONLINE', label: 'Online' },
];

export const PosPage: React.FC = () => {
  const toast = useToast();

  // All catalog medicines
  const [allMedicines, setAllMedicines] = useState<MedicineRow[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(true);

  // Search & category filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Cart & checkout
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [invoiceDiscount, setInvoiceDiscount] = useState('0');
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: 'CASH', amount: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  // Load all medicines on mount
  const loadMedicines = () => {
    setLoadingMedicines(true);
    pharmacyApi
      .listMedicines()
      .then((rows) => {
        setAllMedicines(rows.filter((r) => r.isActive));
      })
      .catch(() => toast.error('Failed to load medicines for POS.'))
      .finally(() => setLoadingMedicines(false));
  };

  useEffect(() => {
    loadMedicines();
  }, []);

  // Unique categories for filter chips
  const categories = useMemo(() => {
    const set = new Set<string>();
    allMedicines.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [allMedicines]);

  // Filtered medicines displayed in the POS product catalog
  const filteredMedicines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMedicines.filter((m) => {
      // Category filter
      if (selectedCategory !== 'ALL' && m.category !== selectedCategory) return false;
      // Search filter
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.category && m.category.toLowerCase().includes(q))
      );
    });
  }, [allMedicines, selectedCategory, search]);

  // Cart quantity map for quick lookup on product cards
  const cartQtyByMedicineId = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((line) => {
      map.set(line.medicine.id, line.quantity);
    });
    return map;
  }, [cart]);

  // Add product to cart or increment
  const handleProductClick = (m: MedicineRow) => {
    if (m.isOutOfStock) {
      toast.error(`"${m.name}" is currently out of stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((l) => l.medicine.id === m.id);
      if (existing) {
        // Increment quantity
        return prev.map((l) =>
          l.medicine.id === m.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      // Add new item to cart
      return [...prev, { medicine: m, quantity: 1, discountAmount: 0 }];
    });
  };

  const updateLine = (medicineId: string, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((l) => (l.medicine.id === medicineId ? { ...l, ...patch } : l)));
  };

  const removeLine = (medicineId: string) =>
    setCart((prev) => prev.filter((l) => l.medicine.id !== medicineId));

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setInvoiceDiscount('0');
    setPayments([{ method: 'CASH', amount: '' }]);
  };

  // Financial totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let lineDiscounts = 0;
    let tax = 0;
    for (const l of cart) {
      const gross = l.quantity * Number(l.medicine.saleRate);
      const disc = Math.min(l.discountAmount, gross);
      const taxable = gross - disc;
      const lineTax = (taxable * Number(l.medicine.taxPercent)) / 100;
      subtotal += gross;
      lineDiscounts += disc;
      tax += lineTax;
    }
    const invDiscount = Math.max(0, Number(invoiceDiscount) || 0);
    const total = Math.max(0, subtotal - lineDiscounts + tax - invDiscount);
    const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const outstanding = Math.max(0, total - paid);
    return { subtotal, lineDiscounts, tax, invDiscount, total, paid, outstanding };
  }, [cart, invoiceDiscount, payments]);

  const addPaymentRow = () => setPayments((prev) => [...prev, { method: 'CASH', amount: '' }]);
  const removePaymentRow = (idx: number) => setPayments((prev) => prev.filter((_, i) => i !== idx));
  const payInFull = () => setPayments([{ method: 'CASH', amount: totals.total.toString() }]);

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Your POS cart is empty. Click on medicines to add them.');
      return;
    }
    const validPayments = payments.filter((p) => Number(p.amount) > 0);
    setSubmitting(true);
    try {
      const invoice = await pharmacyApi.dispenseRetail({
        customerName: customerName.trim() || undefined,
        lines: cart.map((l) => ({
          medicineId: l.medicine.id,
          quantity: l.quantity,
          discountAmount: l.discountAmount,
        })),
        invoiceDiscount: Number(invoiceDiscount) || 0,
        payments: validPayments.map((p) => ({ method: p.method, amount: Number(p.amount) })),
      });
      toast.success(`Sale completed successfully — Invoice ${invoice.invoiceNumber}`);
      setReceipt(invoice);
      clearCart();
      loadMedicines(); // Refresh stock counts in product catalog
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to complete sale.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[1600px] mx-auto space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              Point of Sale (POS) — Retail Counter
            </h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Live Workstation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Select products directly from the catalogue below to instantly add them to the sale card.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear Card
            </button>
          )}
          <button
            type="button"
            onClick={loadMedicines}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            title="Refresh Formulary Catalogue"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ═════════════════════════════════════════════════════════════
            LEFT: ALL PRODUCTS CATALOGUE & QUICK-SELECT CARDS (7 Cols)
            ═════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* Search & Category Filter Toolbar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search medicine name, formulation, item code, barcode…"
                className="w-full h-10 pl-10 pr-4 text-xs font-medium bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#08775A] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Products ({allMedicines.length})
              </button>

              {categories.map((cat) => {
                const count = allMedicines.filter((m) => m.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-[#08775A] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-bold text-slate-700">
                Available Formulary Items ({filteredMedicines.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Click any product card to add directly to sale
              </span>
            </div>

            {loadingMedicines ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-2">
                <div className="h-7 w-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold">Loading product catalogue…</span>
              </div>
            ) : filteredMedicines.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Pill className="h-8 w-8 mx-auto text-slate-300" />
                <div className="font-bold text-slate-700 text-sm">No products found</div>
                <p className="text-xs text-slate-500">
                  Try searching with a different keyword or selecting "All Products".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {filteredMedicines.map((m) => {
                  const inCartQty = cartQtyByMedicineId.get(m.id) ?? 0;
                  const stock = Number(m.currentStock || 0);

                  return (
                    <div
                      key={m.id}
                      onClick={() => handleProductClick(m)}
                      className={`relative p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between select-none cursor-pointer group ${
                        m.isOutOfStock
                          ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                          : inCartQty > 0
                          ? 'bg-emerald-50/70 border-emerald-400 shadow-xs ring-1 ring-emerald-400'
                          : 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-xs hover:bg-emerald-50/20'
                      }`}
                    >
                      {/* In-Cart Quantity Badge */}
                      {inCartQty > 0 && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-600 text-white font-black text-[10px] rounded-full shadow-xs flex items-center gap-1 animate-in zoom-in-50">
                          <Check className="h-3 w-3" />
                          <span>{inCartQty} in card</span>
                        </div>
                      )}

                      {/* Out of Stock Ribbon */}
                      {m.isOutOfStock && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-rose-600 text-white font-bold text-[9px] rounded uppercase tracking-wider">
                          Out of stock
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-900 line-clamp-2 leading-tight">
                          {m.name}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                          <span>{m.code}</span>
                          {m.category && (
                            <>
                              <span>·</span>
                              <span className="truncate">{m.category}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 mt-2 border-t border-slate-100 flex items-end justify-between">
                        <div>
                          <div className="text-[10px] text-slate-400">Retail Rate</div>
                          <div className="font-extrabold text-sm text-slate-900 tabular-nums">
                            {formatPKR(m.saleRate)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`text-[10px] font-bold tabular-nums ${
                              m.isOutOfStock
                                ? 'text-rose-600'
                                : m.isLowStock
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {formatNumber(stock)} {m.unit}
                          </div>
                          <div className="text-[9px] text-slate-400">in stock</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            RIGHT: ACTIVE POS CARD / CART & CHECKOUT (5 Cols)
            ═════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3.5">
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Current Sale Card</h2>
                  <span className="text-[11px] text-slate-500">
                    {cart.length} {cart.length === 1 ? 'item' : 'items'} in sale card
                  </span>
                </div>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-14 text-center text-slate-400 space-y-2">
                  <div className="h-12 w-12 rounded-full bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center mx-auto text-slate-300">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <div className="font-bold text-slate-700 text-xs">Sale Card is Empty</div>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Click any product card from the catalogue on the left to add items automatically.
                  </p>
                </div>
              ) : (
                cart.map((line) => {
                  const gross = line.quantity * Number(line.medicine.saleRate);
                  const disc = Math.min(line.discountAmount, gross);
                  const taxable = gross - disc;
                  const lineTax = (taxable * Number(line.medicine.taxPercent)) / 100;
                  const lineNet = taxable + lineTax;

                  return (
                    <div
                      key={line.medicine.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 truncate">
                            {line.medicine.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {formatPKR(line.medicine.saleRate)} × {line.quantity} {line.medicine.unit}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-extrabold text-xs text-slate-900 tabular-nums">
                            {formatPKR(lineNet)}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLine(line.medicine.id)}
                            className="text-rose-500 hover:text-rose-700 text-[10px] flex items-center gap-0.5 ml-auto mt-0.5"
                          >
                            <Trash2 className="h-3 w-3" /> Remove
                          </button>
                        </div>
                      </div>

                      {/* Stepper & Line Discount */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-xs">
                        {/* Stepper */}
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateLine(line.medicine.id, {
                                quantity: Math.max(1, line.quantity - 1),
                              })
                            }
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-slate-100 text-slate-700 transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center font-bold text-xs tabular-nums text-slate-900">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateLine(line.medicine.id, {
                                quantity: line.quantity + 1,
                              })
                            }
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-slate-100 text-slate-700 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Line Discount Input */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Disc:</span>
                          <input
                            type="number"
                            min={0}
                            value={line.discountAmount || ''}
                            onChange={(e) =>
                              updateLine(line.medicine.id, {
                                discountAmount: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            placeholder="0"
                            className="w-16 h-7 text-right text-xs bg-white border border-slate-200 rounded-lg px-1.5 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Customer & Overall Discount Inputs */}
            <div className="border-t border-slate-100 pt-3 space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="h-3 w-3 text-slate-400" />
                  Customer / Patient (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Walk-in / Patient Name"
                  className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Tag className="h-3 w-3 text-slate-400" />
                  Invoice-Level Extra Discount (PKR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded-lg text-right font-semibold focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                />
              </div>
            </div>

            {/* Financial Breakdown Summary */}
            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Gross Subtotal:</span>
                <span className="font-semibold tabular-nums">{formatPKR(totals.subtotal)}</span>
              </div>
              {(totals.lineDiscounts > 0 || totals.invDiscount > 0) && (
                <div className="flex justify-between text-emerald-700">
                  <span>Total Discounts:</span>
                  <span className="font-semibold tabular-nums">
                    - {formatPKR(totals.lineDiscounts + totals.invDiscount)}
                  </span>
                </div>
              )}
              {totals.tax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>GST / Tax:</span>
                  <span className="font-semibold tabular-nums">+ {formatPKR(totals.tax)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-extrabold text-sm text-slate-900">
                <span>Net Payable:</span>
                <span className="tabular-nums text-base text-emerald-800">
                  {formatPKR(totals.total)}
                </span>
              </div>
            </div>

            {/* Payment Section */}
            <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                  Payment Collection
                </span>
                <button
                  type="button"
                  onClick={payInFull}
                  className="text-[11px] font-bold text-[#08775A] hover:underline"
                >
                  Pay Full ({formatPKR(totals.total)})
                </button>
              </div>

              {payments.map((p, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <select
                    value={p.method}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((row, i) =>
                          i === idx
                            ? { ...row, method: e.target.value as PaymentRow['method'] }
                            : row
                        )
                      )
                    }
                    className="h-8 px-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 font-medium"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={0}
                    value={p.amount}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, amount: e.target.value } : row))
                      )
                    }
                    placeholder="Amount (PKR)"
                    className="flex-1 h-8 px-2.5 text-xs border border-slate-200 rounded-lg text-right font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />

                  {payments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePaymentRow(idx)}
                      className="p-1 text-rose-500 hover:text-rose-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addPaymentRow}
                className="text-[11px] font-semibold text-slate-500 hover:text-[#08775A] flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add Split Payment (Card + Cash)
              </button>

              <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-xs">
                <span>Outstanding Balance:</span>
                <span
                  className={`tabular-nums ${
                    totals.outstanding > 0 ? 'text-rose-700 font-extrabold' : 'text-slate-500'
                  }`}
                >
                  {formatPKR(totals.outstanding)}
                </span>
              </div>
            </div>

            {/* Complete Sale Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || cart.length === 0}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#08775A] hover:bg-[#065f46] text-white text-xs font-extrabold shadow-md disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Complete Sale &amp; Print Receipt
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice & Thermal Slip Print Modal */}
      {receipt && (
        <PharmacyInvoiceModal
          invoice={receipt}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
};
