import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { pharmacyController as c } from './pharmacy.controller';
import * as s from './pharmacy.schemas';

const router = Router();
const view = authorize('pharmacy', 'view');
const create = authorize('pharmacy', 'create');
const edit = authorize('pharmacy', 'edit');

// Medicine Master (pharmacy.md §9) — Sales cannot create/edit (§4 restriction, `edit` not granted to SALES_DISPENSING).
router.post('/medicines', edit, validate({ body: s.createMedicineBodySchema }), asyncHandler(c.createMedicine));
router.get('/medicines', view, validate({ query: s.listMedicinesQuerySchema }), asyncHandler(c.listMedicines));
router.get('/medicines/next-code', edit, asyncHandler(c.nextMedicineCode));
router.patch('/medicines/:id', edit, validate({ params: s.idParamsSchema, body: s.updateMedicineBodySchema }), asyncHandler(c.updateMedicine));

// Batches & Stock
router.post('/medicines/:id/batches', edit, validate({ params: s.idParamsSchema, body: s.createBatchBodySchema }), asyncHandler(c.createBatch));
router.get('/medicines/:id/batches', view, validate({ params: s.idParamsSchema }), asyncHandler(c.getMedicineBatches));
router.get('/medicines/:id/packaging', view, validate({ params: s.idParamsSchema }), asyncHandler(c.getPackaging));
router.post('/medicines/:id/opening-stock', edit, validate({ params: s.idParamsSchema, body: s.openingStockBodySchema }), asyncHandler(c.receiveOpeningStock));
router.post('/medicines/:id/batches/:batchId/opening-stock', edit, validate({ params: s.batchIdParamsSchema, body: s.openingStockBodySchema }), asyncHandler(c.receiveOpeningStock));

// Stock Movement Center (pharmacy.md §9.1)
router.get('/stock-movements', view, validate({ query: s.stockMovementsQuerySchema }), asyncHandler(c.stockMovements));
router.post('/stock-adjustments', edit, validate({ body: s.stockAdjustmentBodySchema }), asyncHandler(c.createStockAdjustment));

// POS (pharmacy.md §6) — Sales CAN dispense/create sales (`create` granted to all three roles).
router.post('/dispense', create, validate({ body: s.dispenseRetailBodySchema }), asyncHandler(c.dispenseRetail));
router.post('/sales-returns', create, validate({ body: s.salesReturnBodySchema }), asyncHandler(c.salesReturn));
router.get('/invoices', view, validate({ query: s.listInvoicesQuerySchema }), asyncHandler(c.listInvoices));
router.get('/invoices/:id', view, validate({ params: s.invoiceIdParamsSchema }), asyncHandler(c.getInvoiceById));
router.post('/invoices/:id/payments', create, validate({ params: s.invoiceIdParamsSchema, body: s.addPaymentBodySchema }), asyncHandler(c.addPayment));

export default router;
