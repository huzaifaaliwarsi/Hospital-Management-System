import apiClient, { setStoredSession, clearStoredSession } from './apiClient';

export interface BackendLoginResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      username: string;
      email: string;
      role: string;
      staffId?: string;
      staff?: {
        id: string;
        fullName: string;
        designation: string;
        department?: { id: string; name: string };
      };
    };
  };
}

// Maps backend Prisma role to frontend UserRole
export function mapRoleToUserRole(role: string): import('../types').UserRole {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'ADMIN':
      return 'Admin';
    case 'FRONT_DESK_BILLING':
      return 'Billing Officer';
    case 'ADMISSION':
      return 'Admission Officer';
    case 'INVENTORY_MANAGEMENT':
      return 'Store Manager';
    case 'PHARMACY_SUPER_ADMIN':
    case 'PHARMACY_MANAGER':
    case 'PHARMACY_SALES_DISPENSING':
      return 'Pharmacist';
    default:
      return 'Front Desk & Billing';
  }
}

// Maps backend Prisma role to frontend PortalKey
export function mapRoleToPortalKey(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'super-admin';
    case 'ADMIN':
      return 'admin';
    case 'FRONT_DESK_BILLING':
      return 'front-desk';
    case 'ADMISSION':
      return 'admission';
    case 'INVENTORY_MANAGEMENT':
      return 'inventory';
    case 'PHARMACY_SUPER_ADMIN':
    case 'PHARMACY_MANAGER':
    case 'PHARMACY_SALES_DISPENSING':
      return 'inventory'; // Connected to pharmacy workstation
    default:
      return 'front-desk';
  }
}

export const authApiService = {
  async login(usernameOrEmail: string, password: string):Promise<BackendLoginResponse['data']> {
    const res = await apiClient.post<BackendLoginResponse>('/auth/login', {
      identifier: usernameOrEmail,
      password,
    });

    const data = res.data.data;
    setStoredSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
      portal: mapRoleToPortalKey(data.user.role),
    });

    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Proceed with local logout regardless of network failure
    } finally {
      clearStoredSession();
    }
  },

  async getMe() {
    const res = await apiClient.get('/auth/me');
    return res.data.data;
  },
};
