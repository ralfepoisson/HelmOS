CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeBaseStorageProvider" AS ENUM ('LOCAL', 'S3');

-- CreateEnum
CREATE TYPE "KnowledgeBaseFileProcessingStatus" AS ENUM (
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'DELETED'
);

-- CreateEnum
CREATE TYPE "KnowledgeBaseJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "knowledge_bases" (
  "id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "owner_type" VARCHAR(50),
  "owner_id" VARCHAR(255),
  "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID NOT NULL,
  CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_bases_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "knowledge_bases_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "knowledge_base_files" (
  "id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "original_filename" VARCHAR(255) NOT NULL,
  "stored_object_key" TEXT NOT NULL,
  "storage_provider" "KnowledgeBaseStorageProvider" NOT NULL,
  "mime_type" VARCHAR(200) NOT NULL,
  "file_extension" VARCHAR(20) NOT NULL,
  "file_size_bytes" BIGINT NOT NULL,
  "checksum_sha256" VARCHAR(64),
  "source_type" VARCHAR(100),
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_by" UUID NOT NULL,
  "processing_status" "KnowledgeBaseFileProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
  "error_message" TEXT,
  "media_duration_ms" INTEGER,
  "page_count" INTEGER,
  "image_width" INTEGER,
  "image_height" INTEGER,
  "deleted_at" TIMESTAMP(3),
  "metadata_json" JSONB,
  CONSTRAINT "knowledge_base_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_base_files_knowledge_base_id_fkey"
    FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "knowledge_base_files_submitted_by_fkey"
    FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "knowledge_base_file_tags" (
  "file_id" UUID NOT NULL,
  "tag" VARCHAR(80) NOT NULL,
  CONSTRAINT "knowledge_base_file_tags_pkey" PRIMARY KEY ("file_id", "tag"),
  CONSTRAINT "knowledge_base_file_tags_file_id_fkey"
    FOREIGN KEY ("file_id") REFERENCES "knowledge_base_files"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "knowledge_base_embeddings" (
  "id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "file_id" UUID NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "chunk_text" TEXT NOT NULL,
  "chunk_summary" TEXT,
  "embedding_model" VARCHAR(120) NOT NULL,
  "embedding" vector(2048) NOT NULL,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_base_embeddings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_base_embeddings_knowledge_base_id_fkey"
    FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "knowledge_base_embeddings_file_id_fkey"
    FOREIGN KEY ("file_id") REFERENCES "knowledge_base_files"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "knowledge_base_processing_jobs" (
  "id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "file_id" UUID NOT NULL,
  "status" "KnowledgeBaseJobStatus" NOT NULL DEFAULT 'QUEUED',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "error_message" TEXT,
  "payload_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_base_processing_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_base_processing_jobs_knowledge_base_id_fkey"
    FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "knowledge_base_processing_jobs_file_id_fkey"
    FOREIGN KEY ("file_id") REFERENCES "knowledge_base_files"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "knowledge_base_search_audits" (
  "id" UUID NOT NULL,
  "knowledge_base_id" UUID,
  "actor_user_id" UUID,
  "query_text" TEXT NOT NULL,
  "tags_json" JSONB,
  "media_types_json" JSONB,
  "result_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_base_search_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_base_search_audits_knowledge_base_id_fkey"
    FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "knowledge_base_search_audits_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "knowledge_base_tool_audits" (
  "id" UUID NOT NULL,
  "agent_key" VARCHAR(100) NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "knowledge_base_ids_json" JSONB NOT NULL,
  "file_id" UUID,
  "query_text" TEXT,
  "result_count" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_user_id" UUID,
  CONSTRAINT "knowledge_base_tool_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_base_tool_audits_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_bases_name_key" ON "knowledge_bases"("name");
CREATE INDEX "knowledge_bases_status_updated_at_idx" ON "knowledge_bases"("status", "updated_at");
CREATE INDEX "knowledge_bases_owner_type_owner_id_idx" ON "knowledge_bases"("owner_type", "owner_id");
CREATE INDEX "knowledge_bases_created_by_idx" ON "knowledge_bases"("created_by");
CREATE INDEX "knowledge_bases_updated_by_idx" ON "knowledge_bases"("updated_by");

CREATE INDEX "knowledge_base_files_knowledge_base_id_submitted_at_idx"
  ON "knowledge_base_files"("knowledge_base_id", "submitted_at" DESC);
CREATE INDEX "knowledge_base_files_processing_status_submitted_at_idx"
  ON "knowledge_base_files"("processing_status", "submitted_at" DESC);
CREATE INDEX "knowledge_base_files_submitted_by_idx" ON "knowledge_base_files"("submitted_by");
CREATE INDEX "knowledge_base_files_mime_type_idx" ON "knowledge_base_files"("mime_type");
CREATE INDEX "knowledge_base_files_deleted_at_idx" ON "knowledge_base_files"("deleted_at");
CREATE INDEX "knowledge_base_file_tags_tag_idx" ON "knowledge_base_file_tags"("tag");

CREATE UNIQUE INDEX "knowledge_base_embeddings_file_id_chunk_index_key"
  ON "knowledge_base_embeddings"("file_id", "chunk_index");
CREATE INDEX "knowledge_base_embeddings_knowledge_base_id_created_at_idx"
  ON "knowledge_base_embeddings"("knowledge_base_id", "created_at" DESC);
CREATE INDEX "knowledge_base_embeddings_file_id_created_at_idx"
  ON "knowledge_base_embeddings"("file_id", "created_at" DESC);
CREATE INDEX "knowledge_base_processing_jobs_status_available_at_idx"
  ON "knowledge_base_processing_jobs"("status", "available_at");
CREATE INDEX "knowledge_base_processing_jobs_file_id_created_at_idx"
  ON "knowledge_base_processing_jobs"("file_id", "created_at" DESC);
CREATE INDEX "knowledge_base_processing_jobs_knowledge_base_id_created_at_idx"
  ON "knowledge_base_processing_jobs"("knowledge_base_id", "created_at" DESC);

CREATE INDEX "knowledge_base_search_audits_knowledge_base_id_created_at_idx"
  ON "knowledge_base_search_audits"("knowledge_base_id", "created_at" DESC);
CREATE INDEX "knowledge_base_search_audits_actor_user_id_created_at_idx"
  ON "knowledge_base_search_audits"("actor_user_id", "created_at" DESC);

CREATE INDEX "knowledge_base_tool_audits_agent_key_created_at_idx"
  ON "knowledge_base_tool_audits"("agent_key", "created_at" DESC);
CREATE INDEX "knowledge_base_tool_audits_file_id_created_at_idx"
  ON "knowledge_base_tool_audits"("file_id", "created_at" DESC);
CREATE INDEX "knowledge_base_tool_audits_actor_user_id_created_at_idx"
  ON "knowledge_base_tool_audits"("actor_user_id", "created_at" DESC);
