const express = require("express");
const { z } = require("zod");

const { createPrismaSupportLogAnalysisService } = require("../services/support-log-analysis.service");

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const searchSchema = z
  .object({
    agentKey: z.string().trim().min(1),
    query: z.string().trim().min(1),
    knowledgeBaseIds: z.array(z.string().uuid()).max(25).optional(),
    tags: z.array(z.string().trim().min(1)).max(25).optional(),
    limit: z.number().int().min(1).max(25).optional(),
    actorUserId: z.string().uuid().optional(),
  })
  .strict();

function createKnowledgeBaseToolRouter({ knowledgeBaseRuntime, prisma = null }) {
  const router = express.Router();
  const apiKey = process.env.KNOWLEDGE_BASE_TOOL_API_KEY?.trim() || null;
  const logAnalysisService = prisma ? createPrismaSupportLogAnalysisService({ prisma }) : null;

  router.use((req, _res, next) => {
    if (!apiKey) {
      next(createHttpError(503, "Knowledge base tool API key is not configured."));
      return;
    }

    const requestKey = `${req.headers["x-helmos-tool-key"] ?? ""}`.trim();
    if (requestKey !== apiKey) {
      next(createHttpError(403, "Knowledge base tool access is denied."));
      return;
    }

    next();
  });

  router.use((_req, _res, next) => {
    try {
      knowledgeBaseRuntime?.assertAvailable?.();
      next();
    } catch (error) {
      next(error);
    }
  });

  router.post("/knowledge-base/search", async (req, res) => {
    const payload = searchSchema.parse(req.body);
    const results = await knowledgeBaseRuntime.toolService.searchKnowledgeBase({
      agentKey: payload.agentKey,
      query: payload.query,
      knowledgeBaseIds: payload.knowledgeBaseIds ?? [],
      tags: payload.tags ?? [],
      limit: payload.limit ?? 10,
      actorUserId: payload.actorUserId ?? null,
    });

    res.json({ data: results });
  });

  router.get("/knowledge-base/files/:id", async (req, res) => {
    const agentKey = `${req.query.agentKey ?? ""}`.trim();
    if (!agentKey) {
      throw createHttpError(400, "agentKey is required.");
    }

    const record = await knowledgeBaseRuntime.toolService.getKnowledgeBaseFileMetadata({
      agentKey,
      fileId: req.params.id,
    });

    if (!record) {
      res.status(404).json({ error: "Knowledge base file not found." });
      return;
    }

    res.json({ data: record });
  });

  router.get("/knowledge-base/files/:id/chunks", async (req, res) => {
    const agentKey = `${req.query.agentKey ?? ""}`.trim();
    if (!agentKey) {
      throw createHttpError(400, "agentKey is required.");
    }

    const limit = Number.parseInt(`${req.query.limit ?? "20"}`, 10);
    const offset = Number.parseInt(`${req.query.offset ?? "0"}`, 10);
    const chunks = await knowledgeBaseRuntime.toolService.getKnowledgeBaseFileChunks({
      agentKey,
      fileId: req.params.id,
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    res.json({ data: chunks });
  });

  router.post("/log-analysis/analyze", async (req, res) => {
    if (!logAnalysisService) {
      throw createHttpError(503, "Log analysis service is unavailable.");
    }

    const payload = z
      .object({
        query: z.string().trim().min(1).optional(),
        severity: z.enum(["error", "warn", "info"]).optional(),
        requestId: z.string().trim().min(1).optional(),
        userId: z.string().trim().min(1).optional(),
        tenantId: z.string().trim().min(1).optional(),
        route: z.string().trim().min(1).optional(),
        timeRange: z.string().trim().min(1).optional(),
        scope: z.string().trim().min(1).optional(),
      })
      .strict()
      .parse(req.body);

    const result = await logAnalysisService.analyze(payload);
    res.json({ data: result });
  });

  return router;
}

module.exports = {
  createKnowledgeBaseToolRouter,
};
