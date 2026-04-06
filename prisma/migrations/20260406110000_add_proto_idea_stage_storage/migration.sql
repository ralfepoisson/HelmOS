CREATE TYPE "ProtoIdeaProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "proto_idea_extraction_policies" (
  "id" UUID NOT NULL,
  "profile_name" VARCHAR(100) NOT NULL DEFAULT 'default',
  "extraction_breadth" VARCHAR(30) NOT NULL DEFAULT 'standard',
  "inference_tolerance" VARCHAR(30) NOT NULL DEFAULT 'balanced',
  "novelty_bias" VARCHAR(30) NOT NULL DEFAULT 'balanced',
  "minimum_signal_threshold" VARCHAR(30) NOT NULL DEFAULT 'medium',
  "max_proto_ideas_per_source" INTEGER NOT NULL DEFAULT 4,
  "latest_run_status" VARCHAR(30),
  "last_run_at" TIMESTAMPTZ,
  "latest_run_summary_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "proto_idea_extraction_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proto_idea_sources" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "prospecting_configuration_id" UUID,
  "extraction_policy_id" UUID,
  "upstream_source_record_id" VARCHAR(255) NOT NULL,
  "source_key" VARCHAR(512) NOT NULL,
  "source_title" VARCHAR(500),
  "source_url" TEXT,
  "source_type" VARCHAR(100),
  "source_captured_at" TIMESTAMPTZ,
  "source_payload" JSONB NOT NULL,
  "processing_status" "ProtoIdeaProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "processing_started_at" TIMESTAMPTZ,
  "processing_completed_at" TIMESTAMPTZ,
  "processing_failed_at" TIMESTAMPTZ,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "latest_gateway_run_id" VARCHAR(255),
  "extraction_policy_snapshot" JSONB,
  "last_error_message" TEXT,
  "last_error_meta" JSONB,
  "raw_llm_payload" JSONB,
  "parsed_response" JSONB,
  "source_summary" TEXT,
  "overall_signal_strength_label" VARCHAR(100),
  "overall_signal_strength_tone" VARCHAR(100),
  "overall_signal_agent_confidence" VARCHAR(100),
  "overall_signal_explanation" TEXT,
  "extraction_notes" TEXT,
  "deduplication_notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "proto_idea_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "proto_idea_sources_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "proto_idea_sources_prospecting_configuration_id_fkey"
    FOREIGN KEY ("prospecting_configuration_id") REFERENCES "prospecting_configurations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "proto_idea_sources_extraction_policy_id_fkey"
    FOREIGN KEY ("extraction_policy_id") REFERENCES "proto_idea_extraction_policies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "proto_ideas" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "problem_statement" TEXT NOT NULL,
  "target_customer" TEXT NOT NULL,
  "opportunity_hypothesis" TEXT NOT NULL,
  "why_it_matters" TEXT NOT NULL,
  "opportunity_type" VARCHAR(100) NOT NULL,
  "explicit_signals" JSONB NOT NULL DEFAULT '[]',
  "inferred_signals" JSONB NOT NULL DEFAULT '[]',
  "assumptions" JSONB NOT NULL DEFAULT '[]',
  "open_questions" JSONB NOT NULL DEFAULT '[]',
  "status_label" VARCHAR(100) NOT NULL,
  "status_tone" VARCHAR(100) NOT NULL,
  "agent_confidence" VARCHAR(100) NOT NULL,
  "status_explanation" TEXT NOT NULL,
  "raw_llm_payload" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "proto_ideas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "proto_ideas_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "proto_ideas_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "proto_idea_sources"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "proto_idea_extraction_policies_profile_name_key"
  ON "proto_idea_extraction_policies"("profile_name");

CREATE UNIQUE INDEX "proto_idea_sources_owner_user_id_source_key_key"
  ON "proto_idea_sources"("owner_user_id", "source_key");

CREATE INDEX "proto_idea_sources_processing_status_source_captured_at_updated_at_idx"
  ON "proto_idea_sources"("processing_status", "source_captured_at", "updated_at");

CREATE INDEX "proto_idea_sources_owner_user_id_processing_status_source_captured_at_idx"
  ON "proto_idea_sources"("owner_user_id", "processing_status", "source_captured_at");

CREATE INDEX "proto_idea_sources_prospecting_configuration_id_processing_status_idx"
  ON "proto_idea_sources"("prospecting_configuration_id", "processing_status");

CREATE INDEX "proto_idea_sources_extraction_policy_id_processing_status_idx"
  ON "proto_idea_sources"("extraction_policy_id", "processing_status");

CREATE INDEX "proto_ideas_owner_user_id_created_at_idx"
  ON "proto_ideas"("owner_user_id", "created_at");

CREATE INDEX "proto_ideas_source_id_created_at_idx"
  ON "proto_ideas"("source_id", "created_at");
