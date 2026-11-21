import { formatPKR } from '../../frontend/src/utils/formatters';
import { afterEach, expect, it, vi } from 'vitest';
const captured = vi.hoisted(() => ({ pdf: vi.fn(), sheets: vi.fn(), arrays: vi.fn(), write: vi.fn(), html: vi.fn() }));
vi.mock('../../frontend/node_modules/jspdf/dist/jspdf.node.min.js', () => ({ jsPDF: class {
  internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } }; lastAutoTable = { finalY: 80 };
  setFillColor() {} rect() {} setFont() {} setFontSize() {} setTextColor() {} text() {}
  setDrawColor() {} roundedRect() {} setLineWidth() {} line() {} save() {}
} }));
vi.mock('../../frontend/node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs', () => ({ default: captured.pdf }));
vi.mock('../../frontend/node_modules/xlsx/xlsx.js', () => ({ utils: {
  json_to_sheet: (rows: unknown[]) => { captured.sheets(rows); return {}; },
  aoa_to_sheet: (rows: unknown[]) => { captured.arrays(rows); return {}; },
  book_new: () => ({}), book_append_sheet: vi.fn(), sheet_to_csv: () => '',
}, writeFile: captured.write }));
vi.mock('../../frontend/src/services/hospitalProfileService', () => ({
  getHospitalProfile: () => ({ name: 'Test Hospital' }), getProfileFieldValue: () => '', formatHospitalAddress: () => '',
}));
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../frontend/src/services/apiClient', () => ({ default: api }));
import { fetchIncomeExpenseLedger } from '../../frontend/src/services/managementReportsService';
import { m01SummaryRows } from '../../frontend/src/features/superAdmin/reports/m01Summary';
import { downloadTablePDF, downloadTableExcel, downloadTableCSV, printTable } from '../../frontend/src/services/tableExportService';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('M01 passes full consolidated data and financial footer unchanged to all four export adapters', async () => {
  const row = { reference:'INV-26-0001',grossBilling:1000,collectionsReceived:500,outstandingPayable:500 };
  api.get.mockResolvedValue({data:{data:{items:[row],totalRecords:1}}});
  const report=await fetchIncomeExpenseLedger({preset:'today'}, {method:'CASH'},1,500,true);
  expect(api.get).toHaveBeenCalledWith('/reports/management/income-expense-ledger', {params:expect.objectContaining({exportAll:true,method:'CASH'})});
  // Collections span all methods; cash movement is already calculated separately by the API.
  const totals = { cashMovement: { totalCustomerCollections:900, actualPaidOperatingExpenses:225, netPhysicalCashMovement:175, netCashMovement:175, currentRemainingCustomerDues:500 }, hospitalCosts: { doctorCommissionEarned:1000 } } as any;
  const summaryRows=m01SummaryRows(totals).map(({label,value})=>({label,value}));
  expect(summaryRows).toHaveLength(4);
  expect(summaryRows.map(r=>r.value)).toEqual([900,225,175,500]);
  expect(summaryRows.map(r=>r.label)).toEqual([
    'Total Customer Collections (Net of Customer Refunds)',
    'Actual Paid Operating Expenses (Including Salary and Commission Payouts)',
    'Net Cash Movement', 'Current Remaining Customer Dues',
  ]);
  const zeroRows=m01SummaryRows({cashMovement:{totalCustomerCollections:-0,actualPaidOperatingExpenses:0,netPhysicalCashMovement:-0,currentRemainingCustomerDues:0}} as any);
  expect(zeroRows.map(r=>formatPKR(r.value))).toEqual(Array(4).fill('PKR 0.00'));
  const request={documentTitle:'M01',filenamePrefix:'M01',currentUser:null,rows:report.items,summaryRows,minimalSummary:true,columns:[
    {header:'Reference',cell:(r:any)=>r.reference},
    ...['grossBilling','collectionsReceived','outstandingPayable'].map(k=>({header:k,cell:(r:any)=>r[k].toFixed(2),excelValue:(r:any)=>r[k]})),
  ]};
  vi.stubGlobal('document',{createElement:()=>({click:vi.fn()}),body:{appendChild:vi.fn(),removeChild:vi.fn()}});
  vi.stubGlobal('window',{open:()=>({document:{write:captured.html,close:vi.fn()},focus:vi.fn(),print:vi.fn()})});
  vi.useFakeTimers();
  downloadTablePDF(request);downloadTableExcel(request);downloadTableCSV(request);printTable(request);
  expect(captured.pdf.mock.calls[0][1].body).toEqual([['INV-26-0001','1000.00','500.00','500.00']]);
  expect(captured.pdf.mock.calls[1][1].body).toEqual(summaryRows.map(r=>[r.label,formatPKR(r.value)]));
  expect(captured.pdf.mock.calls[1][1].head).toBeUndefined();
  expect(captured.sheets.mock.calls[0][0]).toEqual([{Reference:row.reference,grossBilling:1000,collectionsReceived:500,outstandingPayable:500}]);
  expect(captured.sheets.mock.calls[2][0]).toEqual(captured.sheets.mock.calls[0][0]);
  expect(captured.arrays.mock.calls[0][0]).toEqual(summaryRows.map(r=>[r.label,r.value]));
  expect(captured.arrays.mock.calls[1][0]).toEqual(summaryRows.map(r=>[r.label,formatPKR(r.value)]));
  const html=captured.html.mock.calls[0][0];
  expect(html).not.toContain('INCOME & EXPENSE SUMMARY'); expect(html).not.toContain('Collections & Cash'); expect(html).toContain('1 record'); expect(html).toContain('INV-26-0001');
  for(const r of summaryRows) expect(html).toContain(`${r.label}</td><td style="text-align:right;font-weight:bold">${formatPKR(r.value)}`);
});
