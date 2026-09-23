import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Search, X, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { HospitalService } from '../../types/serviceRates';
import { formatPKR } from '../../utils/formatters';

export interface ServiceChecklistProps {
  services: HospitalService[];
  selectedServiceIds: string[];
  onChange: (selectedIds: string[]) => void;
  maxHeightClass?: string;
  label?: string;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  showCategoryBadge?: boolean;
  defaultOpen?: boolean;
}

export const ServiceChecklist: React.FC<ServiceChecklistProps> = ({
  services,
  selectedServiceIds,
  onChange,
  maxHeightClass = 'max-h-64',
  label,
  placeholder = 'Select services / procedures…',
  emptyMessage = 'No services available in this category',
  disabled = false,
  showCategoryBadge = true,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredServices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.departmentName && s.departmentName.toLowerCase().includes(q))
    );
  }, [services, searchTerm]);

  const selectedInFilteredCount = useMemo(() => {
    return filteredServices.filter((s) => selectedServiceIds.includes(s.id)).length;
  }, [filteredServices, selectedServiceIds]);

  const allFilteredSelected =
    filteredServices.length > 0 && selectedInFilteredCount === filteredServices.length;

  const handleToggle = (serviceId: string) => {
    if (disabled) return;
    if (selectedServiceIds.includes(serviceId)) {
      onChange(selectedServiceIds.filter((id) => id !== serviceId));
    } else {
      onChange([...selectedServiceIds, serviceId]);
    }
  };

  const handleToggleAllFiltered = () => {
    if (disabled || filteredServices.length === 0) return;
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredServices.map((s) => s.id));
      onChange(selectedServiceIds.filter((id) => !filteredIds.has(id)));
    } else {
      const merged = new Set([...selectedServiceIds, ...filteredServices.map((s) => s.id)]);
      onChange(Array.from(merged));
    }
  };

  const selectedTotalAmount = useMemo(() => {
    const map = new Map(services.map((s) => [s.id, s.standardRate]));
    return selectedServiceIds.reduce((sum, id) => sum + (map.get(id) || 0), 0);
  }, [services, selectedServiceIds]);

  return (
    <div ref={dropdownRef} className="relative w-full space-y-1 font-sans">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700">{label}</label>
          {selectedServiceIds.length > 0 && (
            <span className="text-[11px] font-semibold text-[#08775A]">
              {selectedServiceIds.length} selected ({formatPKR(selectedTotalAmount)})
            </span>
          )}
        </div>
      )}

      {/* Trigger Box (Looks like a clean Select dropdown) */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[38px] rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
          isOpen
            ? 'border-[#08775A] ring-2 ring-[#08775A]/20 bg-white'
            : 'border-slate-300 bg-white hover:border-slate-400'
        } ${disabled ? 'bg-slate-50 opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          {selectedServiceIds.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-800">
                {selectedServiceIds.length} {selectedServiceIds.length === 1 ? 'service' : 'services'} selected
              </span>
              <span className="font-bold text-[#08775A] bg-[#08775A]/10 px-2 py-0.5 rounded text-[11px]">
                {formatPKR(selectedTotalAmount)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedServiceIds.length > 0 && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
              title="Clear all selections"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Dropdown Popover Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col animate-in fade-in duration-100">
          {/* Top Search & Filter Bar */}
          <div className="p-2.5 border-b border-slate-200 bg-slate-50/70 space-y-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search services by name or code…"
                autoFocus
                className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
              <span>
                Showing {filteredServices.length} of {services.length} services
              </span>
              {filteredServices.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllFiltered}
                  className="font-semibold text-[#08775A] hover:text-[#065f46] hover:underline cursor-pointer"
                >
                  {allFilteredSelected ? 'Deselect all filtered' : `Select all filtered (${filteredServices.length})`}
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Checklist Items */}
          <div className={`overflow-y-auto divide-y divide-slate-100 ${maxHeightClass}`}>
            {filteredServices.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                {searchTerm ? `No services match "${searchTerm}".` : emptyMessage}
              </div>
            ) : (
              filteredServices.map((service) => {
                const isChecked = selectedServiceIds.includes(service.id);
                return (
                  <div
                    key={service.id}
                    onClick={() => handleToggle(service.id)}
                    className={`px-3 py-2 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors select-none ${
                      isChecked
                        ? 'bg-[#08775A]/5 hover:bg-[#08775A]/10'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="shrink-0 pt-0.5">
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-[#08775A]" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300 hover:text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold ${isChecked ? 'text-[#08775A]' : 'text-slate-800'}`}>
                            {service.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {service.code}
                          </span>
                          {showCategoryBadge && service.departmentName && (
                            <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                              {service.departmentName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {service.billingUnit && service.billingUnit !== 'One-Time' && (
                        <span className="text-[10px] text-slate-400 uppercase">
                          {service.billingUnit.replace('_', ' ')}
                        </span>
                      )}
                      <span className={`font-bold ${isChecked ? 'text-[#08775A]' : 'text-slate-900'}`}>
                        {formatPKR(service.standardRate)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold text-slate-600">
              {selectedServiceIds.length} selected ({formatPKR(selectedTotalAmount)})
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-2xs cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
