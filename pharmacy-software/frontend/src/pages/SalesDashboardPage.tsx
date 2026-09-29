import React, { useEffect, useState } from 'react';
import { Loader2, TrendingUp, Banknote, CreditCard, Wallet, ClipboardList } from 'lucide-react';
import { pharmacyApi, SalesDashboard } from '../services/pharmacyApi';
import { KpiCard } from '../components/KpiCard';
import { formatPKR } from '../utils/format';

export const SalesDashboardPage: React.FC = () => {
  const [data, setData] = useState<SalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pharmacyApi
      .getSalesDashboard()
      .then(setData)
      .catch(() => setError('Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#52665e] gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
      </div>
    );
  }
  if (error || !data) {
    return <div className="p-10 text-center text-rose-600 text-sm">{error ?? 'No data.'}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#111827]">Sales Dashboard</h2>
        <p className="text-xs text-[#52665e]">My sales, cash/card/online, expected cash — pharmacy.md §5.1.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard label="My Sales Today" value={formatPKR(data.mySalesToday)} icon={TrendingUp} />
        <KpiCard label="Cash Collection" value={formatPKR(data.cashCollectionToday)} icon={Banknote} />
        <KpiCard label="Card / Online" value={formatPKR(data.cardOnlineCollectionToday)} icon={CreditCard} />
        <KpiCard label="Pending HMS Requests" value={String(data.pendingHmsRequests)} icon={ClipboardList} tone={data.pendingHmsRequests > 0 ? 'warning' : 'default'} />
        <KpiCard label="My Expected Cash" value={formatPKR(data.expectedCash)} icon={Wallet} />
      </div>
    </div>
  );
};
