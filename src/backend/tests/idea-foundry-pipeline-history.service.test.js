const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getIdeaFoundryPipelineRunDetail,
  listIdeaFoundryPipelineRuns,
} = require("../app/services/idea-foundry-pipeline-history.service");

function createLogEntry(overrides = {}) {
  return {
    id: overrides.id ?? "log-1",
    level: overrides.level ?? "info",
    scope: "idea-foundry",
    event: overrides.event ?? "idea_foundry_pipeline_run_started",
    message: overrides.message ?? "message",
    context: overrides.context ?? {},
    createdAt: overrides.createdAt ?? new Date("2026-04-11T08:00:00.000Z"),
  };
}

test("listIdeaFoundryPipelineRuns groups pipeline logs into most-recent-first run summaries", async () => {
  const prisma = {
    logEntry: {
      findMany: async () => [
        createLogEntry({
          id: "run-1-start",
          event: "idea_foundry_pipeline_run_started",
          createdAt: new Date("2026-04-10T10:00:00.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-1",
            requestedStartStage: "sources",
          },
        }),
        createLogEntry({
          id: "run-1-stage-1",
          event: "idea_foundry_pipeline_stage_proto_idea",
          createdAt: new Date("2026-04-10T10:00:10.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-1",
            stageKey: "proto-idea",
            normalizedStageKey: "proto-ideas",
            status: "COMPLETED",
            processedCount: 2,
            producedCount: 2,
          },
        }),
        createLogEntry({
          id: "run-1-finish",
          event: "idea_foundry_pipeline_run_completed",
          createdAt: new Date("2026-04-10T10:00:30.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-1",
            status: "COMPLETED",
            completedStageCount: 4,
            failedStageCount: 0,
            stageStates: {
              sources: "completed",
              "proto-ideas": "completed",
              "idea-candidates": "completed",
              "curated-opportunities": "completed",
            },
          },
        }),
        createLogEntry({
          id: "run-2-start",
          event: "idea_foundry_pipeline_run_started",
          createdAt: new Date("2026-04-11T09:00:00.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-2",
            requestedStartStage: "idea-candidates",
          },
        }),
        createLogEntry({
          id: "run-2-finish",
          event: "idea_foundry_pipeline_run_failed",
          level: "error",
          createdAt: new Date("2026-04-11T09:00:18.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-2",
            status: "FAILED",
            completedStageCount: 1,
            failedStageCount: 1,
            errorMessage: "Idea Evaluation failed.",
            stageStates: {
              sources: "completed",
              "proto-ideas": "completed",
              "idea-candidates": "completed",
              "curated-opportunities": "failed",
            },
          },
        }),
      ],
    },
  };

  const result = await listIdeaFoundryPipelineRuns(prisma, "user-1");

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((entry) => ({
      runId: entry.runId,
      status: entry.status,
      requestedStartStage: entry.requestedStartStage,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
    })),
    [
      {
        runId: "run-2",
        status: "FAILED",
        requestedStartStage: "idea-candidates",
        startedAt: "2026-04-11T09:00:00.000Z",
        endedAt: "2026-04-11T09:00:18.000Z",
      },
      {
        runId: "run-1",
        status: "COMPLETED",
        requestedStartStage: "sources",
        startedAt: "2026-04-10T10:00:00.000Z",
        endedAt: "2026-04-10T10:00:30.000Z",
      },
    ],
  );
});

test("getIdeaFoundryPipelineRunDetail returns stage summaries and structured item-level changes for a run", async () => {
  const prisma = {
    logEntry: {
      findMany: async () => [
        createLogEntry({
          id: "run-start",
          event: "idea_foundry_pipeline_run_started",
          createdAt: new Date("2026-04-11T09:00:00.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-77",
            requestedStartStage: "sources",
          },
        }),
        createLogEntry({
          id: "stage-1",
          event: "idea_foundry_pipeline_stage_sources",
          createdAt: new Date("2026-04-11T09:00:04.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-77",
            stageKey: "sources",
            normalizedStageKey: "sources",
            status: "COMPLETED",
            attempts: 1,
            processedCount: 1,
            producedCount: 2,
            totals: {
              processedCount: 1,
              completedCount: 1,
              failedCount: 0,
              resultRecordCount: 2,
            },
            stageTimeline: {
              startedAt: "2026-04-11T09:00:00.500Z",
              endedAt: "2026-04-11T09:00:04.000Z",
            },
            history: [
              {
                kind: "created",
                entityType: "source",
                entityId: "result-1",
                title: "NHS clinic overtime pain",
                summary: "Captured a new source result from the prospecting execution.",
              },
              {
                kind: "created",
                entityType: "source",
                entityId: "result-2",
                title: "Manual roster swaps create chaos",
                summary: "Captured a new source result from the prospecting execution.",
              },
            ],
          },
        }),
        createLogEntry({
          id: "stage-2",
          event: "idea_foundry_pipeline_stage_proto_idea",
          createdAt: new Date("2026-04-11T09:00:15.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-77",
            stageKey: "proto-idea",
            normalizedStageKey: "proto-ideas",
            status: "COMPLETED",
            attempts: 2,
            processedCount: 2,
            producedCount: 1,
            totals: {
              processedCount: 2,
              completedCount: 1,
              failedCount: 0,
              createdCount: 1,
            },
            stageTimeline: {
              startedAt: "2026-04-11T09:00:04.100Z",
              endedAt: "2026-04-11T09:00:15.000Z",
            },
            history: [
              {
                kind: "created",
                entityType: "proto-idea",
                entityId: "proto-1",
                title: "Emergency shift scheduling assistant",
                summary: "Created a new proto-idea from the strongest source signal.",
              },
              {
                kind: "state_changed",
                entityType: "proto-idea-source",
                entityId: "source-1",
                title: "NHS clinic overtime pain",
                summary: "Processing status changed from PENDING to COMPLETED.",
                fromState: "PENDING",
                toState: "COMPLETED",
              },
            ],
          },
        }),
        createLogEntry({
          id: "run-finish",
          event: "idea_foundry_pipeline_run_completed",
          createdAt: new Date("2026-04-11T09:00:30.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-77",
            status: "COMPLETED",
            completedStageCount: 4,
            failedStageCount: 0,
            stageStates: {
              sources: "completed",
              "proto-ideas": "completed",
              "idea-candidates": "completed",
              "curated-opportunities": "completed",
            },
          },
        }),
      ],
    },
  };

  const result = await getIdeaFoundryPipelineRunDetail(prisma, "user-1", "run-77");

  assert.equal(result.runId, "run-77");
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.stages.length, 2);
  assert.deepEqual(
    result.stages.map((stage) => ({
      stageKey: stage.stageKey,
      status: stage.status,
      processedCount: stage.processedCount,
      producedCount: stage.producedCount,
      historyCount: stage.history.length,
    })),
    [
      {
        stageKey: "sources",
        status: "COMPLETED",
        processedCount: 1,
        producedCount: 2,
        historyCount: 2,
      },
      {
        stageKey: "proto-ideas",
        status: "COMPLETED",
        processedCount: 2,
        producedCount: 1,
        historyCount: 2,
      },
    ],
  );
  assert.equal(result.stages[1].history[1].fromState, "PENDING");
  assert.equal(result.stages[1].history[1].toState, "COMPLETED");
});

test("getIdeaFoundryPipelineRunDetail derives producedCount from created history when totals report zero", async () => {
  const prisma = {
    logEntry: {
      findMany: async () => [
        createLogEntry({
          id: "run-start",
          event: "idea_foundry_pipeline_run_started",
          createdAt: new Date("2026-04-11T11:41:00.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-88",
            requestedStartStage: "sources",
          },
        }),
        createLogEntry({
          id: "stage-1",
          event: "idea_foundry_pipeline_stage_proto_idea",
          createdAt: new Date("2026-04-11T11:44:00.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-88",
            stageKey: "proto-idea",
            normalizedStageKey: "proto-ideas",
            status: "COMPLETED",
            attempts: 9,
            processedCount: 8,
            producedCount: 0,
            totals: {
              processedCount: 8,
              completedCount: 8,
              failedCount: 0,
              createdCount: 0,
            },
            history: [
              {
                kind: "created",
                entityType: "proto-idea",
                entityId: "proto-1",
                title: "First proto idea",
                summary: "Created a new proto-idea from the strongest source signal.",
              },
              {
                kind: "created",
                entityType: "proto-idea",
                entityId: "proto-2",
                title: "Second proto idea",
                summary: "Created a new proto-idea from the strongest source signal.",
              },
            ],
          },
        }),
        createLogEntry({
          id: "run-finish",
          event: "idea_foundry_pipeline_run_completed",
          createdAt: new Date("2026-04-11T11:54:00.000Z"),
          context: {
            ownerUserId: "user-1",
            runId: "run-88",
            status: "COMPLETED",
            completedStageCount: 4,
            failedStageCount: 0,
            stageStates: {
              sources: "completed",
              "proto-ideas": "completed",
              "idea-candidates": "completed",
              "curated-opportunities": "completed",
            },
          },
        }),
      ],
    },
  };

  const result = await getIdeaFoundryPipelineRunDetail(prisma, "user-1", "run-88");

  assert.equal(result.stages[0].stageKey, "proto-ideas");
  assert.equal(result.stages[0].processedCount, 8);
  assert.equal(result.stages[0].producedCount, 2);
});
