export interface BiometricDevice {
  id: string;
  name: string;
  brandModel?: string | null;
  deviceSerial: string;
  protocol: string;
  timezone: string;
  isEnabled: boolean;
  authMode: string;
  hasSharedSecret?: boolean;
  lastSeenAt?: string | null;
  lastPushAt?: string | null;
  lastPushStatus: 'SUCCESS' | 'FAILED' | 'NEVER';
  lastPushMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffBiometricMapping {
  id: string;
  staffId: string;
  deviceId: string;
  enrollNumber: string;
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt: string;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    designation?: string;
    status: string;
  };
  device?: {
    id: string;
    name: string;
    deviceSerial: string;
  };
}

export interface BiometricRawPunchItem {
  id: string;
  deviceId?: string | null;
  deviceSerial?: string | null;
  enrollNumber?: string | null;
  staffId?: string | null;
  deviceSource: string;
  punchAt: string;
  punchType?: string | null;
  verificationType?: string | null;
  errorMessage?: string | null;
  processingStatus: 'RECEIVED' | 'UNMAPPED' | 'NORMALIZED' | 'DUPLICATE' | 'INVALID' | 'ERROR';
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  } | null;
}

export interface BiometricDeviceOverview {
  device: BiometricDevice | null;
  counts: {
    totalStaff: number;
    mappedStaff: number;
    totalPunches?: number;
    unmappedPunches: number;
    pendingPunches: number;
    errorPunches: number;
  };
  connection?: { admsPath: string; jsonPath: string; serialIpAllowlistConfigured: boolean };
  recentPunches: BiometricRawPunchItem[];
  derivedStatus: 'ONLINE' | 'STALE' | 'NEVER_CONNECTED' | 'DISABLED';
}
