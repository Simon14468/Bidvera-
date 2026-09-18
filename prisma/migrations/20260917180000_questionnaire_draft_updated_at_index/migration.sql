-- Dashboard activity queries filter QuestionnaireDraftAnswer by companyId + updatedAt.
CREATE INDEX IF NOT EXISTS "QuestionnaireDraftAnswer_companyId_updatedAt_idx"
  ON "QuestionnaireDraftAnswer"("companyId", "updatedAt");
