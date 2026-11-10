export type PortalRole = 'SUPER_ADMIN' | 'ADMIN' | 'SALES_DISPENSING';

export interface CurrentUser {
  id: string;
  username: string;
  email?: string | null;
  fullName: string;
  role: PortalRole;
  mustResetPassword: boolean;
}
