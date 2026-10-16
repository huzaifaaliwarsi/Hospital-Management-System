const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.hospitalInvoice.findMany({
    select: { id: true, invoiceNumber: true, selfPayEncounter: true }
  });
  console.log('--- INVOICES ---');
  console.log(JSON.stringify(invoices, null, 2));

  const audits = await prisma.auditLog.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' }
  });
  console.log('--- RECENT AUDITS ---');
  console.log(audits.map(a => ({ action: a.action, entity: a.entity, details: a.details })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
