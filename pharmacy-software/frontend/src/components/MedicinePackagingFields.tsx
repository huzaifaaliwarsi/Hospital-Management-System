import React, { useState } from 'react';
import { Plus, X, Package, Loader2, Calculator } from 'lucide-react';
import { pharmacyApi, Unit } from '../services/pharmacyApi';
import { useToast } from '../context/ToastContext';

/**
 * One packaging level as entered in the UI — largest pack first. `relativeQty`
 * is relative to the NEXT row down (or the Base Unit if this is the last/
 * smallest row), matching how a pharmacist naturally reads packaging:
 * "1 Box = 10 Strip", "1 Strip = 10 Tablet". The flat conversion-to-base
 * (what the API actually stores) is computed from this chain, back to front.
 */
export interface PackagingLevelForm {
  unitId: string;
  relativeQty: string;
  isSaleUnit: boolean;
}

interface Props {
  units: Unit[];
  onUnitCreated: (unit: Unit) => void;
  baseUnitId: string;
  onBaseUnitIdChange: (id: string) => void;
  baseIsSaleUnit: boolean;
  onBaseIsSaleUnitChange: (sale: boolean) => void;
  defaultPurchaseUnitId: string;
  onDefaultPurchaseUnitIdChange: (id: string) => void;
  levels: PackagingLevelForm[];
  onLevelsChange: (levels: PackagingLevelForm[]) => void;
}

/** Computes the flat conversion-to-base for every level, back-to-front (largest pack last to resolve). Returns a Map<unitId, flatConversion>. */
export function computeFlatConversions(levels: PackagingLevelForm[]): Map<string, number> {
  const flat = new Map<string, number>();
  let below = 1; // base unit's own flat conversion
  for (let i = levels.length - 1; i >= 0; i--) {
    const lvl = levels[i]!;
    const rel = Number(lvl.relativeQty) || 0;
    const value = rel * below;
    if (lvl.unitId) flat.set(lvl.unitId, value);
    below = value || below;
  }
  return flat;
}

/** Reverse of computeFlatConversions — used when loading an existing medicine for edit (API gives flat values, UI needs the relative chain). */
export function flatToRelativeLevels(sortedAscending: { unitId: string; conversionToBase: number }[]): PackagingLevelForm[] {
  const descending = [...sortedAscending].sort((a, b) => b.conversionToBase - a.conversionToBase);
  return descending.map((lvl, idx) => {
    const below = idx === descending.length - 1 ? 1 : descending[idx + 1]!.conversionToBase;
    return { unitId: lvl.unitId, relativeQty: String(lvl.conversionToBase / below), isSaleUnit: false };
  });
}

/**
 * medicine-packaging-plan — the packaging builder. Matches the approved UI:
 * Base Stock Unit, a single Default Purchase Unit, a largest-to-smallest
 * "1 X = N Y" breakdown with a calculated summary, and one consolidated
 * Sale Units checklist. A simple single-unit medicine (the common case)
 * never needs to touch the breakdown at all — zero extra friction.
 */
export const MedicinePackagingFields: React.FC<Props> = ({
  units,
  onUnitCreated,
  baseUnitId,
  onBaseUnitIdChange,
  baseIsSaleUnit,
  onBaseIsSaleUnitChange,
  defaultPurchaseUnitId,
  onDefaultPurchaseUnitIdChange,
  levels,
  onLevelsChange,
}) => {
  const toast = useToast();
  const [quickAddFor, setQuickAddFor] = useState<'base' | number | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [creatingUnit, setCreatingUnit] = useState(false);

  const baseUnitName = units.find((u) => u.id === baseUnitId)?.name ?? '';
  const flatConversions = computeFlatConversions(levels);

  // Everything that can be picked as "Default Purchase Unit" or checked as a "Sale Unit" — base + every level with a unit chosen.
  const allUnitChoices = [
    ...(baseUnitId ? [{ unitId: baseUnitId, name: baseUnitName }] : []),
    ...levels.filter((l) => l.unitId).map((l) => ({ unitId: l.unitId, name: units.find((u) => u.id === l.unitId)?.name ?? '?' })),
  ];

  const handleQuickAddUnit = async (target: 'base' | number) => {
    if (!quickAddName.trim()) return;
    setCreatingUnit(true);
    try {
      const unit = await pharmacyApi.createUnit({ name: quickAddName.trim() });
      onUnitCreated(unit);
      if (target === 'base') onBaseUnitIdChange(unit.id);
      else updateLevel(target, { unitId: unit.id });
      toast.success(`Unit "${unit.name}" added.`);
      setQuickAddFor(null);
      setQuickAddName('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to add unit.');
    } finally {
      setCreatingUnit(false);
    }
  };

  const addLevel = () => onLevelsChange([...levels, { unitId: '', relativeQty: '', isSaleUnit: true }]);
  const removeLevel = (idx: number) => {
    const removedId = levels[idx]?.unitId;
    onLevelsChange(levels.filter((_, i) => i !== idx));
    if (removedId && defaultPurchaseUnitId === removedId) onDefaultPurchaseUnitIdChange(baseUnitId);
  };
  const updateLevel = (idx: number, patch: Partial<PackagingLevelForm>) =>
    onLevelsChange(levels.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const summary = [...levels]
    .filter((l) => l.unitId && flatConversions.has(l.unitId))
    .map((l) => `1 ${units.find((u) => u.id === l.unitId)?.name ?? '?'} = ${flatConversions.get(l.unitId)} ${baseUnitName || 'base unit'}`);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Base Unit *</label>
          {quickAddFor === 'base' ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddUnit('base'))}
                placeholder="Unit name"
                className="flex-1 h-9 px-3 bg-white border border-[#08775A] rounded-xl focus:outline-none text-xs"
              />
              <button type="button" disabled={creatingUnit} onClick={() => handleQuickAddUnit('base')} className="h-9 w-9 shrink-0 flex items-center justify-center bg-[#08775A] text-white rounded-xl disabled:opacity-60 cursor-pointer">
                {creatingUnit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => setQuickAddFor(null)} className="h-9 w-9 shrink-0 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <select
                value={baseUnitId}
                onChange={(e) => {
                  onBaseUnitIdChange(e.target.value);
                  if (!defaultPurchaseUnitId) onDefaultPurchaseUnitIdChange(e.target.value);
                }}
                className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              >
                <option value="">Select base unit…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setQuickAddFor('base')}
                title="Add a new unit"
                className="h-9 w-9 shrink-0 flex items-center justify-center border border-dashed border-slate-300 text-slate-500 hover:border-[#08775A] hover:text-[#08775A] rounded-xl cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Default Purchase Unit *</label>
          <select
            value={defaultPurchaseUnitId}
            onChange={(e) => onDefaultPurchaseUnitIdChange(e.target.value)}
            disabled={allUnitChoices.length === 0}
            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#08775A] disabled:bg-slate-50 disabled:text-slate-400"
          >
            {allUnitChoices.length === 0 && <option value="">Select base unit first…</option>}
            {allUnitChoices.map((c) => (
              <option key={c.unitId} value={c.unitId}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Packaging Levels (Optional) */}
      {levels.length === 0 ? (
        <div className="flex items-center justify-between p-2.5 bg-slate-50/80 border border-dashed border-slate-200 rounded-xl">
          <span className="text-xs text-slate-500 font-medium">Single unit item (no Box / Strip packs)</span>
          <button
            type="button"
            onClick={addLevel}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#08775A] bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Multi-Pack (Box, Strip...)</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
            <span className="text-xs font-semibold text-slate-700">Multi-Pack Breakdown</span>
            <button
              type="button"
              onClick={addLevel}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#08775A] hover:underline cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Level</span>
            </button>
          </div>

          {levels.map((lvl, idx) => {
            const belowName = idx === levels.length - 1 ? (baseUnitName || 'base unit') : (units.find((u) => u.id === levels[idx + 1]?.unitId)?.name ?? '?');
            return (
              <div key={idx} className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-200">
                <span className="text-xs font-medium text-slate-500 shrink-0">1</span>
                {quickAddFor === idx ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      autoFocus
                      value={quickAddName}
                      onChange={(e) => setQuickAddName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddUnit(idx))}
                      placeholder="Unit name"
                      className="flex-1 h-7.5 px-2 bg-white border border-[#08775A] rounded-md text-xs focus:outline-none"
                    />
                    <button type="button" disabled={creatingUnit} onClick={() => handleQuickAddUnit(idx)} className="h-7.5 w-7.5 shrink-0 flex items-center justify-center bg-[#08775A] text-white rounded-md disabled:opacity-60 cursor-pointer">
                      {creatingUnit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    </button>
                    <button type="button" onClick={() => setQuickAddFor(null)} className="h-7.5 w-7.5 shrink-0 flex items-center justify-center border border-slate-200 rounded-md text-slate-500 cursor-pointer">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <select
                    value={lvl.unitId}
                    onChange={(e) => (e.target.value === '__add__' ? setQuickAddFor(idx) : updateLevel(idx, { unitId: e.target.value }))}
                    className="flex-1 h-7.5 px-2 bg-white border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  >
                    <option value="">Select pack unit…</option>
                    {units.filter((u) => u.id !== baseUnitId && !levels.some((l2, i2) => i2 !== idx && l2.unitId === u.id)).map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                    <option value="__add__">+ Add new unit…</option>
                  </select>
                )}
                <span className="text-xs text-slate-400 shrink-0">=</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={lvl.relativeQty}
                  onChange={(e) => updateLevel(idx, { relativeQty: e.target.value })}
                  placeholder="Qty"
                  className="w-16 h-7.5 px-2 bg-white border border-slate-200 rounded-md text-xs text-right font-bold focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                />
                <span className="text-xs font-medium text-slate-600 shrink-0 min-w-14 truncate" title={belowName}>{belowName}</span>
                <button type="button" onClick={() => removeLevel(idx)} className="h-7.5 w-7.5 shrink-0 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer ml-auto">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          {summary.length > 0 && (
            <div className="flex items-center gap-2 pt-1 text-xs text-emerald-800 bg-emerald-50/70 border border-emerald-100 rounded-lg px-2.5 py-1.5">
              <Calculator className="h-3.5 w-3.5 text-[#08775A] shrink-0" />
              <span className="font-semibold">{summary.join('  ·  ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Consolidated Sale Units checklist — base unit + every configured pack level. */}
      {baseUnitId && (
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-[#08775A]" />
            Sellable at POS:
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer select-none hover:bg-slate-100">
              <input
                type="checkbox"
                checked={baseIsSaleUnit}
                onChange={(e) => onBaseIsSaleUnitChange(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>{baseUnitName}</span>
              <span className="text-[10px] text-slate-400 font-normal">(Base)</span>
            </label>
            {levels.filter((l) => l.unitId).map((lvl, idx) => (
              <label key={lvl.unitId + idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer select-none hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={lvl.isSaleUnit}
                  onChange={(e) => {
                    const realIdx = levels.findIndex((l2) => l2.unitId === lvl.unitId);
                    updateLevel(realIdx, { isSaleUnit: e.target.checked });
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>{units.find((u) => u.id === lvl.unitId)?.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
