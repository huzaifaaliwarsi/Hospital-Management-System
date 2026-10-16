import { apiClient } from './apiClient';
import type { BiometricDevice, StaffBiometricMapping, BiometricDeviceOverview, BiometricRawPunchItem } from '../types/device';

export const DeviceService = {
  async getDeviceOverview(): Promise<BiometricDeviceOverview> {
    const res = await apiClient.get('/devices/biometric');
    return res.data.data;
  },

  async upsertDevice(data: {
    id?: string;
    name: string;
    brandModel?: string;
    deviceSerial: string;
    protocol?: string;
    timezone?: string;
    isEnabled?: boolean;
    authMode?: string;
    sharedSecret?: string;
  }): Promise<BiometricDevice> {
    const res = await apiClient.put('/devices/biometric', data);
    return res.data.data;
  },

  async getMappings(deviceId?: string): Promise<StaffBiometricMapping[]> {
    const res = await apiClient.get('/devices/biometric/mappings', {
      params: deviceId ? { deviceId } : undefined,
    });
    return res.data.data;
  },

  async createMapping(data: {
    staffId: string;
    enrollNumber: string;
    deviceId?: string;
  }): Promise<StaffBiometricMapping> {
    const res = await apiClient.post('/devices/biometric/mappings', data);
    return res.data.data;
  },

  async deleteMapping(id: string): Promise<void> {
    await apiClient.delete(`/devices/biometric/mappings/${id}`);
  },

  async reprocess(deviceId?: string): Promise<{ processed: number; failed: number }> {
    const res = await apiClient.post('/devices/biometric/reprocess', { deviceId });
    return res.data.data;
  },

  async getUnmappedPunches(deviceId?: string): Promise<BiometricRawPunchItem[]> {
    const res = await apiClient.get('/devices/biometric/unmapped-punches', { params: { deviceId } });
    return res.data.data;
  },
};
