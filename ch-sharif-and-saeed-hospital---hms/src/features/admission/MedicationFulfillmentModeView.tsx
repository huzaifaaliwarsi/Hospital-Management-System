import React, { useEffect, useMemo, useState } from 'react';
import { Pill, Home } from 'lucide-react';
import { fetchAdmissions, AdmissionRecord } from '../../services/admissionService';
import { ActiveAdmissionsView } from './ActiveAdmissionsView';

/**
 * Medication Fulfillment Mode — reuses the shared active-admissions table
 * (still the right place to drill into one admission's Medication Mode
 * tab), but adds a real Self vs Hospital-Managed split computed from the
 * same `/admissions?status=ACTIVE` data via `ActiveAdmissionsView`'s
 * header slot, so this nav item shows something genuinely its own instead
 * of looking identical to Active Admissions.
 */
export const MedicationFulfillmentModeView: React.FC = () => {
  const [active, setActive] = useState<AdmissionRecord[]>([]);

  useEffect(() => {
    fetchAdmissions({ status: 'ACTIVE' }).then(setActive).catch(() => {});
  }, []);

  const hospitalManagedCount = useMemo(() => active.filter((a) => a.medicationMode === 'HOSPITAL_MANAGED').length, [active]);
  const selfCount = active.length - hospitalManagedCount;

  return (
    <ActiveAdmissionsView
      title="Medication Fulfillment Mode"
      subtitle="Toggle Self vs Hospital Managed medication sourcing per admission."
      initialTab="medication"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-blue-50 text-blue-700">
            <Pill className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 leading-none">{hospitalManagedCount}</p>
            <p className="text-[11px] text-slate-500 mt-1">Hospital Managed <span className="text-slate-400">of {active.length} active</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 text-slate-600">
            <Home className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 leading-none">{selfCount}</p>
            <p className="text-[11px] text-slate-500 mt-1">Self (Patient Arranged) <span className="text-slate-400">of {active.length} active</span></p>
          </div>
        </div>
      </div>
    </ActiveAdmissionsView>
  );
};
