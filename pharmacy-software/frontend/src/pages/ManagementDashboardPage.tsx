import React, { useEffect, useState } from 'react';
import { Loader2, TrendingUp, ShoppingBag, Package, AlertTriangle, PackageX, CalendarX, Ban, Truck, Clock, Wallet, ClipboardList } from 'lucide-react';
import { pharmacyApi, ManagementDashboard } from '../services/pharmacyApi';
import { KpiCard } from '../components/KpiCard';
import { formatPKR } from '../utils/format';

export const ManagementDashboardPage: React.FC = () => {
  const [data, setData] = useState<ManagementDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pharmacyApi
      .getManagementDashboard()
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
        <h2 className="text-lg font-bold text-[#111827]">Pharmacy Dashboard</h2>
        <p className="text-xs text-[#52665e]">Sales, profit, purchases, stock, expiry, vendor payable, cash and settlement overview — pharmacy.md §5.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Sales Today" value={formatPKR(data.salesToday)} icon={TrendingUp} />
        <KpiCard label="Purchases Today" value={formatPKR(data.purchasesToday)} icon={ShoppingBag} />
        <KpiCard label="Current Stock Value" value={formatPKR(data.currentStockValue)} icon={Package} />
        <KpiCard label="Low Stock" value={String(data.lowStockCount)} icon={AlertTriangle} tone={data.lowStockCount > 0 ? 'warning' : 'default'} />
        <KpiCard label="Out of Stock" value={String(data.outOfStockCount)} icon={PackageX} tone={data.outOfStockCount > 0 ? 'danger' : 'default'} />
        <KpiCard label="Near Expiry" value={String(data.nearExpiryCount)} icon={CalendarX} tone={data.nearExpiryCount > 0 ? 'warning' : 'default'} />
        <KpiCard label="Expired / Quarantine" value={String(data.expiredCount)} icon={Ban} tone={data.expiredCount > 0 ? 'danger' : 'default'} />
        <KpiCard label="Vendor Payable" value={formatPKR(data.vendorPayable)} icon={Truck} />
        <KpiCard label="Pending HMS Requests" value={String(data.pendingHmsRequests)} icon={ClipboardList} tone={data.pendingHmsRequests > 0 ? 'warning' : 'default'} />
        <KpiCard label="Pending Settlements" value={String(data.pendingSettlements)} icon={Clock} tone={data.pendingSettlements > 0 ? 'warning' : 'default'} />
        <KpiCard label="My Expected Cash" value={formatPKR(data.expectedCash)} icon={Wallet} />
      </div>
    </div>
  );
};
