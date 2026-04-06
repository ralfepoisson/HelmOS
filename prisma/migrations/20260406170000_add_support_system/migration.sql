-- CreateEnum
CREATE TYPE "SupportConversationStatus" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM (
  'NEW',
  'TRIAGED',
  'INVESTIGATING',
  'WAITING_FOR_HUMAN_REVIEW',
  'ACTION_APPROVED',
  'ACTION_REJECTED',
  'RESOLVED',
  'CLOSED'
);

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM (
  'PRODUCT_QUESTION',
  'BUG_REPORT',
  'INCIDENT',
  'DATA_ISSUE',
  'ACCESS_ISSUE',
  'CONFIGURATION',
  'EXTERNAL_DEPENDENCY',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "SupportTicketSource" AS ENUM ('INLINE_HELP_WIDGET');

-- CreateEnum
CREATE TYPE "SupportInvestigationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupportRecommendationStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED'
);

-- CreateEnum
CREATE TYPE "SupportIssueClassification" AS ENUM (
  'USER_ERROR',
  'DATA_ISSUE',
  'TRANSIENT_INFRA_ISSUE',
  'BACKEND_BUG',
  'FRONTEND_BUG',
  'CONFIGURATION_DEFECT',
  'EXTERNAL_DEPENDENCY_FAILURE',
  'UNKNOWN'
);

-- CreateTable
CREATE TABLE "support_conversations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "tenant_id" VARCHAR(255),
  "title" VARCHAR(255),
  "status" "SupportConversationStatus" NOT NULL DEFAULT 'OPEN',
  "source" "SupportTicketSource" NOT NULL DEFAULT 'INLINE_HELP_WIDGET',
  "escalated_at" TIMESTAMP(3),
  "last_message_at" TIMESTAMP(3),
  "last_route" VARCHAR(255),
  "session_key" VARCHAR(120),
  "client_context_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "support_messages" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "message_index" INTEGER NOT NULL,
  "sender_type" "ActorType" NOT NULL,
  "sender_user_id" UUID,
  "message_text" TEXT NOT NULL,
  "message_format" "MessageFormat" NOT NULL DEFAULT 'MARKDOWN',
  "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
  "detected_intent" VARCHAR(80),
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_messages_sender_user_id_fkey"
    FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "support_tickets" (
  "id" UUID NOT NULL,
  "ticket_key" VARCHAR(32) NOT NULL,
  "conversation_id" UUID,
  "reporter_user_id" UUID NOT NULL,
  "tenant_id" VARCHAR(255),
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'NEW',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "severity" "SupportTicketSeverity" NOT NULL DEFAULT 'MODERATE',
  "category" "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
  "source" "SupportTicketSource" NOT NULL DEFAULT 'INLINE_HELP_WIDGET',
  "route" VARCHAR(255),
  "technical_context_json" JSONB,
  "investigation_notes" TEXT,
  "proposed_fix" TEXT,
  "proposed_fix_confidence" VARCHAR(40),
  "proposed_fix_rationale" TEXT,
  "human_review_required" BOOLEAN NOT NULL DEFAULT true,
  "human_review_status" VARCHAR(40),
  "assigned_to_user_id" UUID,
  "triaged_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_tickets_reporter_user_id_fkey"
    FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_tickets_assigned_to_user_id_fkey"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "support_ticket_events" (
  "id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "event_type" VARCHAR(80) NOT NULL,
  "from_status" "SupportTicketStatus",
  "to_status" "SupportTicketStatus",
  "actor_type" "ActorType" NOT NULL DEFAULT 'SYSTEM',
  "actor_user_id" UUID,
  "comment" TEXT,
  "payload_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_ticket_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_ticket_events_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_ticket_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "support_investigations" (
  "id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "investigator_agent_key" VARCHAR(100) NOT NULL,
  "investigator_user_id" UUID,
  "status" "SupportInvestigationStatus" NOT NULL DEFAULT 'PENDING',
  "issue_summary" TEXT,
  "evidence_reviewed_json" JSONB,
  "likely_root_cause" TEXT,
  "confidence_label" VARCHAR(40),
  "rationale" TEXT,
  "classification" "SupportIssueClassification" NOT NULL DEFAULT 'UNKNOWN',
  "recommended_remediation" TEXT,
  "human_review_required" BOOLEAN NOT NULL DEFAULT true,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_investigations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_investigations_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_investigations_investigator_user_id_fkey"
    FOREIGN KEY ("investigator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "support_recommendations" (
  "id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "investigation_id" UUID,
  "status" "SupportRecommendationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "recommendation_text" TEXT NOT NULL,
  "rationale" TEXT,
  "confidence_label" VARCHAR(40),
  "human_notes" TEXT,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_recommendations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_recommendations_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_recommendations_investigation_id_fkey"
    FOREIGN KEY ("investigation_id") REFERENCES "support_investigations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_recommendations_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "support_conversations_user_id_session_key_key"
  ON "support_conversations"("user_id", "session_key");
CREATE INDEX "support_conversations_user_id_updated_at_idx"
  ON "support_conversations"("user_id", "updated_at" DESC);
CREATE INDEX "support_conversations_status_updated_at_idx"
  ON "support_conversations"("status", "updated_at" DESC);
CREATE INDEX "support_conversations_tenant_id_updated_at_idx"
  ON "support_conversations"("tenant_id", "updated_at" DESC);

CREATE UNIQUE INDEX "support_messages_conversation_id_message_index_key"
  ON "support_messages"("conversation_id", "message_index");
CREATE INDEX "support_messages_conversation_id_created_at_idx"
  ON "support_messages"("conversation_id", "created_at" DESC);
CREATE INDEX "support_messages_sender_user_id_idx"
  ON "support_messages"("sender_user_id");

CREATE UNIQUE INDEX "support_tickets_ticket_key_key"
  ON "support_tickets"("ticket_key");
CREATE INDEX "support_tickets_reporter_user_id_created_at_idx"
  ON "support_tickets"("reporter_user_id", "created_at" DESC);
CREATE INDEX "support_tickets_conversation_id_created_at_idx"
  ON "support_tickets"("conversation_id", "created_at" DESC);
CREATE INDEX "support_tickets_status_updated_at_idx"
  ON "support_tickets"("status", "updated_at" DESC);
CREATE INDEX "support_tickets_priority_severity_updated_at_idx"
  ON "support_tickets"("priority", "severity", "updated_at" DESC);
CREATE INDEX "support_tickets_category_updated_at_idx"
  ON "support_tickets"("category", "updated_at" DESC);
CREATE INDEX "support_tickets_tenant_id_updated_at_idx"
  ON "support_tickets"("tenant_id", "updated_at" DESC);
CREATE INDEX "support_tickets_assigned_to_user_id_updated_at_idx"
  ON "support_tickets"("assigned_to_user_id", "updated_at" DESC);

CREATE INDEX "support_ticket_events_ticket_id_created_at_idx"
  ON "support_ticket_events"("ticket_id", "created_at" ASC);
CREATE INDEX "support_ticket_events_actor_user_id_created_at_idx"
  ON "support_ticket_events"("actor_user_id", "created_at" DESC);
CREATE INDEX "support_ticket_events_event_type_created_at_idx"
  ON "support_ticket_events"("event_type", "created_at" DESC);

CREATE INDEX "support_investigations_ticket_id_created_at_idx"
  ON "support_investigations"("ticket_id", "created_at" DESC);
CREATE INDEX "support_investigations_status_updated_at_idx"
  ON "support_investigations"("status", "updated_at" DESC);
CREATE INDEX "support_investigations_classification_updated_at_idx"
  ON "support_investigations"("classification", "updated_at" DESC);

CREATE INDEX "support_recommendations_ticket_id_created_at_idx"
  ON "support_recommendations"("ticket_id", "created_at" DESC);
CREATE INDEX "support_recommendations_status_updated_at_idx"
  ON "support_recommendations"("status", "updated_at" DESC);
CREATE INDEX "support_recommendations_reviewed_by_user_id_reviewed_at_idx"
  ON "support_recommendations"("reviewed_by_user_id", "reviewed_at" DESC);
