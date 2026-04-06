const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildUiSnapshotFromAgentReview,
  executeProspectingConfiguration,
  runProspectingConfigurationReview,
} = require("../app/services/prospecting-configuration.service");

test("buildUiSnapshotFromAgentReview preserves unknown source metadata instead of inventing demo defaults", () => {
  const snapshot = buildUiSnapshotFromAgentReview({
    recommended_strategy_update: {
      prospecting_objective: {},
      search_strategy: {
        summary: "",
        strategy_patterns: [],
        steering_hypothesis: "",
      },
      search_themes: [],
      source_mix: [
        {
          label: "Operator forums",
          enabled: true,
          expected_signal_type: "Repeated workflow complaints",
          rationale: "Returned by the agent",
          review_frequency: "Every run",
        },
      ],
      query_families: [],
      signal_quality_criteria: [],
      scan_policy: {
        run_mode: "manual-only",
        cadence: "",
        max_results_per_run: 0,
        promotion_threshold: "",
        geographic_scope: [],
        language_scope: [],
        guardrails: [],
      },
    },
    proposed_changes: [],
    review_flags: [],
    reply_to_user: {
      content: "Kept the current source mix focused.",
    },
    strategy_review_overview: {
      assessment: {
        label: "ok",
        reason: "",
        next_best_action: "",
      },
    },
    current_strategy_assessment: {
      summary: "",
      observed_strengths: [],
      observed_weaknesses: [],
      notable_gaps: [],
      status: {
        label: "",
        tone: "",
        agent_confidence: "",
        explanation: "",
      },
    },
  });

  assert.equal(snapshot.sources.length, 1);
  assert.deepEqual(snapshot.sources[0], {
    id: "operator-forums",
    label: "Operator forums",
    description: "Returned by the agent",
    enabled: true,
    freshness: "Unknown",
    signalType: "Repeated workflow complaints",
    noiseProfile: "Unknown",
    reviewFrequency: "Every run",
  });
  assert.deepEqual(snapshot.recentMetrics, []);
});

test("runProspectingConfigurationReview persists the next runtime slot on the enforced hourly cadence", async () => {
  let storedRecord = null;
  const now = Date.now();
  const prisma = {
    prospectingConfiguration: {
      async findUnique() {
        return null;
      },
      async upsert({ create, update }) {
        storedRecord = {
          id: "prospecting-config-1",
          ...(storedRecord ?? {}),
          ...(storedRecord ? update : create),
        };
        return storedRecord;
      },
    },
    agentDefinition: {
      async findMany() {
        return [
          {
            key: "prospecting",
            name: "Prospecting Agent",
            active: true,
            updatedAt: new Date("2026-04-05T20:00:00.000Z"),
          },
        ];
      },
    },
    logEntry: {
      async create({ data }) {
        return { id: data.id ?? "log-1", ...data };
      },
    },
  };
  const agentGatewayClient = {
    async getAdminSnapshot() {
      return {
        status: "online",
        agents: [{ key: "prospecting" }],
      };
    },
    async startRun() {
      return { id: "run-1" };
    },
    async waitForRunCompletion() {
      return {
        id: "run-1",
        status: "completed",
        normalized_output: {
          reply_to_user: {
            content: "Kept the strategy tight.",
          },
          strategy_review_overview: {
            assessment: {
              label: "solid",
              reason: "Signals are usable.",
              next_best_action: "Keep scanning hourly.",
            },
          },
          current_strategy_assessment: {
            summary: "The strategy is coherent.",
            observed_strengths: ["Clear themes"],
            observed_weaknesses: [],
            notable_gaps: [],
            status: {
              label: "healthy",
              tone: "confident",
              agent_confidence: "high",
              explanation: "The review payload is complete.",
            },
          },
          recommended_strategy_update: {
            prospecting_objective: {
              objective_name: "Find workflow pain",
              description: "Search for repeated operator pain.",
              target_domain: "B2B SaaS",
              include_themes: ["workflow pain"],
              exclude_themes: [],
            },
            search_strategy: {
              summary: "Stay focused on recurring complaints.",
              strategy_patterns: [],
              steering_hypothesis: "Operators repeat the same broken workflow.",
            },
            search_themes: [],
            source_mix: [],
            query_families: [],
            signal_quality_criteria: [],
            scan_policy: {
              run_mode: "scheduled",
              cadence: "Daily",
              max_results_per_run: 5,
              promotion_threshold: "Repeated pain",
              geographic_scope: [],
              language_scope: [],
              guardrails: [],
            },
          },
          proposed_changes: [],
          review_flags: [],
        },
      };
    },
  };

  const result = await runProspectingConfigurationReview(
    prisma,
    agentGatewayClient,
    {
      snapshot: {
        queryFamilies: [],
      },
    },
    {
      id: "user-1",
      email: "founder@example.com",
    },
  );

  const nextRunAt = Date.parse(result.runtime.nextRun);
  assert.equal(result.snapshot.cadence.runMode, "Scheduled");
  assert.equal(result.snapshot.cadence.cadence, "Every hour");
  assert.equal(result.snapshot.nextRun, "Every hour");
  assert.equal(Number.isNaN(nextRunAt), false);
  assert.ok(nextRunAt >= now + (59 * 60 * 1000));
  assert.ok(nextRunAt <= Date.now() + (61 * 60 * 1000));
});

test("executeProspectingConfiguration retries zero-result boolean queries with a simplified fallback", async () => {
  let storedRecord = {
    id: "prospecting-config-1",
    ownerUserId: "user-1",
    agentState: "active",
    latestRunStatus: "COMPLETED",
    uiSnapshotJson: {
      strategyMode: "Focused search",
      cadence: {
        runMode: "Scheduled",
        cadence: "Every hour",
      },
      queryFamilies: [
        {
          id: "emerging-technology-trends",
          title: "Emerging Technology Trends",
          representativeQueries: ["\"emerging technology\" OR \"new innovation\" OR \"breakthrough\""],
          themeLink: "emerging-technologies",
          sourceApplicability: ["Industry News Aggregators"],
          status: "Active",
          priorityRank: 1,
        },
      ],
    },
    latestReviewJson: {
      reply_to_user: {
        content: "ok",
      },
    },
    lastResultRecords: [],
    lastRunAt: new Date("2026-04-05T19:00:00.000Z"),
    nextRunAt: new Date("2026-04-05T20:00:00.000Z"),
  };
  const searchCalls = [];
  const logEntries = [];
  const prisma = {
    prospectingConfiguration: {
      async findUnique() {
        return storedRecord;
      },
      async upsert({ create, update }) {
        storedRecord = {
          ...(storedRecord ?? {}),
          ...(storedRecord ? update : create),
        };
        return storedRecord;
      },
    },
    logEntry: {
      async create({ data }) {
        logEntries.push(data);
        return { id: data.id ?? `log-${logEntries.length}`, ...data };
      },
    },
  };
  const agentGatewayClient = {
    async searchWeb({ query }) {
      searchCalls.push(query);

      if (query === "\"emerging technology\" OR \"new innovation\" OR \"breakthrough\"") {
        return {
          payload: {
            results: [],
          },
        };
      }

      return {
        payload: {
          results: [
            {
              title: "Breakthroughs in emerging technology",
              url: "https://example.com/emerging-technology",
              snippet: "Recent breakthrough coverage.",
              provider: "web_search",
              rank: 1,
            },
          ],
        },
      };
    },
  };

  const result = await executeProspectingConfiguration(
    prisma,
    agentGatewayClient,
    {
      id: "user-1",
      email: "founder@example.com",
    },
  );

  assert.deepEqual(searchCalls, [
    "\"emerging technology\" OR \"new innovation\" OR \"breakthrough\"",
    "emerging technology new innovation breakthrough",
  ]);
  assert.equal(result.runtime.latestRunStatus, "COMPLETED");
  assert.equal(result.runtime.resultRecordCount, 1);
  assert.equal(storedRecord.lastResultRecords.length, 1);
  assert.equal(storedRecord.lastResultRecords[0].query, "\"emerging technology\" OR \"new innovation\" OR \"breakthrough\"");
  assert.equal(
    storedRecord.lastResultRecords[0].executedQuery,
    "emerging technology new innovation breakthrough",
  );
  assert.equal(
    logEntries.some((entry) => entry.event === "prospecting_execution_query_retry_succeeded"),
    true,
  );
});

test("executeProspectingConfiguration stores deduplicated normalized source records", async () => {
  let storedRecord = {
    id: "prospecting-config-1",
    ownerUserId: "user-1",
    agentState: "active",
    latestRunStatus: "COMPLETED",
    uiSnapshotJson: {
      strategyMode: "Focused search",
      cadence: {
        runMode: "Scheduled",
        cadence: "Every hour",
      },
      queryFamilies: [
        {
          id: "ops-forums",
          title: "Operator forums",
          representativeQueries: ["finops workflow complaints", "finops workflow complaints"],
          themeLink: "workflow-pain",
          sourceApplicability: ["forums"],
          status: "Active",
          priorityRank: 1,
        },
      ],
    },
    latestReviewJson: {
      reply_to_user: {
        content: "ok",
      },
    },
    lastResultRecords: [],
    lastRunAt: new Date("2026-04-05T19:00:00.000Z"),
    nextRunAt: new Date("2026-04-05T20:00:00.000Z"),
  };
  const prisma = {
    prospectingConfiguration: {
      async findUnique() {
        return storedRecord;
      },
      async upsert({ create, update }) {
        storedRecord = {
          ...(storedRecord ?? {}),
          ...(storedRecord ? update : create),
        };
        return storedRecord;
      },
    },
    logEntry: {
      async create({ data }) {
        return { id: data.id ?? "log-1", ...data };
      },
    },
  };
  const agentGatewayClient = {
    async searchWeb() {
      return {
        payload: {
          results: [
            {
              title: "Thread A",
              url: "https://example.com/thread-a",
              snippet: "Operators complain about reconciliations.",
              provider: "web_search",
              rank: 1,
            },
            {
              title: "Thread A duplicate",
              url: "https://example.com/thread-a",
              snippet: "Duplicate url should collapse.",
              provider: "web_search",
              rank: 2,
            },
          ],
        },
      };
    },
  };

  const result = await executeProspectingConfiguration(
    prisma,
    agentGatewayClient,
    {
      id: "user-1",
      email: "founder@example.com",
    },
  );

  assert.equal(result.runtime.latestRunStatus, "COMPLETED");
  assert.equal(result.runtime.resultRecordCount, 1);
  assert.equal(Array.isArray(storedRecord.lastResultRecords), true);
  assert.equal(storedRecord.lastResultRecords.length, 1);
  assert.equal(storedRecord.lastResultRecords[0].sourceUrl, "https://example.com/thread-a");
  assert.equal(storedRecord.lastResultRecords[0].queryFamilyId, "ops-forums");
});
