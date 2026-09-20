-- AlterTable
ALTER TABLE "EmailVerificationToken" ADD COLUMN IF NOT EXISTS "deliverySecretEnc" TEXT;
ALTER TABLE "EmailChangeToken" ADD COLUMN IF NOT EXISTS "deliverySecretEnc" TEXT;
ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "deliverySecretEnc" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaEnterClaim" (
    "id" TEXT NOT NULL,
    "sessionTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaEnterClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SaEnterClaim_expiresAt_idx" ON "SaEnterClaim"("expiresAt");
