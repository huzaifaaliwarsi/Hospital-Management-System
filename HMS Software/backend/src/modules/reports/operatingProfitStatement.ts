import { prisma } from '@/db/client';
import { hospitalClock } from '@/shared/hospitalClock';
import { staffFinanceSummary } from './staffFinanceSummary';
import { operatingPerformance } from './operatingPerformance';
import type { IncomeExpenseLedgerQuery, OperatingProfitQuery } from './managementReports.schemas';
import type { managementReportsService } from './managementReports.service';

type Ledger = Awaited<ReturnType<typeof managementReportsService.getIncomeExpenseLedger>>;
type Range = { start: Date; end: Date; label: string };
export type StatementEntry = { id: string; date: string; reference: string; category: string; department: string; description: string; actor: string; revenue: number; cost: number; status: string; details: Record<string, unknown> };
export const statementCategories = [
  ['opd','1. HOSPITAL OPERATING REVENUE','OPD Services Revenue','REVENUE'],
  ['emergency','1. HOSPITAL OPERATING REVENUE','Emergency Services Revenue','REVENUE'],
  ['observation','1. HOSPITAL OPERATING REVENUE','Observation Services Revenue','REVENUE'],
  ['admission','1. HOSPITAL OPERATING REVENUE','Admission / Inpatient Hospital Services Revenue','REVENUE'],
  ['otherRevenue','1. HOSPITAL OPERATING REVENUE','Other Valid Hospital Services Revenue','REVENUE'],
  ['discounts','1. HOSPITAL OPERATING REVENUE','Less: Approved Discounts','REVENUE'],
  ['serviceCredits','1. HOSPITAL OPERATING REVENUE','Less: Valid Service Credits / Reversals','REVENUE'],
  ['netRevenue','1. HOSPITAL OPERATING REVENUE','TOTAL NET EARNED HOSPITAL REVENUE','SUBTOTAL'],
  ['consumables','2. DIRECT SERVICE COSTS','Clinical Consumables / Materials Used','COST'],
  ['procedure','2. DIRECT SERVICE COSTS','Procedure / Treatment Direct Consumable Costs','COST'],
  ['otherDirect','2. DIRECT SERVICE COSTS','Other Valid Direct Service Costs','COST'],
  ['directReturns','2. DIRECT SERVICE COSTS','Less: Valid Direct Cost Reversals / Returns','COST'],
  ['directTotal','2. DIRECT SERVICE COSTS','TOTAL DIRECT SERVICE COSTS','SUBTOTAL'],
  ['grossProfit','3. GROSS PROFIT (GROSS MARGIN)','GROSS PROFIT (GROSS MARGIN)','SUBTOTAL'],
  ['payroll','4. OPERATING OVERHEADS & EXPENSES','Staff Salaries / Payroll Recognized','EXPENSE'],
  ['commission','4. OPERATING OVERHEADS & EXPENSES','Doctor Commission Earned / Recognized','EXPENSE'],
  ['hospitalOpex','4. OPERATING OVERHEADS & EXPENSES','Hospital Operating Expenses','EXPENSE'],
  ['inventoryOpex','4. OPERATING OVERHEADS & EXPENSES','Inventory Operating Expenses','EXPENSE'],
  ['otherOpex','4. OPERATING OVERHEADS & EXPENSES','Other Valid Operating Overheads','EXPENSE'],
  ['expenseCredits','4. OPERATING OVERHEADS & EXPENSES','Less: Valid Expense Reversals / Credits','EXPENSE'],
  ['opexTotal','4. OPERATING OVERHEADS & EXPENSES','TOTAL OPERATING EXPENSES','SUBTOTAL'],
  ['operatingProfit','5. NET OPERATING PROFIT / (LOSS)','NET OPERATING PROFIT / (LOSS)','NET RESULT'],
] as const;
const revenueKeys = ['opd','emergency','observation','admission','otherRevenue','discounts','serviceCredits'];
const directKeys = ['consumables','procedure','otherDirect','directReturns'];
const expenseKeys = ['payroll','commission','hospitalOpex','inventoryOpex','otherOpex','expenseCredits'];
export function categoryKeys(category?: string): string[] | undefined {
  if (!category) return undefined;
  if (category === 'netRevenue') return revenueKeys;
  if (category === 'directTotal') return directKeys;
  if (category === 'opexTotal') return expenseKeys;
  if (category === 'grossProfit' || category === 'grossMargin') return [...revenueKeys,...directKeys];
  if (category === 'operatingProfit' || category === 'operatingMargin') return [...revenueKeys,...directKeys,...expenseKeys];
  return [category];
}
export function previousEquivalent(range: Range): Range {
  const duration = range.end.getTime() - range.start.getTime() + 1;
  return { start: new Date(range.start.getTime() - duration), end: new Date(range.start.getTime() - 1), label: 'Previous Equivalent Period' };
}
export const growth = (current: number | null, prior: number | null) => current === null || prior === null || prior === 0 ? null : (current - prior) / Math.abs(prior) * 100;
const sum = (entries: StatementEntry[], keys: string[], field: 'revenue' | 'cost') => entries.filter(e => keys.includes(e.category)).reduce((s,e) => s + e[field],0);

/** Uses the same invoice snapshots, staff recognition and P&L arithmetic as the existing reports. */
export function summarizeStatement(entries: StatementEntry[], incomplete: boolean) {
  const amounts: Record<string, number | null> = {};
  for (const [key] of statementCategories) amounts[key] = sum(entries,[key],revenueKeys.includes(key) ? 'revenue' : 'cost');
  const net = sum(entries,revenueKeys,'revenue'), direct = sum(entries,directKeys,'cost'), opex = sum(entries,expenseKeys,'cost');
  const performance = operatingPerformance(net,direct,opex);
  Object.assign(amounts,{netRevenue:net,directTotal:direct,opexTotal:opex,
    grossProfit:incomplete ? null : performance.grossProfit,
    grossMargin:incomplete || !net ? null : performance.grossProfit/net*100,
    operatingProfit:incomplete ? null : performance.operatingProfit,
    operatingMargin:incomplete || !net ? null : performance.operatingMargin});
  return amounts;
}

async function readPeriod(range: Range, departmentId: string | undefined, readLedger: (q: IncomeExpenseLedgerQuery) => Promise<Ledger>) {
  const [ledger, staff, lines] = await Promise.all([
    readLedger({ preset:'custom',fromDate:hospitalClock(range.start).date,toDate:hospitalClock(range.end).date,departmentId,page:1,limit:500,exportAll:true }),
    staffFinanceSummary(range.start,range.end,departmentId),
    prisma.invoiceLineItem.findMany({where:{createdAt:{gte:range.start,lte:range.end},isCompleted:true,billingSource:{not:'PHARMACY'},hospitalInvoice:{status:{not:'VOID'}}},include:{serviceRate:{include:{department:true}},hospitalInvoice:{include:{department:true,appointment:{include:{department:true}},admissionRecord:{include:{department:true}},createdByUser:{select:{displayName:true,username:true}},selfPayEncounter:{select:{fullName:true}},panelPatient:{select:{fullName:true}}}}}}),
  ]);
  const entries: StatementEntry[] = [];
  for (const line of lines) {
    const inv=line.hospitalInvoice;
    const department=line.serviceRate?.department ?? inv.department ?? inv.appointment?.department ?? inv.admissionRecord?.department;
    if (departmentId && department?.id !== departmentId) continue;
    const type=inv.encounterType || inv.sourceType;
    const category = inv.admissionRecordId ? 'admission' : ({OPD:'opd',EMERGENCY:'emergency',ER:'emergency',OBSERVATION:'observation',OBSV:'observation',ADMISSION:'admission'} as Record<string,string>)[type] || 'otherRevenue';
    const base={date:line.createdAt.toISOString(),reference:inv.invoiceNumber,department:department?.name || 'Unassigned',description:line.descriptionSnapshot || line.serviceRate?.name || 'Hospital service',actor:inv.createdByUser?.displayName || inv.createdByUser?.username || inv.createdById || 'Unassigned',status:inv.status,details:{invoiceId:inv.id,lineId:line.id,patient:inv.selfPayEncounter?.fullName || inv.panelPatient?.fullName,quantity:Number(line.quantity),historicalRate:Number(line.rateSnapshot),billingSource:line.billingSource,gross:Number(line.lineGross),discount:Number(line.discountAmount),net:Number(line.lineNet)}};
    entries.push({...base,id:line.id,category,revenue:Number(line.lineGross),cost:0});
    if (Number(line.discountAmount)) entries.push({...base,id:`discount-${line.id}`,category:'discounts',revenue:-Number(line.discountAmount),cost:0});
  }
  for (const row of ledger.items) {
    if (!['EXPENSE','CONSUMABLE'].includes(row.transactionType) || row.recognizedExpense === 0) continue;
    const category=row.recognizedExpense < 0 ? row.transactionType==='CONSUMABLE'?'directReturns':'expenseCredits' : row.transactionType==='CONSUMABLE'?'consumables':row.id.startsWith('iexp-')?'inventoryOpex':'hospitalOpex';
    entries.push({id:row.id,date:row.date,reference:row.reference,category,department:row.department,description:row.patientPayeeDescription,actor:row.portalUser,status:row.status,revenue:0,cost:row.recognizedExpense,details:row.details || {sourceId:row.id,paymentMethod:row.paymentMethod,recognizedExpense:row.recognizedExpense,paid:row.expensePaid}});
  }
  for (const row of staff.sources) entries.push({id:`${row.category}-${row.id}`,date:row.date,reference:row.reference,category:row.amount<0?'expenseCredits':row.category,department:departmentId || 'See source allocation',description:row.category==='payroll'?'Approved payroll recognition':'Eligible collection commission recognition',actor:row.actor,status:row.status,revenue:0,cost:row.amount,details:row.details});
  const warnings: string[] = [];
  let incomplete=ledger.totals.hospitalCosts.hasIncompleteCost;
  if (incomplete) warnings.push(`${ledger.totals.hospitalCosts.missingCostCount} consumption records have incomplete historical costs. Profit is unavailable.`);
  const expectedCosts=ledger.totals.hospitalCosts;
  const observedDirect=sum(entries,directKeys,'cost');
  const observedOpex=sum(entries,expenseKeys,'cost');
  const expectedOpex=expectedCosts.staffPayrollRecognized+expectedCosts.doctorCommissionEarned+expectedCosts.approvedHospitalExpenses+expectedCosts.inventoryOperatingExpenses;
  if (Math.abs(observedDirect-expectedCosts.directConsumables)>0.01 || Math.abs(observedOpex-expectedOpex)>0.01) {
    incomplete=true; warnings.push('Source costs do not fully reconcile with the canonical financial summary. Profit is unavailable; no balancing records were invented.');
  }
  const net=sum(entries,revenueKeys,'revenue');
  if (Math.abs(net-ledger.totals.hospitalRevenue.netEarnedRevenue)>0.01) warnings.push('Hospital revenue includes completed, non-pharmacy service lines only. The broader billing cohort differs; inspect service completion and source ownership.');
  return { entries, amounts:summarizeStatement(entries,incomplete), incomplete,warnings };
}

export async function buildOperatingStatement(query: OperatingProfitQuery, range: Range, readLedger: (q: IncomeExpenseLedgerQuery) => Promise<Ledger>) {
  const priorRange=query.comparison==='previous' && query.preset!=='all_time' ? previousEquivalent(range) : null;
  const [current,prior]=await Promise.all([readPeriod(range,query.departmentId,readLedger),priorRange?readPeriod(priorRange,query.departmentId,readLedger):Promise.resolve(null)]);
  const rows=statementCategories.map(([key,section,label,type])=>{
    const amount=current.amounts[key] ?? null, previous=prior?.amounts[key] ?? null;
    const margin=key.endsWith('Margin');
    return {key,section,label,type,unit:margin?'percent':'currency',current:amount,prior:previous,percentOfRevenue:margin?null:amount===null || !current.amounts.netRevenue?null:amount/current.amounts.netRevenue*100,variance:growth(amount,previous),sourceCount:current.entries.filter(e=>categoryKeys(key)?.includes(e.category)).length};
  });
  const keys=categoryKeys(query.category);
  const matching=current.entries.filter(e=>!keys || keys.includes(e.category)).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const page=query.page||1,limit=query.limit||25;
  const warnings=[...current.warnings,...(prior?.warnings.map(w=>`Prior period: ${w}`)||[])];
  if(query.preset==='all_time' && query.comparison==='previous') warnings.push('Comparison is disabled for All Time.');
  return {
    period: { start: range.start.toISOString(), end: range.end.toISOString(), label: range.label },
    priorPeriod: priorRange ? { start: priorRange.start.toISOString(), end: priorRange.end.toISOString(), label: `${hospitalClock(priorRange.start).date} to ${hospitalClock(priorRange.end).date}` } : null,
    rows,
    warnings,
    incomplete: current.incomplete,
    ledger: {
      items: query.exportAll ? matching : matching.slice((page - 1) * limit, page * limit),
      page,
      limit,
      totalRecords: matching.length,
      totalPages: Math.max(1, Math.ceil(matching.length / limit)),
      recognizedRevenue: matching.reduce((s, e) => s + e.revenue, 0),
      recognizedCost: matching.reduce((s, e) => s + e.cost, 0),
    },
    summary: {
      revenue: current.amounts.netRevenue ?? 0,
      grossBilling: current.amounts.netRevenue ?? 0,
      discounts: current.amounts.discounts ?? 0,
      directCost: current.amounts.directTotal ?? 0,
      grossProfit: current.amounts.grossProfit ?? 0,
      payroll: current.amounts.payroll ?? 0,
      doctorCommission: current.amounts.commission ?? 0,
      otherOperatingExpenses: current.amounts.opexTotal ?? 0,
      totalCosts: (current.amounts.directTotal ?? 0) + (current.amounts.opexTotal ?? 0),
      operatingProfit: current.amounts.operatingProfit ?? 0,
      marginPercentage: current.amounts.operatingMargin ?? 0,
      hasIncompleteCost: current.incomplete,
    },
  };
}
