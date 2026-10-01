import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { ForceChangePasswordPage } from './pages/ForceChangePasswordPage';
import { Sidebar } from './layout/Sidebar';
import { TopBar } from './layout/TopBar';
import { MANAGEMENT_NAV, SALES_NAV, NavGroup } from './layout/navigation';
import { ManagementDashboardPage } from './pages/ManagementDashboardPage';
import { SalesDashboardPage } from './pages/SalesDashboardPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { PosPage } from './pages/PosPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { VendorsPage } from './pages/VendorsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { BalanceSheetPage } from './pages/BalanceSheetPage';
import { SettlementsPage } from './pages/SettlementsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { UsersPage } from './pages/UsersPage';
import { StockMovementsPage } from './pages/StockMovementsPage';
import { HmsRequestQueuePage } from './pages/HmsRequestQueuePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ComingSoonPage } from './pages/ComingSoonPage';

function findLabel(groups: NavGroup[], id: string): string {
  for (const g of groups) {
    const item = g.items.find((i) => i.id === id);
    if (item) return item.label;
  }
  return 'Pharmacy';
}

const App: React.FC = () => {
  const { isAuthenticated, isLoading, currentUser, logout } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-[#52665e]">Loading…</div>;
  if (!isAuthenticated || !currentUser) return <LoginPage />;
  if (currentUser.mustResetPassword) return <ForceChangePasswordPage />;

  const isSales = currentUser.role === 'SALES_DISPENSING';
  const navGroups = isSales ? SALES_NAV : MANAGEMENT_NAV;
  const portalLabel = isSales ? 'Sales Portal' : currentUser.role === 'SUPER_ADMIN' ? 'Super Admin — Management Portal' : 'Admin — Management Portal';

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return isSales ? <SalesDashboardPage /> : <ManagementDashboardPage onNavigate={setPage} />;
      case 'medicines':
        return <MedicinesPage canEdit={!isSales} />;
      case 'pos':
        return <PosPage />;
      case 'invoices':
        return <InvoicesPage />;
      case 'hms-requests':
        return <HmsRequestQueuePage canApprove={!isSales} />;
      case 'stock-movements':
        return <StockMovementsPage canAdjust={!isSales} />;
      case 'vendors':
        return <VendorsPage canEdit={!isSales} />;
      case 'purchases':
        return <PurchasesPage />;
      case 'balance-sheet':
        return <BalanceSheetPage />;
      case 'settlements':
        return <SettlementsPage canReview={!isSales} />;
      case 'expenses':
        return <ExpensesPage canApprove={!isSales} />;
      case 'users':
        return <UsersPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <ComingSoonPage title="Not found" step="—" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <Sidebar
        groups={navGroups}
        portalLabel={portalLabel}
        currentPage={page}
        onSelectPage={setPage}
        onLogout={logout}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />
      <div
        className="min-h-screen flex flex-col transition-all duration-300 ease-in-out"
        style={{ marginLeft: sidebarOpen ? '256px' : '0px' }}
      >
        <TopBar
          user={currentUser}
          pageTitle={findLabel(navGroups, page)}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <main className="flex-1">{renderPage()}</main>
      </div>
    </div>
  );
};

export default App;
