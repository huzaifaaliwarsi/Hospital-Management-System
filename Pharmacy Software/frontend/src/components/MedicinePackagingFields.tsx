import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Package, Loader2, AlertCircle, Layers } from 'lucide-react';
import { pharmacyApi, Unit } from '../services/pharmacyApi';
import { useToast } from '../context/ToastContext';

export interface PackagingLevelForm {
  unitId: string;
  toUnitId?: string;
  relativeQty: string;
  isSaleUnit: boolean;
}

export interface CalculatedLevelInfo {
  unitId: string;
  unitName: string;
  toUnitId: string;
  toUnitName: string;
  relativeQty: number;
  conversionToBase: number;
}

export interface PackagingCalculationResult {
  flatConversions: Map<string, number>;
  calculatedLevels: CalculatedLevelInfo[];
  errors: string[];
  isValid: boolean;
}

export function computeFlatConversions(
  levels: PackagingLevelForm[],
  baseUnitId?: string,
  units: Unit[] = []
): PackagingCalculationResult {
  const flatConversions = new Map<string, number>();
  const errors: string[] = [];

  if (!baseUnitId) {
    return { flatConversions, calculatedLevels: [], errors, isValid: false };
  }

  flatConversions.set(baseUnitId, 1);

  if (!levels || levels.length === 0) {
    return { flatConversions, calculatedLevels: [], errors: [], isValid: true };
  }

  const unitMap = new Map(units.map((u) => [u.id, u.name]));
  const baseName = unitMap.get(baseUnitId) || 'Base Unit';
  const seenUnits = new Set<string>();

  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i]!;
    if (!lvl.unitId) {
      errors.push(`Level ${i + 1}: Select a packaging unit.`);
      continue;
    }
    if (lvl.unitId === baseUnitId) {
      const uName = unitMap.get(lvl.unitId) || 'Unit';
      errors.push(`"${uName}" is already the Base Unit.`);
      continue;
    }
    if (seenUnits.has(lvl.unitId)) {
      const uName = unitMap.get(lvl.unitId) || 'Unit';
      errors.push(`"${uName}" cannot appear more than once.`);
      continue;
    }
    seenUnits.add(lvl.unitId);

    const effectiveTo = lvl.toUnitId || baseUnitId;
    if (lvl.unitId === effectiveTo) {
      const uName = unitMap.get(lvl.unitId) || 'Unit';
      errors.push(`"${uName}" cannot contain itself.`);
      continue;
    }

    const relQty = Number(lvl.relativeQty);
    if (!lvl.relativeQty || isNaN(relQty) || relQty <= 0) {
      const uName = unitMap.get(lvl.unitId) || 'Unit';
      errors.push(`Enter a valid quantity (> 0) for "${uName}".`);
    }
  }

  let progress = true;
  let remaining = levels.filter((l) => l.unitId && l.unitId !== baseUnitId && Number(l.relativeQty) > 0);

  while (progress && remaining.length > 0) {
    progress = false;
    const nextRemaining: PackagingLevelForm[] = [];

    for (const lvl of remaining) {
      const effectiveTo = lvl.toUnitId || baseUnitId;
      if (flatConversions.has(effectiveTo)) {
        const targetConv = flatConversions.get(effectiveTo)!;
        const relQty = Number(lvl.relativeQty);
        const resolved = relQty * targetConv;
        flatConversions.set(lvl.unitId, resolved);
        progress = true;
      } else {
        nextRemaining.push(lvl);
      }
    }
    remaining = nextRemaining;
  }

  if (remaining.length > 0) {
    for (const lvl of remaining) {
      const uName = unitMap.get(lvl.unitId) || 'Unit';
      errors.push(`"${uName}": circular conversion or not linked to ${baseName}.`);
    }
  }

  for (const lvl of levels) {
    if (lvl.unitId && flatConversions.has(lvl.unitId)) {
      const conv = flatConversions.get(lvl.unitId)!;
      if (conv <= 1) {
        const uName = unitMap.get(lvl.unitId) || 'Unit';
        errors.push(`1 ${uName} = ${conv} ${baseName}. Must be greater than 1.`);
      }
    }
  }

  const calculatedLevels: CalculatedLevelInfo[] = levels
    .filter((l) => l.unitId && flatConversions.has(l.unitId))
    .map((l) => {
      const effectiveTo = l.toUnitId || baseUnitId;
      return {
        unitId: l.unitId,
        unitName: unitMap.get(l.unitId) || l.unitId,
        toUnitId: effectiveTo,
        toUnitName: unitMap.get(effectiveTo) || effectiveTo,
        relativeQty: Number(l.relativeQty) || 0,
        conversionToBase: flatConversions.get(l.unitId) || 0,
      };
    })
    .sort((a, b) => b.conversionToBase - a.conversionToBase);

  return {
    flatConversions,
    calculatedLevels,
    errors,
    isValid: errors.length === 0,
  };
}

export function flatToRelativeLevels(
  sortedAscending: { unitId: string; conversionToBase: number }[],
  baseUnitId?: string
): PackagingLevelForm[] {
  const descending = [...sortedAscending].sort((a, b) => b.conversionToBase - a.conversionToBase);
  return descending.map((lvl, idx) => {
    const below = idx === descending.length - 1 ? null : descending[idx + 1]!;
    const belowConversion = below ? below.conversionToBase : 1;
    const belowUnitId = below ? below.unitId : (baseUnitId || '');
    const relQty = belowConversion > 0 ? lvl.conversionToBase / belowConversion : lvl.conversionToBase;
    return {
      unitId: lvl.unitId,
      toUnitId: belowUnitId,
      relativeQty: String(relQty),
      isSaleUnit: true,
    };
  });
}

export function validatePackagingState(
  packaging: {
    baseUnitId: string;
    defaultPurchaseUnitId: string;
    baseIsSaleUnit: boolean;
    levels: PackagingLevelForm[];
  },
  units: Unit[] = []
): string | null {
  if (!packaging.baseUnitId) return 'Base Stock Unit is required.';
  if (!packaging.defaultPurchaseUnitId) return 'Default Purchase Unit is required.';

  const calc = computeFlatConversions(packaging.levels, packaging.baseUnitId, units);
  if (!calc.isValid) {
    return calc.errors[0] || 'Please fix packaging level errors.';
  }

  const validPurchaseUnitIds = new Set([
    packaging.baseUnitId,
    ...calc.calculatedLevels.map((l) => l.unitId),
  ]);
  if (!validPurchaseUnitIds.has(packaging.defaultPurchaseUnitId)) {
    return 'Default Purchase Unit must be either the Base Unit or a valid packaging level.';
  }

  const hasSaleUnit =
    packaging.baseIsSaleUnit ||
    packaging.levels.some((l) => l.isSaleUnit && calc.flatConversions.has(l.unitId));
  if (!hasSaleUnit) {
    return 'At least one unit must be marked sellable at POS.';
  }

  return null;
}

export function createPackagingPayload(packaging: {
  baseUnitId: string;
  defaultPurchaseUnitId: string;
  baseIsSaleUnit: boolean;
  levels: PackagingLevelForm[];
}) {
  const { flatConversions } = computeFlatConversions(packaging.levels, packaging.baseUnitId);
  return {
    baseUnitId: packaging.baseUnitId,
    baseIsPurchaseUnit: packaging.defaultPurchaseUnitId === packaging.baseUnitId,
    baseIsSaleUnit: packaging.baseIsSaleUnit,
    packagingLevels: packaging.levels
      .filter((l) => l.unitId && (flatConversions.get(l.unitId) ?? 0) > 1)
      .map((l) => ({
        unitId: l.unitId,
        conversionToBase: flatConversions.get(l.unitId) ?? 0,
        isPurchaseUnit: l.unitId === packaging.defaultPurchaseUnitId,
        isSaleUnit: l.isSaleUnit,
      })),
  };
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

  const baseUnit = units.find((u) => u.id === baseUnitId);
  const baseUnitName = baseUnit?.name ?? '';

  const calculation = useMemo(
    () => computeFlatConversions(levels, baseUnitId, units),
    [levels, baseUnitId, units]
  );

  // Available options for Default Purchase Unit
  const purchaseUnitChoices = useMemo(() => {
    if (!baseUnitId) return [];
    const list: { unitId: string; label: string }[] = [
      { unitId: baseUnitId, label: `${baseUnitName || 'Base Unit'} (Single Item)` },
    ];
    for (const lvl of calculation.calculatedLevels) {
      list.push({
        unitId: lvl.unitId,
        label: `${lvl.unitName} (${lvl.conversionToBase} ${baseUnitName}s)`,
      });
    }
    return list;
  }, [baseUnitId, baseUnitName, calculation.calculatedLevels]);

  // Dynamic chain summary (e.g. 1 Box = 10 Strip • 1 Strip = 10 Tablet ➔ 1 Box = 100 Tablets)
  const chainSummary = useMemo(() => {
    if (!baseUnitId || calculation.calculatedLevels.length === 0) return null;
    const parts = calculation.calculatedLevels.map(
      (lvl) => `1 ${lvl.unitName} = ${lvl.relativeQty} ${lvl.toUnitName}`
    );
    const highest = calculation.calculatedLevels[0];
    if (!highest) return null;
    return {
      chainText: parts.join('  •  '),
      totalText: `1 ${highest.unitName} = ${highest.conversionToBase} ${baseUnitName || 'base unit'}s`,
    };
  }, [baseUnitId, baseUnitName, calculation.calculatedLevels]);

  // Keep Default Purchase Unit valid, and smartly auto-select highest pack when a new pack is created
  useEffect(() => {
    if (!baseUnitId) return;
    const isValidChoice = purchaseUnitChoices.some((c) => c.unitId === defaultPurchaseUnitId);
    if (!defaultPurchaseUnitId || !isValidChoice) {
      // If we have calculated levels (like Box), default to highest pack, else baseUnitId
      const highestPack = calculation.calculatedLevels[0];
      onDefaultPurchaseUnitIdChange(highestPack ? highestPack.unitId : baseUnitId);
    }
  }, [baseUnitId, defaultPurchaseUnitId, purchaseUnitChoices, calculation.calculatedLevels, onDefaultPurchaseUnitIdChange]);

  const handleQuickAddUnit = async (target: 'base' | number) => {
    const trimmed = quickAddName.trim();
    if (!trimmed) return;
    setCreatingUnit(true);
    try {
      const unit = await pharmacyApi.createUnit({ name: trimmed });
      onUnitCreated(unit);
      if (target === 'base') {
        onBaseUnitIdChange(unit.id);
      } else {
        updateLevel(target, { unitId: unit.id });
      }
      toast.success(`Unit "${unit.name}" added.`);
      setQuickAddFor(null);
      setQuickAddName('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to add unit.');
    } finally {
      setCreatingUnit(false);
    }
  };

  const addLevel = () => {
    if (!baseUnitId) {
      toast.error('Select a Base Unit first.');
      return;
    }
    const prevUnitId = levels.length > 0 ? levels[levels.length - 1]?.unitId : baseUnitId;
    const next: PackagingLevelForm[] = [
      ...levels,
      {
        unitId: '',
        toUnitId: prevUnitId || baseUnitId,
        relativeQty: '',
        isSaleUnit: true,
      },
    ];
    onLevelsChange(next);
  };

  const removeLevel = (idx: number) => {
    const removedUnitId = levels[idx]?.unitId;
    const next = levels.filter((_, i) => i !== idx);
    onLevelsChange(next);
    if (removedUnitId && defaultPurchaseUnitId === removedUnitId) {
      onDefaultPurchaseUnitIdChange(baseUnitId);
    }
  };

  const updateLevel = (idx: number, patch: Partial<PackagingLevelForm>) => {
    const next = levels.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onLevelsChange(next);
  };

  return (
    <div className="space-y-3.5 text-xs">
      {/* ─────────────────────────────────────────────────────────────
          STEP 1: BASE STOCK UNIT (Full Width, Crisp & Aligned)
          ───────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full bg-emerald-100 text-[#08775A] font-extrabold flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Base Stock Unit *</span>
          </label>
          <span className="text-[11px] text-slate-400 font-normal">
            Smallest loose unit counted in inventory
          </span>
        </div>

        {quickAddFor === 'base' ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddUnit('base'))}
              placeholder="e.g. Tablet, Capsule, Vial"
              className="flex-1 h-9 px-3 bg-white border border-[#0e7d5a] rounded-xl font-medium focus:outline-none text-xs"
            />
            <button
              type="button"
              disabled={creatingUnit}
              onClick={() => handleQuickAddUnit('base')}
              className="h-9 px-4 bg-[#0e7d5a] text-white rounded-xl font-bold disabled:opacity-60 cursor-pointer shadow-2xs hover:bg-[#0c6b4d] transition-colors"
            >
              {creatingUnit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Unit'}
            </button>
            <button
              type="button"
              onClick={() => { setQuickAddFor(null); setQuickAddName(''); }}
              className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={baseUnitId}
              onChange={(e) => {
                const newId = e.target.value;
                onBaseUnitIdChange(newId);
                if (levels.length > 0) {
                  onLevelsChange(
                    levels.map((l) => (!l.toUnitId || l.toUnitId === baseUnitId ? { ...l, toUnitId: newId } : l))
                  );
                }
              }}
              className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
            >
              <option value="">Select Base Unit (e.g. Tablet, Capsule, Bottle, Vial)…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setQuickAddFor('base'); setQuickAddName(''); }}
              title="Add a new unit to the catalog"
              className="h-9 px-3 flex items-center gap-1.5 border border-dashed border-emerald-300 text-[#0e7d5a] bg-emerald-50/50 hover:bg-emerald-50 rounded-xl text-xs font-bold cursor-pointer shrink-0 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Unit</span>
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STEP 2: PACKAGING HIERARCHY (Box / Strip breakdown)
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full bg-emerald-100 text-[#08775A] font-extrabold flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Packaging Hierarchy</span>
            <span className="font-normal text-[11px] text-slate-400 ml-1">
              (Optional: Box, Strip, Carton)
            </span>
          </label>
          <button
            type="button"
            onClick={addLevel}
            disabled={!baseUnitId}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#0e7d5a] bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Level</span>
          </button>
        </div>

        {levels.length === 0 ? (
          <div className="py-2.5 px-3 bg-white border border-dashed border-slate-200 rounded-lg text-slate-500 text-[11px] flex items-center justify-between">
            <span>
              Single item only — no Box or Strip configured.
              {baseUnitName ? ` Stock will be tracked strictly in ${baseUnitName}s.` : ''}
            </span>
            <button
              type="button"
              onClick={addLevel}
              disabled={!baseUnitId}
              className="text-[11px] font-bold text-[#0e7d5a] hover:underline cursor-pointer disabled:opacity-40 ml-2 shrink-0"
            >
              + Configure Box / Strip
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {levels.map((lvl, idx) => {
              const effectiveToId = lvl.toUnitId || baseUnitId;
              const isQuickAddingThis = quickAddFor === idx;
              const flatVal = calculation.flatConversions.get(lvl.unitId);

              return (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-2xs"
                >
                  <span className="text-xs font-extrabold text-slate-400 shrink-0">1</span>

                  {/* Pack Unit */}
                  <div className="w-32 shrink-0">
                    {isQuickAddingThis ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={quickAddName}
                          onChange={(e) => setQuickAddName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddUnit(idx))}
                          placeholder="Pack name"
                          className="w-full h-8 px-2 bg-white border border-[#0e7d5a] rounded-md text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={creatingUnit}
                          onClick={() => handleQuickAddUnit(idx)}
                          className="h-8 px-2 bg-[#0e7d5a] text-white rounded-md text-[11px] font-bold cursor-pointer"
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => { setQuickAddFor(null); setQuickAddName(''); }}
                          className="h-8 w-6 flex items-center justify-center text-slate-400 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={lvl.unitId}
                        onChange={(e) => {
                          if (e.target.value === '__add__') {
                            setQuickAddFor(idx);
                            setQuickAddName('');
                          } else {
                            updateLevel(idx, { unitId: e.target.value });
                          }
                        }}
                        className="w-full h-8 px-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                      >
                        <option value="">Select Pack…</option>
                        {units
                          .filter((u) => u.id !== baseUnitId && !levels.some((l2, i2) => i2 !== idx && l2.unitId === u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        <option value="__add__">+ Add new unit…</option>
                      </select>
                    )}
                  </div>

                  <span className="text-xs font-extrabold text-slate-400 shrink-0">=</span>

                  {/* Quantity */}
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={lvl.relativeQty}
                    onChange={(e) => updateLevel(idx, { relativeQty: e.target.value })}
                    placeholder="Qty"
                    className="w-16 h-8 px-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-md text-xs text-center font-extrabold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />

                  {/* Sub Unit */}
                  <div className="w-28 shrink-0">
                    <select
                      value={effectiveToId}
                      onChange={(e) => updateLevel(idx, { toUnitId: e.target.value })}
                      className="w-full h-8 px-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                    >
                      {baseUnitId && (
                        <option value={baseUnitId}>{baseUnitName || 'Base Unit'}</option>
                      )}
                      {units
                        .filter((u) => u.id !== baseUnitId && u.id !== lvl.unitId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Calculated Conversion Result Pill */}
                  {flatVal && flatVal > 1 && (
                    <span className="inline-flex items-center text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md whitespace-nowrap">
                      = {flatVal} {baseUnitName}s
                    </span>
                  )}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => removeLevel(idx)}
                    title="Remove level"
                    className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0 ml-auto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}

            {/* Chain breakdown summary badge */}
            {chainSummary && calculation.errors.length === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-emerald-50/80 border border-emerald-200/90 rounded-lg text-xs font-semibold text-emerald-950 mt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9.5px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-[#08775A] text-white">
                    Summary
                  </span>
                  <span className="text-emerald-900 font-medium">
                    {chainSummary.chainText}
                  </span>
                </div>
                <div className="font-extrabold text-[#08775A] bg-white px-2.5 py-0.5 rounded-md border border-emerald-200 shadow-2xs font-mono">
                  {chainSummary.totalText}
                </div>
              </div>
            )}

            {/* Errors */}
            {calculation.errors.length > 0 && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
                {calculation.errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] font-medium text-rose-700">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STEP 3: DEFAULT PURCHASE UNIT (Full Width, Intuitive)
          ───────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full bg-emerald-100 text-[#08775A] font-extrabold flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Default Purchase Unit *</span>
          </label>
          <span className="text-[11px] text-slate-400 font-normal">
            Vendor order &amp; billing unit (e.g. Box)
          </span>
        </div>

        <select
          value={defaultPurchaseUnitId}
          onChange={(e) => onDefaultPurchaseUnitIdChange(e.target.value)}
          disabled={purchaseUnitChoices.length === 0}
          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] disabled:bg-slate-50 disabled:text-slate-400"
        >
          {purchaseUnitChoices.length === 0 && <option value="">Select Base Unit first…</option>}
          {purchaseUnitChoices.map((c) => (
            <option key={c.unitId} value={c.unitId}>{c.label}</option>
          ))}
        </select>
        {defaultPurchaseUnitId && (
          <p className="text-[10.5px] text-slate-500 font-medium">
            Vendor purchases will default to this unit. Stock will automatically convert into <strong className="text-slate-700 font-bold">{baseUnitName || 'base units'}</strong>.
          </p>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          POS SELLABLE UNITS (Horizontal Toggle Bar)
          ───────────────────────────────────────────────────────────── */}
      {baseUnitId && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 shrink-0">
            <Package className="h-3.5 w-3.5 text-[#0e7d5a]" />
            POS Sellable Units:
          </span>

          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={baseIsSaleUnit}
              onChange={(e) => onBaseIsSaleUnitChange(e.target.checked)}
              className="rounded text-[#0e7d5a] focus:ring-[#0e7d5a]"
            />
            <span>{baseUnitName || 'Base Unit'}</span>
          </label>

          {calculation.calculatedLevels.map((lvl) => {
            const realIdx = levels.findIndex((l) => l.unitId === lvl.unitId);
            const isChecked = realIdx >= 0 ? levels[realIdx]?.isSaleUnit ?? true : true;

            return (
              <label
                key={lvl.unitId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (realIdx >= 0) {
                      updateLevel(realIdx, { isSaleUnit: e.target.checked });
                    }
                  }}
                  className="rounded text-[#0e7d5a] focus:ring-[#0e7d5a]"
                />
                <span>{lvl.unitName}</span>
                <span className="text-[10px] font-normal text-slate-400">({lvl.conversionToBase} {baseUnitName}s)</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};
