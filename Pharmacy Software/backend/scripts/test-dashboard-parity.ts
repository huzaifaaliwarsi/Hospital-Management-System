import 'dotenv/config';
import assert from 'node:assert/strict';
import { prisma } from '../src/db/client';
import { dashboardService } from '../src/modules/dashboard/dashboard.service';

async function main() {
  const admin = await prisma.portalUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) throw new Error('No admin user');

  console.log('Running current dashboardService.getManagementSummary...');
  const currentMgmt = await dashboardService.getManagementSummary(admin.id);

  console.log('Running current dashboardService.getSalesSummary...');
  const currentSales = await dashboardService.getSalesSummary(admin.id);

  console.log('Current Mgmt Summary Keys:', Object.keys(currentMgmt));
  console.log('Current Sales Summary:', currentSales);
  console.log('Mgmt summary KPI values:', {
    salesToday: currentMgmt.salesToday.toString(),
    salesCountToday: currentMgmt.salesCountToday,
    purchasesToday: currentMgmt.purchasesToday.toString(),
    totalRevenueAllTime: currentMgmt.totalRevenueAllTime.toString(),
    recognizedRevenueToday: currentMgmt.recognizedRevenueToday.toString(),
    collectionsToday: currentMgmt.collectionsToday.toString(),
    outstanding: currentMgmt.outstanding.toString(),
    operatingProfitToday: currentMgmt.operatingProfitToday?.toString(),
    incompleteInvoices: currentMgmt.incompleteInvoices,
    totalMedicines: currentMgmt.totalMedicines,
    totalStockUnits: currentMgmt.totalStockUnits,
    lowStockCount: currentMgmt.lowStockCount,
    outOfStockCount: currentMgmt.outOfStockCount,
    nearExpiryCount: currentMgmt.nearExpiryCount,
    expiredCount: currentMgmt.expiredCount,
  });

  console.log('overview:', currentMgmt.inventoryOverview.slice(0, 2));
  console.log('lowStock:', currentMgmt.lowStockList.slice(0, 2));
  console.log('nearExpiry:', currentMgmt.nearExpiryList.slice(0, 2));
  console.log('supplierUpdates:', currentMgmt.supplierUpdates.slice(0, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
