import { z } from 'zod';
import { deviceCredentials } from './adms.routes';
import { Request, Response } from 'express';
import { devicesService } from './devices.service';
import { upsertDeviceSchema, createStaffMappingSchema, punchIngestSchema } from './devices.schemas';

export class DevicesController {
  async getOverview(_req: Request, res: Response) {
    const result = await devicesService.getDeviceOverview();
    return res.json({ data: result });
  }

  async upsertDevice(req: Request, res: Response) {
    const input = upsertDeviceSchema.parse(req.body);
    const result = await devicesService.upsertDevice(input);
    return res.json({ data: result, message: 'Biometric device registered successfully.' });
  }

  async listMappings(req: Request, res: Response) {
    const deviceId = z.string().uuid().optional().parse(req.query.deviceId);
    const mappings = await devicesService.listMappings(deviceId);
    return res.json({ data: mappings });
  }

  async createMapping(req: Request, res: Response) {
    const input = createStaffMappingSchema.parse(req.body);
    const mapping = await devicesService.createOrUpdateMapping(input);
    return res.status(201).json({ data: mapping, message: 'Staff biometric mapping saved successfully.' });
  }

  async deleteMapping(req: Request, res: Response) {
    const id = z.string().uuid().parse(req.params.id);
    const result = await devicesService.deleteMapping(id);
    return res.json({ data: result, message: 'Mapping removed.' });
  }

  async getUnmappedPunches(req: Request, res: Response) {
    const unmapped = await devicesService.getUnmappedPunches(z.string().uuid().optional().parse(req.query.deviceId));
    return res.json({ data: unmapped });
  }

  /**
   * Public HTTP Ingest Endpoint (device calls this directly)
   */
  async reprocess(req: Request, res: Response) {
    const input = z.object({ deviceId: z.string().uuid().optional() }).parse(req.body);
    res.json({ data: await devicesService.processPending(input.deviceId) });
  }

  async ingestPunches(req: Request, res: Response) {
    const input = punchIngestSchema.parse(req.body);
    const device = await devicesService.authenticateDevice(input.deviceSerial, deviceCredentials(req), 'CLOUD_SERVER');
    const result = await devicesService.ingestPunches(input, device);
    return res.json({ data: result });
  }
}

export const devicesController = new DevicesController();
