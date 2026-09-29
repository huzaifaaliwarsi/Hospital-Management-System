import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Pill,
  Truck,
  Wallet,
  Users,
  BarChart3,
  RotateCcw,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}
export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

/** pharmacy.md §3 — Management Portal (Super Admin + Admin, same screens). */
export const MANAGEMENT_NAV: NavGroup[] = [
  { id: 'dashboard', title: 'DASHBOARD', items: [{ id: 'dashboard', label: 'Pharmacy Dashboard', icon: LayoutDashboard }] },
  { id: 'pos', title: 'POS & SALES', items: [{ id: 'pos', label: 'New Sale (POS)', icon: ShoppingCart }, { id: 'invoices', label: 'Sales / Invoices', icon: ClipboardList }] },
  { id: 'hms', title: 'HMS REQUESTS', items: [{ id: 'hms-requests', label: 'Hospital Request Queue', icon: ClipboardList }] },
  { id: 'medicines', title: 'MEDICINES & STOCK', items: [{ id: 'medicines', label: 'Medicine Stock Overview', icon: Pill }, { id: 'stock-movements', label: 'Stock Movement Center', icon: RotateCcw }] },
  { id: 'vendors', title: 'VENDORS', items: [{ id: 'vendors', label: 'Vendor Directory', icon: Truck }, { id: 'purchases', label: 'Purchase / Stock In', icon: Truck }] },
  { id: 'cash', title: 'CASH & EXPENSES', items: [{ id: 'balance-sheet', label: 'My Balance Sheet', icon: Wallet }, { id: 'settlements', label: 'Account Settlement', icon: Wallet }, { id: 'expenses', label: 'Expenses', icon: Wallet }] },
  { id: 'users', title: 'USERS', items: [{ id: 'users', label: 'Account Management', icon: Users }] },
  { id: 'reports', title: 'REPORTS', items: [{ id: 'reports', label: 'Pharmacy Reports', icon: BarChart3 }] },
];

/** pharmacy.md §4 — Sales Portal, deliberately narrow. */
export const SALES_NAV: NavGroup[] = [
  { id: 'dashboard', title: 'DASHBOARD', items: [{ id: 'dashboard', label: 'Sales Dashboard', icon: LayoutDashboard }] },
  { id: 'pos', title: 'POS', items: [{ id: 'pos', label: 'New Sale', icon: ShoppingCart }, { id: 'invoices', label: 'My Sales', icon: ClipboardList }] },
  { id: 'hms', title: 'HMS REQUESTS', items: [{ id: 'hms-requests', label: 'Request Queue', icon: ClipboardList }] },
  { id: 'cash', title: 'CASH CONTROL', items: [{ id: 'balance-sheet', label: 'My Balance Sheet', icon: Wallet }, { id: 'settlements', label: 'My Account Settlement', icon: Wallet }] },
  { id: 'reports', title: 'REPORTS', items: [{ id: 'reports', label: 'My Sales Reports', icon: BarChart3 }] },
];
