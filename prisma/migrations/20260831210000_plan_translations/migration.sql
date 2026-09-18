-- Plan marketing translations (ar/es/zh/fr). English remains on Plan.name / featureList.
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "translations" JSONB;
