import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Loader2,
  Building2,
  UserCheck,
  Check,
  Phone,
  CreditCard,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { PanelPatientSearchResult, searchPanelPatients } from '../../services/patientRegistryService';

export interface PanelPatientSearchSectionProps {
  selectedPatient: PanelPatientSearchResult | null;
  onSelectPatient: (patient: PanelPatientSearchResult) => void;
  onClearPatient: () => void;
  panelIdFilter?: string;
  autoLoadRecent?: boolean;
}

export const PanelPatientSearchSection: React.FC<PanelPatientSearchSectionProps> = ({
  selectedPatient,
  onSelectPatient,
  onClearPatient,
  panelIdFilter,
  autoLoadRecent = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PanelPatientSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live search debounce effect - triggers on every keystroke
  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      if (autoLoadRecent && !selectedPatient) {
        setIsSearching(true);
        searchPanelPatients('', panelIdFilter)
          .then((res) => {
            setResults(res);
            setIsOpen(true);
          })
          .catch(() => {})
          .finally(() => setIsSearching(false));
      } else {
        setResults([]);
        setIsOpen(false);
      }
      return;
    }

    setIsSearching(true);
    setError(null);

    const debounceTimer = setTimeout(async () => {
      try {
        const res = await searchPanelPatients(trimmed, panelIdFilter);
        setResults(res);
        setIsOpen(true);
      } catch (err: any) {
        setError(err?.message || 'Unable to fetch panel patients.');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => clearTimeout(debounceTimer);
  }, [query, panelIdFilter, autoLoadRecent, selectedPatient]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If a patient is selected, show a clean, professional verified card
  if (selectedPatient) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs transition-all">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-[#08775A] border border-emerald-100 flex items-center justify-center shrink-0">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-900 tracking-tight">
                  {selectedPatient.fullName}
                </span>
                <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedPatient.mrNumber}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                  {selectedPatient.panelName || 'Corporate Panel'}
                </span>
              </div>

              <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                {selectedPatient.panelMemberId && (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400">ID:</span>
                    <strong className="font-mono text-slate-700 font-semibold">{selectedPatient.panelMemberId}</strong>
                  </span>
                )}
                {selectedPatient.phone && (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400">Phone:</span>
                    <span className="font-mono text-slate-700">{selectedPatient.phone}</span>
                  </span>
                )}
                {selectedPatient.cnicOrPassport && (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400">CNIC:</span>
                    <span className="font-mono text-slate-700">{selectedPatient.cnicOrPassport}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onClearPatient();
              setQuery('');
              setResults([]);
            }}
            className="shrink-0 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
            <span>Change</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      {/* Search Input Bar */}
      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search panel patient by name, Employee/Card ID, MR#, CNIC, or phone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || query.trim()) setIsOpen(true);
          }}
          className="w-full pl-9 pr-9 py-2.5 text-xs text-slate-800 placeholder-slate-400 bg-white border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#08775A] focus:border-[#08775A] transition-all"
        />

        {/* Right side status / clear icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-[#08775A] animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setIsOpen(false);
              }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="p-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Floating Live Results Dropdown */}
      {isOpen && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-y-auto divide-y divide-slate-100">
          {results.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              {isSearching ? (
                <span>Searching panel registry...</span>
              ) : (
                <span>No matching panel patient found for &quot;<strong>{query}</strong>&quot;.</span>
              )}
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 bg-slate-50/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Matching Patients ({results.length})</span>
                <span className="text-[10px] text-slate-400 font-normal">Click to select</span>
              </div>
              {results.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => {
                    onSelectPatient(patient);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="p-3 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-900 group-hover:text-[#08775A] transition-colors">
                        {patient.fullName}
                      </span>
                      <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium">
                        {patient.mrNumber}
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-100">
                        {patient.panelName || 'Corporate'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                      {patient.panelMemberId && (
                        <span>ID: <strong className="font-mono text-slate-700">{patient.panelMemberId}</strong></span>
                      )}
                      {patient.phone && (
                        <span>Phone: <span className="font-mono text-slate-600">{patient.phone}</span></span>
                      )}
                      {patient.cnicOrPassport && (
                        <span>CNIC: <span className="font-mono text-slate-600">{patient.cnicOrPassport}</span></span>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 text-xs font-medium text-[#08775A] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    Select <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
