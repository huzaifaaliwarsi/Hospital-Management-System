import React from 'react';
import { Shield, UserCheck, ShieldAlert, UserX } from 'lucide-react';
import { AdminUser } from '../../../types/adminUser';

interface AdminUsersKPIBarProps {
  users: AdminUser[];
}

export const AdminUsersKPIBar: React.FC<AdminUsersKPIBarProps> = ({ users }) => {
  // All KPIs derive directly from the active admin-user dataset
  const totalUsers = users.length;
  const activeAdmins = users.filter(
    (u) => u.role === 'ADMIN' && u.status === 'ACTIVE'
  ).length;
  const superAdminAccounts = users.filter((u) => u.role === 'SUPER_ADMIN').length;
  const inactiveOrSuspended = users.filter(
    (u) => u.status === 'INACTIVE' || u.status === 'SUSPENDED'
  ).length;

  const cards = [
    {
      id: 'kpi-total-admins',
      label: 'Total Administrative Users',
      value: totalUsers,
      subtext: 'Governance & Operations',
      icon: Shield,
      accentBg: 'bg-[#effaf5]',
      accentBorder: 'border-[#c2e7db]',
      accentColor: 'text-[#08775A]',
      iconBg: 'bg-[#08775A]/10 text-[#08775A]',
    },
    {
      id: 'kpi-active-admins',
      label: 'Active Hospital Admins',
      value: activeAdmins,
      subtext: 'Operational Privileges',
      icon: UserCheck,
      accentBg: 'bg-emerald-50',
      accentBorder: 'border-emerald-200',
      accentColor: 'text-emerald-700',
      iconBg: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'kpi-super-admins',
      label: 'Super Admin Accounts',
      value: superAdminAccounts,
      subtext: 'Protected Institutional Roots',
      icon: ShieldAlert,
      accentBg: 'bg-teal-50',
      accentBorder: 'border-teal-200',
      accentColor: 'text-teal-800',
      iconBg: 'bg-teal-100 text-teal-800',
    },
    {
      id: 'kpi-inactive-suspended',
      label: 'Inactive / Suspended',
      value: inactiveOrSuspended,
      subtext: 'Access Disabled or Revoked',
      icon: UserX,
      accentBg: 'bg-slate-50',
      accentBorder: 'border-slate-200',
      accentColor: 'text-slate-700',
      iconBg: 'bg-slate-200 text-slate-700',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            id={card.id}
            className={`rounded-xl border ${card.accentBorder} ${card.accentBg} p-4 transition-all duration-150 flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate-600 tracking-tight">
                {card.label}
              </span>
              <div className={`p-2 rounded-lg ${card.iconBg}`}>
                <IconComponent className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className={`text-2xl font-bold tracking-tight ${card.accentColor}`}>
                {card.value}
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {card.subtext}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
