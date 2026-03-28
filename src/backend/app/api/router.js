const express = require("express");

const { createAuthMiddleware, createAuthServiceSignInHandler, requireAdmin } = require("./auth");
const { createAdminRouter } = require("./admin-router");
const { createBusinessIdeasRouter } = require("./business-ideas-router");
const { createCrudRouter } = require("./create-crud-router");
const { prismaEnums, resourceConfigs } = require("./resources");

function createApiRouter({ prisma, agentGatewayClient }) {
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

  router.use("/admin", authenticate, requireAdmin, createAdminRouter({ prisma, agentGatewayClient }));
  router.use("/business-ideas", authenticate, createBusinessIdeasRouter({ prisma, agentGatewayClient }));

  resourceConfigs.forEach((config) => {
    router.use(`/${config.path}`, authenticate, createCrudRouter({ prisma, config }));
  });

  return router;
}

module.exports = {
  createApiRouter,
};
