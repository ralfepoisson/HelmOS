CREATE TABLE "prospecting_reviews" (
  "id" UUID NOT NULL,
  "prospecting_configuration_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "gateway_run_id" VARCHAR(255),
  "review_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospecting_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prospecting_reviews_prospecting_configuration_id_fkey"
    FOREIGN KEY ("prospecting_configuration_id") REFERENCES "prospecting_configurations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "prospecting_reviews_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "prospecting_reviews_prospecting_configuration_id_created_at_idx"
  ON "prospecting_reviews"("prospecting_configuration_id", "created_at");

CREATE INDEX "prospecting_reviews_owner_user_id_created_at_idx"
  ON "prospecting_reviews"("owner_user_id", "created_at");

CREATE TABLE "prospecting_result_records" (
  "id" UUID NOT NULL,
  "prospecting_configuration_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "source_key" VARCHAR(512) NOT NULL,
  "query" VARCHAR(1000),
  "executed_query" VARCHAR(1000),
  "query_family_id" VARCHAR(255),
  "query_family_title" VARCHAR(500),
  "theme_link" VARCHAR(500),
  "source_title" VARCHAR(500),
  "source_url" TEXT,
  "snippet" TEXT,
  "provider" VARCHAR(100),
  "rank" INTEGER,
  "captured_at" TIMESTAMP(3),
  "source_payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospecting_result_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prospecting_result_records_prospecting_configuration_id_fkey"
    FOREIGN KEY ("prospecting_configuration_id") REFERENCES "prospecting_configurations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "prospecting_result_records_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "prospecting_result_records_owner_user_id_source_key_key"
  ON "prospecting_result_records"("owner_user_id", "source_key");

CREATE INDEX "prospecting_result_records_prospecting_configuration_id_captured_at_idx"
  ON "prospecting_result_records"("prospecting_configuration_id", "captured_at");

CREATE INDEX "prospecting_result_records_owner_user_id_captured_at_idx"
  ON "prospecting_result_records"("owner_user_id", "captured_at");

INSERT INTO "prospecting_reviews" (
  "id",
  "prospecting_configuration_id",
  "owner_user_id",
  "gateway_run_id",
  "review_json",
  "created_at"
)
SELECT
  gen_random_uuid(),
  pc."id",
  pc."owner_user_id",
  pc."latest_gateway_run_id",
  pc."latest_review_json",
  COALESCE(pc."updated_at", CURRENT_TIMESTAMP)
FROM "prospecting_configurations" pc
WHERE pc."latest_review_json" IS NOT NULL;

INSERT INTO "prospecting_result_records" (
  "id",
  "prospecting_configuration_id",
  "owner_user_id",
  "source_key",
  "query",
  "executed_query",
  "query_family_id",
  "query_family_title",
  "theme_link",
  "source_title",
  "source_url",
  "snippet",
  "provider",
  "rank",
  "captured_at",
  "source_payload",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  pc."id",
  pc."owner_user_id",
  COALESCE(
    NULLIF(lower(trim(record->>'sourceUrl')), ''),
    'source-record:' || COALESCE(NULLIF(record->>'id', ''), gen_random_uuid()::text)
  ),
  NULLIF(record->>'query', ''),
  NULLIF(record->>'executedQuery', ''),
  NULLIF(record->>'queryFamilyId', ''),
  NULLIF(record->>'queryFamilyTitle', ''),
  NULLIF(record->>'themeLink', ''),
  NULLIF(record->>'sourceTitle', ''),
  NULLIF(record->>'sourceUrl', ''),
  NULLIF(record->>'snippet', ''),
  NULLIF(record->>'provider', ''),
  CASE WHEN COALESCE(record->>'rank', '') ~ '^[0-9]+$' THEN (record->>'rank')::INTEGER ELSE NULL END,
  CASE WHEN COALESCE(record->>'capturedAt', '') <> '' THEN (record->>'capturedAt')::timestamptz ELSE NULL END,
  record,
  COALESCE(pc."updated_at", CURRENT_TIMESTAMP),
  COALESCE(pc."updated_at", CURRENT_TIMESTAMP)
FROM "prospecting_configurations" pc
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pc."last_result_records", '[]'::jsonb)) AS record
ON CONFLICT ("owner_user_id", "source_key") DO NOTHING;
