"server-only";
import { prisma } from "@/lib/db";

export async function auditLog(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: string
) {
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, details },
  });
}
