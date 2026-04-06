const express = require("express");

const { createAuthMiddleware, createAuthServiceSignInHandler, requireAdmin } = require("./auth");
const { createAdminRouter } = require("./admin-router");
const { createBusinessIdeasRouter } = require("./business-ideas-router");
const { createProspectingRouter } = require("./prospecting-router");
const { createProtoIdeaRouter } = require("./proto-idea-router");
const { createCrudRouter } = require("./create-crud-router");
const { prismaEnums, resourceConfigs } = require("./resources");
const { createKnowledgeBaseToolRouter } = require("./tool-router");

function createApiRouter({ prisma, agentGatewayClient, knowledgeBaseRuntime, storageService }) {
  const router = express.Router();
  const authenticate = createAuthMiddleware({ prisma });

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
    });
  });

  router.get("/meta", (_req, res) => {
    res.json({
      data: {
        resources: resourceConfigs.map(({ path, filterFields }) => ({
          path,
          filterFields,
        })),
        enums: prismaEnums,
      },
    });
  });

  router.get("/auth/sign-in", createAuthServiceSignInHandler());

  if (knowledgeBaseRuntime) {
    router.use("/tools", createKnowledgeBaseToolRouter({ knowledgeBaseRuntime }));
  }

  router.use(
    "/admin",
    authenticate,
    requireAdmin,
    createAdminRouter({ prisma, agentGatewayClient, knowledgeBaseRuntime, storageService }),
  );
  router.use("/business-ideas", authenticate, createBusinessIdeasRouter({ prisma, agentGatewayClient }));
  router.use("/idea-foundry/prospecting", authenticate, createProspectingRouter({ prisma, agentGatewayClient }));
  router.use("/idea-foundry/proto-idea", authenticate, requireAdmin, createProtoIdeaRouter({ prisma, agentGatewayClient }));

  resourceConfigs.forEach((config) => {
    router.use(`/${config.path}`, authenticate, createCrudRouter({ prisma, config }));
  });

  return router;
}

module.exports = {
  createApiRouter,
};
