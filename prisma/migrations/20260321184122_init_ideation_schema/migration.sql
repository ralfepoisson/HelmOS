-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('IDEATION');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkspaceStage" AS ENUM ('IDEATION', 'VALUE_PROPOSITION', 'CUSTOMER_SEGMENTS', 'BUSINESS_MODEL', 'MARKET_RESEARCH');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('IDEATION');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "RefinementState" AS ENUM ('EMPTY', 'DRAFT', 'NEEDS_REFINEMENT', 'GOOD', 'STRONG');

-- CreateEnum
CREATE TYPE "AgentConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('LOCKED', 'CURRENT', 'AVAILABLE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "UnlockState" AS ENUM ('LOCKED', 'UNLOCKED');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageFormat" AS ENUM ('PLAIN_TEXT', 'MARKDOWN');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(200),
    "avatar_url" TEXT,
    "auth_provider" VARCHAR(50) NOT NULL,
    "auth_provider_user_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_members" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MemberRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "legal_name" VARCHAR(255),
    "slug" VARCHAR(120) NOT NULL,
    "industry" VARCHAR(100),
    "website_url" TEXT,
    "description" TEXT,
    "branding" JSONB,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "workspace_type" "WorkspaceType" NOT NULL DEFAULT 'IDEATION',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_stage" "WorkspaceStage" NOT NULL DEFAULT 'IDEATION',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_documents" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL DEFAULT 'IDEATION',
    "title" VARCHAR(255) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "completeness_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "quality_state" VARCHAR(50),
    "agent_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_sections" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "section_key" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL,
    "content" TEXT,
    "status" "SectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "refinement_state" "RefinementState" NOT NULL DEFAULT 'EMPTY',
    "agent_confidence" "AgentConfidence",
    "completion_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "last_updated_by_type" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "last_updated_by_user_id" UUID,
    "last_updated_at" TIMESTAMP(3),
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,

    CONSTRAINT "strategy_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_versions" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "content" TEXT,
    "change_summary" TEXT,
    "changed_by_type" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "changed_by_user_id" UUID,
    "agent_run_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diff_json" JSONB,

    CONSTRAINT "section_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_insights" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "insight_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "score" DECIMAL(5,2),
    "severity" VARCHAR(50),
    "generated_by_type" "ActorType" NOT NULL DEFAULT 'AGENT',
    "agent_run_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_current" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_progress" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "stage_key" "WorkspaceStage" NOT NULL,
    "display_order" INTEGER NOT NULL,
    "status" "StageStatus" NOT NULL,
    "unlock_state" "UnlockState" NOT NULL DEFAULT 'LOCKED',
    "unlock_reason" TEXT,
    "completion_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "quality_checks" JSONB,
    "entered_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_threads" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "document_id" UUID,
    "title" VARCHAR(255),
    "status" "ThreadStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "message_index" INTEGER NOT NULL,
    "sender_type" "ActorType" NOT NULL,
    "sender_user_id" UUID,
    "message_text" TEXT NOT NULL,
    "message_format" "MessageFormat" NOT NULL DEFAULT 'MARKDOWN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_generated_id" VARCHAR(100),
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "metadata" JSONB,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "trigger_message_id" UUID,
    "run_status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "model_name" VARCHAR(100),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "summary" TEXT,
    "error_message" TEXT,
    "result_metadata" JSONB,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run_effects" (
    "id" UUID NOT NULL,
    "agent_run_id" UUID NOT NULL,
    "effect_type" VARCHAR(50) NOT NULL,
    "target_entity_type" VARCHAR(50) NOT NULL,
    "target_entity_id" UUID,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_run_effects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "actor_type" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actor_user_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" UUID,
    "event_summary" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_provider_auth_provider_user_id_key" ON "users"("auth_provider", "auth_provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");

-- CreateIndex
CREATE INDEX "organisation_members_user_id_idx" ON "organisation_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_members_organisation_id_user_id_key" ON "organisation_members"("organisation_id", "user_id");

-- CreateIndex
CREATE INDEX "companies_created_by_user_id_idx" ON "companies"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_organisation_id_slug_key" ON "companies"("organisation_id", "slug");

-- CreateIndex
CREATE INDEX "workspaces_company_id_idx" ON "workspaces"("company_id");

-- CreateIndex
CREATE INDEX "workspaces_created_by_user_id_idx" ON "workspaces"("created_by_user_id");

-- CreateIndex
CREATE INDEX "strategy_documents_workspace_id_idx" ON "strategy_documents"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_documents_workspace_id_document_type_key" ON "strategy_documents"("workspace_id", "document_type");

-- CreateIndex
CREATE INDEX "strategy_sections_document_id_display_order_idx" ON "strategy_sections"("document_id", "display_order");

-- CreateIndex
CREATE INDEX "strategy_sections_last_updated_by_user_id_idx" ON "strategy_sections"("last_updated_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_sections_document_id_section_key_key" ON "strategy_sections"("document_id", "section_key");

-- CreateIndex
CREATE INDEX "section_versions_changed_by_user_id_idx" ON "section_versions"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "section_versions_agent_run_id_idx" ON "section_versions"("agent_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "section_versions_section_id_version_no_key" ON "section_versions"("section_id", "version_no");

-- CreateIndex
CREATE INDEX "document_insights_document_id_is_current_idx" ON "document_insights"("document_id", "is_current");

-- CreateIndex
CREATE INDEX "document_insights_agent_run_id_idx" ON "document_insights"("agent_run_id");

-- CreateIndex
CREATE INDEX "stage_progress_workspace_id_display_order_idx" ON "stage_progress"("workspace_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "stage_progress_workspace_id_stage_key_key" ON "stage_progress"("workspace_id", "stage_key");

-- CreateIndex
CREATE INDEX "chat_threads_workspace_id_idx" ON "chat_threads"("workspace_id");

-- CreateIndex
CREATE INDEX "chat_threads_document_id_idx" ON "chat_threads"("document_id");

-- CreateIndex
CREATE INDEX "chat_threads_created_by_user_id_idx" ON "chat_threads"("created_by_user_id");

-- CreateIndex
CREATE INDEX "chat_messages_sender_user_id_idx" ON "chat_messages"("sender_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_thread_id_message_index_key" ON "chat_messages"("thread_id", "message_index");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_thread_id_client_generated_id_key" ON "chat_messages"("thread_id", "client_generated_id");

-- CreateIndex
CREATE INDEX "agent_runs_thread_id_started_at_idx" ON "agent_runs"("thread_id", "started_at");

-- CreateIndex
CREATE INDEX "agent_runs_trigger_message_id_idx" ON "agent_runs"("trigger_message_id");

-- CreateIndex
CREATE INDEX "agent_run_effects_agent_run_id_idx" ON "agent_run_effects"("agent_run_id");

-- CreateIndex
CREATE INDEX "agent_run_effects_target_entity_type_target_entity_id_idx" ON "agent_run_effects"("target_entity_type", "target_entity_id");

-- CreateIndex
CREATE INDEX "activity_log_workspace_id_created_at_idx" ON "activity_log"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_log_actor_user_id_idx" ON "activity_log"("actor_user_id");

-- CreateIndex
CREATE INDEX "activity_log_event_type_idx" ON "activity_log"("event_type");

-- AddForeignKey
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_documents" ADD CONSTRAINT "strategy_documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_sections" ADD CONSTRAINT "strategy_sections_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "strategy_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_sections" ADD CONSTRAINT "strategy_sections_last_updated_by_user_id_fkey" FOREIGN KEY ("last_updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_versions" ADD CONSTRAINT "section_versions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "strategy_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_versions" ADD CONSTRAINT "section_versions_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_versions" ADD CONSTRAINT "section_versions_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_insights" ADD CONSTRAINT "document_insights_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "strategy_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_insights" ADD CONSTRAINT "document_insights_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_progress" ADD CONSTRAINT "stage_progress_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "strategy_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_trigger_message_id_fkey" FOREIGN KEY ("trigger_message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_effects" ADD CONSTRAINT "agent_run_effects_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
