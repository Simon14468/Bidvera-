-- Revocable hashed report share tokens (M5). Legacy HMAC links remain valid until expiry.

CREATE TABLE "ReportShare" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportShare_tokenHash_key" ON "ReportShare"("tokenHash");
CREATE INDEX "ReportShare_companyId_tenderId_idx" ON "ReportShare"("companyId", "tenderId");
CREATE INDEX "ReportShare_tenderId_revokedAt_idx" ON "ReportShare"("tenderId", "revokedAt");

ALTER TABLE "ReportShare" ADD CONSTRAINT "ReportShare_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportShare" ADD CONSTRAINT "ReportShare_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
