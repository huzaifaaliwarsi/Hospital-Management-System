import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { PORTAL_CONFIGS, PORTAL_NAVIGATION_MAP } from '../../constants/portalNavigations';
import { HOSPITAL_INFO, SOFTWARE_PROVIDER } from '../../constants';
import { PortalKey } from '../../types';
import {
  Compass,
  KeyRound,
  ExternalLink,
  Shield,
  Building2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { cn } from '../../utils/formatters';

interface PortalLayoutProps {
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  const { currentUser, activePortal, switchPortal, logout } = useAuth();
  const { currentModule, navigate, currentPath } = useRouter();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showPortalTour, setShowPortalTour] = useState(false);

  const portalConfig = PORTAL_CONFIGS[activePortal] || PORTAL_CONFIGS['super-admin'];
  const portalGroups = PORTAL_NAVIGATION_MAP[activePortal] || PORTAL_NAVIGATION_MAP['super-admin'];

  // Resolve current module label and group title
  let currentModuleName = 'Dashboard';
  let currentGroupTitle = 'Overview';

  for (const group of portalGroups) {
    const item = group.items.find(
      (i) =>
        i.id === currentModule ||
        i.id === currentModule.replace(/-/g, '_') ||
        i.id.replace(/_/g, '-') === currentModule
    );
    if (item) {
      currentModuleName = item.label;
      currentGroupTitle = group.title;
      break;
    }
  }

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSelectModule = (moduleId: string) => {
    if (moduleId === 'logout') {
      handleLogout();
      return;
    }
    navigate(`${portalConfig.routePrefix}/${moduleId}`);
  };

  const handlePortalSwitch = (portalKey: PortalKey) => {
    // If the user already has access to this portal, switch to it
    if (currentUser && currentUser.allowedPortals.includes(portalKey)) {
      switchPortal(portalKey);
      navigate(PORTAL_CONFIGS[portalKey].defaultRoute);
    } else {
      // Otherwise navigate to that portal's dedicated login page
      navigate(`/login/${portalKey}`);
    }
  };

  const allPortalKeys: PortalKey[] = [
    'super-admin',
    'admin',
    'front-desk',
    'admission',
    'inventory',
  ];

  return (
    <div className="min-h-screen bg-[#f6f8f7] flex flex-col antialiased text-[#111827] font-sans">
      {/* Portal-Specific Sidebar */}
      <Sidebar
        activePortal={activePortal}
        currentModule={currentModule}
        onSelectModule={handleSelectModule}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area (Offset for Sidebar) */}
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-200 ease-in-out min-w-0',
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        )}
      >
        {/* Header */}
        <Header
          user={currentUser || { name: 'Hospital Staff', email: 'staff@isysware.com', role: 'Staff' }}
          activePortal={activePortal}
          onChangePortal={handlePortalSwitch}
          currentModuleName={currentModuleName}
          currentGroupTitle={currentGroupTitle}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onLogout={handleLogout}
          onOpenQuickSearch={() => {}}
        />

        {/* Main View Port */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
