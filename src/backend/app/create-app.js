const express = require("express");

const { createApiRouter } = require("./api/router");
const { errorHandler } = require("./api/error-handler");
const { createAgentGatewayClient } = require("./services/agent-gateway-client");

function isAllowedOrigin(origin) {
  if (typeof origin !== "string" || origin.length === 0) {
    return false;
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
  const gatewayClient =
    agentGatewayClient ??
    createAgentGatewayClient({ baseUrl: process.env.AGENT_GATEWAY_BASE_URL });

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    if (req.method === "OPTIONS") {
      return res.status(204).send();
    }

    next();
  });
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", createApiRouter({ prisma, agentGatewayClient: gatewayClient }));

  app.use((req, res) => {
    res.status(404).json({
      error: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
