const { prisma } = require("../app/config/prisma");
const { createAgentGatewayClient } = require("../app/services/agent-gateway-client");
const { createIdeaFoundryPipelineExecutor } = require("../app/services/idea-foundry-pipeline.service");

async function main() {
  const retryFailed = String(process.env.IDEA_FOUNDRY_PIPELINE_RETRY_FAILED ?? "").trim().toLowerCase() === "true";
  const maxStageIterations = Number.parseInt(process.env.IDEA_FOUNDRY_PIPELINE_MAX_STAGE_ITERATIONS ?? "100", 10);
  const ownerUserId = typeof process.env.IDEA_FOUNDRY_PIPELINE_OWNER_USER_ID === "string"
    ? process.env.IDEA_FOUNDRY_PIPELINE_OWNER_USER_ID.trim()
    : "";
  const agentGatewayClient = createAgentGatewayClient({
    baseUrl: process.env.AGENT_GATEWAY_BASE_URL || "http://127.0.0.1:8000/api/v1",
    prisma,
  });
  const executor = createIdeaFoundryPipelineExecutor({
    maxStageIterations: Number.isInteger(maxStageIterations) ? maxStageIterations : 100,
  });

  const result = await executor.execute(prisma, agentGatewayClient, {
    retryFailed,
    ownerUserId: ownerUserId || null,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`Idea Foundry pipeline failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
