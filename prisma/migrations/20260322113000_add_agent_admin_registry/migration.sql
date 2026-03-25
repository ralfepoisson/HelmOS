-- CreateTable
CREATE TABLE "agent_definitions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "allowed_tools" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "default_model" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_configs" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "prompt_template" TEXT NOT NULL,
    "config_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_definitions_key_key" ON "agent_definitions"("key");

-- CreateIndex
CREATE INDEX "agent_definitions_active_idx" ON "agent_definitions"("active");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_configs_key_version_key" ON "prompt_configs"("key", "version");

-- CreateIndex
CREATE INDEX "prompt_configs_key_active_idx" ON "prompt_configs"("key", "active");
