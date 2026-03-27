const express = require("express");
const { z } = require("zod");
const { BusinessType } = require("@prisma/client");

const {
  createBusinessIdea,
  getBusinessIdea,
  getBusinessIdeaForTool,
  listBusinessIdeas,
  sendIdeationMessage,
  sendValuePropositionMessage,
  resendLastIdeationMessage,
  resendLastValuePropositionMessage,
} = require("../services/business-ideas.service");

const createBusinessIdeaSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    businessType: z.nativeEnum(BusinessType),
  })
  .strict();

const ideationMessageSchema = z
  .object({
    messageText: z.string().trim().min(1).max(8000),
  })
  .strict();

function createBusinessIdeasRouter({ prisma, agentGatewayClient }) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const ideas = await listBusinessIdeas(prisma, req.auth.currentUser);

    res.json({
      data: ideas,
    });
  });

  router.post("/", async (req, res) => {
    const payload = createBusinessIdeaSchema.parse(req.body);
    const idea = await createBusinessIdea(prisma, payload, req.auth.currentUser);

    res.status(201).json({
      data: idea,
    });
  });

  router.post("/:workspaceId/ideation/messages", async (req, res) => {
    const payload = ideationMessageSchema.parse(req.body);
    const idea = await sendIdeationMessage(
      prisma,
      agentGatewayClient,
      req.params.workspaceId,
      payload,
      req.auth.currentUser,
    );

    res.json({
      data: idea,
    });
  });

  router.post("/:workspaceId/ideation/messages/retry-last", async (req, res) => {
    const idea = await resendLastIdeationMessage(
      prisma,
      agentGatewayClient,
      req.params.workspaceId,
      req.auth.currentUser,
    );

    res.json({
      data: idea,
    });
  });

  router.get("/:workspaceId/value-proposition", async (req, res) => {
    const idea = await getBusinessIdeaForTool(
      prisma,
      req.params.workspaceId,
      "value-proposition",
      req.auth.currentUser
    );

    res.json({
      data: idea,
    });
  });

  router.post("/:workspaceId/value-proposition/messages", async (req, res) => {
    const payload = ideationMessageSchema.parse(req.body);
    const idea = await sendValuePropositionMessage(
      prisma,
      agentGatewayClient,
      req.params.workspaceId,
      payload,
      req.auth.currentUser,
    );

    res.json({
      data: idea,
    });
  });

  router.post("/:workspaceId/value-proposition/messages/retry-last", async (req, res) => {
    const idea = await resendLastValuePropositionMessage(
      prisma,
      agentGatewayClient,
      req.params.workspaceId,
      req.auth.currentUser,
    );

    res.json({
      data: idea,
    });
  });

  router.get("/:workspaceId", async (req, res) => {
    const idea = await getBusinessIdea(prisma, req.params.workspaceId, req.auth.currentUser);

    res.json({
      data: idea,
    });
  });

  return router;
}

module.exports = {
  createBusinessIdeasRouter,
};
