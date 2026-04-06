const express = require("express");
const { z } = require("zod");

const {
  getCuratedOpportunityPipelineContents,
  runIdeaEvaluationStage,
} = require("../services/idea-evaluation.service");

const ideaEvaluationRunSchema = z
  .object({
    batchSize: z.number().int().min(1).max(25).optional(),
    retryFailed: z.boolean().optional(),
    ideaCandidateId: z.string().uuid().optional(),
  })
  .strict();

function createIdeaEvaluationRouter({ prisma, agentGatewayClient }) {
  const router = express.Router();

  router.get("/opportunities", async (req, res) => {
    const payload = await getCuratedOpportunityPipelineContents(prisma, req.auth.currentUser.id);
    res.json({
      data: payload,
    });
  });

  router.post("/run", async (req, res) => {
    const payload = ideaEvaluationRunSchema.parse(req.body);
    const result = await runIdeaEvaluationStage(
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
  createIdeaEvaluationRouter,
};
