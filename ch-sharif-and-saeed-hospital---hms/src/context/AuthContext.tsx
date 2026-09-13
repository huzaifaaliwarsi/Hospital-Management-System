import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, PortalKey, StaffAccount, UserSession, AccountabilityAuditTrace } from '../types';
import { StaffPortalKey } from '../types/staffUser';
import { PORTAL_CONFIGS } from '../constants/portalNavigations';
import { AdminUserService } from '../services/adminUserService';
import { StaffUserService } from '../services/staffUserService';
import { authApiService, mapRoleToPortalKey, mapRoleToUserRole } from '../services/authApiService';
import { primeHospitalProfileCache } from '../services/hospitalProfileService';
import { primeDepartmentsCache } from '../services/departmentService';
import { primeServicesCache } from '../services/serviceRatesService';
import { primeWardsRoomsBedsCache } from '../services/wardsRoomsBedsService';
import { primeAdminUsersCache } from '../services/adminUserService';
import { primeStaffUsersCache } from '../services/staffUserService';
import { primeShiftsCache } from '../services/shiftService';
import { primeCorporatePanelsCache } from '../services/panelService';
import { AUTH_TOKEN_REFRESHED_EVENT, AUTH_SESSION_EXPIRED_EVENT } from '../services/apiClient';
import { primePatientRegistryCache } from '../services/patientRegistryService';

// Operational staff demo fallback accounts (Admin and Super Admin are authoritatively managed in AdminUserService)
export const MOCK_STAFF_ACCOUNTS: Record<string, StaffAccount> = {
  frontdesk: {
    username: 'frontdesk',
    password: 'FrontDesk@123',
    user: {
      id: 'usr_frontdesk',
      username: 'frontdesk',
      name: 'Ahmed Raza',
      email: 'ahmed.raza@sharif-saeed.hospital',
      role: 'Billing Officer',
      department: 'Front Desk Reception & Patient Cashiering',
      portal: 'front-desk',
      allowedPortals: ['front-desk'],
      permissions: ['patient_registration', 'token_generation', 'billing_cashier', 'receipt_issuance'],
      status: 'active',
      lastLogin: 'Today, 08:00 AM',
      isSuperAdminProtected: false,
    },
  },
  admission: {
    username: 'admission',
    password: 'Admission@123',
    user: {
      id: 'usr_admission',
      username: 'admission',
      name: 'Sara Khan',
      email: 'sara.khan@sharif-saeed.hospital',
      role: 'Admission Officer',
      department: 'Inpatient Wards & Bed Coordination Desk',
      portal: 'admission',
      allowedPortals: ['admission'],
      permissions: ['bed_management', 'admission_clearance', 'discharge_management', 'ward_transfers'],
      status: 'active',
      lastLogin: 'Today, 07:45 AM',
      isSuperAdminProtected: false,
    },
  },
  inventory: {
    username: 'inventory',
    password: 'Inventory@123',
    user: {
      id: 'usr_inventory',
      username: 'inventory',
      name: 'Usman Ali',
      email: 'usman.ali@sharif-saeed.hospital',
      role: 'Store Manager',
      department: 'Central Store, Procurement & Goods Receiving (GRN)',
      portal: 'inventory',
      allowedPortals: ['inventory'],
      permissions: ['grn_entry', 'purchase_orders', 'stock_transfer', 'inventory_audit'],
      status: 'active',
      lastLogin: 'Today, 08:05 AM',
      isSuperAdminProtected: false,
    },
  },
  pharmacy: {
    username: 'pharmacy',
    password: 'Pharmacy@123',
    user: {
      id: 'usr_pharmacy',
      username: 'pharmacy',
      name: 'Tariq Mehmood',
      email: 'tariq.pharmacy@sharif-saeed.hospital',
      role: 'Pharmacist',
      department: 'Central Pharmacy & Dispensing Counter',
      portal: 'inventory',
      allowedPortals: ['inventory'],
      permissions: ['medicine_dispense', 'batch_receipt', 'pos_cashiering'],
      status: 'active',
      lastLogin: 'Today, 08:15 AM',
      isSuperAdminProtected: false,
    },
  },
};

interface AuthContextType {
  currentUser: User | null;
  session: UserSession | null;
  activePortal: PortalKey;
  isAuthenticated: boolean;
  login: (
    portalKey: PortalKey | null | '',
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; portal?: PortalKey }>;
  logout: () => void;
  switchPortal: (targetPortal: PortalKey) => boolean;
  hasPortalAccess: (portalKey: PortalKey) => boolean;
  auditTrace: AccountabilityAuditTrace;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'css_hospital_active_user';
const STORAGE_KEY_PORTAL = 'css_hospital_active_portal';
const STORAGE_KEY_SESSION = 'css_hospital_active_session';

function clearStoredAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_SESSION);
    localStorage.removeItem(STORAGE_KEY_PORTAL);
  } catch {
    // ignore
  }
}

/**
 * Validates and normalizes restored localStorage sessions.
 * Never blindly trusts persisted allowedPortals or stale sessions.
 */
function validateAndNormalizeRestoredSession(): {
  user: User;
  session: UserSession;
  portal: PortalKey;
} | null {
  try {
    const rawUser = localStorage.getItem(STORAGE_KEY_USER);
    const rawSession = localStorage.getItem(STORAGE_KEY_SESSION);
    const rawPortal = localStorage.getItem(STORAGE_KEY_PORTAL);

    if (!rawUser || !rawSession) {
      clearStoredAuth();
      return null;
    }

    const user = JSON.parse(rawUser) as User;
    const session = JSON.parse(rawSession) as UserSession;
    const portal = (rawPortal as PortalKey) || user.portal;

    // Check basic integrity
    if (!user || typeof user !== 'object' || !user.id || !user.role || !user.portal) {
      clearStoredAuth();
      return null;
    }

    if (!session || typeof session !== 'object' || !session.userId || !session.role) {
      clearStoredAuth();
      return null;
    }

    // Explicit rejection of removed Pharmacy portal or unrecognized portals
    const validPortals: PortalKey[] = ['super-admin', 'admin', 'front-desk', 'admission', 'inventory'];
    if (
      (user.portal as string) === 'pharmacy' ||
      (session.selectedPortal as string) === 'pharmacy' ||
      (portal as string) === 'pharmacy' ||
      !validPortals.includes(user.portal)
    ) {
      clearStoredAuth();
      return null;
    }

    // 1. Super Admin role — restoring a session trusts the JWT already
    // issued by the backend (`session.token`, attached to every subsequent
    // API call by `apiClient`'s interceptor); that token is the real
    // account-still-active check, not a synchronous local cache lookup
    // (which is empty at this point in the render — `AdminUserService`'s
    // cache is only populated by an async fetch that hasn't run yet).
    if (user.role === 'Super Admin' || (user as any).role === 'SUPER_ADMIN') {
      if (!session.token) {
        clearStoredAuth();
        return null;
      }

      // Strictly normalize to super-admin only
      const normalizedUser: User = {
        ...user,
        role: 'Super Admin',
        portal: 'super-admin',
        allowedPortals: ['super-admin'],
      };
      const normalizedSession: UserSession = {
        ...session,
        selectedPortal: 'super-admin',
        allowedPortals: ['super-admin'],
      };

      return {
        user: normalizedUser,
        session: normalizedSession,
        portal: 'super-admin',
      };
    }

    // 2. Admin role — same JWT-trust rationale as Super Admin above.
    if (user.role === 'Admin' || (user as any).role === 'ADMIN') {
      if (!session.token) {
        clearStoredAuth();
        return null;
      }

      // Strictly normalize to admin only
      const normalizedUser: User = {
        ...user,
        role: 'Admin',
        portal: 'admin',
        allowedPortals: ['admin'],
      };
      const normalizedSession: UserSession = {
        ...session,
        selectedPortal: 'admin',
        allowedPortals: ['admin'],
      };

      return {
        user: normalizedUser,
        session: normalizedSession,
        portal: 'admin',
      };
    }

    // 3. Operational Staff (Front Desk, Admission, Inventory) — same
    // JWT-trust rationale as Super Admin/Admin above: `StaffUserService`'s
    // cache is also async-populated and empty at this point in the render.
    const validStaffPortals: StaffPortalKey[] = ['front-desk', 'admission', 'inventory'];
    if (session.token && validStaffPortals.includes(user.portal as StaffPortalKey)) {
      const assignedPortal = user.portal as StaffPortalKey;
      const normalizedUser: User = {
        ...user,
        portal: assignedPortal,
        allowedPortals: [assignedPortal],
      };
      const normalizedSession: UserSession = {
        ...session,
        selectedPortal: assignedPortal,
        allowedPortals: [assignedPortal],
      };

      return {
        user: normalizedUser,
        session: normalizedSession,
        portal: assignedPortal,
      };
    }

    // Fallback: check operational demo account
    const mockAccount = MOCK_STAFF_ACCOUNTS[user.username];
    if (
      mockAccount &&
      mockAccount.user.status === 'active' &&
      mockAccount.user.portal === user.portal &&
      mockAccount.user.allowedPortals.includes(user.portal)
    ) {
      const assignedPortal = mockAccount.user.portal;
      const normalizedUser: User = {
        ...user,
        portal: assignedPortal,
        allowedPortals: [assignedPortal],
      };
      const normalizedSession: UserSession = {
        ...session,
        selectedPortal: assignedPortal,
        allowedPortals: [assignedPortal],
      };

      return {
        user: normalizedUser,
        session: normalizedSession,
        portal: assignedPortal,
      };
    }

    // Unknown or incompatible user - invalidate
    clearStoredAuth();
    return null;
  } catch {
    clearStoredAuth();
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Validate and normalize saved session on initial mount
  const initialAuth = React.useMemo(() => validateAndNormalizeRestoredSession(), []);

  const [currentUser, setCurrentUser] = useState<User | null>(initialAuth?.user || null);
  const [session, setSession] = useState<UserSession | null>(initialAuth?.session || null);
  const [activePortal, setActivePortal] = useState<PortalKey>(initialAuth?.portal || 'super-admin');

  // Immediately persist normalized session or clear invalid state
  useEffect(() => {
    try {
      if (currentUser && session) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
        localStorage.setItem(STORAGE_KEY_PORTAL, activePortal);
      } else {
        clearStoredAuth();
      }
    } catch {
      // ignore storage error
    }
  }, [currentUser, session, activePortal]);

  // Warm the hospital-profile in-memory cache once per authenticated
  // session so print/export/letterhead helpers have real backend data
  // synchronously available (see `hospitalProfileService.ts`).
  useEffect(() => {
    if (currentUser) {
      primeHospitalProfileCache();
      primeDepartmentsCache();
      primeServicesCache();
      primeWardsRoomsBedsCache();
      primeAdminUsersCache();
      primeStaffUsersCache();
      primeShiftsCache();
      primeCorporatePanelsCache();
      primePatientRegistryCache();
    }
  }, [currentUser?.id]);

  const hasPortalAccess = (portalKey: PortalKey): boolean => {
    if (!currentUser) return false;
    return currentUser.allowedPortals.includes(portalKey);
  };

  const login = async (
    portalKey: PortalKey | null | '',
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; portal?: PortalKey }> => {
    // 1. Validate portal selection
    if (!portalKey || !PORTAL_CONFIGS[portalKey]) {
      return {
        success: false,
        error: 'Please select a portal.',
      };
    }

    // 2. Validate input fields
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      return {
        success: false,
        error: 'Please enter your username or email.',
      };
    }

    if (!password) {
      return {
        success: false,
        error: 'Please enter your password.',
      };
    }

    // 3. Attempt live Backend API authentication
    try {
      const backendAuth = await authApiService.login(cleanUsername, password);
      const targetPortal = (mapRoleToPortalKey(backendAuth.user.role) as PortalKey) || portalKey;

      const userRole = mapRoleToUserRole(backendAuth.user.role);

      const authenticatedUser: User = {
        id: backendAuth.user.id,
        username: backendAuth.user.username,
        name: backendAuth.user.staff?.fullName || backendAuth.user.username,
        email: backendAuth.user.email,
        role: userRole,
        department: backendAuth.user.staff?.department?.name || 'Hospital Administration',
        portal: targetPortal,
        allowedPortals: [targetPortal, 'super-admin', 'admin', 'front-desk', 'admission', 'inventory'],
        permissions: ['*'],
        status: 'active',
        lastLogin: 'Just now',
        isSuperAdminProtected: backendAuth.user.role === 'SUPER_ADMIN',
      };

      const userSession: UserSession = {
        userId: backendAuth.user.id,
        name: authenticatedUser.name,
        username: backendAuth.user.username,
        role: userRole,
        selectedPortal: targetPortal,
        allowedPortals: authenticatedUser.allowedPortals,
        permissions: ['*'],
        status: 'active',
        loginTime: new Date().toISOString(),
        token: backendAuth.accessToken,
      };

      setCurrentUser(authenticatedUser);
      setSession(userSession);
      setActivePortal(targetPortal);

      return {
        success: true,
        portal: targetPortal,
      };
    } catch (apiErr: any) {
      // If backend returns an explicit 401 invalid credential, return error
      if (apiErr.response?.status === 401) {
        return {
          success: false,
          error: apiErr.message || 'Invalid username or password.',
        };
      }
      // If backend is unreachable/offline, fall through to local fallback
      console.warn('Backend login unavailable, evaluating local credentials:', apiErr.message);
    }

    // 4. Admin/Super Admin accounts have no offline fallback — their real
    // password only ever lives, hashed, on the backend (`PortalUser`).
    // If we get here, the backend login attempt above failed to reach the
    // server at all; a matching username in the Admin Users list is not
    // sufficient to authenticate without it.
    const adminUser =
      AdminUserService.getAdminUserByUsername(cleanUsername) ||
      AdminUserService.getAdminUsers().find((u) => u.email.toLowerCase() === cleanUsername);
    if (adminUser) {
      return {
        success: false,
        error: 'Unable to reach the authentication server. Please check your connection and try again.',
      };
    }

    // 5. Staff (Front Desk / Admission / Inventory) accounts also have no
    // offline fallback for the same reason as Admin/Super Admin above —
    // their real password only ever lives, hashed, on the backend.
    const staffUser =
      StaffUserService.getStaffUserByUsername(cleanUsername) ||
      StaffUserService.getStaffUsers().find((u) => u.email.toLowerCase() === cleanUsername);
    if (staffUser && staffUser.accessType === 'PORTAL_USER') {
      return {
        success: false,
        error: 'Unable to reach the authentication server. Please check your connection and try again.',
      };
    }

    // 6. Fallback to operational staff demo accounts (Front Desk, Admission, Pharmacy, Inventory)
    const account = MOCK_STAFF_ACCOUNTS[cleanUsername];
    if (!account) {
      return {
        success: false,
        error: 'Invalid username or password.',
      };
    }

    // Verify configured password strictly (no universal bypass)
    if (password !== account.password) {
      return {
        success: false,
        error: 'Invalid username or password.',
      };
    }

    // Verify account status
    if (account.user.status === 'suspended' || account.user.status === 'inactive') {
      return {
        success: false,
        error: 'Your account is disabled. Please contact the Hospital Administrator.',
      };
    }

    // Check portal authorization
    if (!account.user.allowedPortals.includes(portalKey)) {
      return {
        success: false,
        error: 'Your account does not have access to the selected portal.',
      };
    }

    // Establish authenticated session for staff account
    const now = new Date();
    const loginTimeStr = new Intl.DateTimeFormat('en-PK', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(now);

    const userWithLogin: User = {
      ...account.user,
      lastLogin: `Today at ${loginTimeStr}`,
    };

    const newSession: UserSession = {
      userId: account.user.id,
      name: account.user.name,
      username: account.user.username,
      role: account.user.role,
      selectedPortal: portalKey,
      allowedPortals: account.user.allowedPortals,
      permissions: account.user.permissions || ['standard_access'],
      status: 'active',
      loginTime: loginTimeStr,
      token: `mock_jwt_${account.user.id}_${Date.now()}`,
    };

    setCurrentUser(userWithLogin);
    setSession(newSession);
    setActivePortal(portalKey);

    return {
      success: true,
      portal: portalKey,
    };
  };

  const logout = () => {
    setCurrentUser(null);
    setSession(null);
    try {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.removeItem(STORAGE_KEY_PORTAL);
    } catch {
      // ignore
    }
  };

  // Keep the in-memory session's token in sync with `apiClient`'s silent
  // background refresh (access tokens are short-lived, 15 minutes), and
  // fall back to a clean logout if that refresh ultimately fails —
  // otherwise the app would keep showing a "logged in" shell that 401s on
  // every request forever with no way to recover short of clearing storage
  // by hand.
  useEffect(() => {
    const handleTokenRefreshed = (e: Event) => {
      const newToken = (e as CustomEvent<{ accessToken: string }>).detail?.accessToken;
      if (!newToken) return;
      setSession((prev) => (prev ? { ...prev, token: newToken } : prev));
    };
    const handleSessionExpired = () => {
      logout();
    };
    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(AUTH_TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const switchPortal = (targetPortal: PortalKey): boolean => {
    if (!currentUser) return false;
    if (!currentUser.allowedPortals.includes(targetPortal)) {
      return false;
    }
    setActivePortal(targetPortal);
    if (session) {
      setSession({
        ...session,
        selectedPortal: targetPortal,
      });
    }
    return true;
  };

    const actorLabel = currentUser ? `${currentUser.name} (${currentUser.role})` : 'System Automated';

    const auditTrace: AccountabilityAuditTrace = {
      createdBy: actorLabel,
      updatedBy: actorLabel,
      collectedBy: actorLabel,
      approvedBy: actorLabel,
      refundedBy: actorLabel,
      voidedBy: actorLabel,
      cancelledBy: actorLabel,
      dispensedBy: actorLabel,
      receivedBy: actorLabel,
      issuedBy: actorLabel,
      dischargedBy: actorLabel,
    };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        activePortal,
        isAuthenticated: !!currentUser && !!session,
        login,
        logout,
        switchPortal,
        hasPortalAccess,
        auditTrace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
