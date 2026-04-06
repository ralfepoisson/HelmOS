const express = require("express");
const { z } = require("zod");

const {
  createIdeaFoundryPipelineExecutor,
} = require("../services/idea-foundry-pipeline.service");

const pipelineRunSchema = z
  .object({
    retryFailed: z.boolean().optional(),
    maxStageIterations: z.number().int().min(1).max(250).optional(),
  })
  .strict();

function createIdeaFoundryPipelineRouter({ prisma, agentGatewayClient, ideaFoundryPipelineExecutor }) {
  const router = express.Router();
  const executor = ideaFoundryPipelineExecutor ?? createIdeaFoundryPipelineExecutor();

  router.post("/run", async (req, res) => {
    const payload = pipelineRunSchema.parse(req.body);
    const result = await executor.execute(prisma, agentGatewayClient, {
      ...payload,
      ownerUserId: req.auth.currentUser.id,
    });

    res.json({
      data: result,
    });
  });

  return router;
}

module.exports = {
  createIdeaFoundryPipelineRouter,
};
