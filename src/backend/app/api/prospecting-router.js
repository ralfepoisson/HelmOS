const express = require("express");
const { z } = require("zod");

const {
  executeProspectingConfiguration,
  getProspectingConfiguration,
  runProspectingConfigurationReview,
} = require("../services/prospecting-configuration.service");

const runProspectingReviewSchema = z
  .object({
    snapshot: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

function createProspectingRouter({ prisma, agentGatewayClient }) {
  const router = express.Router();

  router.get("/configuration", async (req, res) => {
    const payload = await getProspectingConfiguration(prisma, req.auth.currentUser);
    res.json({
      data: payload,
    });
  });

  router.post("/configuration/run", async (req, res) => {
    const payload = runProspectingReviewSchema.parse(req.body);
    const updated = await runProspectingConfigurationReview(
      prisma,
      agentGatewayClient,
      payload,
      req.auth.currentUser,
    );

    res.json({
      data: updated,
    });
  });

  router.post("/configuration/execute", async (req, res) => {
    const executed = await executeProspectingConfiguration(
      prisma,
      agentGatewayClient,
      req.auth.currentUser,
    );

    res.json({
      data: executed,
    });
  });

  return router;
}

module.exports = {
  createProspectingRouter,
};
