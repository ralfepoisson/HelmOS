const express = require("express");
const { z } = require("zod");

const {
  getIdeaCandidatePipelineContents,
  getIdeaRefinementConfiguration,
  runIdeaRefinementStage,
  saveIdeaRefinementConfiguration,
} = require("../services/idea-refinement.service");

const ideaRefinementPolicySchema = z
  .object({
    profileName: z.string().trim().min(1).default("default"),
    refinementDepth: z.enum(["light", "standard", "deep"]),
    creativityLevel: z.enum(["low", "medium", "high"]),
    strictness: z.enum(["conservative", "balanced", "exploratory"]),
    maxConceptualToolsPerRun: z.number().int().min(1).max(6),
    internalQualityThreshold: z.enum(["basic", "standard", "high"]),
  })
  .strict();

const ideaRefinementRunSchema = z
  .object({
    batchSize: z.number().int().min(1).max(10).optional(),
    retryFailed: z.boolean().optional(),
    protoIdeaId: z.string().uuid().optional(),
  })
  .strict();

function createIdeaRefinementRouter({ prisma, agentGatewayClient }) {
  const router = express.Router();

  router.get("/configuration", async (_req, res) => {
    const payload = await getIdeaRefinementConfiguration(prisma);
    res.json({
      data: payload,
    });
  });

  router.post("/configuration", async (req, res) => {
    const payload = ideaRefinementPolicySchema.parse(req.body);
    const saved = await saveIdeaRefinementConfiguration(prisma, payload, req.auth.currentUser);
    res.json({
      data: saved,
    });
  });

  router.get("/candidates", async (req, res) => {
    const payload = await getIdeaCandidatePipelineContents(prisma, req.auth.currentUser.id);
    res.json({
      data: payload,
    });
  });

  router.post("/run", async (req, res) => {
    const payload = ideaRefinementRunSchema.parse(req.body);
    const result = await runIdeaRefinementStage(
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
  createIdeaRefinementRouter,
};
