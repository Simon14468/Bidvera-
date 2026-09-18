import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function writeAdminAudit(input: {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipHash?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      previousValue: input.previousValue,
      newValue: input.newValue,
      ipHash: input.ipHash ?? null,
      metadata: input.metadata,
    },
  });
}
