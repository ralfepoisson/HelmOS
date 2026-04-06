CREATE TYPE "IdeaRefinementProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "idea_refinement_policies" (
  "id" UUID NOT NULL,
  "profile_name" VARCHAR(100) NOT NULL DEFAULT 'default',
  "refinement_depth" VARCHAR(30) NOT NULL DEFAULT 'standard',
  "creativity_level" VARCHAR(30) NOT NULL DEFAULT 'medium',
  "strictness" VARCHAR(30) NOT NULL DEFAULT 'balanced',
  "max_conceptual_tools_per_run" INTEGER NOT NULL DEFAULT 3,
  "internal_quality_threshold" VARCHAR(30) NOT NULL DEFAULT 'standard',
  "latest_run_status" VARCHAR(30),
  "last_run_at" TIMESTAMPTZ,
  "latest_run_summary_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "idea_refinement_policies_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "proto_ideas"
  ADD COLUMN "refinement_status" "IdeaRefinementProcessingStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "refinement_started_at" TIMESTAMPTZ,
  ADD COLUMN "refinement_completed_at" TIMESTAMPTZ,
  ADD COLUMN "refinement_failed_at" TIMESTAMPTZ,
  ADD COLUMN "refinement_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "latest_refinement_policy_id" UUID,
  ADD COLUMN "latest_refinement_gateway_run_id" VARCHAR(255),
  ADD COLUMN "latest_refinement_error_message" TEXT,
  ADD COLUMN "latest_refinement_error_meta" JSONB;

CREATE TABLE "idea_candidates" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "proto_idea_id" UUID NOT NULL,
  "policy_id" UUID,
  "problem_statement" TEXT NOT NULL,
  "target_customer" TEXT NOT NULL,
  "value_proposition" TEXT NOT NULL,
  "opportunity_concept" TEXT NOT NULL,
  "differentiation" TEXT NOT NULL,
  "assumptions" JSONB NOT NULL DEFAULT '[]',
  "open_questions" JSONB NOT NULL DEFAULT '[]',
  "improvement_summary" TEXT NOT NULL,
  "key_changes" JSONB NOT NULL DEFAULT '[]',
  "applied_reasoning_summary" TEXT NOT NULL,
  "applied_conceptual_tool_ids" JSONB NOT NULL DEFAULT '[]',
  "quality_check_coherence" TEXT NOT NULL,
  "quality_check_gaps" JSONB NOT NULL DEFAULT '[]',
  "quality_check_risks" JSONB NOT NULL DEFAULT '[]',
  "status_label" VARCHAR(100) NOT NULL,
  "status_tone" VARCHAR(100) NOT NULL,
  "agent_confidence" VARCHAR(100) NOT NULL,
  "status_explanation" TEXT NOT NULL,
  "refinement_iteration" INTEGER NOT NULL DEFAULT 1,
  "deduplication_fingerprint" VARCHAR(1000),
  "raw_llm_payload" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "idea_candidates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idea_candidates_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "idea_candidates_proto_idea_id_fkey"
    FOREIGN KEY ("proto_idea_id") REFERENCES "proto_ideas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "idea_candidates_policy_id_fkey"
    FOREIGN KEY ("policy_id") REFERENCES "idea_refinement_policies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "_ConceptualToolToIdeaCandidate" (
  "A" UUID NOT NULL,
  "B" UUID NOT NULL
);

CREATE UNIQUE INDEX "idea_refinement_policies_profile_name_key"
  ON "idea_refinement_policies"("profile_name");

CREATE INDEX "proto_ideas_owner_user_id_refinement_status_created_at_idx"
  ON "proto_ideas"("owner_user_id", "refinement_status", "created_at");

CREATE INDEX "proto_ideas_latest_refinement_policy_id_refinement_status_idx"
  ON "proto_ideas"("latest_refinement_policy_id", "refinement_status");

CREATE INDEX "idea_candidates_owner_user_id_created_at_idx"
  ON "idea_candidates"("owner_user_id", "created_at");

CREATE INDEX "idea_candidates_proto_idea_id_refinement_iteration_idx"
  ON "idea_candidates"("proto_idea_id", "refinement_iteration");

CREATE INDEX "idea_candidates_policy_id_created_at_idx"
  ON "idea_candidates"("policy_id", "created_at");

CREATE UNIQUE INDEX "_ConceptualToolToIdeaCandidate_AB_unique"
  ON "_ConceptualToolToIdeaCandidate"("A", "B");

CREATE INDEX "_ConceptualToolToIdeaCandidate_B_index"
  ON "_ConceptualToolToIdeaCandidate"("B");

ALTER TABLE "proto_ideas"
  ADD CONSTRAINT "proto_ideas_latest_refinement_policy_id_fkey"
  FOREIGN KEY ("latest_refinement_policy_id") REFERENCES "idea_refinement_policies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "_ConceptualToolToIdeaCandidate"
  ADD CONSTRAINT "_ConceptualToolToIdeaCandidate_A_fkey"
  FOREIGN KEY ("A") REFERENCES "conceptual_tools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_ConceptualToolToIdeaCandidate"
  ADD CONSTRAINT "_ConceptualToolToIdeaCandidate_B_fkey"
  FOREIGN KEY ("B") REFERENCES "idea_candidates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
