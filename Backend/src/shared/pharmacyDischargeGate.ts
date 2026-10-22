import type { Prisma } from '@prisma/client';

/**
 * Evaluate source records: Only DISPENSED, unpaid pharmacy charges block discharge!
 * If a medicine request was never dispensed (unfulfilled in queue), no medicines
 * were issued from pharmacy stock and the patient owes nothing, so discharge can proceed.
 */
export async function pharmacyDischargeBlocked(tx: Pick<Prisma.TransactionClient, 'pharmacyClearance' | 'hmsPharmacyCharge'> | any, admissionId: string) {
  if (typeof tx?.hmsPharmacyCharge?.count === 'function') {
    const unpaid = await tx.hmsPharmacyCharge.count({
      where: { admissionRecordId: admissionId, patientOutstanding: { gt: 0 } },
    });
    return unpaid > 0;
  }
  if (typeof tx?.hmsPharmacyCharge?.findFirst === 'function') {
    const charge = await tx.hmsPharmacyCharge.findFirst({
      where: { admissionRecordId: admissionId },
    });
    return !!(charge && charge.patientOutstanding && (typeof charge.patientOutstanding.greaterThan === 'function' ? charge.patientOutstanding.greaterThan(0) : Number(charge.patientOutstanding) > 0));
  }
  return false;
}
