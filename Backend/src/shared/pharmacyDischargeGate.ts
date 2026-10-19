import type { Prisma } from '@prisma/client';

/** Evaluate source records, never just a previously stamped clearance. */
export async function pharmacyDischargeBlocked(tx: Pick<Prisma.TransactionClient, 'pharmacyClearance' | 'hmsPharmacyCharge'>, admissionId: string) {
  const [pending, unpaid] = await Promise.all([
    tx.pharmacyClearance.count({ where: {
      admissionRecordId: admissionId,
      status: { in: ['REQUESTED', 'ACCEPTED', 'PARTIALLY_FULFILLED', 'DISPENSING', 'INTEGRATION_ERROR', 'AUTHORIZATION_REQUIRED'] },
    } }),
    tx.hmsPharmacyCharge.count({ where: { admissionRecordId: admissionId, patientOutstanding: { gt: 0 } } }),
  ]);
  return pending > 0 || unpaid > 0;
}
