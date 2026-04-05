CREATE TABLE "prospecting_configurations" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "agent_state" VARCHAR(20) NOT NULL DEFAULT 'idle',
  "latest_run_status" VARCHAR(30),
  "latest_gateway_run_id" VARCHAR(255),
  "last_run_at" TIMESTAMPTZ,
  "next_run_at" TIMESTAMPTZ,
  "ui_snapshot_json" JSONB NOT NULL DEFAULT '{}',
  "latest_review_json" JSONB,
  "last_result_records" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospecting_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prospecting_configurations_owner_user_id_key" UNIQUE ("owner_user_id"),
  CONSTRAINT "prospecting_configurations_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "prospecting_configurations_latest_run_status_updated_at_idx"
  ON "prospecting_configurations"("latest_run_status", "updated_at");
