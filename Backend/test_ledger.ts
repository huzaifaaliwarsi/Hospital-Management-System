import { prisma } from './src/db/client';
import { admissionBillingService } from './src/modules/frontdesk/admissionBilling.service';

async function main() {
  const admissionId = 'c1ad589b-a4f5-4b38-8946-6cd8cf3e1e01';
  console.log('Testing admission:', admissionId);

  const ledger = await admissionBillingService.getLedger(admissionId);
  console.log('=== LEDGER SUMMARY ===');
  console.log('Total Charges:', ledger.summary.totalCharges.toString());
  console.log('Total Paid:', ledger.summary.totalPaid.toString());
  console.log('Outstanding:', ledger.summary.outstandingBalance.toString());
  console.log('Available Credit:', ledger.summary.availableCredit.toString());
  console.log('Entries:');
  for (const e of ledger.entries) {
    console.log(`- [${e.status}] ${e.type} | ${e.description} | Qty: ${e.qty} | Rate: ${e.rate} | Debit: ${e.debit} | Due: ${e.dueAmount}`);
  }

  const statement = await admissionBillingService.getStatement(admissionId);
  console.log('\n=== STATEMENT ===');
  console.log('Consolidated total:', statement.consolidated.total.toString());
  console.log('Consolidated outstanding:', statement.consolidated.outstanding.toString());
  console.log('Pharmacy Charge obj:', statement.pharmacyCharge ? {
    invoiceNum: statement.pharmacyCharge.pharmacyInvoiceNumber,
    total: statement.pharmacyCharge.totalAmount.toString(),
    items: statement.pharmacyCharge.items,
  } : null);

  const records = await admissionBillingService.listAdmissionRecords();
  const r = records.find(x => x.id === admissionId);
  console.log('\n=== ADMISSION RECORD ===');
  console.log('Current Charges:', r?.currentCharges.toString());
  console.log('Outstanding:', r?.outstanding.toString());
  console.log('Billing Status:', r?.billingStatus);


  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
