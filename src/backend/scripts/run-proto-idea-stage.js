const { prisma } = require("../app/config/prisma");
const { createAgentGatewayClient } = require("../app/services/agent-gateway-client");
const { runProtoIdeaExtractionPass } = require("../app/services/proto-idea-extraction.service");

async function main() {
  const batchSize = Number.parseInt(process.env.PROTO_IDEA_BATCH_SIZE ?? "1", 10);
  const retryFailed = String(process.env.PROTO_IDEA_RETRY_FAILED ?? "").trim().toLowerCase() === "true";
  const agentGatewayClient = createAgentGatewayClient({
    baseUrl: process.env.AGENT_GATEWAY_BASE_URL || "http://127.0.0.1:8000/api/v1",
    prisma,
  });

  const result = await runProtoIdeaExtractionPass(prisma, agentGatewayClient, {
    batchSize: Number.isInteger(batchSize) ? batchSize : 1,
    retryFailed,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`Proto-idea extraction failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
