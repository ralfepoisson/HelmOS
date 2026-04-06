const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildProtoIdeaExtractionPrompt,
  getProtoIdeaExtractionConfiguration,
  runProtoIdeaExtractionPass,
  saveProtoIdeaExtractionConfiguration,
  validateProtoIdeaExtractionOutput,
} = require("../app/services/proto-idea-extraction.service");

test("buildProtoIdeaExtractionPrompt embeds the proto-idea agent identity and the source artefact", () => {
  const prompt = buildProtoIdeaExtractionPrompt(
    {
      id: "source-1",
      sourceTitle: "Dispatch software complaints",
      sourceUrl: "https://example.com/thread",
      snippet: "Schedulers still juggle five tools.",
    },
    {
      extractionBreadth: "expansive",
      inferenceTolerance: "balanced",
      noveltyBias: "pragmatic",
      minimumSignalThreshold: "medium",
      maxProtoIdeasPerSource: 4,
    },
    "# Proto-Idea Agent\n\nReturn JSON only.",
  );

  assert.match(prompt, /Proto-Idea Agent/);
  assert.match(prompt, /Dispatch software complaints/);
  assert.match(prompt, /https:\/\/example\.com\/thread/);
  assert.match(prompt, /Return JSON only/);
  assert.match(prompt, /Runtime extraction policy/);
  assert.match(prompt, /"extraction_breadth": "expansive"/);
  assert.match(prompt, /"max_proto_ideas_per_source": 4/);
});

test("getProtoIdeaExtractionConfiguration creates or returns the default policy record", async () => {
  let stored = null;
  const prisma = {
    protoIdeaExtractionPolicy: {
      async upsert({ create }) {
        stored = stored ?? {
          id: "policy-1",
          latestRunStatus: null,
          lastRunAt: null,
          latestRunSummaryJson: null,
          ...create,
        };
        return stored;
      },
    },
  };

  const result = await getProtoIdeaExtractionConfiguration(prisma);

  assert.equal(result.policy.profileName, "default");
  assert.equal(result.policy.extractionBreadth, "standard");
  assert.equal(result.policy.maxProtoIdeasPerSource, 4);
  assert.equal(result.runtime.latestRunStatus, "idle");
});

test("saveProtoIdeaExtractionConfiguration persists an updated admin policy", async () => {
  let stored = null;
  const logs = [];
  const prisma = {
    protoIdeaExtractionPolicy: {
      async upsert({ create, update }) {
        stored = {
          id: "policy-1",
          ...(stored ?? {}),
          ...(stored ? update : create),
        };
        return stored;
      },
    },
    logEntry: {
      async create({ data }) {
        logs.push(data);
        return { id: `log-${logs.length}`, ...data };
      },
    },
  };

  const result = await saveProtoIdeaExtractionConfiguration(
    prisma,
    {
      profileName: "default",
      extractionBreadth: "conservative",
      inferenceTolerance: "strict_grounding",
      noveltyBias: "pragmatic",
      minimumSignalThreshold: "high",
      maxProtoIdeasPerSource: 2,
    },
    { id: "admin-1" },
  );

  assert.equal(result.policy.extractionBreadth, "conservative");
  assert.equal(result.policy.inferenceTolerance, "strict_grounding");
  assert.equal(result.policy.maxProtoIdeasPerSource, 2);
  assert.equal(logs.some((entry) => entry.event === "proto_idea_policy_saved"), true);
});

test("validateProtoIdeaExtractionOutput parses raw JSON strings that match the proto-idea schema", () => {
  const validation = validateProtoIdeaExtractionOutput(
    JSON.stringify({
      reply_to_user: {
        content: "Extracted grounded proto-ideas.",
      },
      source_analysis: {
        source_id: "source-1",
        source_type: "web_search",
        source_title: "Dispatch software complaints",
        summary: "Operators are piecing together fragmented dispatch workflows.",
        primary_signals: ["Schedulers complain about jumping between tools."],
        observed_problems_or_needs: ["Teams lack a unified dispatch workflow."],
        inferred_patterns: ["Operational fragmentation is causing avoidable overhead."],
        overall_signal_strength: {
          label: "Strong",
          tone: "success",
          agent_confidence: "high",
          explanation: "The source contains repeated operational pain.",
        },
      },
      proto_idea_overview: {
        extraction_readiness: {
          label: "Ready",
          reason: "The source provides enough grounded signals.",
          next_best_action: "Persist the extracted proto-ideas for refinement.",
        },
        extraction_notes: "Two differentiated opportunity directions were present.",
      },
      proto_ideas: [
        {
          proto_idea_id: "idea-1",
          title: "Dispatch workflow unification",
          source_grounding: {
            explicit_signals: ["Schedulers use multiple tools to coordinate jobs."],
            inferred_from_source: ["Workflow fragmentation likely causes missed updates."],
          },
          problem_statement: "Dispatch teams struggle to coordinate jobs across disconnected systems.",
          target_customer: "Service operations managers and dispatch coordinators",
          opportunity_hypothesis: "A unified operations layer could reduce dispatch coordination friction.",
          why_it_matters: "Operational delays and communication gaps directly impact service delivery.",
          opportunity_type: "Workflow software",
          assumptions: ["Teams would adopt a cross-tool coordination layer."],
          open_questions: ["Which systems are most painful to coordinate today?"],
          status: {
            label: "Promising",
            tone: "success",
            agent_confidence: "medium",
            explanation: "The pain is visible, but the precise wedge still needs validation.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: false,
          },
        },
      ],
      deduplication_notes: {
        potential_overlap_detected: false,
        explanation: "",
      },
    }),
  );

  assert.equal(validation.success, true);
  assert.equal(validation.data.proto_ideas.length, 1);
});

test("runProtoIdeaExtractionPass claims the oldest unprocessed source, deduplicates obvious duplicates, and persists proto-ideas", async () => {
  const sourceRecords = [
    {
      id: "source-newer",
      sourceTitle: "Newer source",
      sourceUrl: "https://example.com/newer",
      snippet: "Recent signal",
      provider: "web_search",
      capturedAt: "2026-04-05T10:00:00.000Z",
    },
    {
      id: "source-older",
      sourceTitle: "Older source",
      sourceUrl: "https://example.com/older",
      snippet: "Operators keep re-entering customer details across tools.",
      provider: "web_search",
      capturedAt: "2026-04-04T10:00:00.000Z",
    },
  ];

  const createdSources = [];
  const createdIdeas = [];
  const logEntries = [];
  const sourceRows = new Map();
  let storedPolicy = {
    id: "policy-1",
    profileName: "default",
    extractionBreadth: "standard",
    inferenceTolerance: "balanced",
    noveltyBias: "balanced",
    minimumSignalThreshold: "medium",
    maxProtoIdeasPerSource: 4,
    latestRunStatus: null,
    latestRunSummaryJson: null,
    lastRunAt: null,
  };

  const prisma = {
    prospectingConfiguration: {
      async findMany() {
        return [
          {
            id: "prospecting-config-1",
            ownerUserId: "user-1",
            lastRunAt: new Date("2026-04-05T12:00:00.000Z"),
            lastResultRecords: sourceRecords,
            ownerUser: {
              id: "user-1",
              email: "founder@example.com",
              displayName: "Founder Example",
            },
          },
        ];
      },
    },
    protoIdeaExtractionPolicy: {
      async upsert() {
        return storedPolicy;
      },
      async update({ data }) {
        storedPolicy = {
          ...storedPolicy,
          ...data,
        };
        return storedPolicy;
      },
    },
    protoIdeaSource: {
      async findUnique({ where }) {
        return sourceRows.get(`${where.ownerUserId_sourceKey.ownerUserId}:${where.ownerUserId_sourceKey.sourceKey}`) ?? null;
      },
      async create({ data }) {
        const key = `${data.ownerUserId}:${data.sourceKey}`;
        const row = {
          id: `proto-source-${createdSources.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        createdSources.push(row);
        sourceRows.set(key, row);
        return row;
      },
      async updateMany({ where, data }) {
        const row = Array.from(sourceRows.values()).find((entry) => entry.id === where.id);
        if (!row) {
          return { count: 0 };
        }
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      },
      async update({ where, data }) {
        const row = Array.from(sourceRows.values()).find((entry) => entry.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      async findMany() {
        return Array.from(sourceRows.values());
      },
    },
    protoIdea: {
      async deleteMany({ where }) {
        for (let index = createdIdeas.length - 1; index >= 0; index -= 1) {
          if (createdIdeas[index].sourceId === where.sourceId) {
            createdIdeas.splice(index, 1);
          }
        }
        return { count: 0 };
      },
      async create({ data }) {
        const row = {
          id: `proto-idea-${createdIdeas.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        createdIdeas.push(row);
        return row;
      },
      async findMany() {
        return createdIdeas;
      },
    },
    agentDefinition: {
      async findMany() {
        return [
          {
            key: "proto-idea",
            name: "Proto-Idea Agent",
            active: true,
            updatedAt: new Date("2026-04-05T20:00:00.000Z"),
          },
        ];
      },
    },
    logEntry: {
      async create({ data }) {
        logEntries.push(data);
        return { id: data.id ?? `log-${logEntries.length}`, ...data };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };

  const agentGatewayClient = {
    async getAdminSnapshot() {
      return {
        status: "online",
        agents: [{ key: "proto-idea" }],
      };
    },
    async startRun(payload) {
      assert.match(payload.input_text, /Older source/);
      assert.match(payload.input_text, /Runtime extraction policy/);
      assert.equal(payload.context.extraction_policy.max_proto_ideas_per_source, 4);
      return { id: "gateway-run-1" };
    },
    async waitForRunCompletion() {
      return {
        id: "gateway-run-1",
        status: "completed",
        normalized_output: {
          reply_to_user: {
            content: "Extracted grounded proto-ideas.",
          },
          source_analysis: {
            source_id: "source-older",
            source_type: "web_search",
            source_title: "Older source",
            summary: "Operators are re-entering information across tools.",
            primary_signals: ["Repeated manual entry"],
            observed_problems_or_needs: ["Fragmented service operations tooling"],
            inferred_patterns: ["Operational software gaps create admin overhead"],
            overall_signal_strength: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The source is a clear operations pain signal.",
            },
          },
          proto_idea_overview: {
            extraction_readiness: {
              label: "Ready",
              reason: "The source is sufficiently concrete.",
              next_best_action: "Persist and refine later.",
            },
            extraction_notes: "One duplicate pair was merged.",
          },
          proto_ideas: [
            {
              proto_idea_id: "idea-a",
              title: "Service ops system of record",
              source_grounding: {
                explicit_signals: ["Operators re-enter customer details across tools."],
                inferred_from_source: ["A coordination layer could remove duplicate work."],
              },
              problem_statement: "Service teams repeatedly re-enter the same job information.",
              target_customer: "Service operations teams",
              opportunity_hypothesis: "A shared system of record could reduce repeat admin work.",
              why_it_matters: "Admin overhead slows operations and creates errors.",
              opportunity_type: "Operations workflow",
              assumptions: ["Teams have multiple disconnected systems today."],
              open_questions: ["Which tools create the most duplicated entry?"],
              status: {
                label: "Promising",
                tone: "success",
                agent_confidence: "medium",
                explanation: "Pain is visible but product shape is still early.",
              },
              ui_hints: {
                highlight: true,
                needs_attention: false,
              },
            },
            {
              proto_idea_id: "idea-b",
              title: "Service ops system of record",
              source_grounding: {
                explicit_signals: ["Operators re-enter customer details across tools."],
                inferred_from_source: ["A coordination layer could remove duplicate work."],
              },
              problem_statement: "Service teams repeatedly re-enter the same job information.",
              target_customer: "Service operations teams",
              opportunity_hypothesis: "A shared system of record could reduce repeat admin work.",
              why_it_matters: "Admin overhead slows operations and creates errors.",
              opportunity_type: "Operations workflow",
              assumptions: ["Adoption would depend on integrations."],
              open_questions: ["How often do updates get missed?"],
              status: {
                label: "Promising",
                tone: "success",
                agent_confidence: "medium",
                explanation: "Duplicate variant of the same opportunity.",
              },
              ui_hints: {
                highlight: false,
                needs_attention: false,
              },
            },
          ],
          deduplication_notes: {
            potential_overlap_detected: true,
            explanation: "The response contained two near-identical variants.",
          },
        },
      };
    },
  };

  const result = await runProtoIdeaExtractionPass(prisma, agentGatewayClient, {
    batchSize: 1,
    agentIdentityMarkdown: "# Proto-Idea Agent\n\nReturn JSON only.",
  });

  assert.equal(result.processedCount, 1);
  assert.equal(result.completedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(createdSources.length, 1);
  assert.equal(createdSources[0].upstreamSourceRecordId, "source-older");
  assert.equal(createdSources[0].extractionPolicyId, "policy-1");
  assert.equal(createdSources[0].extractionPolicySnapshot.max_proto_ideas_per_source, 4);
  assert.equal(createdIdeas.length, 1);
  assert.equal(createdIdeas[0].title, "Service ops system of record");
  assert.match(createdSources[0].deduplicationNotes, /merged 1 obvious duplicate/i);
  assert.equal(storedPolicy.latestRunStatus, "COMPLETED");
  assert.equal(storedPolicy.latestRunSummaryJson.completedCount, 1);
  assert.equal(
    logEntries.some((entry) => entry.event === "proto_idea_extraction_completed"),
    true,
  );
});

test("runProtoIdeaExtractionPass marks the source as failed when the agent returns malformed JSON", async () => {
  const sourceRows = new Map();
  let storedPolicy = {
    id: "policy-1",
    profileName: "default",
    extractionBreadth: "standard",
    inferenceTolerance: "balanced",
    noveltyBias: "balanced",
    minimumSignalThreshold: "medium",
    maxProtoIdeasPerSource: 4,
    latestRunStatus: null,
    latestRunSummaryJson: null,
    lastRunAt: null,
  };

  const prisma = {
    prospectingConfiguration: {
      async findMany() {
        return [
          {
            id: "prospecting-config-1",
            ownerUserId: "user-1",
            lastRunAt: new Date("2026-04-05T12:00:00.000Z"),
            lastResultRecords: [
              {
                id: "source-1",
                sourceTitle: "Broken payload source",
                sourceUrl: "https://example.com/source-1",
                snippet: "Repeated complaints",
                provider: "web_search",
                capturedAt: "2026-04-04T10:00:00.000Z",
              },
            ],
            ownerUser: {
              id: "user-1",
              email: "founder@example.com",
            },
          },
        ];
      },
    },
    protoIdeaExtractionPolicy: {
      async upsert() {
        return storedPolicy;
      },
      async update({ data }) {
        storedPolicy = {
          ...storedPolicy,
          ...data,
        };
        return storedPolicy;
      },
    },
    protoIdeaSource: {
      async findUnique({ where }) {
        return sourceRows.get(`${where.ownerUserId_sourceKey.ownerUserId}:${where.ownerUserId_sourceKey.sourceKey}`) ?? null;
      },
      async create({ data }) {
        const key = `${data.ownerUserId}:${data.sourceKey}`;
        const row = {
          id: "proto-source-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        sourceRows.set(key, row);
        return row;
      },
      async updateMany({ where, data }) {
        const row = Array.from(sourceRows.values()).find((entry) => entry.id === where.id);
        if (!row) {
          return { count: 0 };
        }
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      },
      async update({ where, data }) {
        const row = Array.from(sourceRows.values()).find((entry) => entry.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    protoIdea: {
      async deleteMany() {
        return { count: 0 };
      },
      async create() {
        throw new Error("No proto-ideas should be created for malformed payloads");
      },
    },
    agentDefinition: {
      async findMany() {
        return [
          {
            key: "proto-idea",
            name: "Proto-Idea Agent",
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
    async $transaction(callback) {
      return callback(this);
    },
  };

  const agentGatewayClient = {
    async getAdminSnapshot() {
      return {
        status: "online",
        agents: [{ key: "proto-idea" }],
      };
    },
    async startRun() {
      return { id: "gateway-run-1" };
    },
    async waitForRunCompletion() {
      return {
        id: "gateway-run-1",
        status: "completed",
        normalized_output: {
          debug: {
            raw_llm_output: "{not-valid-json",
          },
        },
      };
    },
  };

  const result = await runProtoIdeaExtractionPass(prisma, agentGatewayClient, {
    batchSize: 1,
    agentIdentityMarkdown: "# Proto-Idea Agent\n\nReturn JSON only.",
  });

  assert.equal(result.processedCount, 1);
  assert.equal(result.completedCount, 0);
  assert.equal(result.failedCount, 1);
  const failedSource = Array.from(sourceRows.values())[0];
  assert.equal(failedSource.processingStatus, "FAILED");
  assert.match(failedSource.lastErrorMessage, /invalid json/i);
  assert.equal(storedPolicy.latestRunStatus, "FAILED");
});
