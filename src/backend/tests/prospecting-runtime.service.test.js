const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createProspectingRuntime,
} = require("../app/services/prospecting-runtime.service");

test("prospecting runtime waits for the persisted next run slot before executing an hourly scheduled cadence", async () => {
  const optimizationCalls = [];
  const logEntries = [];
  const dueDate = new Date("2026-04-05T20:00:00.000Z");

  const prisma = {
    prospectingConfiguration: {
      async findMany(args) {
        assert.deepEqual(args.where, {
          agentState: "active",
        });

        return [
          {
            id: "prospecting-config-1",
            ownerUserId: "user-1",
            lastRunAt: new Date("2026-04-05T18:00:00.000Z"),
            nextRunAt: new Date("2026-04-06T18:00:00.000Z"),
            uiSnapshotJson: {
              cadence: {
                runMode: "Scheduled",
                cadence: "Every hour",
              },
            },
            ownerUser: {
              id: "user-1",
              email: "founder@example.com",
              displayName: "Founder Example",
              appRole: "USER",
            },
          },
        ];
      },
    },
    logEntry: {
      async create({ data }) {
        logEntries.push(data);
        return {
          id: `log-${logEntries.length}`,
          ...data,
        };
      },
    },
  };

  const runtime = createProspectingRuntime({
    prisma,
    agentGatewayClient: {},
    config: {
      pollMs: 25,
    },
    runOptimizationCycle: async (...args) => {
      optimizationCalls.push(args);
      return {
        runtime: {
          latestRunStatus: "COMPLETED",
          resultRecordCount: 12,
        },
      };
    },
    now: () => dueDate,
  });

  await runtime.triggerProcessingPass();

  assert.equal(optimizationCalls.length, 0);
  assert.equal(logEntries.length, 0);
});

test("prospecting runtime queries active configurations without excluding nullable run statuses or truncating the scan", async () => {
  let receivedArgs = null;

  const prisma = {
    prospectingConfiguration: {
      async findMany(args) {
        receivedArgs = args;
        return [];
      },
    },
    logEntry: {
      async create() {
        return null;
      },
    },
  };

  const runtime = createProspectingRuntime({
    prisma,
    agentGatewayClient: {},
    now: () => new Date("2026-04-05T20:00:00.000Z"),
  });

  await runtime.triggerProcessingPass();

  assert.deepEqual(receivedArgs.where, {
    agentState: "active",
  });
  assert.equal(Object.hasOwn(receivedArgs, "take"), false);
});

test("prospecting runtime processes due prospecting configurations when the next run slot has elapsed", async () => {
  const optimizationCalls = [];
  const logEntries = [];
  const dueDate = new Date("2026-04-05T20:00:00.000Z");

  const prisma = {
    prospectingConfiguration: {
      async findMany(args) {
        assert.deepEqual(args.where, {
          agentState: "active",
        });

        return [
          {
            id: "prospecting-config-1",
            ownerUserId: "user-1",
            lastRunAt: new Date("2026-04-05T18:00:00.000Z"),
            nextRunAt: new Date("2026-04-05T19:00:00.000Z"),
            uiSnapshotJson: {
              cadence: {
                runMode: "Scheduled",
                cadence: "Every hour",
              },
            },
            ownerUser: {
              id: "user-1",
              email: "founder@example.com",
              displayName: "Founder Example",
              appRole: "USER",
            },
          },
        ];
      },
    },
    logEntry: {
      async create({ data }) {
        logEntries.push(data);
        return {
          id: `log-${logEntries.length}`,
          ...data,
        };
      },
    },
  };

  const runtime = createProspectingRuntime({
    prisma,
    agentGatewayClient: {},
    config: {
      pollMs: 25,
    },
    runOptimizationCycle: async (...args) => {
      optimizationCalls.push(args);
      return {
        runtime: {
          latestRunStatus: "COMPLETED",
          resultRecordCount: 12,
        },
      };
    },
    now: () => dueDate,
  });

  await runtime.triggerProcessingPass();

  assert.equal(optimizationCalls.length, 1);
  assert.deepEqual(optimizationCalls[0][2], {
    snapshot: {
      cadence: {
        runMode: "Scheduled",
        cadence: "Every hour",
      },
    },
  });
  assert.equal(optimizationCalls[0][3].id, "user-1");
  assert.equal(
    logEntries.some((entry) => entry.event === "prospecting_runtime_cycle_succeeded"),
    true,
  );
});

test("prospecting runtime skips a due configuration when another runtime already claimed the same row", async () => {
  const optimizationCalls = [];
  let updateManyArgs = null;

  const prisma = {
    prospectingConfiguration: {
      async findMany() {
        return [
          {
            id: "prospecting-config-1",
            ownerUserId: "user-1",
            updatedAt: new Date("2026-04-05T19:59:00.000Z"),
            lastRunAt: new Date("2026-04-05T18:00:00.000Z"),
            nextRunAt: new Date("2026-04-05T19:00:00.000Z"),
            uiSnapshotJson: {
              cadence: {
                runMode: "Scheduled",
                cadence: "Every hour",
              },
            },
            ownerUser: {
              id: "user-1",
              email: "founder@example.com",
              displayName: "Founder Example",
              appRole: "USER",
            },
          },
        ];
      },
      async updateMany(args) {
        updateManyArgs = args;
        return { count: 0 };
      },
    },
    logEntry: {
      async create() {
        return null;
      },
    },
  };

  const runtime = createProspectingRuntime({
    prisma,
    agentGatewayClient: {},
    runOptimizationCycle: async (...args) => {
      optimizationCalls.push(args);
      return {
        runtime: {
          latestRunStatus: "COMPLETED",
          resultRecordCount: 5,
        },
      };
    },
    now: () => new Date("2026-04-05T20:00:00.000Z"),
  });

  await runtime.triggerProcessingPass();

  assert.deepEqual(updateManyArgs.where, {
    id: "prospecting-config-1",
    updatedAt: new Date("2026-04-05T19:59:00.000Z"),
  });
  assert.equal(updateManyArgs.data.latestRunStatus, "RUNNING");
  assert.ok(updateManyArgs.data.updatedAt instanceof Date);
  assert.equal(optimizationCalls.length, 0);
});

test("prospecting runtime falls back to last run age when the next run slot is missing", async () => {
  const optimizationCalls = [];

  const prisma = {
    prospectingConfiguration: {
      async findMany() {
        return [
          {
            id: "prospecting-config-1",
            ownerUserId: "user-1",
            lastRunAt: new Date("2026-04-05T18:00:00.000Z"),
            nextRunAt: null,
            uiSnapshotJson: {
              cadence: {
                runMode: "Scheduled",
                cadence: "Every hour",
              },
            },
            ownerUser: {
              id: "user-1",
              email: "founder@example.com",
              displayName: "Founder Example",
              appRole: "USER",
            },
          },
        ];
      },
    },
    logEntry: {
      async create() {
        return null;
      },
    },
  };

  const runtime = createProspectingRuntime({
    prisma,
    agentGatewayClient: {},
    runOptimizationCycle: async (...args) => {
      optimizationCalls.push(args);
      return {
        runtime: {
          latestRunStatus: "COMPLETED",
          resultRecordCount: 1,
        },
      };
    },
    now: () => new Date("2026-04-05T20:00:00.000Z"),
  });

  await runtime.triggerProcessingPass();

  assert.equal(optimizationCalls.length, 1);
});

test("prospecting runtime recovers configurations stranded in RUNNING when their persisted hourly slot is due", async () => {
  const optimizationCalls = [];

  const prisma = {
    prospectingConfiguration: {
      async findMany(args) {
        assert.deepEqual(args.where, {
          agentState: "active",
        });

        return [
          {
            id: "prospecting-config-stale-running",
            ownerUserId: "user-1",
            latestRunStatus: "RUNNING",
            lastRunAt: new Date("2026-04-05T18:00:00.000Z"),
            nextRunAt: new Date("2026-04-05T19:00:00.000Z"),
            uiSnapshotJson: {
              cadence: {
                runMode: "Scheduled",
                cadence: "Every hour",
              },
            },
            ownerUser: {
              id: "user-1",
              email: "founder@example.com",
              displayName: "Founder Example",
              appRole: "USER",
            },
          },
        ];
      },
    },
    logEntry: {
      async create() {
        return null;
      },
    },
  };

  const runtime = createProspectingRuntime({
    prisma,
    agentGatewayClient: {},
    runOptimizationCycle: async (...args) => {
      optimizationCalls.push(args);
      return {
        runtime: {
          latestRunStatus: "COMPLETED",
          resultRecordCount: 3,
        },
      };
    },
    now: () => new Date("2026-04-05T20:00:00.000Z"),
  });

  await runtime.triggerProcessingPass();

  assert.equal(optimizationCalls.length, 1);
  assert.equal(optimizationCalls[0][3].id, "user-1");
});

test("prospecting runtime skips overlapping ticks while a pass is still in progress", async () => {
  const releases = [];
  let findManyCalls = 0;

  const prisma = {
    prospectingConfiguration: {
      async findMany() {
        findManyCalls += 1;
        return [
          {
            id: `prospecting-config-${findManyCalls}`,
            ownerUserId: "user-1",
            lastRunAt: new Date("2026-04-05T18:00:00.000Z"),
            nextRunAt: new Date("2026-04-05T19:00:00.000Z"),
            uiSnapshotJson: {
              cadence: {
                runMode: "Scheduled",
                cadence: "Every hour",
              },
            },
            ownerUser: {
              id: "user-1",
              email: "founder@example.com",
              displayName: "Founder Example",
              appRole: "USER",
            },
          },
        ];
      },
    },
    logEntry: {
      async create() {
        return null;
      },
    },
  };

  const runtime = createProspectingRuntime({
    prisma,
    agentGatewayClient: {},
    runOptimizationCycle: async () =>
      new Promise((resolve) => {
        releases.push(resolve);
      }),
    now: () => new Date("2026-04-05T20:00:00.000Z"),
  });

  const firstPass = runtime.triggerProcessingPass();
  const overlappingPass = runtime.triggerProcessingPass();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(findManyCalls, 1);

  releases[0]({
    runtime: {
      latestRunStatus: "COMPLETED",
      resultRecordCount: 1,
    },
  });

  await firstPass;
  await overlappingPass;
  assert.equal(findManyCalls, 1);
});

test("prospecting runtime reports background tick failures instead of swallowing them silently", async () => {
  let findManyCalls = 0;
  const reportedErrors = [];

  const prisma = {
    prospectingConfiguration: {
      async findMany() {
        findManyCalls += 1;
        if (findManyCalls === 1) {
          return [];
        }

        throw new Error("database offline");
      },
    },
    logEntry: {
      async create() {
        return null;
      },
    },
  };

  const runtime = createProspectingRuntime({
    prisma,
    agentGatewayClient: {},
    config: {
      pollMs: 10,
    },
    onError: (error) => {
      reportedErrors.push(error instanceof Error ? error.message : String(error));
    },
    now: () => new Date("2026-04-05T20:00:00.000Z"),
  });

  await runtime.start();
  await new Promise((resolve) => setTimeout(resolve, 30));
  await runtime.stop();

  assert.ok(findManyCalls >= 2);
  assert.ok(reportedErrors.length >= 1);
  assert.ok(reportedErrors.every((message) => message === "database offline"));
});

test("prospecting runtime start does not fail when the prospecting table has not been migrated yet", async () => {
  let findManyCalls = 0;
  const reportedErrors = [];

  const prisma = {
    prospectingConfiguration: {
      async findMany() {
        findManyCalls += 1;
        const error = new Error("The table `public.prospecting_configurations` does not exist in the current database.");
        error.code = "P2021";
        throw error;
      },
    },
    logEntry: {
      async create() {
        return null;
      },
    },
  };

  const runtime = createProspectingRuntime({
    prisma,
    agentGatewayClient: {},
    config: {
      pollMs: 10,
    },
    onError: (error) => {
      reportedErrors.push(error instanceof Error ? error.message : String(error));
    },
  });

  await runtime.start();
  await runtime.triggerProcessingPass();
  await runtime.stop();

  assert.equal(findManyCalls, 2);
  assert.deepEqual(reportedErrors, []);
});
