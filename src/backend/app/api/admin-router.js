const express = require("express");
const { z } = require("zod");

const {
  createAgentAdmin,
  loadAgentAdminRecord,
  loadAgentAdminSnapshot,
  updateAgentAdmin,
} = require("../services/agent-admin.service");
const {
  createKnowledgeBase,
  deleteKnowledgeBase,
  deleteKnowledgeBaseFile,
  getKnowledgeBaseDetail,
  getKnowledgeBaseFileDetail,
  listKnowledgeBases,
  updateKnowledgeBase,
  uploadKnowledgeBaseFile,
} = require("../services/knowledge-base-processing.service");
const { searchLogEntries, SUPPORTED_LEVELS } = require("../services/log-entry.service");

const stringField = (max) => {
  const base = z.string().trim().min(1);
  return typeof max === "number" ? base.max(max) : base;
};

const nullableStringField = (max) => z.union([stringField(max), z.null()]);
const jsonField = () => z.unknown();
const supportedModelAliases = ["helmos-default", "helmos-research", "helmos-supervisor"];
const supportedToolNames = ["retrieval", "web_search", "object_storage", "communications"];
const modelField = () => z.enum(supportedModelAliases);
const nullableModelField = () => z.union([modelField(), z.null()]);
const toolArrayField = () => z.array(z.enum(supportedToolNames)).max(25);
const uuidField = () => z.string().uuid();
const stringArrayField = (max) => z.array(stringField(max)).max(25);

const promptConfigSchema = z
  .object({
    key: stringField(100).optional(),
    version: stringField(50),
    promptTemplate: z.string().trim().min(1),
    configJson: jsonField().optional(),
  })
  .strict();

const knowledgeBaseSchema = z
  .object({
    name: stringField(200),
    description: z.union([z.string().trim(), z.null()]).optional(),
    ownerType: nullableStringField(50).optional(),
    ownerId: nullableStringField(255).optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict();

const updateKnowledgeBaseSchema = knowledgeBaseSchema.partial().strict();

const knowledgeBaseUploadSchema = z
  .object({
    knowledgeBaseId: uuidField(),
    originalFilename: stringField(255),
    mimeType: stringField(200),
    contentBase64: z.string().trim().min(1),
    sourceType: nullableStringField(100).optional(),
    tags: stringArrayField(80).optional(),
  })
  .strict();

const knowledgeBaseSearchSchema = z
  .object({
    query: z.string().trim().min(1),
    knowledgeBaseIds: z.array(uuidField()).max(25).optional(),
    tags: stringArrayField(80).optional(),
    mediaTypes: z.array(z.enum(["text", "document", "image", "audio", "video"])).max(10).optional(),
    limit: z.number().int().min(1).max(25).optional(),
  })
  .strict();

const updateAgentAdminSchema = z
  .object({
    name: stringField(255).optional(),
    version: stringField(50).optional(),
    description: nullableStringField().optional(),
    allowedTools: toolArrayField().optional(),
    defaultModel: nullableModelField().optional(),
    active: z.boolean().optional(),
    promptConfig: promptConfigSchema.optional(),
  })
  .strict();

const createAgentAdminSchema = z
  .object({
    key: stringField(100).optional(),
    name: stringField(255),
    version: stringField(50),
    description: nullableStringField().optional(),
    allowedTools: toolArrayField().optional(),
    defaultModel: nullableModelField().optional(),
    active: z.boolean().optional(),
    promptConfig: promptConfigSchema,
  })
  .strict();

function ensureUpdatePayload(data) {
  if (Object.keys(data).length === 0) {
    const error = new Error("Update payload must contain at least one field");
    error.statusCode = 400;
    throw error;
  }
}

function ensureKnowledgeBaseAvailable(knowledgeBaseRuntime) {
  knowledgeBaseRuntime?.assertAvailable?.();
}

function createAdminRouter({ prisma, agentGatewayClient, knowledgeBaseRuntime, storageService }) {
  const router = express.Router();

  router.get("/logs", async (req, res) => {
    const snapshot = await searchLogEntries(prisma, {
      query: req.query.q,
      timeRange: req.query.timeRange,
      levels: req.query.levels,
      scope: req.query.scope,
      limit: 100,
    });

    res.json({
      data: {
        ...snapshot,
        availableLevels: SUPPORTED_LEVELS,
      },
    });
  });

  router.get("/agents", async (_req, res) => {
    const snapshot = await loadAgentAdminSnapshot(prisma, agentGatewayClient);

    res.json({
      data: snapshot,
    });
  });

  router.get("/agents/:id", async (req, res) => {
    const agent = await loadAgentAdminRecord(prisma, req.params.id, agentGatewayClient);

    if (!agent) {
      res.status(404).json({
        error: "Agent not found",
      });
      return;
    }

    res.json({
      data: agent,
    });
  });

  router.post("/agents", async (req, res) => {
    const payload = createAgentAdminSchema.parse(req.body);
    const agent = await createAgentAdmin(prisma, payload, agentGatewayClient);

    res.status(201).json({
      data: agent,
    });
  });

  router.patch("/agents/:id", async (req, res) => {
    const payload = updateAgentAdminSchema.parse(req.body);
    ensureUpdatePayload(payload);

    const agent = await updateAgentAdmin(prisma, req.params.id, payload, agentGatewayClient);

    res.json({
      data: agent,
    });
  });

  router.get("/knowledge-bases", async (_req, res) => {
    ensureKnowledgeBaseAvailable(knowledgeBaseRuntime);
    const records = await listKnowledgeBases(prisma);

    res.json({
      data: records,
    });
  });

  router.post("/knowledge-bases", async (req, res) => {
    ensureKnowledgeBaseAvailable(knowledgeBaseRuntime);
    const payload = knowledgeBaseSchema.parse(req.body);
    const record = await createKnowledgeBase(prisma, payload, req.auth.currentUser);

    res.status(201).json({
      data: record,
    });
  });

  router.get("/knowledge-bases/:id", async (req, res) => {
    ensureKnowledgeBaseAvailable(knowledgeBaseRuntime);
    const record = await getKnowledgeBaseDetail(prisma, req.params.id);

    if (!record) {
      res.status(404).json({
        error: "Knowledge base not found",
      });
      return;
    }

    res.json({
      data: record,
    });
  });

  router.put("/knowledge-bases/:id", async (req, res) => {
    ensureKnowledgeBaseAvailable(knowledgeBaseRuntime);
    const payload = updateKnowledgeBaseSchema.parse(req.body);
    ensureUpdatePayload(payload);
    const record = await updateKnowledgeBase(prisma, req.params.id, payload, req.auth.currentUser);

    res.json({
      data: record,
    });
  });

  router.delete("/knowledge-bases/:id", async (req, res) => {
    ensureKnowledgeBaseAvailable(knowledgeBaseRuntime);
    await deleteKnowledgeBase(prisma, storageService, req.params.id, req.auth.currentUser);
    res.status(204).send();
  });

  router.post("/knowledge-base-files/upload", async (req, res) => {
    ensureKnowledgeBaseAvailable(knowledgeBaseRuntime);
    const payload = knowledgeBaseUploadSchema.parse(req.body);
    const record = await uploadKnowledgeBaseFile({
      prisma,
      storageService,
      knowledgeBaseId: payload.knowledgeBaseId,
      payload,
      actorUser: req.auth.currentUser,
    });

    if (knowledgeBaseRuntime) {
      knowledgeBaseRuntime.triggerProcessingPass().catch(() => {});
    }

    res.status(201).json({
      data: record,
    });
  });

  router.get("/knowledge-base-files/:id", async (req, res) => {
    ensureKnowledgeBaseAvailable(knowledgeBaseRuntime);
    const record = await getKnowledgeBaseFileDetail(prisma, req.params.id);

    if (!record) {
      res.status(404).json({
        error: "Knowledge base file not found",
      });
      return;
    }

    res.json({
      data: record,
    });
  });

  router.delete("/knowledge-base-files/:id", async (req, res) => {
    ensureKnowledgeBaseAvailable(knowledgeBaseRuntime);
    await deleteKnowledgeBaseFile(prisma, storageService, req.params.id, req.auth.currentUser);
    res.status(204).send();
  });

  router.post("/knowledge-base-search", async (req, res) => {
    ensureKnowledgeBaseAvailable(knowledgeBaseRuntime);
    const payload = knowledgeBaseSearchSchema.parse(req.body);
    const results = await knowledgeBaseRuntime.searchService.search({
      query: payload.query,
      knowledgeBaseIds: payload.knowledgeBaseIds ?? [],
      tags: payload.tags ?? [],
      mediaTypes: payload.mediaTypes ?? [],
      limit: payload.limit ?? 10,
      actorUserId: req.auth.currentUser.id,
    });

    res.json({
      data: results,
    });
  });

  return router;
}

module.exports = {
  createAdminRouter,
};
