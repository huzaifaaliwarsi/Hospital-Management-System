import { prisma } from '@/db/client';

/** Prisma `select` fragment for resolving a "Name (Role)" actor label from a PortalUser relation. */
export const actorSelect = {
  select: { username: true, role: true, staff: { select: { fullName: true } } },
} as const;

export type ActorRelation = { username: string; role: string; staff?: { fullName: string } | null };

export function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/** Same label format as `resolveActorLabel`, for callers that already `include`d the relation. */
export function formatActorFromRelation(user: ActorRelation | null | undefined): string {
  if (!user) return 'System';
  const name = user.staff?.fullName || user.username;
  return `${name} (${formatRoleLabel(user.role)})`;
}

/**
 * Resolves a human-readable "Name (Role)" label for a PortalUser id — used
 * wherever an audit-trail column is a plain string (no FK relation), e.g.
 * `HospitalProfile.updatedBy`, `Department.statusChangedBy`.
 */
export async function resolveActorLabel(portalUserId: string): Promise<string> {
  const user = await prisma.portalUser.findUnique({
    where: { id: portalUserId },
    select: { username: true, role: true, staff: { select: { fullName: true } } },
  });
  return formatActorFromRelation(user);
}
