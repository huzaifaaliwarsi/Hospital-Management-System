import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  X,
  Loader2,
  Building2,
  UserCheck,
  Check,
  Phone,
  CreditCard,
} from 'lucide-react';
import { PanelPatientSearchResult, searchPanelPatients } from '../../services/patientRegistryService';
import { PanelBadge } from './PanelBadge';

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
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (searchTerm = query) => {
    setIsSearching(true);
    setError(null);
    try {
      const res = await searchPanelPatients(searchTerm, panelIdFilter);
      setResults(res);
      setHasSearched(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to search Panel Patient Registry.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (autoLoadRecent && !selectedPatient && results.length === 0) {
      handleSearch('');
    }
  }, [autoLoadRecent, selectedPatient]);

  // If a patient is selected, display their verified registry card
  if (selectedPatient) {
    return (
      <div className="bg-white border-2 border-emerald-500/60 rounded-xl p-3.5 shadow-2xs space-y-2 animate-in fade-in">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 text-[#08775A] flex items-center justify-center shrink-0 mt-0.5 font-bold">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900 truncate">{selectedPatient.fullName}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                  MR# {selectedPatient.mrNumber}
                </span>
                <PanelBadge />
              </div>

              <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-emerald-800">{selectedPatient.panelName || 'Corporate Panel'}</span>
                {selectedPatient.panelMemberId && (
                  <span>• Member ID: <b className="font-mono text-slate-800">{selectedPatient.panelMemberId}</b></span>
                )}
                {selectedPatient.phone && (
                  <span>• Phone: <span className="font-mono">{selectedPatient.phone}</span></span>
                )}
                {selectedPatient.cnicOrPassport && (
                  <span>• CNIC: <span className="font-mono">{selectedPatient.cnicOrPassport}</span></span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClearPatient}
            className="shrink-0 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <X className="h-3 w-3" /> Change Patient
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 space-y-3 animate-in fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
          <Building2 className="h-4 w-4 text-amber-700" />
          <span>Search Panel Patient Registry</span>
        </div>
        <span className="text-[10px] text-amber-800 font-medium">
          Search existing patient or type name below to register new
        </span>
      </div>

      {/* Search Input Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by Patient Name, MR Number, CNIC or Phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="w-full pl-9 pr-3 py-2 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>

        <button
          type="button"
          onClick={() => handleSearch()}
          disabled={isSearching}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
        >
          {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Search
        </button>

        <button
          type="button"
          onClick={() => {
            setQuery('');
            handleSearch('');
          }}
          disabled={isSearching}
          className="px-2.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-amber-300 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          Browse All
        </button>
      </div>

      {error && (
        <div className="p-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Results Dropdown / Table */}
      {hasSearched && (
        <div className="mt-2 space-y-1.5 border border-amber-200 bg-white rounded-lg p-2 max-h-56 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No matching panel patients found. You can proceed below to register a new panel patient.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="text-[10px] font-bold text-slate-500 uppercase px-2 py-1 flex items-center justify-between">
                <span>Matching Panel Patients ({results.length})</span>
                <span className="text-[9px] text-amber-700 font-normal">Click to auto-fill form</span>
              </div>
              {results.map((patient) => (
                <div
                  key={patient.id}
                  className="p-2 hover:bg-amber-50/50 rounded flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{patient.fullName}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                        {patient.mrNumber}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {patient.panelName || 'Corporate'}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      {patient.panelMemberId && <span>Member ID: <b className="font-mono">{patient.panelMemberId}</b></span>}
                      {patient.phone && <span>Phone: <span className="font-mono">{patient.phone}</span></span>}
                      {patient.cnicOrPassport && <span>CNIC: <span className="font-mono">{patient.cnicOrPassport}</span></span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectPatient(patient);
                      setResults([]);
                      setHasSearched(false);
                      setQuery('');
                    }}
                    className="shrink-0 px-2.5 py-1 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-md shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Check className="h-3 w-3" /> Use Patient
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
