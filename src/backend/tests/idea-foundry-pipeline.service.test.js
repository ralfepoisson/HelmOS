const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createIdeaFoundryPipelineExecutor,
  shouldContinueStage,
} = require("../app/services/idea-foundry-pipeline.service");

test("shouldContinueStage returns true only when a stage processed work and did not fail", () => {
  assert.equal(shouldContinueStage({ processedCount: 1, failedCount: 0 }), true);
  assert.equal(shouldContinueStage({ processedCount: 0, failedCount: 0 }), false);
  assert.equal(shouldContinueStage({ processedCount: 1, failedCount: 1 }), false);
  assert.equal(shouldContinueStage(null), false);
});

test("idea foundry pipeline executor repeats a stage until it stops making progress, then advances to the next stage", async () => {
  const stageCalls = [];
  const executor = createIdeaFoundryPipelineExecutor({
    stages: [
      {
        key: "proto-idea",
        run: async (_prisma, _agentGatewayClient, options) => {
          stageCalls.push({ stage: "proto-idea", options });
          if (stageCalls.filter((entry) => entry.stage === "proto-idea").length === 1) {
            return { processedCount: 1, completedCount: 1, failedCount: 0 };
          }
          return { processedCount: 0, completedCount: 0, failedCount: 0 };
        },
      },
      {
        key: "idea-refinement",
        run: async (_prisma, _agentGatewayClient, options) => {
          stageCalls.push({ stage: "idea-refinement", options });
          if (stageCalls.filter((entry) => entry.stage === "idea-refinement").length === 1) {
            return { processedCount: 2, completedCount: 2, failedCount: 0 };
          }
          return { processedCount: 0, completedCount: 0, failedCount: 0 };
        },
      },
    ],
  });

  const result = await executor.execute({}, {}, { ownerUserId: "user-1" });

  assert.equal(stageCalls.length, 4);
  assert.deepEqual(
    stageCalls.map((entry) => entry.stage),
    ["proto-idea", "proto-idea", "idea-refinement", "idea-refinement"],
  );
  assert.deepEqual(result.stageResults.map((entry) => entry.key), ["proto-idea", "idea-refinement"]);
  assert.equal(result.stageResults[0].attempts, 2);
  assert.equal(result.stageResults[0].totals.processedCount, 1);
  assert.equal(result.stageResults[1].attempts, 2);
  assert.equal(result.stageResults[1].totals.processedCount, 2);
  assert.equal(result.completedStageCount, 2);
});

test("idea foundry pipeline executor stops after the first failed stage and reports the failure", async () => {
  const executor = createIdeaFoundryPipelineExecutor({
    stages: [
      {
        key: "proto-idea",
        run: async () => ({
          processedCount: 1,
          completedCount: 0,
          failedCount: 1,
        }),
      },
      {
        key: "idea-refinement",
        run: async () => {
          throw new Error("downstream stage should not run");
        },
      },
    ],
  });

  const result = await executor.execute({}, {}, {});

  assert.equal(result.status, "FAILED");
  assert.equal(result.completedStageCount, 0);
  assert.equal(result.failedStageCount, 1);
  assert.equal(result.stageResults.length, 1);
  assert.equal(result.stageResults[0].status, "FAILED");
  assert.equal(result.stageResults[0].totals.failedCount, 1);
});
