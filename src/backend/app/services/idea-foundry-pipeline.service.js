const { runIdeaRefinementPass } = require("./idea-refinement.service");
const { createLogEntry } = require("./log-entry.service");
const { runProtoIdeaExtractionPass } = require("./proto-idea-extraction.service");

const DEFAULT_MAX_STAGE_ITERATIONS = 100;

function shouldContinueStage(result) {
  if (!result || typeof result !== "object") {
    return false;
  }

  const processedCount = Number(result.processedCount ?? 0);
  const failedCount = Number(result.failedCount ?? 0);
  return processedCount > 0 && failedCount === 0;
}

function accumulateTotals(accumulator, result) {
  return {
    processedCount: Number(accumulator.processedCount ?? 0) + Number(result?.processedCount ?? 0),
    completedCount: Number(accumulator.completedCount ?? 0) + Number(result?.completedCount ?? 0),
    failedCount: Number(accumulator.failedCount ?? 0) + Number(result?.failedCount ?? 0),
    skippedCount: Number(accumulator.skippedCount ?? 0) + Number(result?.skippedCount ?? 0),
    createdCount: Number(accumulator.createdCount ?? 0) + Number(result?.createdCount ?? 0),
    updatedCount: Number(accumulator.updatedCount ?? 0) + Number(result?.updatedCount ?? 0),
    candidateCount: Number(accumulator.candidateCount ?? 0) + Number(result?.candidateCount ?? 0),
  };
}

function buildDefaultStages() {
  return [
    {
      key: "proto-idea",
      run: runProtoIdeaExtractionPass,
    },
    {
      key: "idea-refinement",
      run: runIdeaRefinementPass,
    },
  ];
}

function createIdeaFoundryPipelineExecutor({
  stages = buildDefaultStages(),
  maxStageIterations = DEFAULT_MAX_STAGE_ITERATIONS,
  logEntryWriter = createLogEntry,
} = {}) {
  async function execute(prisma, agentGatewayClient, options = {}) {
    const stageResults = [];
    const ownerUserId =
      typeof options.ownerUserId === "string" && options.ownerUserId.trim().length > 0
        ? options.ownerUserId.trim()
        : null;

    for (const stage of stages) {
      const attempts = [];
      let totals = accumulateTotals({}, null);
      let status = "COMPLETED";
      let stopReason = "no_work_remaining";

      for (let iteration = 1; iteration <= maxStageIterations; iteration += 1) {
        const result = await stage.run(prisma, agentGatewayClient, options);
        attempts.push(result);
        totals = accumulateTotals(totals, result);

        if (Number(result?.failedCount ?? 0) > 0) {
          status = "FAILED";
          stopReason = "stage_failed";
          break;
        }

        if (!shouldContinueStage(result)) {
          stopReason = "no_work_remaining";
          break;
        }

        if (iteration === maxStageIterations) {
          status = "HALTED";
          stopReason = "iteration_limit_reached";
        }
      }

      stageResults.push({
        key: stage.key,
        status,
        stopReason,
        attempts: attempts.length,
        lastResult: attempts.at(-1) ?? null,
        totals,
      });

      await logEntryWriter(prisma, {
        level: status === "FAILED" ? "error" : "info",
        scope: "idea-foundry",
        event: `idea_foundry_pipeline_stage_${String(stage.key).replace(/[^a-z0-9]+/gi, "_")}`,
        message: "Executed an Idea Foundry pipeline stage.",
        context: {
          ownerUserId,
          stageKey: stage.key,
          status,
          stopReason,
          attempts: attempts.length,
          totals,
        },
      });

      if (status !== "COMPLETED") {
        return {
          status: status === "FAILED" ? "FAILED" : "HALTED",
          completedStageCount: stageResults.filter((entry) => entry.status === "COMPLETED").length,
          failedStageCount: stageResults.filter((entry) => entry.status === "FAILED").length,
          stageResults,
        };
      }
    }

    return {
      status: "COMPLETED",
      completedStageCount: stageResults.filter((entry) => entry.status === "COMPLETED").length,
      failedStageCount: 0,
      stageResults,
    };
  }

  return {
    execute,
  };
}

module.exports = {
  createIdeaFoundryPipelineExecutor,
  shouldContinueStage,
};
