-- ConfidenceLevel enum used by DecisionMemory / DecisionMemoryRevision.
-- Must exist before 20260831170000_decision_memory (which references the type).
-- Idempotent for databases that already received the enum via db push.

DO $$ BEGIN
  CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
