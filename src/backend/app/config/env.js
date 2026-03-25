const DEFAULT_PORT = 3001;
const DEFAULT_HOST = "0.0.0.0";

function parsePort(value) {
  const parsed = Number.parseInt(value ?? `${DEFAULT_PORT}`, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_PORT;
  }

  return parsed;
}

const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? DEFAULT_HOST,
  port: parsePort(process.env.PORT),
  agentGatewayBaseUrl: process.env.AGENT_GATEWAY_BASE_URL?.trim() || null,
};

module.exports = {
  env,
};
