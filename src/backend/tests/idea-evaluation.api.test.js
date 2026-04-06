const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const request = require("supertest");

const { createApp } = require("../app/create-app");

function encodeJwtPayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function createSignedTestJwt(overrides = {}, { secret = null } = {}) {
  const header = encodeJwtPayload({ alg: secret ? "HS256" : "none", typ: "JWT" });
  const payload = encodeJwtPayload({
    userid: "api-test-user-1",
    accountId: "api-test-account-1",
    email: "api-test-user@helmos.test",
    displayName: "API Test User",
    timezone: "Europe/Paris",
    locale: "en-GB",
    isAdmin: false,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  });
  const unsigned = `${header}.${payload}`;
  const signature = secret
    ? crypto.createHmac("sha256", secret).update(unsigned).digest("base64url")
    : "signature";

  return `${unsigned}.${signature}`;
}

function withAuth(requestBuilder, overrides) {
  return requestBuilder.set("Authorization", `Bearer ${createSignedTestJwt(overrides)}`);
}

function buildSupportDelegates() {
  return {
    supportConversation: {
      findFirst: async () => null,
    },
    supportMessage: {
      findMany: async () => [],
    },
    supportTicket: {
      findMany: async () => [],
    },
    supportTicketEvent: {},
  };
}

test("GET /api/idea-foundry/evaluation/opportunities returns persisted curated opportunities", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    curatedOpportunity: {
      async findMany() {
        return [
          {
            id: "opportunity-1",
            ownerUserId: "admin-user-1",
            ideaCandidateId: "candidate-1",
            title: "Compliance workflow co-pilot",
            summary: "Promoted because the candidate is coherent and differentiated.",
            problemStatement: "Owner-led accounting firms lose time coordinating recurring compliance reminders.",
            targetCustomer: "Owner-led accounting firms with recurring compliance deadlines.",
            valueProposition: "A workflow cockpit for recurring compliance operations.",
            productServiceDescription: "A SaaS workflow layer with recurring templates and reminder orchestration.",
            differentiation: "Starts with recurring compliance operations instead of broad practice management.",
            earlyMonetizationIdea: "Monthly SaaS subscription by active workflow templates.",
            readinessLabel: "High",
            strongestAspect: "The problem-customer-value triangle is coherent.",
            biggestRisk: "Adoption may still require workflow-change support.",
            blockingIssue: "",
            duplicateRiskLabel: "Low",
            duplicateRiskExplanation: "No close overlap is visible.",
            nextBestAction: "Promote it into Curated Opportunities.",
            promotionReason: "The idea is decision-ready for downstream strategy work.",
            tagsJson: {
              industry: ["accounting_software"],
            },
            evaluationPayloadJson: {
              evaluation_summary: {
                recommended_action: "promote",
              },
            },
            promotedAt: new Date("2026-04-06T11:00:00Z"),
            createdAt: new Date("2026-04-06T11:00:00Z"),
            updatedAt: new Date("2026-04-06T11:00:00Z"),
            ideaCandidate: {
              id: "candidate-1",
              protoIdeaId: "proto-1",
              protoIdea: {
                title: "Compliance workflow co-pilot",
              },
            },
          },
        ];
      },
    },
    ...buildSupportDelegates(),
  };

  const app = createApp({ prisma, agentGatewayClient: {} });
  const response = await withAuth(
    request(app).get("/api/idea-foundry/evaluation/opportunities"),
    { isAdmin: true, email: "ralfepoisson@gmail.com" }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].title, "Compliance workflow co-pilot");
  assert.equal(response.body.data[0].readinessLabel, "High");
});

test("POST /api/idea-foundry/evaluation/run executes the idea evaluation agent and promotes a candidate", async () => {
  const candidates = new Map([
    [
      "candidate-1",
      {
        id: "candidate-1",
        ownerUserId: "admin-user-1",
        protoIdeaId: "proto-1",
        problemStatement: "Owner-led accounting firms lose time coordinating recurring compliance reminders.",
        targetCustomer: "Owner-led accounting firms with recurring compliance deadlines.",
        valueProposition: "A workflow cockpit for recurring compliance operations.",
        opportunityConcept: "A compliance workflow cockpit for small accounting firms.",
        differentiation: "Starts with recurring compliance operations instead of broad practice management.",
        assumptions: [],
        openQuestions: [],
        improvementSummary: "Sharper customer and wedge definition.",
        keyChanges: [],
        appliedReasoningSummary: "Used assumption mapping.",
        appliedConceptualToolIds: ["tool-1"],
        qualityCheckCoherence: "Problem, customer, and wedge are aligned.",
        qualityCheckGaps: [],
        qualityCheckRisks: [],
        statusLabel: "Refined",
        statusTone: "success",
        agentConfidence: "medium",
        statusExplanation: "The candidate is clearer and more actionable.",
        refinementIteration: 1,
        workflowState: "AWAITING_EVALUATION",
        evaluationStatus: "PENDING",
        evaluationAttempts: 0,
        protoIdea: {
          id: "proto-1",
          title: "Compliance workflow co-pilot",
          sourceId: "proto-source-1",
          source: {
            sourceTitle: "VAT reminder pain",
          },
        },
      },
    ],
  ]);
  const createdOpportunities = [];
  let capturedGatewayPayload = null;

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    ideaCandidate: {
      async findMany() {
        return Array.from(candidates.values());
      },
      async updateMany({ where, data }) {
        Object.assign(candidates.get(where.id), data);
        return { count: 1 };
      },
      async findUnique({ where }) {
        return candidates.get(where.id);
      },
      async update({ where, data }) {
        Object.assign(candidates.get(where.id), data);
        return candidates.get(where.id);
      },
    },
    curatedOpportunity: {
      async findMany() {
        return createdOpportunities;
      },
      async findUnique() {
        return null;
      },
      async create({ data }) {
        createdOpportunities.push(data);
        return data;
      },
    },
    agentDefinition: {
      async findMany() {
        return [
          {
            key: "idea_evaluation",
            name: "Idea Evaluation Agent",
            active: true,
            updatedAt: new Date("2026-04-06T10:00:00Z"),
          },
        ];
      },
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
    ...buildSupportDelegates(),
    async $transaction(callback) {
      return callback(this);
    },
  };

  const agentGatewayClient = {
    async getAdminSnapshot() {
      return {
        status: "online",
        agents: [{ key: "idea_evaluation" }],
      };
    },
    async startRun(payload) {
      capturedGatewayPayload = payload;
      return { id: "evaluate-run-1" };
    },
    async waitForRunCompletion() {
      return {
        id: "evaluate-run-1",
        status: "completed",
        normalized_output: {
          reply_to_user: {
            content: "This candidate is strong enough to promote into Curated Opportunities.",
          },
          evaluation_overview: {
            decision: {
              label: "Promote",
              tone: "success",
              reason: "The problem, buyer, value proposition, and wedge are coherent and decision-ready.",
              next_best_action: "Promote it into Curated Opportunities.",
            },
            readiness: {
              label: "High",
              reason: "The candidate is specific enough for downstream strategy work.",
            },
          },
          problem_statement: {
            content: "Owner-led accounting firms lose time coordinating recurring compliance reminders.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The pain is specific and commercially relevant.",
            },
          },
          target_customer: {
            content: "Owner-led accounting firms with recurring compliance deadlines.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The customer is concrete enough for customer discovery.",
            },
          },
          value_proposition: {
            content: "A workflow cockpit that turns recurring compliance work into managed operational templates.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The benefit is easy to understand.",
            },
          },
          product_service_description: {
            content: "A SaaS workflow layer with deadline templates, reminders, and task handoffs for small firms.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "medium",
              explanation: "The product shape is clear at the right level of detail.",
            },
          },
          differentiation: {
            content: "Starts from recurring compliance operations instead of broad practice-management breadth.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "medium",
              explanation: "The wedge is commercially meaningful.",
            },
          },
          early_monetization_idea: {
            content: "Monthly SaaS subscription priced by active workflow templates and recurring deadline coverage.",
            status: {
              label: "Plausible",
              tone: "success",
              agent_confidence: "medium",
              explanation: "The payer and value exchange are both believable.",
            },
          },
          tags: {
            industry: ["accounting_software"],
            capability: ["workflow_automation"],
            customer_type: ["small_accounting_firms"],
            problem_type: ["recurring_compliance_operations"],
            solution_pattern: ["workflow_cockpit"],
            business_model: ["saas_subscription"],
          },
          evaluation_summary: {
            strongest_aspect: "The problem-customer-value triangle is coherent.",
            biggest_risk: "Adoption still depends on workflow-change willingness.",
            blocking_issue: "",
            recommended_action: "promote",
            recommended_action_reason: "The candidate is strong enough to justify downstream strategy work.",
            duplicate_risk: {
              label: "Low",
              explanation: "No strong overlap is visible against the provided curated opportunities.",
            },
          },
        },
      };
    },
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/evaluation/run")
      .send({ batchSize: 1 }),
    { isAdmin: true, email: "ralfepoisson@gmail.com" }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(capturedGatewayPayload.requested_agent, "idea_evaluation");
  assert.equal(response.body.data.result.completedCount, 1);
  assert.equal(response.body.data.result.promotedCount, 1);
  assert.equal(createdOpportunities.length, 1);
  assert.equal(response.body.data.opportunities.length, 1);
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "idea_evaluation_agent_run_completed"),
    true
  );
});
