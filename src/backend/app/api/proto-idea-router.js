const express = require("express");
const { z } = require("zod");

const {
  getProtoIdeaExtractionConfiguration,
  runProtoIdeaExtractionStage,
  saveProtoIdeaExtractionConfiguration,
} = require("../services/proto-idea-extraction.service");

const protoIdeaPolicySchema = z
  .object({
    profileName: z.string().trim().min(1).default("default"),
    extractionBreadth: z.enum(["conservative", "standard", "expansive"]),
    inferenceTolerance: z.enum(["strict_grounding", "balanced", "exploratory"]),
    noveltyBias: z.enum(["pragmatic", "balanced", "exploratory"]),
    minimumSignalThreshold: z.enum(["low", "medium", "high"]),
    maxProtoIdeasPerSource: z.number().int().min(1).max(12),
  })
  .strict();

const protoIdeaRunSchema = z
  .object({
    batchSize: z.number().int().min(1).max(10).optional(),
    retryFailed: z.boolean().optional(),
  })
  .strict();

function createProtoIdeaRouter({ prisma, agentGatewayClient }) {
  const router = express.Router();

  router.get("/configuration", async (_req, res) => {
    const payload = await getProtoIdeaExtractionConfiguration(prisma);
    res.json({
      data: payload,
    });
  });

  router.post("/configuration", async (req, res) => {
    const payload = protoIdeaPolicySchema.parse(req.body);
    const saved = await saveProtoIdeaExtractionConfiguration(prisma, payload, req.auth.currentUser);
    res.json({
      data: saved,
    });
  });

  router.post("/run", async (req, res) => {
    const payload = protoIdeaRunSchema.parse(req.body);
    const result = await runProtoIdeaExtractionStage(
      prisma,
      agentGatewayClient,
      req.auth.currentUser,
      payload,
    );

    res.json({
      data: result,
    });
  });

  return router;
}

module.exports = {
  createProtoIdeaRouter,
};
