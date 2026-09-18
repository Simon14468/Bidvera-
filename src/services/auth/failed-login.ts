import { hashIdentifier } from "@/lib/crypto";
import { logInfo, trackEvent } from "@/services/observability";
import { writeAdminAudit } from "@/services/admin/audit";

export function failedLoginAuditPayload(input: {
  email: string;
  ip?: string | null;
  scope: "user" | "super_admin";
}) {
  return {
    scope: input.scope,
    emailHash: hashIdentifier(input.email),
    ipHash: hashIdentifier(input.ip),
  };
}

export async function recordFailedLoginAttempt(input: {
  email: string;
  ip?: string | null;
  scope: "user" | "super_admin";
  adminUserId?: string | null;
}): Promise<void> {
  const payload = failedLoginAuditPayload(input);
  logInfo("auth.login_failed", payload);
  await trackEvent({
    action: "LOGIN",
    ipHash: payload.ipHash,
    metadata: {
      result: "failed",
      scope: payload.scope,
      emailHash: payload.emailHash,
    },
  });
  if (input.scope === "super_admin" && input.adminUserId) {
    await writeAdminAudit({
      adminUserId: input.adminUserId,
      action: "ADMIN_LOGIN_FAILED",
      targetType: "admin_user",
      targetId: input.adminUserId,
      ipHash: payload.ipHash,
      metadata: { emailHash: payload.emailHash },
    });
  }
}
