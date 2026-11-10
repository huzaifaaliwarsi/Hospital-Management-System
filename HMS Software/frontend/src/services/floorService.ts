import apiClient from './apiClient';
import { HospitalFloor } from '../types/department';

export interface CreateFloorInput {
  floorNumber: number;
  name: string;
  building?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateFloorInput {
  floorNumber?: number;
  name?: string;
  building?: string;
  description?: string;
  isActive?: boolean;
}

let cachedFloors: HospitalFloor[] = [];

export class FloorService {
  /**
   * Fetches all hospital floors from backend PostgreSQL database.
   */
  static async fetchFloors(): Promise<HospitalFloor[]> {
    try {
      const res = await apiClient.get<{ data: HospitalFloor[] }>('/setup/floors');
      cachedFloors = res.data.data;
      return cachedFloors;
    } catch (err) {
      console.error('Failed to fetch hospital floors:', err);
      return cachedFloors;
    }
  }

  /**
   * Gets cached floors synchronously if available.
   */
  static getCachedFloors(): HospitalFloor[] {
    return cachedFloors;
  }

  /**
   * Creates a new hospital floor in database.
   */
  static async createFloor(data: CreateFloorInput): Promise<HospitalFloor> {
    const res = await apiClient.post<{ data: HospitalFloor }>('/setup/floors', data);
    const created = res.data.data;
    cachedFloors = [...cachedFloors, created].sort((a, b) => a.floorNumber - b.floorNumber);
    return created;
  }

  /**
   * Updates an existing hospital floor in database.
   */
  static async updateFloor(id: string, data: UpdateFloorInput): Promise<HospitalFloor> {
    const res = await apiClient.patch<{ data: HospitalFloor }>(`/setup/floors/${id}`, data);
    const updated = res.data.data;
    cachedFloors = cachedFloors.map((f) => (f.id === id ? updated : f)).sort((a, b) => a.floorNumber - b.floorNumber);
    return updated;
  }

  /**
   * Deletes a floor from database.
   */
  static async deleteFloor(id: string): Promise<void> {
    await apiClient.delete(`/setup/floors/${id}`);
    cachedFloors = cachedFloors.filter((f) => f.id !== id);
  }
}
