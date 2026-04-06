const express = require("express");
const { z } = require("zod");

const { createSupportAdminService } = require("../services/support-admin.service");
const { createIncidentResponseService } = require("../services/support-investigation.service");
const { createPrismaSupportLogAnalysisService } = require("../services/support-log-analysis.service");

const updateTicketSchema = z
  .object({
    status: z
      .enum([
        "NEW",
        "TRIAGED",
        "INVESTIGATING",
        "WAITING_FOR_HUMAN_REVIEW",
        "ACTION_APPROVED",
        "ACTION_REJECTED",
        "RESOLVED",
        "CLOSED",
      ])
      .optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    severity: z.enum(["MINOR", "MODERATE", "MAJOR", "CRITICAL"]).optional(),
    category: z
      .enum([
        "PRODUCT_QUESTION",
        "BUG_REPORT",
        "INCIDENT",
        "DATA_ISSUE",
        "ACCESS_ISSUE",
        "CONFIGURATION",
        "EXTERNAL_DEPENDENCY",
        "OTHER",
      ])
      .optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    investigationNotes: z.string().trim().max(10000).nullable().optional(),
    proposedFix: z.string().trim().max(10000).nullable().optional(),
    proposedFixConfidence: z.string().trim().max(40).nullable().optional(),
  })
  .strict();

const reviewSchema = z
  .object({
    action: z.enum(["approve", "reject", "edit"]),
    recommendationText: z.string().trim().max(10000).optional(),
    humanNotes: z.string().trim().max(10_000).optional(),
  })
  .strict();

function createAdminSupportRouter({ prisma }) {
  const router = express.Router();
  const logAnalyzer = createPrismaSupportLogAnalysisService({ prisma });
  const supportAdminService = createSupportAdminService({
    prisma,
    incidentResponseService: createIncidentResponseService({
      prisma,
      logAnalyzer,
    }),
  });

  router.get("/conversations", async (req, res) => {
    const data = await supportAdminService.listConversations({
      userId: `${req.query.userId ?? ""}`.trim() || undefined,
      hasTicket: `${req.query.hasTicket ?? ""}`.trim() === "true",
      escalated: `${req.query.escalated ?? ""}`.trim() === "true",
    });

    res.json({ data });
  });

  router.get("/conversations/:id", async (req, res) => {
    const data = await supportAdminService.getConversation(req.params.id);
    if (!data) {
      res.status(404).json({ error: "Support conversation not found." });
      return;
    }
    res.json({ data });
  });

  router.get("/tickets", async (req, res) => {
    const data = await supportAdminService.listTickets({
      status: `${req.query.status ?? ""}`.trim() || undefined,
      priority: `${req.query.priority ?? ""}`.trim() || undefined,
      category: `${req.query.category ?? ""}`.trim() || undefined,
      reporterUserId: `${req.query.reporterUserId ?? ""}`.trim() || undefined,
    });

    res.json({ data });
  });

  router.get("/tickets/:id", async (req, res) => {
    const data = await supportAdminService.getTicket(req.params.id);
    if (!data) {
      res.status(404).json({ error: "Support ticket not found." });
      return;
    }
    res.json({ data });
  });

  router.patch("/tickets/:id", async (req, res) => {
    const payload = updateTicketSchema.parse(req.body);
    const data = await supportAdminService.updateTicket(req.params.id, payload, req.auth.currentUser);
    if (!data) {
      res.status(404).json({ error: "Support ticket not found." });
      return;
    }
    res.json({ data });
  });

  router.post("/tickets/:id/investigate", async (req, res) => {
    const data = await supportAdminService.runInvestigation(req.params.id, req.auth.currentUser);
    res.status(202).json({ data });
  });

  router.post("/tickets/:id/review", async (req, res) => {
    const payload = reviewSchema.parse(req.body);
    const data = await supportAdminService.reviewRecommendation(req.params.id, payload, req.auth.currentUser);
    res.json({ data });
  });

  return router;
}

module.exports = {
  createAdminSupportRouter,
};
