import React from 'react';
import { Calendar } from 'lucide-react';
import type { CurrentUser } from '../types';

const ROLE_LABEL: Record<CurrentUser['role'], string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  SALES_DISPENSING: 'Sales / Dispensing',
};

export const TopBar: React.FC<{ user: CurrentUser; pageTitle: string }> = ({ user, pageTitle }) => {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <header className="h-14 bg-white border-b border-[#e2eae5] flex items-center justify-between px-6 sticky top-0 z-30">
      <h1 className="text-sm font-bold text-[#111827]">{pageTitle}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-[#52665e]">
          <Calendar className="h-3.5 w-3.5" /> {today}
        </div>
        <div className="flex items-center gap-2 pl-4 border-l border-[#e2eae5]">
          <div className="h-8 w-8 rounded-full bg-[#129b70] text-white flex items-center justify-center text-xs font-bold">
            {user.fullName.slice(0, 1).toUpperCase()}
          </div>
          <div className="leading-tight">
            <div className="text-xs font-bold text-[#111827]">{user.fullName}</div>
            <div className="text-[10px] text-[#52665e]">{ROLE_LABEL[user.role]}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
