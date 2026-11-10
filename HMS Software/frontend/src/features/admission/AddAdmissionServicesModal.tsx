import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  X,
  CheckSquare,
  Square,
  Stethoscope,
  Building2,
  DollarSign,
  User,
  Plus,
  Loader2,
  Filter,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { HospitalService } from '../../types/serviceRates';
import { Department } from '../../types/department';
import { StaffUser } from '../../types/staffUser';
import { formatPKR } from '../../utils/formatters';
import { fetchServices, ServiceRatesService } from '../../services/serviceRatesService';
import { addAdmissionService } from '../../services/admissionService';
import { useToast } from '../../context/ToastContext';

export interface AddAdmissionServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  admissionId: string;
  patientName?: string;
  mrNumber?: string;
  bedLabel?: string;
  destinationInvoiceNumber?: string;
  departments: Department[];
  doctors: StaffUser[];
  onServicesAdded: () => Promise<void>;
}

export const AddAdmissionServicesModal: React.FC<AddAdmissionServicesModalProps> = ({
  isOpen,
  onClose,
  admissionId,
  patientName,
  mrNumber,
  bedLabel,
  destinationInvoiceNumber,
  departments,
  doctors,
  onServicesAdded,
}) => {
  const toast = useToast();

  const [services, setServices] = useState<HospitalService[]>(() => ServiceRatesService.getServices());
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [providerTypeFilter, setProviderTypeFilter] = useState<'ALL' | 'INTERNAL' | 'OUTSOURCED'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const [lineQty, setLineQty] = useState<number>(1);
  const [linePerformedBy, setLinePerformedBy] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load all selectable active services on mount or modal open
  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    setIsLoadingServices(true);
    setErrorMessage(null);

    Promise.all([
      fetchServices({ providerType: 'INTERNAL', status: 'ACTIVE' }).catch(() => []),
      fetchServices({ providerType: 'OUTSOURCED', status: 'ACTIVE' }).catch(() => []),
    ])
      .then(([internalList, outsourcedList]) => {
        if (!isCurrent) return;
        const map = new Map<string, HospitalService>();
        [...internalList, ...outsourcedList].forEach((s) => map.set(s.id, s));
        const combined = Array.from(map.values());
        setServices(combined);
      })
      .catch((err) => {
        if (isCurrent) {
          setErrorMessage(err?.message || 'Could not load service catalog.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingServices(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen]);

  // Extract unique active categories from loaded services
  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set).sort();
  }, [services]);

  // Active departments filter list
  const activeDepartments = useMemo(() => {
    return departments.filter((d) => d.status === 'Active' && !d.pharmacyRelated);
  }, [departments]);

  // Filtered services
  const filteredServices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return services.filter((s) => {
      // Provider type filter
      if (providerTypeFilter !== 'ALL' && s.providerType !== providerTypeFilter) {
        return false;
      }
      // Department filter
      if (selectedDeptId !== 'ALL' && s.departmentId !== selectedDeptId) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'ALL' && s.category !== selectedCategory) {
        return false;
      }
      // Search term
      if (q) {
        const matchName = s.name.toLowerCase().includes(q);
        const matchCode = s.code.toLowerCase().includes(q);
        const matchDept = (s.departmentName || '').toLowerCase().includes(q);
        const matchCat = (s.category || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDept && !matchCat) {
          return false;
        }
      }
      return true;
    });
  }, [services, searchTerm, selectedDeptId, providerTypeFilter, selectedCategory]);

  // Selection toggle
  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredServices.map((s) => s.id);
    setSelectedServiceIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const deselectAllFiltered = () => {
    const filteredSet = new Set(filteredServices.map((s) => s.id));
    setSelectedServiceIds((prev) => prev.filter((id) => !filteredSet.has(id)));
  };

  const clearAllSelected = () => {
    setSelectedServiceIds([]);
  };

  // Selected services list & total
  const selectedServicesList = useMemo(() => {
    const map = new Map(services.map((s) => [s.id, s]));
    return selectedServiceIds.map((id) => map.get(id)).filter(Boolean) as HospitalService[];
  }, [services, selectedServiceIds]);

  const selectedTotal = useMemo(() => {
    const totalUnit = selectedServicesList.reduce((sum, s) => sum + (s.standardRate || 0), 0);
    return totalUnit * (lineQty || 1);
  }, [selectedServicesList, lineQty]);

  // Submit handler
  const handleAddServices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServiceIds.length === 0) {
      setErrorMessage('Please select at least one clinical service or procedure.');
      return;
    }
    if (lineQty < 1) {
      setErrorMessage('Quantity must be at least 1.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const serviceMap = new Map(services.map((s) => [s.id, s]));
      for (const serviceId of selectedServiceIds) {
        const s = serviceMap.get(serviceId);
        await addAdmissionService(admissionId, {
          serviceRateId: serviceId,
          departmentId: s?.departmentId || undefined,
          providerType: s?.providerType || 'INTERNAL',
          outsourcedProviderId: s?.outsourcedProviderId || undefined,
          quantity: lineQty,
          performedByStaffId: linePerformedBy || undefined,
          arrangementMode: 'HOSPITAL_MANAGED',
        });
      }

      const count = selectedServiceIds.length;
      toast.success(
        `${count} ${count === 1 ? 'service' : 'services'} added to patient ledger successfully.`,
        'Services Added'
      );
      setSelectedServiceIds([]);
      setLineQty(1);
      setLinePerformedBy('');
      await onServicesAdded();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to add services to patient admission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      zIndexClass="z-[70]"
      maxWidth="5xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#08775A] to-[#065f46] text-white flex items-center justify-center font-bold shadow-xs">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Add Clinical Services &amp; Procedures
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap mt-0.5">
              {patientName && (
                <span className="font-semibold text-slate-800">{patientName}</span>
              )}
              {mrNumber && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
                    {mrNumber}
                  </span>
                </>
              )}
              {bedLabel && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-[#08775A] font-semibold">{bedLabel}</span>
                </>
              )}
              {destinationInvoiceNumber && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">
                    Posting to:{' '}
                    <span className="font-mono text-slate-700">{destinationInvoiceNumber}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      }
    >
      <form onSubmit={handleAddServices} className="space-y-4">
        {/* Error notification */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-center justify-between gap-2">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 font-bold p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Top Filters & Controls Panel */}
        <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          {/* Row 1: Search Bar + Department Filter + Provider Toggle */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Bar (Span 5) */}
            <div className="md:col-span-5 relative">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Search Services
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, code (e.g. OT-01, CBC, ECG)…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-8 py-2.5 bg-white border border-[#c2e7db] rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] transition-colors"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Department Filter (Span 4) */}
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Department Filter</span>
                <span className="text-[10px] text-slate-400 font-normal lowercase">
                  ({activeDepartments.length} available)
                </span>
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-white border border-[#c2e7db] rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] cursor-pointer transition-colors"
              >
                <option value="ALL">All Departments</option>
                {activeDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.code ? `(${d.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Provider Type Toggle (Span 3) */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Provider Source
              </label>
              <select
                value={providerTypeFilter}
                onChange={(e) => setProviderTypeFilter(e.target.value as any)}
                className="w-full text-xs px-3 py-2.5 bg-white border border-[#c2e7db] rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] cursor-pointer transition-colors"
              >
                <option value="ALL">All Sources</option>
                <option value="INTERNAL">Internal Hospital</option>
                <option value="OUTSOURCED">Outsourced (Labs / Tests)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Doctor (Optional) + Quantity + Quick Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 border-t border-slate-200/60 items-center">
            {/* Doctor / Consultant (Span 6) */}
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Doctor / Consultant <span className="font-normal text-slate-400 lowercase">(optional)</span>
              </label>
              <select
                value={linePerformedBy}
                onChange={(e) => setLinePerformedBy(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-[#c2e7db] rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] cursor-pointer transition-colors"
              >
                <option value="">Select Doctor (Optional)</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} {d.designation ? `(${d.designation})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity per service (Span 3) */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Quantity (per service)
              </label>
              <input
                type="number"
                min={1}
                value={lineQty}
                onChange={(e) => setLineQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full text-xs px-3 py-2 bg-white border border-[#c2e7db] rounded-xl font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              />
            </div>

            {/* Quick Filtered Selection Actions (Span 3) */}
            <div className="sm:col-span-3 flex items-end justify-end gap-2 pt-5">
              <button
                type="button"
                onClick={selectAllFiltered}
                disabled={filteredServices.length === 0}
                className="px-2.5 py-2 text-[11px] font-bold text-[#08775A] bg-white hover:bg-emerald-50 border border-[#c2e7db] rounded-xl shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
                title="Select all services matching current search/filter"
              >
                Select All Shown
              </button>
              <button
                type="button"
                onClick={deselectAllFiltered}
                disabled={selectedServiceIds.length === 0}
                className="px-2.5 py-2 text-[11px] font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
                title="Deselect all visible services"
              >
                Deselect Shown
              </button>
            </div>
          </div>

          {/* Category Chips Bar */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 no-scrollbar">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                Category:
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#08775A] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                }`}
              >
                All Categories ({services.length})
              </button>
              {categories.map((cat) => {
                const count = services.filter((s) => s.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-[#08775A] text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Services Counter & Pills Tray */}
        {selectedServiceIds.length > 0 && (
          <div className="bg-[#effaf5] border border-[#c2e7db] rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-[#08775A] text-white flex items-center justify-center font-bold text-xs">
                  {selectedServiceIds.length}
                </div>
                <span className="text-xs font-bold text-[#08775A]">
                  {selectedServiceIds.length} {selectedServiceIds.length === 1 ? 'Service' : 'Services'} Selected
                </span>
                <span className="text-xs font-bold font-mono text-[#08775A] bg-white px-2 py-0.5 rounded-md border border-[#c2e7db]">
                  Estimated Total: {formatPKR(selectedTotal)}
                </span>
              </div>
              <button
                type="button"
                onClick={clearAllSelected}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear All ({selectedServiceIds.length})</span>
              </button>
            </div>

            {/* Selected Pills */}
            <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto pr-1">
              {selectedServicesList.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#c2e7db] rounded-lg text-xs font-medium text-slate-800 shadow-2xs"
                >
                  <span className="font-semibold text-slate-900">{s.name}</span>
                  <span className="font-mono text-[11px] text-[#08775A] font-bold">
                    {formatPKR((s.standardRate || 0) * (lineQty || 1))}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleService(s.id);
                    }}
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results Header */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span>
            Showing <strong className="text-slate-800">{filteredServices.length}</strong> of{' '}
            <strong className="text-slate-800">{services.length}</strong> available services
          </span>
          {searchTerm && (
            <span>
              Filtering by: &ldquo;<strong className="text-slate-800">{searchTerm}</strong>&rdquo;
            </span>
          )}
        </div>

        {/* Services Grid (2 to 3 services per row, compact & easy to scan) */}
        <div className="max-h-[50vh] overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:#08775A_#effaf5]">
          {isLoadingServices ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-[#08775A]" />
              <p className="text-xs font-semibold">Loading clinical services &amp; rates catalog…</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="py-16 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-8 space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No Services Found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No services match your search or department filter. Try clearing the search or choosing &ldquo;All Departments&rdquo;.
              </p>
              {(searchTerm || selectedDeptId !== 'ALL' || selectedCategory !== 'ALL' || providerTypeFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedDeptId('ALL');
                    setSelectedCategory('ALL');
                    setProviderTypeFilter('ALL');
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#08775A] bg-white border border-[#c2e7db] rounded-xl hover:bg-emerald-50 cursor-pointer transition-colors"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredServices.map((service) => {
                const isSelected = selectedServiceIds.includes(service.id);
                return (
                  <div
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 select-none ${
                      isSelected
                        ? 'bg-[#effaf5] border-[#08775A] ring-2 ring-[#08775A]/25 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-[#08775A]/50 hover:bg-slate-50/70 hover:shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Checkbox + Code + Rate */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="shrink-0">
                          {isSelected ? (
                            <div className="h-4 w-4 rounded bg-[#08775A] text-white flex items-center justify-center">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                          ) : (
                            <div className="h-4 w-4 rounded border-2 border-slate-300 group-hover:border-[#08775A] bg-white" />
                          )}
                        </div>
                        {service.code && (
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            {service.code}
                          </span>
                        )}
                      </div>
                      <div className="font-mono font-bold text-xs sm:text-sm text-[#08775A] tabular-nums shrink-0">
                        {formatPKR(service.standardRate || 0)}
                      </div>
                    </div>

                    {/* Middle: Service Name */}
                    <div className="min-w-0 my-0.5">
                      <div
                        className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#08775A] transition-colors line-clamp-2 leading-snug"
                        title={service.name}
                      >
                        {service.name}
                      </div>
                    </div>

                    {/* Bottom: Department + Category / Unit */}
                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
                      <span
                        className="truncate max-w-[130px] font-semibold text-slate-600"
                        title={service.departmentName || 'General Hospital'}
                      >
                        {service.departmentName || 'General'}
                      </span>
                      {service.category && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0 text-[9.5px]">
                          {service.category}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="pt-3 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
            <span>
              Selected:{' '}
              <strong className="text-slate-900 font-bold">{selectedServiceIds.length}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Total Rate:{' '}
              <strong className="font-mono font-bold text-[#08775A] text-sm tabular-nums">
                {formatPKR(selectedTotal)}
              </strong>
            </span>
            {lineQty > 1 && (
              <span className="text-slate-400 font-normal">
                ({lineQty}x each)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedServiceIds.length === 0}
              className="px-6 py-2.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Adding Services…</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>
                    Add {selectedServiceIds.length > 0 ? selectedServiceIds.length : ''} Service
                    {selectedServiceIds.length === 1 ? '' : 's'} to Stay
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
