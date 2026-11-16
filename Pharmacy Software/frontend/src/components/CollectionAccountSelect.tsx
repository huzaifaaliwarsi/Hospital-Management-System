import { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';

export function CollectionAccountSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiClient.get('/pharmacy/collection-accounts').then(r => { if (active) setAccounts(r.data.data); })
      .catch(() => { if (active) setError('Unable to load authorized collection accounts.'); });
    return () => { active = false; };
  }, []);
  return <label className="block text-xs font-medium">Receiving Bank / Online Account
    <select required value={value} onChange={e => onChange(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
      <option value="">Select account</option>
      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
    {error && <span role="alert" className="text-red-700">{error}</span>}
  </label>;
}
