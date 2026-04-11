const express = require("express");
const { z } = require("zod");

const {
  createIdeaFoundryPipelineExecutor,
  createIdeaFoundryPipelineRuntime,
} = require("../services/idea-foundry-pipeline.service");
const {
  getIdeaFoundryPipelineRunDetail,
  listIdeaFoundryPipelineRuns,
} = require("../services/idea-foundry-pipeline-history.service");

const pipelineRunSchema = z
  .object({
    retryFailed: z.boolean().optional(),
    maxStageIterations: z.number().int().min(1).max(250).optional(),
    startStage: z.enum(["sources", "proto-ideas", "idea-candidates", "curated-opportunities"]).optional(),
  })
  .strict();

function createIdeaFoundryPipelineRouter({
  prisma,
  agentGatewayClient,
  ideaFoundryPipelineExecutor,
  ideaFoundryPipelineRuntime,
}) {
  const router = express.Router();
  const runtime =
    ideaFoundryPipelineRuntime ??
    createIdeaFoundryPipelineRuntime({
      executor: ideaFoundryPipelineExecutor ?? createIdeaFoundryPipelineExecutor(),
    });

  router.post("/run", async (req, res) => {
    const payload = pipelineRunSchema.parse(req.body);
    const result = await runtime.start(prisma, agentGatewayClient, {
      ...payload,
      ownerUserId: req.auth.currentUser.id,
    });

    res.status(result.started ? 202 : 200).json({
      data: result,
    });
  });

  router.get("/status", async (req, res) => {
    res.json({
      data: runtime.getStatus(req.auth.currentUser.id),
    });
  });

  router.get("/history", async (req, res) => {
    res.json({
      data: await listIdeaFoundryPipelineRuns(prisma, req.auth.currentUser.id),
    });
  });

  router.get("/history/:runId", async (req, res) => {
    const detail = await getIdeaFoundryPipelineRunDetail(prisma, req.auth.currentUser.id, req.params.runId);
    if (!detail) {
      res.status(404).json({
        error: "Pipeline run not found.",
      });
      return;
    }

    res.json({
      data: detail,
    });
  });

  return router;
}

module.exports = {
  createIdeaFoundryPipelineRouter,
};
