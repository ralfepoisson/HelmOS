const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { z } = require("zod");

const { createLogEntry } = require("./log-entry.service");
const { listConceptualTools } = require("./conceptual-tools.service");

const IDEA_REFINEMENT_AGENT_KEY_CANDIDATES = [
  "idea-refinement",
  "idea_refinement",
  "idea-refinement-agent",
  "idea_refinement_agent",
];
const DEFAULT_POLICY_PROFILE = "default";
const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_AGENT_IDENTITY_PATH = path.resolve(
  __dirname,
  "../../../../docs/agents/idea_refinement_agent.md",
);
const DEFAULT_REFINEMENT_POLICY = Object.freeze({
  profileName: DEFAULT_POLICY_PROFILE,
  refinementDepth: "standard",
  creativityLevel: "medium",
  strictness: "balanced",
  maxConceptualToolsPerRun: 3,
  internalQualityThreshold: "standard",
});
const DEFAULT_RUNTIME_RESULT = {
  processedCount: 0,
  completedCount: 0,
  failedCount: 0,
  skippedCount: 0,
  selectedProtoIdeaIds: [],
  createdCount: 0,
  updatedCount: 0,
  candidateCount: 0,
};
const DEFAULT_POLICY_RUNTIME = Object.freeze({
  latestRunStatus: "idle",
  lastRunAt: null,
  latestRunSummary: null,
});

const statusSchema = z.object({
  label: z.string(),
  tone: z.string(),
  agent_confidence: z.string(),
  explanation: z.string(),
});

const ideaRefinementOutputSchema = z
  .object({
    reply_to_user: z.object({
      content: z.string(),
    }),
    refinement_overview: z.object({
      improvement_summary: z.string(),
      key_changes: z.array(z.string()),
      applied_reasoning_summary: z.string(),
    }),
    problem_statement: z.object({
      content: z.string(),
      status: statusSchema,
    }),
    target_customer: z.object({
      content: z.string(),
      status: statusSchema,
    }),
    value_proposition: z.object({
      content: z.string(),
      status: statusSchema,
    }),
    opportunity_concept: z.object({
      content: z.string(),
      status: statusSchema,
    }),
    differentiation: z.object({
      content: z.string(),
      status: statusSchema,
    }),
    assumptions: z.object({
      items: z.array(z.string()),
    }),
    open_questions: z.object({
      items: z.array(z.string()),
    }),
    quality_check: z.object({
      coherence: z.string(),
      gaps: z.array(z.string()),
      risks: z.array(z.string()),
    }),
  })
  .passthrough();

const ideaRefinementPolicySchema = z.object({
  profileName: z.string().trim().min(1).default(DEFAULT_POLICY_PROFILE),
  refinementDepth: z.enum(["light", "standard", "deep"]).default("standard"),
  creativityLevel: z.enum(["low", "medium", "high"]).default("medium"),
  strictness: z.enum(["conservative", "balanced", "exploratory"]).default("balanced"),
  maxConceptualToolsPerRun: z.number().int().min(1).max(6).default(3),
  internalQualityThreshold: z.enum(["basic", "standard", "high"]).default("standard"),
});

function loadIdeaRefinementAgentIdentity(identityPath = DEFAULT_AGENT_IDENTITY_PATH) {
  try {
    return fs.readFileSync(identityPath, "utf8");
  } catch {
    return "";
  }
}

function normalizeList(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function formatTimestamp(value) {
  if (value == null || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizePolicyRecord(policy = {}) {
  const normalized = ideaRefinementPolicySchema.parse({
    profileName: policy.profileName ?? policy.profile_name ?? DEFAULT_POLICY_PROFILE,
    refinementDepth: policy.refinementDepth ?? policy.refinement_depth ?? DEFAULT_REFINEMENT_POLICY.refinementDepth,
    creativityLevel: policy.creativityLevel ?? policy.creativity_level ?? DEFAULT_REFINEMENT_POLICY.creativityLevel,
    strictness: policy.strictness ?? DEFAULT_REFINEMENT_POLICY.strictness,
    maxConceptualToolsPerRun:
      policy.maxConceptualToolsPerRun ??
      policy.max_conceptual_tools_per_run ??
      DEFAULT_REFINEMENT_POLICY.maxConceptualToolsPerRun,
    internalQualityThreshold:
      policy.internalQualityThreshold ??
      policy.internal_quality_threshold ??
      DEFAULT_REFINEMENT_POLICY.internalQualityThreshold,
  });

  return {
    id: policy.id ?? null,
    ...normalized,
    latestRunStatus: policy.latestRunStatus ?? policy.latest_run_status ?? DEFAULT_POLICY_RUNTIME.latestRunStatus,
    lastRunAt: policy.lastRunAt ?? policy.last_run_at ?? DEFAULT_POLICY_RUNTIME.lastRunAt,
    latestRunSummary:
      policy.latestRunSummary ??
      policy.latestRunSummaryJson ??
      policy.latest_run_summary_json ??
      DEFAULT_POLICY_RUNTIME.latestRunSummary,
  };
}

function buildIdeaRefinementRuntimePolicySection(policy = DEFAULT_REFINEMENT_POLICY) {
  const normalized = normalizePolicyRecord(policy);
  return {
    profile_name: normalized.profileName,
    refinement_depth: normalized.refinementDepth,
    creativity_level: normalized.creativityLevel,
    strictness: normalized.strictness,
    max_conceptual_tools_per_run: normalized.maxConceptualToolsPerRun,
    internal_quality_threshold: normalized.internalQualityThreshold,
  };
}

function buildIdeaRefinementPrompt(
  protoIdea,
  policy = DEFAULT_REFINEMENT_POLICY,
  conceptualTools = [],
  agentIdentityMarkdown = loadIdeaRefinementAgentIdentity(),
) {
  return [
    "Use the following Idea Refinement Agent identity and refinement contract as the basis for this task.",
    "Return JSON only.",
    "",
    agentIdentityMarkdown.trim(),
    "",
    "Refine exactly one proto-idea into one stronger idea candidate.",
    "Do not produce a full business plan.",
    "Preserve traceability to the input proto-idea.",
    "Apply only the runtime policy and conceptual tools provided below.",
    "",
    "Runtime refinement policy:",
    JSON.stringify(buildIdeaRefinementRuntimePolicySection(policy), null, 2),
    "",
    "Selected conceptual tools:",
    JSON.stringify(
      conceptualTools.map((tool) => ({
        id: tool.id,
        name: tool.name,
        category: tool.category,
        purpose: tool.purpose,
        when_to_use: normalizeList(tool.whenToUse),
        instructions: normalizeList(tool.instructions),
        expected_effect: tool.expectedEffect,
      })),
      null,
      2,
    ),
    "",
    "Proto-idea payload:",
    JSON.stringify(protoIdea ?? {}, null, 2),
  ].join("\n");
}

function parseIdeaRefinementCandidate(output) {
  if (typeof output === "string") {
    try {
      return {
        success: true,
        rawCandidate: JSON.parse(output),
      };
    } catch (error) {
      return {
        success: false,
        issues: [
          {
            path: "$",
            message: `Invalid JSON: ${error instanceof Error ? error.message : "unable to parse output"}`,
          },
        ],
        rawCandidate: output,
      };
    }
  }

  if (!output || typeof output !== "object") {
    return {
      success: false,
      issues: [
        {
          path: "$",
          message: "Output must be a JSON object matching the idea refinement schema.",
        },
      ],
      rawCandidate: output ?? null,
    };
  }

  return {
    success: true,
    rawCandidate: output,
  };
}

function validateIdeaRefinementOutput(output) {
  const parsed = parseIdeaRefinementCandidate(output);
  if (!parsed.success) {
    return parsed;
  }

  const validation = ideaRefinementOutputSchema.safeParse(parsed.rawCandidate);
  if (!validation.success) {
    return {
      success: false,
      issues: validation.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      rawCandidate: parsed.rawCandidate,
    };
  }

  const requiredStringPaths = [
    ["refinement_overview", "improvement_summary"],
    ["problem_statement", "content"],
    ["target_customer", "content"],
    ["value_proposition", "content"],
    ["opportunity_concept", "content"],
    ["differentiation", "content"],
    ["quality_check", "coherence"],
  ];

  const contentIssues = requiredStringPaths
    .map((pathParts) => {
      const value = pathParts.reduce((current, key) => current?.[key], validation.data);
      return typeof value === "string" && value.trim().length > 0
        ? null
        : {
            path: pathParts.join("."),
            message: "This field must be a non-empty string.",
          };
    })
    .filter(Boolean);

  if (contentIssues.length > 0) {
    return {
      success: false,
      issues: contentIssues,
      rawCandidate: parsed.rawCandidate,
    };
  }

  return {
    success: true,
    data: validation.data,
    rawCandidate: parsed.rawCandidate,
  };
}

function extractIdeaRefinementCandidate(summary) {
  const normalized = summary?.normalized_output;
  if (!normalized || typeof normalized !== "object") {
    return normalized ?? null;
  }

  if (
    [
      "reply_to_user",
      "refinement_overview",
      "problem_statement",
      "target_customer",
      "value_proposition",
      "opportunity_concept",
      "differentiation",
      "assumptions",
      "open_questions",
      "quality_check",
    ].every((key) => Object.prototype.hasOwnProperty.call(normalized, key))
  ) {
    return normalized;
  }

  const rawLlmOutput = summary?.normalized_output?.debug?.raw_llm_output;
  return typeof rawLlmOutput === "string" ? rawLlmOutput : normalized;
}

function isMissingIdeaRefinementStorageError(error) {
  return (
    error?.code === "P2021" &&
    typeof error?.message === "string" &&
    (
      error.message.includes("idea_refinement_policies") ||
      error.message.includes("idea_candidates") ||
      error.message.includes("proto_ideas")
    )
  );
}

function isMissingIdeaRefinementColumnError(error, columnNames = []) {
  if (error?.code !== "P2022") {
    return false;
  }

  const haystack = String(error?.meta?.column ?? error?.message ?? "");
  return columnNames.some((columnName) => haystack.includes(columnName));
}

function createIdeaRefinementStorageUnavailableError() {
  const error = new Error(
    "Idea Refinement storage is not available yet. Apply the latest Prisma migrations for conceptual tools and idea refinement, then retry.",
  );
  error.statusCode = 503;
  return error;
}

async function ensureIdeaRefinementPolicy(prisma) {
  const normalizedDefaults = normalizePolicyRecord(DEFAULT_REFINEMENT_POLICY);

  if (!prisma?.ideaRefinementPolicy || typeof prisma.ideaRefinementPolicy.upsert !== "function") {
    return normalizedDefaults;
  }

  try {
    const record = await prisma.ideaRefinementPolicy.upsert({
      where: {
        profileName: DEFAULT_POLICY_PROFILE,
      },
      update: {},
      create: {
        profileName: normalizedDefaults.profileName,
        refinementDepth: normalizedDefaults.refinementDepth,
        creativityLevel: normalizedDefaults.creativityLevel,
        strictness: normalizedDefaults.strictness,
        maxConceptualToolsPerRun: normalizedDefaults.maxConceptualToolsPerRun,
        internalQualityThreshold: normalizedDefaults.internalQualityThreshold,
      },
    });
    return normalizePolicyRecord(record);
  } catch (error) {
    if (isMissingIdeaRefinementStorageError(error)) {
      return normalizedDefaults;
    }
    throw error;
  }
}

function buildIdeaRefinementRuntime(policy) {
  const normalized = normalizePolicyRecord(policy);
  return {
    latestRunStatus: normalized.latestRunStatus ?? DEFAULT_POLICY_RUNTIME.latestRunStatus,
    lastRunAt: formatTimestamp(normalized.lastRunAt),
    latestRunSummary: normalized.latestRunSummary ?? null,
  };
}

async function getIdeaRefinementConfiguration(prisma) {
  const policy = await ensureIdeaRefinementPolicy(prisma);
  return {
    policy: {
      id: policy.id ?? null,
      profileName: policy.profileName,
      refinementDepth: policy.refinementDepth,
      creativityLevel: policy.creativityLevel,
      strictness: policy.strictness,
      maxConceptualToolsPerRun: policy.maxConceptualToolsPerRun,
      internalQualityThreshold: policy.internalQualityThreshold,
    },
    runtime: buildIdeaRefinementRuntime(policy),
  };
}

async function saveIdeaRefinementConfiguration(prisma, payload, currentUser = null) {
  const nextPolicy = normalizePolicyRecord(payload ?? DEFAULT_REFINEMENT_POLICY);

  if (!prisma?.ideaRefinementPolicy || typeof prisma.ideaRefinementPolicy.upsert !== "function") {
    return {
      policy: {
        id: nextPolicy.id ?? null,
        profileName: nextPolicy.profileName,
        refinementDepth: nextPolicy.refinementDepth,
        creativityLevel: nextPolicy.creativityLevel,
        strictness: nextPolicy.strictness,
        maxConceptualToolsPerRun: nextPolicy.maxConceptualToolsPerRun,
        internalQualityThreshold: nextPolicy.internalQualityThreshold,
      },
      runtime: buildIdeaRefinementRuntime(nextPolicy),
    };
  }

  const saved = await prisma.ideaRefinementPolicy.upsert({
    where: {
      profileName: nextPolicy.profileName,
    },
    update: {
      refinementDepth: nextPolicy.refinementDepth,
      creativityLevel: nextPolicy.creativityLevel,
      strictness: nextPolicy.strictness,
      maxConceptualToolsPerRun: nextPolicy.maxConceptualToolsPerRun,
      internalQualityThreshold: nextPolicy.internalQualityThreshold,
    },
    create: {
      profileName: nextPolicy.profileName,
      refinementDepth: nextPolicy.refinementDepth,
      creativityLevel: nextPolicy.creativityLevel,
      strictness: nextPolicy.strictness,
      maxConceptualToolsPerRun: nextPolicy.maxConceptualToolsPerRun,
      internalQualityThreshold: nextPolicy.internalQualityThreshold,
    },
  });

  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "idea_refinement_policy_saved",
    message: "Saved the Idea Refinement policy.",
    context: {
      actorUserId: currentUser?.id ?? null,
      policyId: saved.id,
      profileName: saved.profileName,
      refinementDepth: saved.refinementDepth,
      creativityLevel: saved.creativityLevel,
      strictness: saved.strictness,
      maxConceptualToolsPerRun: saved.maxConceptualToolsPerRun,
      internalQualityThreshold: saved.internalQualityThreshold,
    },
  });

  return {
    policy: {
      id: saved.id,
      profileName: saved.profileName,
      refinementDepth: saved.refinementDepth,
      creativityLevel: saved.creativityLevel,
      strictness: saved.strictness,
      maxConceptualToolsPerRun: saved.maxConceptualToolsPerRun,
      internalQualityThreshold: saved.internalQualityThreshold,
    },
    runtime: buildIdeaRefinementRuntime(saved),
  };
}

async function updateIdeaRefinementPolicyRuntime(prisma, policyId, data) {
  if (!policyId || !prisma?.ideaRefinementPolicy || typeof prisma.ideaRefinementPolicy.update !== "function") {
    return null;
  }

  try {
    return await prisma.ideaRefinementPolicy.update({
      where: {
        id: policyId,
      },
      data,
    });
  } catch (error) {
    if (
      isMissingIdeaRefinementStorageError(error) ||
      isMissingIdeaRefinementColumnError(error, ["latest_run_status", "last_run_at", "latest_run_summary_json"])
    ) {
      return null;
    }
    throw error;
  }
}

async function resolveIdeaRefinementAgentKey(prisma) {
  if (!prisma?.agentDefinition || typeof prisma.agentDefinition.findMany !== "function") {
    return null;
  }

  const candidates = await prisma.agentDefinition.findMany({
    where: {
      active: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  const match = candidates.find((entry) =>
    IDEA_REFINEMENT_AGENT_KEY_CANDIDATES.includes(entry.key) ||
    (typeof entry.name === "string" && entry.name.toLowerCase().includes("idea refinement"))
  );
  return match?.key ?? null;
}

async function ensureGatewayAgentAvailable({ prisma, agentGatewayClient, requestedAgent, ownerUserId }) {
  if (!agentGatewayClient || typeof agentGatewayClient.getAdminSnapshot !== "function") {
    return;
  }

  const snapshot = await agentGatewayClient.getAdminSnapshot();
  const availableAgents = Array.isArray(snapshot?.agents)
    ? snapshot.agents
        .map((agent) => (typeof agent?.key === "string" ? agent.key.trim() : ""))
        .filter(Boolean)
    : [];

  if (snapshot?.status !== "online" || availableAgents.length === 0) {
    await createLogEntry(prisma, {
      level: "warn",
      scope: "idea-foundry",
      event: "idea_refinement_gateway_registry_snapshot_unavailable",
      message: "Skipped idea refinement gateway registry alignment because the runtime snapshot was unavailable.",
      context: {
        ownerUserId,
        requestedAgent,
        gatewayStatus: snapshot?.status ?? null,
        gatewayMessage: snapshot?.message ?? null,
        availableAgents,
      },
    });
    return;
  }

  if (availableAgents.includes(requestedAgent)) {
    return;
  }

  const error = new Error(
    `The agent gateway is online but does not have the '${requestedAgent}' agent registered for idea refinement.`,
  );
  error.statusCode = 503;
  throw error;
}

function estimateWeaknesses(protoIdea = {}) {
  const hypothesis = String(protoIdea.opportunityHypothesis ?? "").trim();
  const problem = String(protoIdea.problemStatement ?? "").trim();
  const targetCustomer = String(protoIdea.targetCustomer ?? "").trim();
  const whyItMatters = String(protoIdea.whyItMatters ?? "").trim();
  const normalizedText = [protoIdea.title, hypothesis, problem, targetCustomer, whyItMatters]
    .map((entry) => String(entry ?? "").toLowerCase())
    .join(" ");

  return {
    weakDifferentiation:
      hypothesis.length < 100 ||
      /\b(platform|tool|software|dashboard|automation|workflow)\b/.test(normalizedText),
    hiddenAssumptions:
      normalizeList(protoIdea.assumptions).length <= 1 || normalizeList(protoIdea.openQuestions).length <= 1,
    fragileConcept:
      whyItMatters.length < 70 || /\bfragmented|manual|disconnect|unclear|generic|broad\b/.test(normalizedText),
    conventionalFraming:
      /\bmanual|legacy|workflow|ops|service|operations|dispatch|compliance|scheduling\b/.test(normalizedText),
  };
}

function scoreConceptualTool(tool, protoIdea, diagnosis) {
  const name = String(tool?.name ?? "").trim().toLowerCase();
  let score = 0;

  if (name === "inversion") {
    score += diagnosis.weakDifferentiation ? 4 : 0;
    score += diagnosis.conventionalFraming ? 1 : 0;
  }
  if (name === "analogy transfer") {
    score += diagnosis.weakDifferentiation ? 3 : 0;
    score += diagnosis.conventionalFraming ? 2 : 0;
  }
  if (name === "assumption mapping") {
    score += diagnosis.hiddenAssumptions ? 6 : 0;
  }
  if (name === "failure analysis") {
    score += diagnosis.fragileConcept ? 4 : 0;
    score += diagnosis.hiddenAssumptions ? 1 : 0;
  }
  if (name === "constraint removal") {
    score += diagnosis.conventionalFraming ? 4 : 0;
    score += diagnosis.weakDifferentiation ? 1 : 0;
  }

  score += normalizeList(tool.whenToUse).some((entry) => {
    const needle = entry.toLowerCase();
    return (
      (needle.includes("weak differentiation") && diagnosis.weakDifferentiation) ||
      (needle.includes("assumption") && diagnosis.hiddenAssumptions) ||
      (needle.includes("fragile") && diagnosis.fragileConcept) ||
      (needle.includes("stale") && diagnosis.conventionalFraming)
    );
  })
    ? 1
    : 0;

  score += String(protoIdea.opportunityType ?? "").toLowerCase() === "workflow saas" && name === "constraint removal" ? 1 : 0;
  return score;
}

function reportsContradiction(coherenceText) {
  const normalized = String(coherenceText ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (/\bno contradictions?\b/.test(normalized) || /\bwithout contradictions?\b/.test(normalized)) {
    return false;
  }

  return /\bcontradictions?\b/.test(normalized);
}

function selectRelevantConceptualTools(protoIdea, activeTools, policy = DEFAULT_REFINEMENT_POLICY) {
  const normalizedPolicy = normalizePolicyRecord(policy);
  const diagnosis = estimateWeaknesses(protoIdea);
  const sorted = [...(Array.isArray(activeTools) ? activeTools : [])]
    .map((tool) => ({
      tool,
      score: scoreConceptualTool(tool, protoIdea, diagnosis),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || String(left.tool.name).localeCompare(String(right.tool.name)));

  const selected = sorted.slice(0, normalizedPolicy.maxConceptualToolsPerRun).map((entry) => entry.tool);
  if (selected.length > 0) {
    return {
      diagnosis,
      selected,
    };
  }

  return {
    diagnosis,
    selected: [...(Array.isArray(activeTools) ? activeTools : [])]
      .sort((left, right) => String(left.name).localeCompare(String(right.name)))
      .slice(0, normalizedPolicy.maxConceptualToolsPerRun),
  };
}

function countPassedQualityChecks(refinement, protoIdea) {
  const checks = [
    String(refinement.problem_statement?.content ?? "").trim().length > 20,
    String(refinement.target_customer?.content ?? "").trim().length > 12,
    String(refinement.opportunity_concept?.content ?? "").trim().length > 24,
    String(refinement.differentiation?.content ?? "").trim().length > 12,
    normalizeList(refinement.assumptions?.items).length > 0,
    !reportsContradiction(refinement.quality_check?.coherence),
    String(refinement.problem_statement?.content ?? "").trim() !== String(protoIdea.problemStatement ?? "").trim(),
  ];

  return checks.filter(Boolean).length;
}

function qualityThresholdToMinimumScore(threshold) {
  switch (String(threshold ?? "").trim().toLowerCase()) {
    case "high":
      return 6;
    case "basic":
      return 4;
    default:
      return 5;
  }
}

function runInternalQualityCheck(refinement, protoIdea, policy) {
  const issues = [];
  if (String(refinement.problem_statement?.content ?? "").trim().length <= 20) {
    issues.push("Problem statement is still too thin to be useful downstream.");
  }
  if (String(refinement.target_customer?.content ?? "").trim().length <= 12) {
    issues.push("Target customer is not yet specific enough.");
  }
  if (String(refinement.opportunity_concept?.content ?? "").trim().length <= 24) {
    issues.push("Opportunity concept is still hard to understand.");
  }
  if (String(refinement.differentiation?.content ?? "").trim().length <= 12) {
    issues.push("Differentiation is missing or too weak.");
  }
  if (normalizeList(refinement.assumptions?.items).length === 0) {
    issues.push("Assumptions were not surfaced.");
  }
  if (String(refinement.problem_statement?.content ?? "").trim() === String(protoIdea.problemStatement ?? "").trim()) {
    issues.push("Refined problem statement is not meaningfully clearer than the proto-idea input.");
  }
  if (reportsContradiction(refinement.quality_check?.coherence)) {
    issues.push("The model reported coherence issues or contradictions.");
  }

  const score = countPassedQualityChecks(refinement, protoIdea);
  const minimumScore = qualityThresholdToMinimumScore(policy?.internalQualityThreshold);
  return {
    success: issues.length === 0 && score >= minimumScore,
    issues,
    score,
    minimumScore,
  };
}

function buildCandidateFingerprint(refinement) {
  const normalized = [
    refinement.problem_statement?.content,
    refinement.target_customer?.content,
    refinement.value_proposition?.content,
    refinement.opportunity_concept?.content,
    refinement.differentiation?.content,
  ]
    .map((entry) => String(entry ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");

  return createHash("sha256").update(normalized).digest("hex");
}

async function listEligibleProtoIdeas(prisma, options = {}) {
  if (!prisma?.protoIdea || typeof prisma.protoIdea.findMany !== "function") {
    return [];
  }

  const where = {};
  if (typeof options.ownerUserId === "string" && options.ownerUserId.trim().length > 0) {
    where.ownerUserId = options.ownerUserId.trim();
  }
  if (typeof options.protoIdeaId === "string" && options.protoIdeaId.trim().length > 0) {
    where.id = options.protoIdeaId.trim();
  }

  try {
    return await prisma.protoIdea.findMany({
      where,
      include: {
        source: {
          select: {
            id: true,
            sourceTitle: true,
            sourceUrl: true,
            sourceCapturedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  } catch (error) {
    if (
      isMissingIdeaRefinementStorageError(error) ||
      isMissingIdeaRefinementColumnError(error, [
        "refinement_status",
        "refinement_started_at",
        "refinement_completed_at",
        "refinement_failed_at",
        "refinement_attempts",
        "latest_refinement_policy_id",
        "latest_refinement_gateway_run_id",
        "latest_refinement_error_message",
        "latest_refinement_error_meta",
      ])
    ) {
      throw createIdeaRefinementStorageUnavailableError();
    }
    throw error;
  }
}

function isEligibleProtoIdea(protoIdea, { retryFailed = false } = {}) {
  const status = String(protoIdea?.refinementStatus ?? "PENDING").trim().toUpperCase();
  if (status === "PROCESSING") {
    return false;
  }
  if (status === "COMPLETED") {
    return false;
  }
  if (status === "FAILED" && !retryFailed) {
    return false;
  }
  return true;
}

async function claimProtoIdeaForRefinement(prisma, protoIdea, policy, options = {}) {
  if (!prisma?.protoIdea) {
    return null;
  }
  if (!isEligibleProtoIdea(protoIdea, options)) {
    return null;
  }

  const data = {
    refinementStatus: "PROCESSING",
    refinementStartedAt: new Date(),
    refinementCompletedAt: null,
    refinementFailedAt: null,
    refinementAttempts: Number(protoIdea.refinementAttempts ?? 0) + 1,
    latestRefinementPolicyId: policy?.id ?? null,
    latestRefinementGatewayRunId: null,
    latestRefinementErrorMessage: null,
    latestRefinementErrorMeta: null,
  };

  if (typeof prisma.protoIdea.updateMany === "function") {
    const result = await prisma.protoIdea.updateMany({
      where: {
        id: protoIdea.id,
      },
      data,
    });
    if (result?.count !== 1) {
      return null;
    }
    if (typeof prisma.protoIdea.findUnique === "function") {
      return prisma.protoIdea.findUnique({
        where: {
          id: protoIdea.id,
        },
        include: {
          source: {
            select: {
              id: true,
              sourceTitle: true,
              sourceUrl: true,
              sourceCapturedAt: true,
            },
          },
        },
      });
    }
  }

  if (typeof prisma.protoIdea.update === "function") {
    return prisma.protoIdea.update({
      where: {
        id: protoIdea.id,
      },
      data,
      include: {
        source: {
          select: {
            id: true,
            sourceTitle: true,
            sourceUrl: true,
            sourceCapturedAt: true,
          },
        },
      },
    });
  }

  return {
    ...protoIdea,
    ...data,
  };
}

async function loadLatestCandidate(prisma, protoIdeaId) {
  if (!prisma?.ideaCandidate || typeof prisma.ideaCandidate.findFirst !== "function") {
    return null;
  }

  try {
    return await prisma.ideaCandidate.findFirst({
      where: {
        protoIdeaId,
      },
      orderBy: {
        refinementIteration: "desc",
      },
    });
  } catch (error) {
    if (isMissingIdeaRefinementStorageError(error)) {
      return null;
    }
    throw error;
  }
}

async function persistIdeaCandidateSuccess({
  prisma,
  protoIdea,
  policy,
  selectedTools,
  validation,
  gatewaySummary,
}) {
  const fingerprint = buildCandidateFingerprint(validation.data);
  const latestCandidate = await loadLatestCandidate(prisma, protoIdea.id);
  const nextIteration = Number(latestCandidate?.refinementIteration ?? 0) + 1;
  const shouldUpdateExisting =
    latestCandidate &&
    typeof latestCandidate.deduplicationFingerprint === "string" &&
    latestCandidate.deduplicationFingerprint === fingerprint;

  const candidateStatus = validation.data.opportunity_concept?.status ?? {
    label: "Refined",
    tone: "info",
    agent_confidence: "medium",
    explanation: validation.data.refinement_overview?.improvement_summary ?? "",
  };

  const candidatePayload = {
    ownerUserId: protoIdea.ownerUserId,
    protoIdeaId: protoIdea.id,
    policyId: policy.id ?? null,
    problemStatement: validation.data.problem_statement.content,
    targetCustomer: validation.data.target_customer.content,
    valueProposition: validation.data.value_proposition.content,
    opportunityConcept: validation.data.opportunity_concept.content,
    differentiation: validation.data.differentiation.content,
    assumptions: normalizeList(validation.data.assumptions.items),
    openQuestions: normalizeList(validation.data.open_questions.items),
    improvementSummary: validation.data.refinement_overview.improvement_summary,
    keyChanges: normalizeList(validation.data.refinement_overview.key_changes),
    appliedReasoningSummary: validation.data.refinement_overview.applied_reasoning_summary,
    appliedConceptualToolIds: selectedTools.map((tool) => tool.id),
    qualityCheckCoherence: validation.data.quality_check.coherence,
    qualityCheckGaps: normalizeList(validation.data.quality_check.gaps),
    qualityCheckRisks: normalizeList(validation.data.quality_check.risks),
    statusLabel: candidateStatus.label ?? "Refined",
    statusTone: candidateStatus.tone ?? "info",
    agentConfidence: candidateStatus.agent_confidence ?? "medium",
    statusExplanation:
      candidateStatus.explanation ??
      validation.data.refinement_overview.improvement_summary ??
      validation.data.reply_to_user.content,
    refinementIteration: shouldUpdateExisting ? latestCandidate.refinementIteration : nextIteration,
    deduplicationFingerprint: fingerprint,
    rawLlmPayload: validation.rawCandidate ?? null,
  };

  const runInTransaction =
    typeof prisma?.$transaction === "function"
      ? (operation) => prisma.$transaction(operation)
      : async (operation) => operation(prisma);

  return runInTransaction(async (tx) => {
    let candidateRecord = null;

    if (shouldUpdateExisting && tx?.ideaCandidate && typeof tx.ideaCandidate.update === "function") {
      candidateRecord = await tx.ideaCandidate.update({
        where: {
          id: latestCandidate.id,
        },
        data: candidatePayload,
      });
    } else if (tx?.ideaCandidate && typeof tx.ideaCandidate.create === "function") {
      candidateRecord = await tx.ideaCandidate.create({
        data: {
          id: randomUUID(),
          ...candidatePayload,
        },
      });
    }

    if (tx?.protoIdea && typeof tx.protoIdea.update === "function") {
      await tx.protoIdea.update({
        where: {
          id: protoIdea.id,
        },
        data: {
          refinementStatus: "COMPLETED",
          refinementCompletedAt: new Date(),
          refinementFailedAt: null,
          latestRefinementPolicyId: policy.id ?? null,
          latestRefinementGatewayRunId: gatewaySummary?.id ?? null,
          latestRefinementErrorMessage: null,
          latestRefinementErrorMeta: null,
        },
      });
    }

    return {
      candidateRecord,
      created: !shouldUpdateExisting,
      updated: Boolean(shouldUpdateExisting),
    };
  });
}

async function persistIdeaRefinementFailure({
  prisma,
  protoIdea,
  error,
  gatewaySummary = null,
  validationIssues = [],
  rawCandidate = null,
  qualityIssues = [],
}) {
  if (!prisma?.protoIdea || typeof prisma.protoIdea.update !== "function") {
    return;
  }

  await prisma.protoIdea.update({
    where: {
      id: protoIdea.id,
    },
    data: {
      refinementStatus: "FAILED",
      refinementFailedAt: new Date(),
      refinementCompletedAt: null,
      latestRefinementGatewayRunId: gatewaySummary?.id ?? null,
      latestRefinementErrorMessage: error instanceof Error ? error.message : String(error),
      latestRefinementErrorMeta: {
        validationIssues,
        rawCandidate,
        qualityIssues,
      },
    },
  });
}

async function getIdeaCandidatePipelineContents(prisma, ownerUserId) {
  if (!prisma?.ideaCandidate || typeof prisma.ideaCandidate.findMany !== "function") {
    return [];
  }

  try {
    const [records, tools] = await Promise.all([
      prisma.ideaCandidate.findMany({
        where: {
          ownerUserId,
        },
        include: {
          protoIdea: {
            select: {
              id: true,
              title: true,
              sourceId: true,
              source: {
                select: {
                  sourceTitle: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),
      listConceptualTools(prisma, { status: "ACTIVE" }),
    ]);

    const toolMap = new Map(tools.map((tool) => [tool.id, tool.name]));
    return records.map((record) => ({
      ...record,
      selectedConceptualToolNames: normalizeList(record.appliedConceptualToolIds)
        .map((toolId) => toolMap.get(toolId) ?? toolId),
      protoIdeaTitle: record.protoIdea?.title ?? null,
      sourceTitle: record.protoIdea?.source?.sourceTitle ?? null,
    }));
  } catch (error) {
    if (isMissingIdeaRefinementStorageError(error)) {
      return [];
    }
    throw error;
  }
}

async function runIdeaRefinementPass(prisma, agentGatewayClient, options = {}) {
  const batchSize = Number.isInteger(options.batchSize)
    ? Math.max(1, Math.min(options.batchSize, 10))
    : DEFAULT_BATCH_SIZE;
  const retryFailed = Boolean(options.retryFailed);
  const ownerUserId =
    typeof options.ownerUserId === "string" && options.ownerUserId.trim().length > 0
      ? options.ownerUserId.trim()
      : null;
  const policy = options.policy ? normalizePolicyRecord(options.policy) : await ensureIdeaRefinementPolicy(prisma);
  const agentIdentityMarkdown = options.agentIdentityMarkdown ?? loadIdeaRefinementAgentIdentity();
  const requestedAgent = await resolveIdeaRefinementAgentKey(prisma);

  if (!requestedAgent) {
    const error = new Error("No active idea refinement agent is registered in the database.");
    error.statusCode = 503;
    throw error;
  }

  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "idea_refinement_policy_loaded",
    message: "Loaded the Idea Refinement policy.",
    context: {
      policyId: policy.id ?? null,
      profileName: policy.profileName,
      refinementDepth: policy.refinementDepth,
      creativityLevel: policy.creativityLevel,
      strictness: policy.strictness,
      maxConceptualToolsPerRun: policy.maxConceptualToolsPerRun,
      internalQualityThreshold: policy.internalQualityThreshold,
      ownerUserId,
    },
  });

  await updateIdeaRefinementPolicyRuntime(prisma, policy.id, {
    latestRunStatus: "RUNNING",
    latestRunSummaryJson: {
      startedAt: new Date().toISOString(),
      policyId: policy.id ?? null,
      policyProfileName: policy.profileName,
    },
  });

  const activeTools = await listConceptualTools(prisma, { status: "ACTIVE" });
  const candidates = await listEligibleProtoIdeas(prisma, {
    ownerUserId,
    protoIdeaId: options.protoIdeaId,
  });
  const outcome = {
    ...DEFAULT_RUNTIME_RESULT,
    policyId: policy.id ?? null,
    policyProfileName: policy.profileName,
  };

  for (const candidate of candidates) {
    if (outcome.processedCount >= batchSize) {
      break;
    }
    if (!candidate.ownerUserId) {
      outcome.skippedCount += 1;
      continue;
    }

    const claimedProtoIdea = await claimProtoIdeaForRefinement(prisma, candidate, policy, { retryFailed });
    if (!claimedProtoIdea) {
      continue;
    }

    outcome.processedCount += 1;
    outcome.selectedProtoIdeaIds.push(claimedProtoIdea.id);

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "idea_refinement_proto_idea_selected",
      message: "Selected a proto-idea for refinement.",
      context: {
        ownerUserId: claimedProtoIdea.ownerUserId,
        protoIdeaId: claimedProtoIdea.id,
        sourceId: claimedProtoIdea.sourceId,
        policyId: policy.id ?? null,
      },
    });

    const selection = selectRelevantConceptualTools(claimedProtoIdea, activeTools, policy);

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "idea_refinement_conceptual_tools_selected",
      message: "Selected conceptual tools for the idea refinement run.",
      context: {
        ownerUserId: claimedProtoIdea.ownerUserId,
        protoIdeaId: claimedProtoIdea.id,
        diagnosis: selection.diagnosis,
        selectedConceptualToolIds: selection.selected.map((tool) => tool.id),
        selectedConceptualToolNames: selection.selected.map((tool) => tool.name),
      },
    });

    let gatewayRun = null;
    let gatewaySummary = null;

    try {
      await ensureGatewayAgentAvailable({
        prisma,
        agentGatewayClient,
        requestedAgent,
        ownerUserId: claimedProtoIdea.ownerUserId,
      });

      const prompt = buildIdeaRefinementPrompt(claimedProtoIdea, policy, selection.selected, agentIdentityMarkdown);

      await createLogEntry(prisma, {
        level: "info",
        scope: "idea-foundry",
        event: "idea_refinement_started",
        message: "Started idea refinement for a proto-idea.",
        context: {
          ownerUserId: claimedProtoIdea.ownerUserId,
          protoIdeaId: claimedProtoIdea.id,
          requestedAgent,
          policyId: policy.id ?? null,
          promptPreview: prompt,
        },
      });

      gatewayRun = await agentGatewayClient.startRun({
        input_text: prompt,
        request_type: "idea_refinement",
        requested_agent: requestedAgent,
        session: {
          title: "Idea Refinement",
          metadata: {
            module: "idea_foundry",
            feature: "idea_refinement",
            owner_user_id: claimedProtoIdea.ownerUserId,
            proto_idea_id: claimedProtoIdea.id,
            proto_idea_source_id: claimedProtoIdea.sourceId,
            refinement_policy_id: policy.id ?? null,
            refinement_policy_profile: policy.profileName,
          },
        },
        context: {
          refinement_policy: buildIdeaRefinementRuntimePolicySection(policy),
          proto_idea: claimedProtoIdea,
          conceptual_tools: selection.selected,
        },
      });

      gatewaySummary = await agentGatewayClient.waitForRunCompletion(gatewayRun.id);
      const validation = validateIdeaRefinementOutput(extractIdeaRefinementCandidate(gatewaySummary));

      if (!validation.success) {
        const error = new Error(validation.issues.map((issue) => issue.message).join("; "));
        await createLogEntry(prisma, {
          level: "warn",
          scope: "idea-foundry",
          event: "idea_refinement_validation_failed",
          message: "The idea refinement gateway returned a non-compliant payload.",
          context: {
            ownerUserId: claimedProtoIdea.ownerUserId,
            protoIdeaId: claimedProtoIdea.id,
            validationIssues: validation.issues,
            rawCandidate: validation.rawCandidate,
          },
        });
        await persistIdeaRefinementFailure({
          prisma,
          protoIdea: claimedProtoIdea,
          error,
          gatewaySummary,
          validationIssues: validation.issues,
          rawCandidate: validation.rawCandidate,
        });
        outcome.failedCount += 1;
        continue;
      }

      const qualityCheck = runInternalQualityCheck(validation.data, claimedProtoIdea, policy);
      if (!qualityCheck.success) {
        const error = new Error(
          `Idea refinement failed the internal quality threshold (${qualityCheck.score}/${qualityCheck.minimumScore}).`,
        );
        await createLogEntry(prisma, {
          level: "warn",
          scope: "idea-foundry",
          event: "idea_refinement_quality_failed",
          message: "The idea refinement output failed the internal quality threshold.",
          context: {
            ownerUserId: claimedProtoIdea.ownerUserId,
            protoIdeaId: claimedProtoIdea.id,
            qualityIssues: qualityCheck.issues,
            score: qualityCheck.score,
            minimumScore: qualityCheck.minimumScore,
          },
        });
        await persistIdeaRefinementFailure({
          prisma,
          protoIdea: claimedProtoIdea,
          error,
          gatewaySummary,
          rawCandidate: validation.rawCandidate,
          qualityIssues: qualityCheck.issues,
        });
        outcome.failedCount += 1;
        continue;
      }

      const persistence = await persistIdeaCandidateSuccess({
        prisma,
        protoIdea: claimedProtoIdea,
        policy,
        selectedTools: selection.selected,
        validation,
        gatewaySummary,
      });

      await createLogEntry(prisma, {
        level: "info",
        scope: "idea-foundry",
        event: "idea_refinement_completed",
        message: "Completed idea refinement for a proto-idea.",
        context: {
          ownerUserId: claimedProtoIdea.ownerUserId,
          protoIdeaId: claimedProtoIdea.id,
          requestedAgent,
          policyId: policy.id ?? null,
          candidateId: persistence.candidateRecord?.id ?? null,
          createdCandidate: persistence.created,
          updatedCandidate: persistence.updated,
          selectedConceptualToolIds: selection.selected.map((tool) => tool.id),
        },
      });

      outcome.completedCount += 1;
      outcome.createdCount += persistence.created ? 1 : 0;
      outcome.updatedCount += persistence.updated ? 1 : 0;
      outcome.candidateCount += 1;
    } catch (error) {
      await createLogEntry(prisma, {
        level: "error",
        scope: "idea-foundry",
        event: "idea_refinement_persistence_failed",
        message: "Idea refinement failed.",
        context: {
          ownerUserId: claimedProtoIdea.ownerUserId,
          protoIdeaId: claimedProtoIdea.id,
          requestedAgent,
          policyId: policy.id ?? null,
          gatewayRunId: gatewaySummary?.id ?? gatewayRun?.id ?? null,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      await persistIdeaRefinementFailure({
        prisma,
        protoIdea: claimedProtoIdea,
        error,
        gatewaySummary,
      });
      outcome.failedCount += 1;
    }
  }

  const finalStatus = outcome.failedCount > 0 && outcome.completedCount === 0 ? "FAILED" : "COMPLETED";
  const finishedAt = new Date();
  await updateIdeaRefinementPolicyRuntime(prisma, policy.id, {
    latestRunStatus: finalStatus,
    lastRunAt: finishedAt,
    latestRunSummaryJson: {
      ...outcome,
      finishedAt: finishedAt.toISOString(),
      latestRunStatus: finalStatus,
    },
  });

  return outcome;
}

async function runIdeaRefinementStage(prisma, agentGatewayClient, currentUser, options = {}) {
  const policy = await ensureIdeaRefinementPolicy(prisma);

  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "idea_refinement_agent_run_started",
    message: "Started an Idea Refinement agent run.",
    context: {
      actorUserId: currentUser?.id ?? null,
      policyId: policy.id ?? null,
      profileName: policy.profileName,
      batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
      retryFailed: Boolean(options.retryFailed),
      protoIdeaId: options.protoIdeaId ?? null,
      ownerUserId: currentUser?.id ?? null,
    },
  });

  try {
    const result = await runIdeaRefinementPass(prisma, agentGatewayClient, {
      ...options,
      policy,
      ownerUserId: currentUser?.id ?? null,
    });
    const refreshed = await getIdeaRefinementConfiguration(prisma);

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "idea_refinement_agent_run_completed",
      message: "Completed an Idea Refinement agent run.",
      context: {
        actorUserId: currentUser?.id ?? null,
        policyId: refreshed.policy.id ?? null,
        latestRunStatus: refreshed.runtime.latestRunStatus,
        latestRunSummary: refreshed.runtime.latestRunSummary,
      },
    });

    return {
      ...refreshed,
      result,
    };
  } catch (error) {
    await updateIdeaRefinementPolicyRuntime(prisma, policy.id, {
      latestRunStatus: "FAILED",
      lastRunAt: new Date(),
      latestRunSummaryJson: {
        error: error instanceof Error ? error.message : String(error),
        policyId: policy.id ?? null,
        policyProfileName: policy.profileName,
      },
    });

    await createLogEntry(prisma, {
      level: "error",
      scope: "idea-foundry",
      event: "idea_refinement_agent_run_failed",
      message: "Idea Refinement agent run failed.",
      context: {
        actorUserId: currentUser?.id ?? null,
        policyId: policy.id ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

module.exports = {
  buildIdeaRefinementPrompt,
  getIdeaCandidatePipelineContents,
  getIdeaRefinementConfiguration,
  loadIdeaRefinementAgentIdentity,
  runIdeaRefinementPass,
  runIdeaRefinementStage,
  saveIdeaRefinementConfiguration,
  selectRelevantConceptualTools,
  validateIdeaRefinementOutput,
};
