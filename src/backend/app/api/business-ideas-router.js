const express = require("express");
const { z } = require("zod");
const { BusinessType } = require("@prisma/client");

const {
  createBusinessIdea,
  getBusinessIdea,
  listBusinessIdeas,
} = require("../services/business-ideas.service");

const createBusinessIdeaSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    businessType: z.nativeEnum(BusinessType),
  })
  .strict();

function createBusinessIdeasRouter({ prisma }) {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    const ideas = await listBusinessIdeas(prisma);

    res.json({
      data: ideas,
    });
  });

  router.post("/", async (req, res) => {
    const payload = createBusinessIdeaSchema.parse(req.body);
    const idea = await createBusinessIdea(prisma, payload);

    res.status(201).json({
      data: idea,
    });
  });

  router.get("/:workspaceId", async (req, res) => {
    const idea = await getBusinessIdea(prisma, req.params.workspaceId);

    res.json({
      data: idea,
    });
  });

  return router;
}

module.exports = {
  createBusinessIdeasRouter,
};
