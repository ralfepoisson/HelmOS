const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildUpcomingPipelineRuns,
  createIdeaFoundryPipelineScheduleRuntime,
  getIdeaFoundryPipelineSchedule,
  saveIdeaFoundryPipelineSchedule,
} = require("../app/services/idea-foundry-pipeline-schedule.service");

test("buildUpcomingPipelineRuns returns the next five slots from the next run time", () => {
  const upcoming = buildUpcomingPipelineRuns({
    enabled: true,
    intervalMinutes: 240,
    nextRunAt: "2026-04-11T12:00:00.000Z",
  });

  assert.deepEqual(upcoming, [
    "2026-04-11T12:00:00.000Z",
    "2026-04-11T16:00:00.000Z",
    "2026-04-11T20:00:00.000Z",
    "2026-04-12T00:00:00.000Z",
    "2026-04-12T04:00:00.000Z",
  ]);
});

test("saveIdeaFoundryPipelineSchedule normalizes manual mode and returns the next five runs", async () => {
  let persistedRecord = null;
  const prisma = {
    $executeRawUnsafe: async () => {},
    $queryRawUnsafe: async () => [],
    $transaction: async (callback) =>
      callback({
        $executeRawUnsafe: async () => {},
        $queryRawUnsafe: async () => [],
      }),
  };

  const service = require("../app/services/idea-foundry-pipeline-schedule.service");
  const originalUpsert = service.__testOnly.upsertPipelineScheduleRecord;
  service.__testOnly.upsertPipelineScheduleRecord = async (_prisma, ownerUserId, data) => {
    persistedRecord = {
      id: "schedule-1",
      ownerUserId,
      enabled: data.enabled,
      intervalMinutes: data.intervalMinutes,
      lastRunAt: null,
      nextRunAt: data.nextRunAt,
      updatedAt: new Date("2026-04-11T09:00:00.000Z"),
    };
    return persistedRecord;
  };

  try {
    const result = await saveIdeaFoundryPipelineSchedule(prisma, "user-1", {
      enabled: false,
      intervalMinutes: 240,
    }, {
      now: () => new Date("2026-04-11T09:00:00.000Z"),
    });

    assert.equal(persistedRecord.enabled, false);
    assert.equal(result.enabled, false);
    assert.equal(result.nextRunAt, null);
    assert.deepEqual(result.upcomingRuns, []);
  } finally {
    service.__testOnly.upsertPipelineScheduleRecord = originalUpsert;
  }
});

test("pipeline schedule runtime starts due scheduled runs and advances the next slot", async () => {
  const startedRuns = [];
  const updates = [];
  const now = new Date("2026-04-11T10:00:00.000Z");

  const prisma = {
    $executeRawUnsafe: async () => {},
    $queryRawUnsafe: async (query) => {
      if (String(query).includes("FROM idea_foundry_pipeline_schedules")) {
        return [
          {
            id: "schedule-1",
            owner_user_id: "user-1",
            enabled: true,
            interval_minutes: 60,
            last_run_at: new Date("2026-04-11T09:00:00.000Z"),
            next_run_at: new Date("2026-04-11T09:30:00.000Z"),
            updated_at: new Date("2026-04-11T09:00:00.000Z"),
          },
        ];
      }

      return [];
    },
    logEntry: {
      async create() {
        return null;
      },
    },
  };

  const runtime = createIdeaFoundryPipelineScheduleRuntime({
    prisma,
    agentGatewayClient: {},
    pipelineRuntime: {
      async start(_prisma, _client, options) {
        startedRuns.push(options);
        return {
          started: true,
        };
      },
    },
    now: () => now,
    claimScheduleRun: async () => true,
    persistScheduleAfterTrigger: async (_prisma, schedule, timestamp) => {
      updates.push({ id: schedule.id, timestamp: timestamp.toISOString() });
    },
  });

  await runtime.triggerProcessingPass();

  assert.equal(startedRuns.length, 1);
  assert.equal(startedRuns[0].ownerUserId, "user-1");
  assert.equal(startedRuns[0].startStage, "sources");
  assert.equal(updates.length, 1);
});

test("getIdeaFoundryPipelineSchedule returns defaults when no persisted record exists", async () => {
  const prisma = {
    $executeRawUnsafe: async () => {},
    $queryRawUnsafe: async () => [],
  };

  const result = await getIdeaFoundryPipelineSchedule(prisma, "user-1", {
    now: () => new Date("2026-04-11T09:00:00.000Z"),
  });

  assert.equal(result.enabled, false);
  assert.equal(result.intervalMinutes, 60);
  assert.deepEqual(result.upcomingRuns, []);
});
