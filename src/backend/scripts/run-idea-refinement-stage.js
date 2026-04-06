const { prisma } = require("../app/config/prisma");
const { createAgentGatewayClient } = require("../app/services/agent-gateway-client");
const { runIdeaRefinementPass } = require("../app/services/idea-refinement.service");

async function main() {
  const batchSize = Number.parseInt(process.env.IDEA_REFINEMENT_BATCH_SIZE ?? "1", 10);
  const retryFailed = String(process.env.IDEA_REFINEMENT_RETRY_FAILED ?? "").trim().toLowerCase() === "true";
  const protoIdeaId = typeof process.env.IDEA_REFINEMENT_PROTO_IDEA_ID === "string"
    ? process.env.IDEA_REFINEMENT_PROTO_IDEA_ID.trim()
    : "";
  const agentGatewayClient = createAgentGatewayClient({
    baseUrl: process.env.AGENT_GATEWAY_BASE_URL || "http://127.0.0.1:8000/api/v1",
    prisma,
  });

  const result = await runIdeaRefinementPass(prisma, agentGatewayClient, {
    batchSize: Number.isInteger(batchSize) ? batchSize : 1,
    retryFailed,
    protoIdeaId: protoIdeaId || undefined,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`Idea refinement failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
