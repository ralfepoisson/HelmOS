const { prisma } = require("../app/config/prisma");
const { createAgentGatewayClient } = require("../app/services/agent-gateway-client");
const { runIdeaEvaluationPass } = require("../app/services/idea-evaluation.service");

async function main() {
  const batchSize = Number.parseInt(process.env.IDEA_EVALUATION_BATCH_SIZE ?? "1", 10);
  const retryFailed = String(process.env.IDEA_EVALUATION_RETRY_FAILED ?? "").trim().toLowerCase() === "true";
  const ideaCandidateId = typeof process.env.IDEA_EVALUATION_CANDIDATE_ID === "string"
    ? process.env.IDEA_EVALUATION_CANDIDATE_ID.trim()
    : "";
  const ownerUserId = typeof process.env.IDEA_EVALUATION_OWNER_USER_ID === "string"
    ? process.env.IDEA_EVALUATION_OWNER_USER_ID.trim()
    : "";
  const agentGatewayClient = createAgentGatewayClient({
    baseUrl: process.env.AGENT_GATEWAY_BASE_URL || "http://127.0.0.1:8000/api/v1",
    prisma,
  });

  const result = await runIdeaEvaluationPass(prisma, agentGatewayClient, {
    batchSize: Number.isInteger(batchSize) ? batchSize : 1,
    retryFailed,
    ideaCandidateId: ideaCandidateId || undefined,
    ownerUserId: ownerUserId || undefined,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`Idea evaluation failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
