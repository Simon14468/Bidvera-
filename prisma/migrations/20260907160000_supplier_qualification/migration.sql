-- CreateTable
CREATE TABLE "SupplierQualificationProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "legalCompanyName" TEXT,
    "tradingName" TEXT,
    "registrationNumber" TEXT,
    "taxVatNumber" TEXT,
    "country" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "companyType" TEXT,
    "yearEstablished" INTEGER,
    "employeeCount" INTEGER,
    "annualTurnover" TEXT,
    "currencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "businessSectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "servicesProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "licenses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "geographicCoverage" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "completenessPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQualificationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQualificationEvidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "storageKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "byteLength" INTEGER,
    "checksumSha256" TEXT,
    "externalUrl" TEXT,
    "provenance" JSONB,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQualificationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQualificationProfile_companyId_key" ON "SupplierQualificationProfile"("companyId");

-- CreateIndex
CREATE INDEX "SupplierQualificationProfile_companyId_idx" ON "SupplierQualificationProfile"("companyId");

-- CreateIndex
CREATE INDEX "SupplierQualificationProfile_updatedAt_idx" ON "SupplierQualificationProfile"("updatedAt");

-- CreateIndex
CREATE INDEX "SupplierQualificationEvidence_companyId_profileId_idx" ON "SupplierQualificationEvidence"("companyId", "profileId");

-- CreateIndex
CREATE INDEX "SupplierQualificationEvidence_companyId_createdAt_idx" ON "SupplierQualificationEvidence"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupplierQualificationProfile" ADD CONSTRAINT "SupplierQualificationProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQualificationEvidence" ADD CONSTRAINT "SupplierQualificationEvidence_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SupplierQualificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
