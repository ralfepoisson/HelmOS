const express = require("express");
const { z } = require("zod");

const {
  createAgentAdmin,
  loadAgentAdminRecord,
  loadAgentAdminSnapshot,
  updateAgentAdmin,
} = require("../services/agent-admin.service");
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

const promptConfigSchema = z
  .object({
    key: stringField(100).optional(),
    version: stringField(50),
    promptTemplate: z.string().trim().min(1),
    configJson: jsonField().optional(),
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

function createAdminRouter({ prisma, agentGatewayClient }) {
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

  return router;
}

module.exports = {
  createAdminRouter,
};
