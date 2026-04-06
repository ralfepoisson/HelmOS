DO $$
BEGIN
  CREATE TYPE "ConceptualToolStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "conceptual_tools" (
  "id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "purpose" TEXT NOT NULL,
  "when_to_use" JSONB NOT NULL DEFAULT '[]',
  "when_not_to_use" JSONB NOT NULL DEFAULT '[]',
  "instructions" JSONB NOT NULL DEFAULT '[]',
  "expected_effect" TEXT NOT NULL,
  "status" "ConceptualToolStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "conceptual_tools_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "conceptual_tools_name_key"
  ON "conceptual_tools"("name");

CREATE INDEX IF NOT EXISTS "conceptual_tools_status_updated_at_idx"
  ON "conceptual_tools"("status", "updated_at");

CREATE INDEX IF NOT EXISTS "conceptual_tools_category_name_idx"
  ON "conceptual_tools"("category", "name");

INSERT INTO "conceptual_tools" (
  "id",
  "name",
  "category",
  "purpose",
  "when_to_use",
  "when_not_to_use",
  "instructions",
  "expected_effect",
  "status",
  "version"
)
VALUES
  (
    '8a8e7708-8225-4a37-bbe0-fd0d3040b001',
    'Inversion',
    'transformative',
    'Challenge the default model by reversing core assumptions.',
    '["high market saturation", "weak differentiation"]',
    '["problem statement unclear"]',
    '["Identify the dominant operating assumption", "Reverse it", "Explore whether the reversed model creates a viable opportunity"]',
    'Increase novelty and differentiation while preserving grounding.',
    'ACTIVE',
    1
  ),
  (
    '8a8e7708-8225-4a37-bbe0-fd0d3040b002',
    'Analogy Transfer',
    'cross-domain',
    'Borrow structural patterns from adjacent domains and reapply them to the current problem.',
    '["category conventions feel stale", "a transfer pattern may unlock a new framing"]',
    '["domain constraints are highly specific and non-transferable"]',
    '["Pick an adjacent domain with a comparable dynamic", "Extract the governing pattern", "Test how that pattern maps onto the current opportunity"]',
    'Expand the design space using grounded but unfamiliar reference models.',
    'ACTIVE',
    1
  ),
  (
    '8a8e7708-8225-4a37-bbe0-fd0d3040b003',
    'Constraint Removal',
    'transformative',
    'Reveal new opportunity shapes by temporarily removing a presumed fixed constraint.',
    '["the team is stuck in local optima", "legacy rules may be over-constraining"]',
    '["regulatory or safety constraints are truly non-negotiable"]',
    '["Name the limiting constraint", "Remove it hypothetically", "Explore what becomes possible and what new risks emerge"]',
    'Open up more ambitious options while clarifying which constraints are genuinely binding.',
    'ACTIVE',
    1
  ),
  (
    '8a8e7708-8225-4a37-bbe0-fd0d3040b004',
    'Failure Analysis',
    'diagnostic',
    'Surface likely failure modes before committing to an idea direction.',
    '["execution risk is opaque", "the concept looks attractive but fragile"]',
    '["the concept is still too undefined for concrete failure analysis"]',
    '["List the most plausible ways the concept could fail", "Trace likely root causes", "Identify mitigations or redesign options"]',
    'Improve robustness and expose hidden assumptions before downstream investment.',
    'ACTIVE',
    1
  ),
  (
    '8a8e7708-8225-4a37-bbe0-fd0d3040b005',
    'Assumption Mapping',
    'diagnostic',
    'Make implicit assumptions explicit so they can be tested, prioritized, and challenged.',
    '["the idea relies on multiple unstated beliefs", "teams disagree on what is assumed versus known"]',
    '["the work already has a validated evidence map"]',
    '["Break the concept into major claims", "Write the hidden assumption behind each claim", "Rank assumptions by risk and uncertainty"]',
    'Create a clearer path for validation and sharper reasoning about idea quality.',
    'ACTIVE',
    1
  )
ON CONFLICT ("name") DO NOTHING;
