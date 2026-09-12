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
  const segments = normalized.split('/').filter(Boolean);

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

  const rawPortal = segments[0] as PortalKey;
  const isPortalValid = VALID_PORTALS.includes(rawPortal);
  const portal: PortalKey = isPortalValid ? rawPortal : 'super-admin';

  const secondSegment = segments[1] || 'dashboard';
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
    try {
      if (options?.replace) {
        window.history.replaceState({}, '', cleanPath);
      } else {
        window.history.pushState({}, '', cleanPath);
      }
      // Also update hash as fallback for iframe reliability
      window.location.hash = `#${cleanPath}`;
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
