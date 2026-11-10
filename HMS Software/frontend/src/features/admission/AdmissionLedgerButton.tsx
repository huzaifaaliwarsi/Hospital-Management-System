import React, { useState } from 'react';
import { AdmissionLedgerModal } from '../frontDesk/admissionRecords/AdmissionLedgerModal';

export const AdmissionLedgerButton: React.FC<{
  admissionId: string;
  className?: string;
  children?: React.ReactNode;
}> = ({ admissionId, className, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'px-2.5 py-1 text-xs font-medium rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 inline-flex items-center gap-1.5 transition-colors cursor-pointer'
        }
      >
        {children || 'View Ledger'}
      </button>
      {open && <AdmissionLedgerModal admissionId={admissionId} readOnly onClose={() => setOpen(false)} />}
    </>
  );
};
