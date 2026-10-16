import React, { useEffect, useState } from 'react';
import { StaffUserService } from '../../../services/staffUserService';

/** Read the effective payment account without merging salary and commission. */
export const PreferredPaymentAccount: React.FC<{ staffId: string; purpose: 'Salary' | 'Commission'; onMethod: (method: string) => void }> = ({ staffId, purpose, onMethod }) => {
  const [account, setAccount] = useState<Record<string, any> | null>(null);
  const [message, setMessage] = useState('Loading preferred payment account…');
  useEffect(() => {
    let active = true;
    StaffUserService.fetchFullProfile(staffId).then(profile => {
      if (!active) return;
      const today = new Date().toISOString().slice(0, 10);
      const bank = (profile.bankAccount?.history ?? []).find((a: any) => a.isActive && a[`preferredFor${purpose}`] && a.effectiveFrom.slice(0, 10) <= today && (!a.effectiveTo || a.effectiveTo.slice(0, 10) > today));
      setAccount(bank ?? null); setMessage(bank ? '' : `No preferred ${purpose.toLowerCase()} account configured.`);
      if (bank) onMethod(bank.paymentMethod);
    }).catch(() => { if (active) setMessage('Unable to load the preferred payment account.'); });
    return () => { active = false; };
  }, [staffId, purpose, onMethod]);
  return <div className="rounded-lg bg-slate-50 border p-3 text-xs text-slate-600">
    <p className="font-semibold">Preferred {purpose} Account</p>
    {account ? <p>{[account.paymentMethod, account.bankName, account.accountTitle, account.accountNumber, account.walletAccount].filter(Boolean).join(' · ')}</p> : <p>{message}</p>}
  </div>;
};
