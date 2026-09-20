import React from 'react';
import { AlertTriangle, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface DangerZoneSectionProps {
  onOpenResetModal: () => void;
}

export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({ onOpenResetModal }) => {
  return (
    <div className="bg-white rounded-xl border border-rose-200 p-5 shadow-2xs overflow-hidden relative">
      {/* Top Banner accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500" />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-rose-100 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#111827]">Danger Zone — System Maintenance</h3>
              <span className="text-[10px] uppercase font-bold tracking-wide text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-full border border-rose-200">
                Destructive Action
              </span>
            </div>
            <p className="text-[11px] text-[#52665e]">
              Purge development/testing clutter before go-live. Irreversible transactional database cleanup.
            </p>
          </div>
        </div>

        <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 flex items-center gap-1.5 self-start sm:self-auto">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
          <span>Super Admin Only</span>
        </span>
      </div>

      {/* Content Body */}
      <div className="p-4 rounded-xl bg-gradient-to-b from-rose-50/40 to-white border border-rose-100 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2 max-w-2xl">
          <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
            <span>Reset Test & Transactional Data</span>
          </h4>
          <p className="text-xs text-[#52665e] leading-relaxed">
            Deletes all runtime transactional data including <strong>Appointments, Invoices, Payment Receipts, Cashier Ledger Balances, Admissions, Bed Occupancy records, and Test Patients</strong>.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[#334155]">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Preserves Hospital Profile & Settings
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Preserves Doctors & Staff Profiles
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Preserves Departments, Rates & Panels
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Preserves Admin Accounts
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center">
          <button
            type="button"
            id="btn-open-reset-data-modal"
            onClick={onOpenResetModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-xs hover:shadow-sm transition-all cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>Reset Test Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
