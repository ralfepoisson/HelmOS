CREATE TYPE "IdeaEvaluationProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TYPE "IdeaEvaluationDecision" AS ENUM ('PROMOTE', 'REFINE', 'REJECT');

CREATE TYPE "IdeaCandidateWorkflowState" AS ENUM ('AWAITING_EVALUATION', 'NEEDS_REFINEMENT', 'REJECTED', 'PROMOTED');

ALTER TABLE "idea_candidates"
  ADD COLUMN "workflow_state" "IdeaCandidateWorkflowState" NOT NULL DEFAULT 'AWAITING_EVALUATION',
  ADD COLUMN "evaluation_status" "IdeaEvaluationProcessingStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "evaluation_started_at" TIMESTAMPTZ,
  ADD COLUMN "evaluation_completed_at" TIMESTAMPTZ,
  ADD COLUMN "evaluation_failed_at" TIMESTAMPTZ,
  ADD COLUMN "evaluation_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "latest_evaluation_gateway_run_id" VARCHAR(255),
  ADD COLUMN "latest_evaluation_error_message" TEXT,
  ADD COLUMN "latest_evaluation_error_meta" JSONB,
  ADD COLUMN "evaluation_decision" "IdeaEvaluationDecision",
  ADD COLUMN "evaluation_decision_reason" TEXT,
  ADD COLUMN "evaluation_next_best_action" TEXT,
  ADD COLUMN "evaluation_recommended_action_reason" TEXT,
  ADD COLUMN "evaluation_readiness_label" VARCHAR(100),
  ADD COLUMN "evaluation_blocking_issue" TEXT,
  ADD COLUMN "evaluation_strongest_aspect" TEXT,
  ADD COLUMN "evaluation_biggest_risk" TEXT,
  ADD COLUMN "evaluation_duplicate_risk_label" VARCHAR(100),
  ADD COLUMN "evaluation_duplicate_risk_explanation" TEXT,
  ADD COLUMN "evaluation_payload_json" JSONB;

CREATE TABLE "curated_opportunities" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "idea_candidate_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "summary" TEXT,
  "problem_statement" TEXT NOT NULL,
  "target_customer" TEXT NOT NULL,
  "value_proposition" TEXT NOT NULL,
  "product_service_description" TEXT NOT NULL,
  "differentiation" TEXT NOT NULL,
  "early_monetization_idea" TEXT NOT NULL,
  "readiness_label" VARCHAR(100) NOT NULL,
  "strongest_aspect" TEXT NOT NULL,
  "biggest_risk" TEXT NOT NULL,
  "blocking_issue" TEXT,
  "duplicate_risk_label" VARCHAR(100) NOT NULL,
  "duplicate_risk_explanation" TEXT NOT NULL,
  "next_best_action" TEXT NOT NULL,
  "promotion_reason" TEXT NOT NULL,
  "tags_json" JSONB NOT NULL DEFAULT '{}',
  "evaluation_payload_json" JSONB NOT NULL,
  "promoted_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "curated_opportunities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "curated_opportunities_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "curated_opportunities_idea_candidate_id_fkey"
    FOREIGN KEY ("idea_candidate_id") REFERENCES "idea_candidates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "curated_opportunities_idea_candidate_id_key"
  ON "curated_opportunities"("idea_candidate_id");

CREATE INDEX "idea_candidates_owner_user_id_workflow_state_updated_at_idx"
  ON "idea_candidates"("owner_user_id", "workflow_state", "updated_at");

CREATE INDEX "idea_candidates_owner_user_id_evaluation_status_updated_at_idx"
  ON "idea_candidates"("owner_user_id", "evaluation_status", "updated_at");

CREATE INDEX "curated_opportunities_owner_user_id_promoted_at_idx"
  ON "curated_opportunities"("owner_user_id", "promoted_at");
