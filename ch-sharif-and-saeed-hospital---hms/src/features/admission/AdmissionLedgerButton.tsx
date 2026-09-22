import React, { useState } from 'react';
import { AdmissionLedgerModal } from '../frontDesk/admissionRecords/AdmissionLedgerModal';

export const AdmissionLedgerButton: React.FC<{ admissionId: string }> = ({ admissionId }) => {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="px-2 py-1.5 text-[11px] font-semibold rounded-md text-[#08775A] hover:bg-[#effaf5]">View Ledger</button>
    {open && <AdmissionLedgerModal admissionId={admissionId} readOnly onClose={() => setOpen(false)} />}
  </>;
};
