const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildIdeaRefinementPrompt,
  getIdeaRefinementConfiguration,
  runIdeaRefinementPass,
  saveIdeaRefinementConfiguration,
  selectRelevantConceptualTools,
  validateIdeaRefinementOutput,
} = require("../app/services/idea-refinement.service");

test("buildIdeaRefinementPrompt embeds the idea refinement identity, policy, tools, and proto-idea", () => {
  const prompt = buildIdeaRefinementPrompt(
    {
      id: "proto-1",
      title: "Dispatch coordination layer",
      problemStatement: "Dispatch teams lose time across disconnected tools.",
      targetCustomer: "Dispatch leads",
      opportunityHypothesis: "A coordination layer could reduce update lag.",
    },
    {
      refinementDepth: "deep",
      creativityLevel: "high",
      strictness: "balanced",
      maxConceptualToolsPerRun: 3,
      internalQualityThreshold: "standard",
    },
    [
      {
        id: "tool-1",
        name: "Assumption Mapping",
        category: "diagnostic",
        purpose: "Surface hidden assumptions",
        instructions: ["List hidden assumptions"],
        expectedEffect: "Sharper reasoning",
      },
    ],
    "# Idea Refinement Agent\n\nReturn JSON only.",
  );

  assert.match(prompt, /Idea Refinement Agent/);
  assert.match(prompt, /Dispatch coordination layer/);
  assert.match(prompt, /Selected conceptual tools/);
  assert.match(prompt, /"refinement_depth": "deep"/);
  assert.match(prompt, /Assumption Mapping/);
});

test("getIdeaRefinementConfiguration creates or returns the default policy record", async () => {
  let stored = null;
  const prisma = {
    ideaRefinementPolicy: {
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

  const result = await getIdeaRefinementConfiguration(prisma);

  assert.equal(result.policy.profileName, "default");
  assert.equal(result.policy.refinementDepth, "standard");
  assert.equal(result.policy.maxConceptualToolsPerRun, 3);
  assert.equal(result.runtime.latestRunStatus, "idle");
});

test("saveIdeaRefinementConfiguration persists an updated admin policy", async () => {
  let stored = null;
  const logs = [];
  const prisma = {
    ideaRefinementPolicy: {
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

  const result = await saveIdeaRefinementConfiguration(
    prisma,
    {
      profileName: "default",
      refinementDepth: "deep",
      creativityLevel: "high",
      strictness: "exploratory",
      maxConceptualToolsPerRun: 4,
      internalQualityThreshold: "high",
    },
    { id: "admin-1" },
  );

  assert.equal(result.policy.refinementDepth, "deep");
  assert.equal(result.policy.maxConceptualToolsPerRun, 4);
  assert.equal(logs.some((entry) => entry.event === "idea_refinement_policy_saved"), true);
});

test("selectRelevantConceptualTools prioritizes tools that match obvious proto-idea weaknesses", () => {
  const selection = selectRelevantConceptualTools(
    {
      title: "Workflow automation platform",
      problemStatement: "Teams still work manually across fragmented tools.",
      targetCustomer: "Operations managers",
      opportunityHypothesis: "A platform could help.",
      whyItMatters: "The process is slow.",
      assumptions: [],
      openQuestions: [],
      opportunityType: "Workflow SaaS",
    },
    [
      { id: "tool-1", name: "Assumption Mapping", whenToUse: ["the idea relies on multiple unstated beliefs"] },
      { id: "tool-2", name: "Failure Analysis", whenToUse: ["the concept looks attractive but fragile"] },
      { id: "tool-3", name: "Analogy Transfer", whenToUse: ["category conventions feel stale"] },
    ],
    {
      maxConceptualToolsPerRun: 2,
    },
  );

  assert.equal(selection.selected.length, 2);
  assert.equal(selection.selected.some((tool) => tool.name === "Assumption Mapping"), true);
  assert.equal(selection.selected.some((tool) => tool.name === "Analogy Transfer"), true);
});

test("validateIdeaRefinementOutput parses raw JSON strings that match the refinement schema", () => {
  const validation = validateIdeaRefinementOutput(
    JSON.stringify({
      reply_to_user: {
        content: "Refined the proto-idea into a clearer candidate.",
      },
      refinement_overview: {
        improvement_summary: "Sharpened the customer, value proposition, and wedge.",
        key_changes: ["Narrowed the ICP", "Clarified the value proposition"],
        applied_reasoning_summary: "Used assumption mapping and failure analysis to improve coherence.",
      },
      problem_statement: {
        content: "Small accounting firms lose time coordinating recurring compliance reminders across manual workflows.",
        status: {
          label: "Strong",
          tone: "success",
          agent_confidence: "high",
          explanation: "The problem is now specific and grounded.",
        },
      },
      target_customer: {
        content: "Owner-led accounting firms with recurring monthly and quarterly filing deadlines.",
        status: {
          label: "Strong",
          tone: "success",
          agent_confidence: "high",
          explanation: "The buyer is now specific enough for downstream evaluation.",
        },
      },
      value_proposition: {
        content: "A recurring workflow cockpit that automates reminder sequencing and task handoffs.",
        status: {
          label: "Strong",
          tone: "success",
          agent_confidence: "high",
          explanation: "The value is tangible and operational.",
        },
      },
      opportunity_concept: {
        content: "A compliance operations cockpit for small firms that turns recurring deadlines into managed workflows.",
        status: {
          label: "Refined",
          tone: "success",
          agent_confidence: "medium",
          explanation: "The opportunity is clearer and more actionable.",
        },
      },
      differentiation: {
        content: "Focuses on recurring compliance operations instead of broad practice management.",
        status: {
          label: "Visible",
          tone: "success",
          agent_confidence: "medium",
          explanation: "The wedge is clearer than before.",
        },
      },
      assumptions: {
        items: ["Firms will adopt workflow help before full automation."],
      },
      open_questions: {
        items: ["Which deadlines create the most urgent pain?"],
      },
      quality_check: {
        coherence: "Problem, buyer, and wedge are aligned.",
        gaps: [],
        risks: [],
      },
    }),
  );

  assert.equal(validation.success, true);
  assert.equal(validation.data.open_questions.items.length, 1);
});

test("runIdeaRefinementPass stores a hashed deduplication fingerprint that fits bounded storage", async () => {
  const protoIdeas = new Map([
    [
      "proto-1",
      {
        id: "proto-1",
        ownerUserId: "user-1",
        sourceId: "proto-source-1",
        title: "Compliance workflow co-pilot",
        problemStatement: "Accounting teams are stuck chasing repetitive VAT reminder work.",
        targetCustomer: "Small accounting firms",
        opportunityHypothesis: "A workflow layer could help automate reminders.",
        whyItMatters: "It wastes time and causes missed deadlines.",
        opportunityType: "Workflow SaaS",
        assumptions: [],
        openQuestions: [],
        refinementStatus: "PENDING",
        refinementAttempts: 0,
        source: {
          id: "proto-source-1",
          sourceTitle: "VAT reminder pain",
          sourceUrl: "https://example.com/vat",
          sourceCapturedAt: new Date("2026-04-06T09:00:00Z"),
        },
      },
    ],
  ]);
  const createdCandidates = [];

  const prisma = {
    ideaRefinementPolicy: {
      async upsert() {
        return {
          id: "policy-1",
          profileName: "default",
          refinementDepth: "standard",
          creativityLevel: "medium",
          strictness: "balanced",
          maxConceptualToolsPerRun: 3,
          internalQualityThreshold: "standard",
        };
      },
      async update({ data }) {
        return data;
      },
    },
    protoIdea: {
      async findMany() {
        return Array.from(protoIdeas.values());
      },
      async updateMany({ where, data }) {
        Object.assign(protoIdeas.get(where.id), data);
        return { count: 1 };
      },
      async findUnique({ where }) {
        return protoIdeas.get(where.id);
      },
      async update({ where, data }) {
        Object.assign(protoIdeas.get(where.id), data);
        return protoIdeas.get(where.id);
      },
    },
    conceptualTool: {
      async findMany() {
        return [];
      },
    },
    ideaCandidate: {
      async findFirst() {
        return null;
      },
      async create({ data }) {
        createdCandidates.push(data);
        return data;
      },
    },
    agentDefinition: {
      async findMany() {
        return [{ key: "idea_refinement", name: "Idea Refinement Agent", active: true, updatedAt: new Date() }];
      },
    },
    logEntry: {
      async create({ data }) {
        return data;
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };

  const agentGatewayClient = {
    async getAdminSnapshot() {
      return { status: "online", agents: [{ key: "idea_refinement" }] };
    },
    async startRun() {
      return { id: "run-1" };
    },
    async waitForRunCompletion() {
      return {
        id: "run-1",
        status: "completed",
        normalized_output: {
          reply_to_user: { content: "ok" },
          refinement_overview: {
            improvement_summary: "Sharper customer and clearer wedge.",
            key_changes: ["Narrowed the customer", "Clarified the wedge"],
            applied_reasoning_summary: "Improved clarity and focus.",
          },
          problem_statement: {
            content: "Owner-led accounting firms lose time managing recurring compliance reminders across manual workflows.",
            status: { label: "Strong", tone: "success", agent_confidence: "high", explanation: "Specific problem." },
          },
          target_customer: {
            content: "Owner-led accounting firms with recurring monthly and quarterly compliance deadlines.",
            status: { label: "Strong", tone: "success", agent_confidence: "high", explanation: "Specific buyer." },
          },
          value_proposition: {
            content: "A workflow cockpit that automates compliance reminder sequencing and task handoffs.",
            status: { label: "Strong", tone: "success", agent_confidence: "high", explanation: "Clear value." },
          },
          opportunity_concept: {
            content: "A compliance operations cockpit for small firms that turns recurring deadlines into managed workflows.",
            status: { label: "Refined", tone: "success", agent_confidence: "medium", explanation: "Actionable concept." },
          },
          differentiation: {
            content: "Focused on recurring compliance operations instead of broad practice management.",
            status: { label: "Visible", tone: "success", agent_confidence: "medium", explanation: "Visible wedge." },
          },
          assumptions: { items: ["Firms will adopt workflow help before full automation."] },
          open_questions: { items: ["Which deadlines hurt the most?"] },
          quality_check: { coherence: "Problem, customer, and wedge align.", gaps: [], risks: [] },
        },
      };
    },
  };

  await runIdeaRefinementPass(prisma, agentGatewayClient, {
    batchSize: 1,
    ownerUserId: "user-1",
  });

  assert.equal(createdCandidates.length, 1);
  assert.match(createdCandidates[0].deduplicationFingerprint, /^[a-f0-9]{64}$/);
});

test("runIdeaRefinementPass claims an eligible proto-idea, selects tools, and persists a refined idea candidate", async () => {
  const protoIdeas = new Map([
    [
      "proto-1",
      {
        id: "proto-1",
        ownerUserId: "user-1",
        sourceId: "proto-source-1",
        title: "Compliance workflow co-pilot",
        problemStatement: "Accounting teams are stuck chasing repetitive VAT reminder work.",
        targetCustomer: "Small accounting firms",
        opportunityHypothesis: "A workflow layer could help automate reminders.",
        whyItMatters: "It wastes time and causes missed deadlines.",
        opportunityType: "Workflow SaaS",
        assumptions: [],
        openQuestions: [],
        refinementStatus: "PENDING",
        refinementAttempts: 0,
        source: {
          id: "proto-source-1",
          sourceTitle: "VAT reminder pain",
          sourceUrl: "https://example.com/vat",
          sourceCapturedAt: new Date("2026-04-06T09:00:00Z"),
        },
      },
    ],
  ]);
  const createdCandidates = [];
  const logs = [];
  let storedPolicy = {
    id: "policy-1",
    profileName: "default",
    refinementDepth: "standard",
    creativityLevel: "medium",
    strictness: "balanced",
    maxConceptualToolsPerRun: 3,
    internalQualityThreshold: "standard",
    latestRunStatus: null,
    lastRunAt: null,
    latestRunSummaryJson: null,
  };
  let capturedGatewayPayload = null;

  const prisma = {
    ideaRefinementPolicy: {
      async upsert() {
        return storedPolicy;
      },
      async update({ data }) {
        storedPolicy = { ...storedPolicy, ...data };
        return storedPolicy;
      },
    },
    protoIdea: {
      async findMany() {
        return Array.from(protoIdeas.values());
      },
      async updateMany({ where, data }) {
        const row = protoIdeas.get(where.id);
        Object.assign(row, data);
        return { count: 1 };
      },
      async findUnique({ where }) {
        return protoIdeas.get(where.id);
      },
      async update({ where, data }) {
        const row = protoIdeas.get(where.id);
        Object.assign(row, data);
        return row;
      },
    },
    conceptualTool: {
      async findMany() {
        return [
          {
            id: "tool-1",
            name: "Assumption Mapping",
            category: "diagnostic",
            purpose: "Surface assumptions",
            whenToUse: ["the idea relies on multiple unstated beliefs"],
            whenNotToUse: [],
            instructions: ["Write the hidden assumptions"],
            expectedEffect: "Clearer reasoning",
            status: "ACTIVE",
            version: 1,
          },
          {
            id: "tool-2",
            name: "Failure Analysis",
            category: "diagnostic",
            purpose: "Stress test the concept",
            whenToUse: ["the concept looks attractive but fragile"],
            whenNotToUse: [],
            instructions: ["List failure modes"],
            expectedEffect: "Stronger robustness",
            status: "ACTIVE",
            version: 1,
          },
        ];
      },
    },
    ideaCandidate: {
      async findFirst() {
        return null;
      },
      async create({ data }) {
        createdCandidates.push(data);
        return data;
      },
    },
    agentDefinition: {
      async findMany() {
        return [
          {
            key: "idea_refinement",
            name: "Idea Refinement Agent",
            active: true,
            updatedAt: new Date("2026-04-06T08:00:00Z"),
          },
        ];
      },
    },
    logEntry: {
      async create({ data }) {
        logs.push(data);
        return { id: `log-${logs.length}`, ...data };
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
        agents: [{ key: "idea_refinement" }],
      };
    },
    async startRun(payload) {
      capturedGatewayPayload = payload;
      return { id: "refine-run-1" };
    },
    async waitForRunCompletion() {
      return {
        id: "refine-run-1",
        status: "completed",
        normalized_output: {
          reply_to_user: {
            content: "Refined the proto-idea into a sharper compliance workflow candidate.",
          },
          refinement_overview: {
            improvement_summary: "Clarified the ICP, value proposition, and differentiation.",
            key_changes: ["Narrowed the customer", "Added a clearer wedge"],
            applied_reasoning_summary: "Used assumption mapping and failure analysis to tighten the concept.",
          },
          problem_statement: {
            content: "Owner-led accounting firms lose time managing recurring compliance reminders across manual workflows.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The problem is clearer and more specific.",
            },
          },
          target_customer: {
            content: "Owner-led accounting firms with recurring monthly and quarterly compliance deadlines.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The target customer is now specific enough to evaluate.",
            },
          },
          value_proposition: {
            content: "A recurring workflow cockpit that automates compliance reminder sequencing and task handoffs.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The value proposition is tangible and actionable.",
            },
          },
          opportunity_concept: {
            content: "A compliance operations cockpit for small firms that turns recurring deadlines into managed workflows.",
            status: {
              label: "Refined",
              tone: "success",
              agent_confidence: "medium",
              explanation: "The candidate is meaningfully clearer than the input.",
            },
          },
          differentiation: {
            content: "Starts with recurring compliance operations instead of generic practice-management breadth.",
            status: {
              label: "Visible",
              tone: "success",
              agent_confidence: "medium",
              explanation: "The wedge is now visible.",
            },
          },
          assumptions: {
            items: ["Firms will adopt workflow support before broader automation."],
          },
          open_questions: {
            items: ["Which deadline types create the highest recurring pain?"],
          },
          quality_check: {
            coherence: "Problem, customer, and solution wedge are aligned with no contradictions.",
            gaps: [],
            risks: ["Still needs validation on willingness to switch workflows."],
          },
        },
      };
    },
  };

  const result = await runIdeaRefinementPass(prisma, agentGatewayClient, {
    batchSize: 1,
    ownerUserId: "user-1",
  });

  assert.equal(result.completedCount, 1);
  assert.equal(result.createdCount, 1);
  assert.equal(createdCandidates.length, 1);
  assert.equal(capturedGatewayPayload.requested_agent, "idea_refinement");
  assert.equal(capturedGatewayPayload.context.refinement_policy.max_conceptual_tools_per_run, 3);
  assert.equal(createdCandidates[0].policyId, "policy-1");
  assert.deepEqual(createdCandidates[0].appliedConceptualToolIds, ["tool-1", "tool-2"]);
  assert.equal(protoIdeas.get("proto-1").refinementStatus, "COMPLETED");
  assert.equal(logs.some((entry) => entry.event === "idea_refinement_completed"), true);
});
