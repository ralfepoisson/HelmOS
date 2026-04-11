const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPendingStageStates,
  createIdeaFoundryPipelineExecutor,
  createIdeaFoundryPipelineRuntime,
  deriveStageStatesFromStageResults,
  shouldContinueStage,
} = require("../app/services/idea-foundry-pipeline.service");

test("shouldContinueStage returns true only when a stage processed work and did not fail", () => {
  assert.equal(shouldContinueStage({ processedCount: 1, failedCount: 0 }), true);
  assert.equal(shouldContinueStage({ processedCount: 0, failedCount: 0 }), false);
  assert.equal(shouldContinueStage({ processedCount: 1, failedCount: 1 }), false);
  assert.equal(shouldContinueStage(null), false);
});

test("deriveStageStatesFromStageResults maps completed and halted stages to operator-visible states", () => {
  assert.deepEqual(
    deriveStageStatesFromStageResults([
      { key: "proto-idea", status: "COMPLETED" },
      { key: "idea-refinement", status: "HALTED" },
    ]),
    {
      sources: "completed",
      "proto-ideas": "completed",
      "idea-candidates": "failed",
      "curated-opportunities": "pending",
    },
  );
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

test("idea foundry pipeline executor can start from a requested stage and skip earlier stages", async () => {
  const stageCalls = [];
  const executor = createIdeaFoundryPipelineExecutor({
    stages: [
      {
        key: "sources",
        run: async () => {
          stageCalls.push("sources");
          return { processedCount: 1, completedCount: 1, failedCount: 0 };
        },
      },
      {
        key: "proto-idea",
        run: async () => {
          stageCalls.push("proto-idea");
          return { processedCount: 0, completedCount: 0, failedCount: 0 };
        },
      },
      {
        key: "idea-refinement",
        run: async () => {
          stageCalls.push("idea-refinement");
          return { processedCount: 0, completedCount: 0, failedCount: 0 };
        },
      },
    ],
  });

  const result = await executor.execute({}, {}, { startStage: "idea-candidates" });

  assert.deepEqual(stageCalls, ["idea-refinement"]);
  assert.deepEqual(result.stageResults.map((entry) => entry.key), ["idea-refinement"]);
});

test("idea foundry pipeline executor runs the sources stage only once even when it produces results", async () => {
  const stageCalls = [];
  const executor = createIdeaFoundryPipelineExecutor({
    stages: [
      {
        key: "sources",
        repeatWhileProgress: false,
        run: async () => {
          stageCalls.push("sources");
          return {
            runtime: {
              resultRecordCount: 30,
            },
          };
        },
        mapResult: (result) => ({
          processedCount: Number(result?.runtime?.resultRecordCount ?? 0) > 0 ? 1 : 0,
          completedCount: 1,
          failedCount: 0,
          resultRecordCount: Number(result?.runtime?.resultRecordCount ?? 0),
        }),
      },
      {
        key: "proto-idea",
        run: async () => {
          stageCalls.push("proto-idea");
          return { processedCount: 0, completedCount: 0, failedCount: 0 };
        },
      },
    ],
  });

  const result = await executor.execute({}, {}, {});

  assert.deepEqual(stageCalls, ["sources", "proto-idea"]);
  assert.equal(result.stageResults[0].attempts, 1);
  assert.equal(result.stageResults[0].producedCount, 30);
});

test("idea foundry pipeline runtime starts an asynchronous run and updates status when it completes", async () => {
  let releaseExecution;
  const executor = {
    execute: async (_prisma, _agentGatewayClient, options) => {
      options.onStageStateChange?.({ stageKey: "sources", status: "running" });
      options.onStageStateChange?.({ stageKey: "sources", status: "completed" });
      options.onStageStateChange?.({ stageKey: "proto-ideas", status: "running" });
      await new Promise((resolve) => {
        releaseExecution = resolve;
      });
      options.onStageStateChange?.({ stageKey: "proto-ideas", status: "completed" });
      options.onStageStateChange?.({ stageKey: "idea-candidates", status: "completed" });
      options.onStageStateChange?.({ stageKey: "curated-opportunities", status: "completed" });
      return {
        status: "COMPLETED",
        completedStageCount: 3,
        failedStageCount: 0,
        stageResults: [
          { key: "proto-idea", status: "COMPLETED" },
          { key: "idea-refinement", status: "COMPLETED" },
          { key: "curated-opportunities", status: "COMPLETED" },
        ],
      };
    },
  };
  const runtime = createIdeaFoundryPipelineRuntime({
    executor,
    now: (() => {
      const timestamps = [
        "2026-04-06T13:00:00.000Z",
        "2026-04-06T13:00:10.000Z",
      ];
      return () => timestamps.shift() ?? "2026-04-06T13:00:10.000Z";
    })(),
    logEntryWriter: async () => {},
    createRunId: () => "run-1",
  });

  const startResult = await runtime.start({}, {}, { ownerUserId: "user-1" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(startResult.started, true);
  assert.equal(startResult.run.status, "RUNNING");
  assert.equal(startResult.run.runId, "run-1");
  assert.deepEqual(runtime.getStatus("user-1").stageStates, {
    ...buildPendingStageStates(),
    sources: "completed",
    "proto-ideas": "running",
  });

  releaseExecution();
  await new Promise((resolve) => setImmediate(resolve));

  const finalStatus = runtime.getStatus("user-1");
  assert.equal(finalStatus.status, "COMPLETED");
  assert.equal(finalStatus.startedAt, "2026-04-06T13:00:00.000Z");
  assert.equal(finalStatus.endedAt, "2026-04-06T13:00:10.000Z");
  assert.equal(finalStatus.stageStates.sources, "completed");
  assert.equal(finalStatus.stageStates["curated-opportunities"], "completed");
});

test("idea foundry pipeline runtime reports the current run when a second start is requested mid-flight", async () => {
  let releaseExecution;
  const runtime = createIdeaFoundryPipelineRuntime({
    executor: {
      execute: async () =>
        new Promise((resolve) => {
          releaseExecution = () =>
            resolve({
              status: "COMPLETED",
              completedStageCount: 0,
              failedStageCount: 0,
              stageResults: [],
            });
        }),
    },
    logEntryWriter: async () => {},
    createRunId: () => "run-2",
  });

  const firstStart = await runtime.start({}, {}, { ownerUserId: "user-1" });
  const secondStart = await runtime.start({}, {}, { ownerUserId: "user-1" });

  assert.equal(firstStart.started, true);
  assert.equal(secondStart.started, false);
  assert.equal(secondStart.run.status, "RUNNING");
  assert.equal(secondStart.run.runId, "run-2");

  releaseExecution();
  await new Promise((resolve) => setImmediate(resolve));
});
