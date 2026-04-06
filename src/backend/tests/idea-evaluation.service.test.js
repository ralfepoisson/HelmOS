const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildIdeaEvaluationPrompt,
  normalizeIdeaEvaluationDecision,
  runIdeaEvaluationPass,
  validateIdeaEvaluationOutput,
} = require("../app/services/idea-evaluation.service");

function buildValidEvaluationOutput(overrides = {}) {
  return {
    reply_to_user: {
      content: "This candidate is strong enough to move forward.",
    },
    evaluation_overview: {
      decision: {
        label: "Promote",
        tone: "success",
        reason: "The idea is coherent, specific, and commercially plausible.",
        next_best_action: "Promote it into Curated Opportunities.",
      },
      readiness: {
        label: "High",
        reason: "The core problem, buyer, and wedge are decision-ready.",
      },
    },
    problem_statement: {
      content: "Owner-led accounting firms lose time coordinating recurring compliance reminders and handoffs.",
      status: {
        label: "Strong",
        tone: "success",
        agent_confidence: "high",
        explanation: "The problem is specific, observable, and meaningful.",
      },
    },
    target_customer: {
      content: "Owner-led accounting firms handling monthly and quarterly compliance deadlines.",
      status: {
        label: "Strong",
        tone: "success",
        agent_confidence: "high",
        explanation: "The buyer context is concrete enough for downstream work.",
      },
    },
    value_proposition: {
      content: "A compliance workflow cockpit that automates reminder sequencing and operational handoffs.",
      status: {
        label: "Strong",
        tone: "success",
        agent_confidence: "high",
        explanation: "The benefit is clear and easy to explain.",
      },
    },
    product_service_description: {
      content: "A SaaS workflow layer that structures recurring compliance work into governed templates and reminders.",
      status: {
        label: "Strong",
        tone: "success",
        agent_confidence: "medium",
        explanation: "The product is understandable without over-specifying implementation.",
      },
    },
    differentiation: {
      content: "It starts from recurring compliance operations rather than broad practice-management breadth.",
      status: {
        label: "Strong",
        tone: "success",
        agent_confidence: "medium",
        explanation: "The wedge is visible and commercially relevant.",
      },
    },
    early_monetization_idea: {
      content: "Charge firms a monthly subscription tied to active workflow templates and recurring deadline coverage.",
      status: {
        label: "Plausible",
        tone: "success",
        agent_confidence: "medium",
        explanation: "The payer, mechanism, and value exchange are believable.",
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
      strongest_aspect: "The problem-customer-value triangle is coherent and specific.",
      biggest_risk: "Switching behaviour inside firms may still take effort.",
      blocking_issue: "",
      recommended_action: "promote",
      recommended_action_reason: "The candidate is specific enough to justify downstream strategy work.",
      duplicate_risk: {
        label: "Low",
        explanation: "No strong overlap is visible against the provided curated opportunities.",
      },
    },
    ...overrides,
  };
}

function buildEvaluationCandidate(overrides = {}) {
  return {
    id: "candidate-1",
    ownerUserId: "user-1",
    protoIdeaId: "proto-1",
    problemStatement: "Small accounting firms still lose time coordinating repetitive compliance reminders.",
    targetCustomer: "Owner-led accounting firms with recurring compliance deadlines.",
    valueProposition: "A compliance operations layer that turns deadline chasing into a governed recurring workflow.",
    opportunityConcept: "A compliance workflow cockpit for small accounting firms that automates reminder sequencing and handoffs.",
    differentiation: "Starts from recurring compliance operations instead of generic practice-management breadth.",
    assumptions: ["Firms will accept workflow automation before broader bookkeeping automation."],
    openQuestions: ["Which deadlines create the most urgent recurring pain?"],
    improvementSummary: "Sharper customer definition and a clearer workflow wedge.",
    keyChanges: ["Narrowed the ICP", "Clarified the wedge"],
    appliedReasoningSummary: "Used assumption mapping and analogy transfer.",
    appliedConceptualToolIds: ["tool-1"],
    qualityCheckCoherence: "Problem, buyer, and wedge are aligned.",
    qualityCheckGaps: [],
    qualityCheckRisks: ["Still needs willingness-to-change validation."],
    statusLabel: "Refined",
    statusTone: "success",
    agentConfidence: "medium",
    statusExplanation: "The opportunity is clearer and more actionable than the proto-idea.",
    refinementIteration: 1,
    workflowState: "AWAITING_EVALUATION",
    evaluationStatus: "PENDING",
    evaluationAttempts: 0,
    createdAt: new Date("2026-04-06T09:00:00Z"),
    updatedAt: new Date("2026-04-06T09:15:00Z"),
    protoIdea: {
      id: "proto-1",
      title: "Compliance workflow co-pilot",
      sourceId: "proto-source-1",
      source: {
        sourceTitle: "VAT reminder pain",
      },
    },
    ...overrides,
  };
}

test("buildIdeaEvaluationPrompt embeds the evaluation identity, candidate, and duplicate-check context", () => {
  const prompt = buildIdeaEvaluationPrompt(
    buildEvaluationCandidate(),
    [
      {
        id: "opportunity-1",
        title: "Compliance workflow system for boutique accounting firms",
        valueProposition: "A workflow system for recurring tax reminders.",
      },
    ],
    "# Idea Evaluation Agent\n\nReturn JSON only.",
  );

  assert.match(prompt, /Idea Evaluation Agent/);
  assert.match(prompt, /Compliance workflow co-pilot/);
  assert.match(prompt, /Existing curated opportunities/);
  assert.match(prompt, /workflow system for recurring tax reminders/i);
});

test("normalizeIdeaEvaluationDecision tolerates label and action formatting variations", () => {
  assert.equal(normalizeIdeaEvaluationDecision("Promote", "promote"), "promote");
  assert.equal(normalizeIdeaEvaluationDecision("Needs refinement", "return_for_refinement"), "refine");
  assert.equal(normalizeIdeaEvaluationDecision("Reject", "REJECT"), "reject");
  assert.equal(normalizeIdeaEvaluationDecision("promotion recommended", null), "promote");
});

test("validateIdeaEvaluationOutput parses a valid promote response", () => {
  const validation = validateIdeaEvaluationOutput(JSON.stringify(buildValidEvaluationOutput()));

  assert.equal(validation.success, true);
  assert.equal(validation.data.normalizedDecision, "promote");
  assert.equal(validation.data.evaluation_summary.duplicate_risk.label, "Low");
});

test("validateIdeaEvaluationOutput parses a valid refine response", () => {
  const validation = validateIdeaEvaluationOutput(
    JSON.stringify(
      buildValidEvaluationOutput({
        evaluation_overview: {
          decision: {
            label: "Needs refinement",
            tone: "warning",
            reason: "The monetisation logic is still too weak.",
            next_best_action: "Clarify who pays first and why.",
          },
          readiness: {
            label: "Medium",
            reason: "The core idea is promising, but one blocker remains.",
          },
        },
        evaluation_summary: {
          strongest_aspect: "The buyer and workflow pain are both clear.",
          biggest_risk: "The monetisation logic is underspecified.",
          blocking_issue: "The evaluation does not yet explain who pays first and what they pay for.",
          recommended_action: "needs_refinement",
          recommended_action_reason: "Resolve the commercial mechanism before promotion.",
          duplicate_risk: {
            label: "Low",
            explanation: "No close overlap appears in the provided comparison set.",
          },
        },
      }),
    ),
  );

  assert.equal(validation.success, true);
  assert.equal(validation.data.normalizedDecision, "refine");
  assert.equal(validation.data.evaluation_summary.blocking_issue.length > 0, true);
});

test("validateIdeaEvaluationOutput parses a valid reject response", () => {
  const validation = validateIdeaEvaluationOutput(
    JSON.stringify(
      buildValidEvaluationOutput({
        evaluation_overview: {
          decision: {
            label: "Reject",
            tone: "danger",
            reason: "The opportunity is too generic and poorly differentiated.",
            next_best_action: "Do not advance this candidate.",
          },
          readiness: {
            label: "Low",
            reason: "The idea is not decision-ready.",
          },
        },
        evaluation_summary: {
          strongest_aspect: "The workflow pain is plausible.",
          biggest_risk: "The idea overlaps heavily with existing generic practice-management software.",
          blocking_issue: "The candidate lacks a convincing wedge beyond generic automation claims.",
          recommended_action: "reject",
          recommended_action_reason: "The weaknesses are fundamental rather than incremental.",
          duplicate_risk: {
            label: "High",
            explanation: "The concept is too close to an already-curated category.",
          },
        },
      }),
    ),
  );

  assert.equal(validation.success, true);
  assert.equal(validation.data.normalizedDecision, "reject");
  assert.equal(validation.data.evaluation_summary.duplicate_risk.label, "High");
});

test("validateIdeaEvaluationOutput rejects malformed JSON", () => {
  const validation = validateIdeaEvaluationOutput("{not-json");

  assert.equal(validation.success, false);
  assert.match(validation.issues[0].message, /invalid json/i);
});

test("validateIdeaEvaluationOutput rejects payloads with missing required fields", () => {
  const payload = buildValidEvaluationOutput();
  delete payload.evaluation_summary;

  const validation = validateIdeaEvaluationOutput(JSON.stringify(payload));

  assert.equal(validation.success, false);
  assert.equal(validation.issues.some((issue) => issue.path.includes("evaluation_summary")), true);
});

test("runIdeaEvaluationPass retries malformed model output and promotes a valid candidate", async () => {
  const candidate = buildEvaluationCandidate();
  const candidates = new Map([[candidate.id, { ...candidate }]]);
  const createdOpportunities = [];
  const logs = [];
  let startRunCalls = 0;

  const prisma = {
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
        return [{ key: "idea_evaluation", active: true, updatedAt: new Date() }];
      },
    },
    logEntry: {
      async create({ data }) {
        logs.push(data);
        return data;
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };

  const agentGatewayClient = {
    async getAdminSnapshot() {
      return { status: "online", agents: [{ key: "idea_evaluation" }] };
    },
    async startRun() {
      startRunCalls += 1;
      return { id: `run-${startRunCalls}` };
    },
    async waitForRunCompletion(runId) {
      if (runId === "run-1") {
        return {
          id: runId,
          status: "completed",
          normalized_output: "{not-json",
        };
      }

      return {
        id: runId,
        status: "completed",
        normalized_output: buildValidEvaluationOutput(),
      };
    },
  };

  const result = await runIdeaEvaluationPass(prisma, agentGatewayClient, {
    ownerUserId: "user-1",
    batchSize: 1,
  });

  assert.equal(startRunCalls, 2);
  assert.equal(result.completedCount, 1);
  assert.equal(result.promotedCount, 1);
  assert.equal(createdOpportunities.length, 1);
  assert.equal(candidates.get(candidate.id).workflowState, "PROMOTED");
  assert.equal(candidates.get(candidate.id).evaluationDecision, "PROMOTE");
  assert.equal(logs.some((entry) => entry.event === "idea_evaluation_validation_failed"), true);
  assert.equal(logs.some((entry) => entry.event === "idea_evaluation_promoted"), true);
});

test("runIdeaEvaluationPass records refine loop state without promoting the candidate", async () => {
  const candidate = buildEvaluationCandidate();
  const candidates = new Map([[candidate.id, { ...candidate }]]);
  const logs = [];

  const prisma = {
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
      async findUnique() {
        return null;
      },
      async create() {
        throw new Error("should not create curated opportunities when refining");
      },
    },
    agentDefinition: {
      async findMany() {
        return [{ key: "idea_evaluation", active: true, updatedAt: new Date() }];
      },
    },
    logEntry: {
      async create({ data }) {
        logs.push(data);
        return data;
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };

  const agentGatewayClient = {
    async getAdminSnapshot() {
      return { status: "online", agents: [{ key: "idea_evaluation" }] };
    },
    async startRun() {
      return { id: "run-1" };
    },
    async waitForRunCompletion() {
      return {
        id: "run-1",
        status: "completed",
        normalized_output: buildValidEvaluationOutput({
          evaluation_overview: {
            decision: {
              label: "Needs refinement",
              tone: "warning",
              reason: "The monetisation path is still too weak.",
              next_best_action: "Clarify the first payer and pricing trigger.",
            },
            readiness: {
              label: "Medium",
              reason: "The idea is promising but not promotion-ready yet.",
            },
          },
          evaluation_summary: {
            strongest_aspect: "The workflow pain is concrete.",
            biggest_risk: "The commercial path is underspecified.",
            blocking_issue: "It is not yet clear who pays first and what they pay for.",
            recommended_action: "return_for_refinement",
            recommended_action_reason: "Resolve the first monetisation wedge before promotion.",
            duplicate_risk: {
              label: "Low",
              explanation: "No close overlap is visible.",
            },
          },
        }),
      };
    },
  };

  const result = await runIdeaEvaluationPass(prisma, agentGatewayClient, {
    ownerUserId: "user-1",
    batchSize: 1,
  });

  assert.equal(result.completedCount, 1);
  assert.equal(result.refinedCount, 1);
  assert.equal(candidates.get(candidate.id).workflowState, "NEEDS_REFINEMENT");
  assert.equal(candidates.get(candidate.id).evaluationDecision, "REFINE");
  assert.equal(candidates.get(candidate.id).evaluationBlockingIssue, "It is not yet clear who pays first and what they pay for.");
  assert.equal(logs.some((entry) => entry.event === "idea_evaluation_refine_requested"), true);
});

test("runIdeaEvaluationPass records reject logic and preserves duplicate-risk output", async () => {
  const candidate = buildEvaluationCandidate();
  const candidates = new Map([[candidate.id, { ...candidate }]]);
  const logs = [];

  const prisma = {
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
      async findUnique() {
        return null;
      },
      async create() {
        throw new Error("should not create curated opportunities when rejecting");
      },
    },
    agentDefinition: {
      async findMany() {
        return [{ key: "idea_evaluation", active: true, updatedAt: new Date() }];
      },
    },
    logEntry: {
      async create({ data }) {
        logs.push(data);
        return data;
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };

  const agentGatewayClient = {
    async getAdminSnapshot() {
      return { status: "online", agents: [{ key: "idea_evaluation" }] };
    },
    async startRun() {
      return { id: "run-1" };
    },
    async waitForRunCompletion() {
      return {
        id: "run-1",
        status: "completed",
        normalized_output: buildValidEvaluationOutput({
          evaluation_overview: {
            decision: {
              label: "Reject",
              tone: "danger",
              reason: "The candidate is too generic and too close to existing workflow software.",
              next_best_action: "Do not advance this opportunity.",
            },
            readiness: {
              label: "Low",
              reason: "The idea is not differentiated enough for downstream work.",
            },
          },
          evaluation_summary: {
            strongest_aspect: "The pain is directionally plausible.",
            biggest_risk: "The concept overlaps too much with existing workflow software.",
            blocking_issue: "The candidate does not establish a meaningful wedge beyond generic automation language.",
            recommended_action: "reject",
            recommended_action_reason: "The weaknesses are fundamental rather than incremental.",
            duplicate_risk: {
              label: "High",
              explanation: "This looks materially similar to an already-curated category.",
            },
          },
        }),
      };
    },
  };

  const result = await runIdeaEvaluationPass(prisma, agentGatewayClient, {
    ownerUserId: "user-1",
    batchSize: 1,
  });

  assert.equal(result.completedCount, 1);
  assert.equal(result.rejectedCount, 1);
  assert.equal(candidates.get(candidate.id).workflowState, "REJECTED");
  assert.equal(candidates.get(candidate.id).evaluationDecision, "REJECT");
  assert.equal(candidates.get(candidate.id).evaluationDuplicateRiskLabel, "High");
  assert.equal(logs.some((entry) => entry.event === "idea_evaluation_rejected"), true);
});

