import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { settingsService } from './settings.service';
import type { UpdatePharmacySettingsBody, UpsertMarkupRuleBody, CreateMedicineCategoryBody, UpdateMedicineCategoryBody } from './settings.schemas';

export const settingsController = {
  async get(_req: Request, res: Response) {
    const data = await settingsService.get();
    res.json({ data });
  },
  async update(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await settingsService.update(req.body as UpdatePharmacySettingsBody, req.user.sub);
    res.json({ data });
  },
  async listMarkupRules(_req: Request, res: Response) {
    const data = await settingsService.listMarkupRules();
    res.json({ data });
  },
  async upsertMarkupRule(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await settingsService.upsertMarkupRule(req.body as UpsertMarkupRuleBody, req.user.sub);
    res.json({ data });
  },
  async deleteMarkupRule(req: Request, res: Response) {
    await settingsService.deleteMarkupRule(req.params.category as string);
    res.status(204).end();
  },
  async listMedicineCategories(_req: Request, res: Response) {
    const data = await settingsService.listMedicineCategories();
    res.json({ data });
  },
  async createMedicineCategory(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await settingsService.createMedicineCategory(req.body as CreateMedicineCategoryBody, req.user.sub);
    res.status(201).json({ data });
  },
  async updateMedicineCategory(req: Request, res: Response) {
    const data = await settingsService.updateMedicineCategory(req.params.id as string, req.body as UpdateMedicineCategoryBody);
    res.json({ data });
  },
  async resetData(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const { scope } = req.body as { scope: 'transactions_only' | 'complete' };
    const result = await settingsService.resetData(scope, req.user.sub);
    res.json({ data: result });
  },
};
