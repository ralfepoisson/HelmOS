CREATE TABLE "log_entries" (
    "id" UUID NOT NULL,
    "level" VARCHAR(20) NOT NULL,
    "scope" VARCHAR(120) NOT NULL,
    "event" VARCHAR(120) NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "log_entries_created_at_idx" ON "log_entries"("created_at");
CREATE INDEX "log_entries_level_created_at_idx" ON "log_entries"("level", "created_at");
CREATE INDEX "log_entries_scope_created_at_idx" ON "log_entries"("scope", "created_at");
