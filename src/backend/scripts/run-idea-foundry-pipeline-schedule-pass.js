const { prisma } = require("../app/config/prisma");
const { createAgentGatewayClient } = require("../app/services/agent-gateway-client");
const { createIdeaFoundryPipelineRuntime } = require("../app/services/idea-foundry-pipeline.service");
const { createIdeaFoundryPipelineScheduleRuntime } = require("../app/services/idea-foundry-pipeline-schedule.service");

const DEFAULT_WAIT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_POLL_MS = 1_000;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForStartedRunsToFinish(pipelineRuntime, ownerUserIds, timeoutMs) {
  const owners = [...new Set(ownerUserIds.filter((value) => typeof value === "string" && value.trim().length > 0))];
  if (owners.length === 0) {
    return [];
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const statuses = owners.map((ownerUserId) => pipelineRuntime.getStatus(ownerUserId));
    const running = statuses.filter((status) => status.status === "RUNNING");
    if (running.length === 0) {
      return statuses;
    }

    await sleep(DEFAULT_POLL_MS);
  }

  return owners.map((ownerUserId) => pipelineRuntime.getStatus(ownerUserId));
}

async function main() {
  const waitTimeoutMs = Number.parseInt(
    process.env.IDEA_FOUNDRY_PIPELINE_SCHEDULE_WAIT_TIMEOUT_MS ?? `${DEFAULT_WAIT_TIMEOUT_MS}`,
    10,
  );
  const agentGatewayClient = createAgentGatewayClient({
    baseUrl: process.env.AGENT_GATEWAY_BASE_URL || "http://127.0.0.1:8000/api/v1",
    prisma,
  });
  const pipelineRuntime = createIdeaFoundryPipelineRuntime();
  const scheduleRuntime = createIdeaFoundryPipelineScheduleRuntime({
    prisma,
    agentGatewayClient,
    pipelineRuntime,
  });

  const summary = await scheduleRuntime.triggerProcessingPass();
  const runStatuses = await waitForStartedRunsToFinish(
    pipelineRuntime,
    summary.startedOwnerUserIds,
    Number.isInteger(waitTimeoutMs) && waitTimeoutMs > 0 ? waitTimeoutMs : DEFAULT_WAIT_TIMEOUT_MS,
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        ...summary,
        runStatuses,
      },
      null,
      2,
    )}\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(`Idea Foundry pipeline schedule pass failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
