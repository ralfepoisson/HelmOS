const express = require("express");
const { z } = require("zod");

const { createSupportService } = require("../services/support.service");
const { createPrismaSupportLogAnalysisService } = require("../services/support-log-analysis.service");

const messageSchema = z
  .object({
    sessionKey: z.string().trim().min(1).max(120).optional(),
    messageText: z.string().trim().min(1).max(4000),
    clientContext: z.unknown().optional(),
  })
  .strict();

function createSupportRouter({ prisma, knowledgeBaseRuntime }) {
  const router = express.Router();
  const logAnalyzer = createPrismaSupportLogAnalysisService({ prisma });
  const supportService = createSupportService({
    prisma,
    knowledgeBaseSearch: async ({ query, knowledgeBaseIds, limit, actorUserId }) =>
      knowledgeBaseRuntime?.searchService?.search
        ? knowledgeBaseRuntime.searchService.search({
            query,
            knowledgeBaseIds,
            limit,
            actorUserId,
          })
        : [],
    logAnalyzer,
  });

  router.get("/conversations/current", async (req, res) => {
    const sessionKey = `${req.query.sessionKey ?? ""}`.trim() || null;
    const data = await supportService.getCurrentConversation({
      actorUser: req.auth.currentUser,
      sessionKey,
    });

    res.json({ data });
  });

  router.post("/conversations/current/messages", async (req, res) => {
    const payload = messageSchema.parse(req.body);
    const data = await supportService.processConversationTurn({
      actorUser: req.auth.currentUser,
      sessionKey: payload.sessionKey ?? null,
      messageText: payload.messageText,
      clientContext: payload.clientContext ?? null,
    });

    res.status(201).json({ data });
  });

  return router;
}

module.exports = {
  createSupportRouter,
};
