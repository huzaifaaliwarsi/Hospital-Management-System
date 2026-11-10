import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PortalKey } from '../types';

export interface ParsedRoute {
  fullPath: string;
  portal: PortalKey;
  isLogin: boolean;
  module: string;
}

interface RouterContextType {
  currentPath: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  parsedRoute: ParsedRoute;
  currentPortal: PortalKey;
  currentModule: string;
  isLogin: boolean;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

const VALID_PORTALS: PortalKey[] = [
  'super-admin',
  'admin',
  'front-desk',
  'admission',
  'inventory',
];

function extractPath(): string {
  // Support both pathname and hash routing for container iframe compatibility
  if (typeof window === 'undefined') return '/login';

  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const hashPath = window.location.hash.slice(1);
    return hashPath || '/login';
  }

  const path = window.location.pathname;
  if (path && path !== '/') {
    return path;
  }
  return '/login';
}

export function parsePath(path: string): ParsedRoute {
  // Clean path
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const pathWithoutQuery = normalized.split('?')[0];
  const segments = pathWithoutQuery.split('/').filter(Boolean);

  if (segments.length === 0 || normalized === '/login') {
    return {
      fullPath: '/login',
      portal: 'super-admin',
      isLogin: true,
      module: 'login',
    };
  }

  // Handle /login or /login/:portal
  if (segments[0] === 'login') {
    const targetSlug = segments[1] as PortalKey;
    const portal = VALID_PORTALS.includes(targetSlug) ? targetSlug : 'super-admin';
    return {
      fullPath: normalized,
      portal,
      isLogin: true,
      module: 'login',
    };
  }

  let rawPortal = segments[0] as string;
  let secondSegment = segments[1] || 'dashboard';

  // Normalize aliases so /admissions maps to admission portal instead of defaulting to super-admin
  if (rawPortal === 'admissions') {
    rawPortal = 'admission';
    if (!segments[1]) {
      secondSegment = 'planned_admissions';
    }
  }

  // Normalize /billing aliases so /billing and /billing/* map to front-desk
  if (rawPortal === 'billing') {
    rawPortal = 'front-desk';
    if (secondSegment === 'inpatient' || secondSegment === 'admission') {
      secondSegment = 'admission_patient_records';
    } else if (secondSegment === 'pending_discharges' || secondSegment === 'billing_pending_discharges') {
      secondSegment = 'billing_pending_discharges';
    } else if (secondSegment === 'payment_requests' || secondSegment === 'admission_payment_requests') {
      secondSegment = 'admission_payment_requests';
    } else if (secondSegment === 'discharged_patients') {
      secondSegment = 'discharged_patients';
    } else if (secondSegment === 'dashboard' || secondSegment === 'invoices') {
      secondSegment = 'hospital_invoices';
    }
  }

  // Front-desk modules accessed without portal prefix
  const FRONT_DESK_MODULES = [
    'admission_patient_records',
    'hospital_invoices',
    'billing_pending_discharges',
    'admission_payment_requests',
    'new_admission',
    'walk_in_intake',
    'appointments',
    'discharged_patients',
    'payments_receipts',
    'my_balance_sheet',
    'my_account_settlement',
    'front_desk_billing_reports',
  ];
  if (FRONT_DESK_MODULES.includes(rawPortal)) {
    secondSegment = rawPortal;
    rawPortal = 'front-desk';
  }

  // Admission modules accessed without portal prefix
  const ADMISSION_MODULES = [
    'active_admissions',
    'planned_admissions',
    'ward_management',
    'bed_management',
  ];
  if (ADMISSION_MODULES.includes(rawPortal)) {
    secondSegment = rawPortal;
    rawPortal = 'admission';
  }

  const isPortalValid = VALID_PORTALS.includes(rawPortal as PortalKey);
  let portal: PortalKey;
  if (isPortalValid) {
    portal = rawPortal as PortalKey;
  } else {
    // Check if active user has an authenticated portal stored in localStorage
    const savedPortal = typeof window !== 'undefined' ? (localStorage.getItem('css_hospital_active_portal') as PortalKey) : null;
    portal = savedPortal && VALID_PORTALS.includes(savedPortal) ? savedPortal : 'super-admin';
  }

  const isLogin = secondSegment === 'login';
  const module = isLogin ? 'login' : secondSegment;

  return {
    fullPath: normalized,
    portal,
    isLogin,
    module,
  };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => extractPath());

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(extractPath());
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    // Only running embedded (e.g. an iframe preview container) needs the
    // `#/path` fallback — appending it in a normal standalone browser tab
    // just makes the address bar show the path twice
    // (`/admin/dashboard#/admin/dashboard`) for no benefit.
    const isEmbedded = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true; // cross-origin access throws only when actually embedded
      }
    })();
    try {
      if (options?.replace) {
        window.history.replaceState({}, '', cleanPath);
      } else {
        window.history.pushState({}, '', cleanPath);
      }
      if (isEmbedded) {
        window.location.hash = `#${cleanPath}`;
      }
    } catch {
      window.location.hash = `#${cleanPath}`;
    }
    setCurrentPath(cleanPath);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const parsedRoute = parsePath(currentPath);
  const currentPortal: PortalKey = parsedRoute.portal;
  const currentModule: string = parsedRoute.module;
  const isLogin: boolean = parsedRoute.isLogin;

  return (
    <RouterContext.Provider
      value={{
        currentPath,
        navigate,
        parsedRoute,
        currentPortal,
        currentModule,
        isLogin,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
