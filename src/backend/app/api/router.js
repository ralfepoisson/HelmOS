const express = require("express");

const { createAuthMiddleware, createAuthServiceSignInHandler, requireAdmin } = require("./auth");
const { createAdminRouter } = require("./admin-router");
const { createAdminSupportRouter } = require("./admin-support-router");
const { createBusinessIdeasRouter } = require("./business-ideas-router");
const { createProspectingRouter } = require("./prospecting-router");
const { createProtoIdeaRouter } = require("./proto-idea-router");
const { createIdeaRefinementRouter } = require("./idea-refinement-router");
const { createIdeaFoundryPipelineRouter } = require("./idea-foundry-pipeline-router");
const { createCrudRouter } = require("./create-crud-router");
const { prismaEnums, resourceConfigs } = require("./resources");
const { createKnowledgeBaseToolRouter } = require("./tool-router");
const { createSupportRouter } = require("./support-router");

function createApiRouter({
  prisma,
  agentGatewayClient,
  knowledgeBaseRuntime,
  storageService,
  ideaFoundryPipelineExecutor,
}) {
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
    router.use("/tools", createKnowledgeBaseToolRouter({ knowledgeBaseRuntime, prisma }));
  }

  router.use(
    "/admin",
    authenticate,
    requireAdmin,
    createAdminRouter({ prisma, agentGatewayClient, knowledgeBaseRuntime, storageService }),
  );
  router.use("/admin/support", authenticate, requireAdmin, createAdminSupportRouter({ prisma }));
  router.use("/business-ideas", authenticate, createBusinessIdeasRouter({ prisma, agentGatewayClient }));
  router.use("/support", authenticate, createSupportRouter({ prisma, knowledgeBaseRuntime }));
  router.use("/idea-foundry/prospecting", authenticate, createProspectingRouter({ prisma, agentGatewayClient }));
  router.use("/idea-foundry/proto-idea", authenticate, requireAdmin, createProtoIdeaRouter({ prisma, agentGatewayClient }));
  router.use(
    "/idea-foundry/refinement",
    authenticate,
    requireAdmin,
    createIdeaRefinementRouter({ prisma, agentGatewayClient }),
  );
  router.use(
    "/idea-foundry/pipeline",
    authenticate,
    requireAdmin,
    createIdeaFoundryPipelineRouter({ prisma, agentGatewayClient, ideaFoundryPipelineExecutor }),
  );

  resourceConfigs.forEach((config) => {
    router.use(`/${config.path}`, authenticate, createCrudRouter({ prisma, config }));
  });

  return router;
}

module.exports = {
  createApiRouter,
};
