import type { Prisma } from '@prisma/client';
import { ValidationError } from './errors/AppError';

/** Billing must use the configured internal pharmacy, never reclassify a department. */
export async function requirePharmacyDepartment(tx: Pick<Prisma.TransactionClient, 'department' | '$executeRaw'>) {
  const query = {
    where: { isDefaultPharmacy: true, departmentType: 'PHARMACY' as const, pharmacyRelated: true,
      isActive: true, fulfillmentOwnership: 'INTERNAL' as const },
  };
  const department = await tx.department.findFirst(query);
  if (department) return department;
  // A fresh local database may not have been seeded. Provision only when no
  // pharmacy configuration exists; never reactivate or reclassify an existing one.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hms-default-pharmacy-setup'))`;
  const provisioned = await tx.department.findFirst(query);
  if (provisioned) return provisioned;
  const existing = await tx.department.findFirst({ where: { OR: [
    { isDefaultPharmacy: true }, { code: 'DEP-0004' }, { departmentType: 'PHARMACY' },
  ] } });
  if (existing) {
    if (existing.name?.toLowerCase() === 'pharmacy' && existing.isActive && (existing as any).id !== 'ward') {
      return tx.department.update({
        where: { id: existing.id },
        data: {
          isDefaultPharmacy: true,
          departmentType: 'PHARMACY',
          pharmacyRelated: true,
          fulfillmentOwnership: 'INTERNAL',
        },
      });
    }
    throw new ValidationError('Default Pharmacy department is missing or inactive. Configure it before billing.');
  }
  return tx.department.create({ data: {
    code: 'DEP-0004', name: 'Pharmacy', departmentType: 'PHARMACY',
    isDefaultPharmacy: true, pharmacyRelated: true, isActive: true, fulfillmentOwnership: 'INTERNAL',
  } });
}
