const express = require("express");

const { createAdminRouter } = require("./admin-router");
const { createBusinessIdeasRouter } = require("./business-ideas-router");
const { createCrudRouter } = require("./create-crud-router");
const { prismaEnums, resourceConfigs } = require("./resources");

function createApiRouter({ prisma, agentGatewayClient }) {
  const router = express.Router();

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

  router.use("/admin", createAdminRouter({ prisma, agentGatewayClient }));
  router.use("/business-ideas", createBusinessIdeasRouter({ prisma }));

  resourceConfigs.forEach((config) => {
    router.use(`/${config.path}`, createCrudRouter({ prisma, config }));
  });

  return router;
}

module.exports = {
  createApiRouter,
};
