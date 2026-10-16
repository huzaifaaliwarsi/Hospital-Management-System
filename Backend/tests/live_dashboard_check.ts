import { log } from 'console';
import { dashboardService } from '../src/modules/reports/dashboard.service';

async function main() {
  console.log('Testing dashboardService against live PostgreSQL database...');
  const result = await dashboardService.getSuperAdminDashboard({ preset: 'today' });

  console.log('=== REAL DATABASE AGGREGATION RESULT ===');
  console.log('Period Label:', result.period.label);
  console.log('Active Departments:', result.infrastructure.activeDepartmentsCount);
  console.log('Active Staff:', result.infrastructure.totalStaffCount);
  console.log('Active Doctors:', result.infrastructure.doctorsCount);
  console.log('Active Corporate Panels:', result.infrastructure.activePanelsCount);
  console.log('Active Panel Patients:', result.infrastructure.activePanelPatientsCount);
  console.log('Total Beds:', result.bedMetrics.totalBeds);
  console.log('Occupied Beds:', result.bedMetrics.occupiedBeds);
  console.log('Available Beds:', result.bedMetrics.availableBeds);
  console.log('Occupancy Percent:', result.bedMetrics.occupancyPercent + '%');
  console.log('Wards in DB:', result.bedMetrics.wards.map(w => `${w.wardName} (${w.totalBeds} beds)`).join(', '));
  console.log('Billing Total Invoices:', result.billingSummary.totalInvoices);
  console.log('Net Billing:', result.billingSummary.netBilling);
  console.log('KPI cards generated:', result.kpis.length);
  console.log('First 3 KPIs:', result.kpis.slice(0, 3).map(k => `${k.title}: ${k.value}`));
  console.log('Attention alerts:', result.attentionAlerts.length);
  console.log('SUCCESS: All real queries executed cleanly against live PostgreSQL database!');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
