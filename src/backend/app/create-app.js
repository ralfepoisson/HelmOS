const express = require("express");

const { createApiRouter } = require("./api/router");
const { errorHandler } = require("./api/error-handler");
const { buildRequestLogger } = require("./api/request-log-middleware");
const { createAgentGatewayClient } = require("./services/agent-gateway-client");
const { getKnowledgeBaseConfig } = require("./services/knowledge-base.config");
const { createKnowledgeBaseProcessingRuntime } = require("./services/knowledge-base-processing.service");
const { createFileStorageService } = require("./services/knowledge-base-storage.service");

function getAllowedOrigins() {
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(configuredOrigins);
}

function isAllowedOrigin(origin, allowedOrigins = getAllowedOrigins()) {
  if (typeof origin !== "string" || origin.length === 0) {
    return false;
  }

  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function createApp({ prisma, agentGatewayClient }) {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  const knowledgeBaseConfig = getKnowledgeBaseConfig();
  const storageService = createFileStorageService(knowledgeBaseConfig);
  const knowledgeBaseRuntime = createKnowledgeBaseProcessingRuntime({
    prisma,
    storageService,
    config: knowledgeBaseConfig,
  });
  const gatewayClient =
    agentGatewayClient ??
    createAgentGatewayClient({
      baseUrl: process.env.AGENT_GATEWAY_BASE_URL || "http://127.0.0.1:8000/api/v1",
      prisma,
    });

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (isAllowedOrigin(origin, allowedOrigins)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    if (req.method === "OPTIONS") {
      return res.status(204).send();
    }

    next();
  });
  app.use(express.json({ limit: "30mb" }));
  app.use(buildRequestLogger({ prisma }));

  app.use(
    "/api",
    createApiRouter({
      prisma,
      agentGatewayClient: gatewayClient,
      knowledgeBaseRuntime,
      storageService,
    }),
  );

  app.use((req, res) => {
    res.status(404).json({
      error: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  app.use(errorHandler);

  app.locals.knowledgeBaseRuntime = knowledgeBaseRuntime;
  app.locals.storageService = storageService;

  return app;
}

module.exports = {
  createApp,
  getAllowedOrigins,
  isAllowedOrigin,
};
