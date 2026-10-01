import React, { useState } from 'react';
import { Search, Bell, MessageSquare, Moon, Sun, ChevronDown } from 'lucide-react';
import type { CurrentUser } from '../types';

const ROLE_LABEL: Record<CurrentUser['role'], string> = {
  SUPER_ADMIN: 'Pharmacy Admin',
  ADMIN: 'Pharmacy Admin',
  SALES_DISPENSING: 'Pharmacy Cashier',
};

interface TopBarProps {
  user: CurrentUser;
  pageTitle: string;
  onSearch?: (query: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ user, pageTitle, onSearch }) => {
  const [searchVal, setSearchVal] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchVal(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-8 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{pageTitle}</h1>
      </div>

      {/* Middle & Right Section */}
      <div className="flex items-center gap-4">
        {/* Search Bar matching Reference Image */}
        <div className="relative w-80 hidden md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchVal}
            onChange={handleSearchChange}
            placeholder="Search medicines, patients, orders..."
            className="w-full h-9.5 pl-10 pr-4 text-xs bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1.5 border-l border-slate-100 pl-3">
          {/* Notifications */}
          <button
            type="button"
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100/70 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          {/* Messages */}
          <button
            type="button"
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100/70 transition-colors cursor-pointer"
            title="Messages & Requests"
          >
            <MessageSquare className="h-4.5 w-4.5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
          </button>

          {/* Dark / Light Toggle */}
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100/70 transition-colors cursor-pointer"
            title="Toggle theme"
          >
            {darkMode ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
        </div>

        {/* User Profile matching Reference */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-100">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-xs font-bold shadow-sm ring-2 ring-emerald-500/20">
            {user.fullName ? user.fullName.slice(0, 1).toUpperCase() : 'U'}
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <div className="text-xs font-bold text-slate-900">{user.fullName || 'Admin'}</div>
            <div className="text-[11px] text-slate-400 font-medium">{ROLE_LABEL[user.role]}</div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
        </div>
      </div>
    </header>
  );
};

