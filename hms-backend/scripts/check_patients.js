const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sp = await prisma.selfPayEncounter.findMany();
  console.log('--- ALL SELF PAY ENCOUNTERS ---');
  console.log(JSON.stringify(sp, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
