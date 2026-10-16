import type { Prisma } from '@prisma/client';

export async function requirePharmacyDepartment(tx: Pick<Prisma.TransactionClient, 'department'>) {
  let department = await tx.department.findFirst({
    where: {
      OR: [
        { isDefaultPharmacy: true },
        { code: 'DEP-0004' },
        { departmentType: 'PHARMACY' },
        { name: { equals: 'Pharmacy', mode: 'insensitive' } },
      ],
      isActive: true,
    },
  });
  if (!department) {
    // If missing or not yet seeded, automatically create/recover default internal pharmacy department with code DEP-0004
    const existing = await tx.department.findFirst({
      where: {
        OR: [
          { code: 'DEP-0004' },
          { name: { equals: 'Pharmacy', mode: 'insensitive' } },
        ],
      },
    });
    if (existing) {
      department = await tx.department.update({
        where: { id: existing.id },
        data: {
          code: 'DEP-0004',
          name: 'Pharmacy',
          isDefaultPharmacy: true,
          departmentType: 'PHARMACY',
          pharmacyRelated: true,
          isActive: true,
          fulfillmentOwnership: 'INTERNAL',
        },
      });
    } else {
      department = await tx.department.create({
        data: {
          code: 'DEP-0004',
          name: 'Pharmacy',
          departmentType: 'PHARMACY',
          isDefaultPharmacy: true,
          pharmacyRelated: true,
          isActive: true,
          fulfillmentOwnership: 'INTERNAL',
        },
      });
    }
  } else if (!department.isDefaultPharmacy) {
    department = await tx.department.update({
      where: { id: department.id },
      data: { isDefaultPharmacy: true, pharmacyRelated: true, fulfillmentOwnership: 'INTERNAL' },
    });
  }
  return department;
}
