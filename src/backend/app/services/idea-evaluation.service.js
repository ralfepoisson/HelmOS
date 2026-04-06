const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { z } = require("zod");

const { createLogEntry } = require("./log-entry.service");

const IDEA_EVALUATION_AGENT_KEY_CANDIDATES = [
  "idea-evaluation",
  "idea_evaluation",
  "idea-evaluation-agent",
  "idea_evaluation_agent",
];
const DEFAULT_BATCH_SIZE = 1;
const MAX_VALIDATION_ATTEMPTS = 2;
const DEFAULT_AGENT_IDENTITY_PATH = path.resolve(
  __dirname,
  "../../../../docs/agents/idea_evaluation_agent.md",
);
const DEFAULT_RUNTIME_RESULT = Object.freeze({
  processedCount: 0,
  completedCount: 0,
  failedCount: 0,
  skippedCount: 0,
  selectedIdeaCandidateIds: [],
  promotedCount: 0,
  refinedCount: 0,
  rejectedCount: 0,
  opportunityCount: 0,
});

const statusSchema = z.object({
  label: z.string(),
  tone: z.string(),
  agent_confidence: z.string(),
  explanation: z.string(),
});

const ideaEvaluationOutputSchema = z
  .object({
    reply_to_user: z.object({
      content: z.string(),
    }),
    evaluation_overview: z.object({
      decision: z.object({
        label: z.string(),
        tone: z.string(),
        reason: z.string(),
        next_best_action: z.string(),
      }),
      readiness: z.object({
        label: z.string(),
        reason: z.string(),
      }),
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
    product_service_description: z.object({
      content: z.string(),
      status: statusSchema,
    }),
    differentiation: z.object({
      content: z.string(),
      status: statusSchema,
    }),
    early_monetization_idea: z.object({
      content: z.string(),
      status: statusSchema,
    }),
    tags: z.object({
      industry: z.array(z.string()),
      capability: z.array(z.string()),
      customer_type: z.array(z.string()),
      problem_type: z.array(z.string()),
      solution_pattern: z.array(z.string()),
      business_model: z.array(z.string()),
    }),
    evaluation_summary: z.object({
      strongest_aspect: z.string(),
      biggest_risk: z.string(),
      blocking_issue: z.string(),
      recommended_action: z.string(),
      recommended_action_reason: z.string(),
      duplicate_risk: z.object({
        label: z.string(),
        explanation: z.string(),
      }),
    }),
  })
  .passthrough();

/**
 * @typedef {"promote" | "refine" | "reject"} IdeaEvaluationDecision
 */

/**
 * @typedef {"AWAITING_EVALUATION" | "NEEDS_REFINEMENT" | "REJECTED" | "PROMOTED"} IdeaCandidateWorkflowState
 */

function loadIdeaEvaluationAgentIdentity(identityPath = DEFAULT_AGENT_IDENTITY_PATH) {
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

function toSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toDisplayLabel(value, fallback = "Unknown") {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeTagList(values) {
  return normalizeList(values)
    .map((entry) =>
      entry
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, ""),
    )
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeDuplicateRiskLabel(value) {
  const slug = toSlug(value);

  if (slug.includes("high")) {
    return "High";
  }
  if (slug.includes("medium") || slug.includes("moderate")) {
    return "Medium";
  }
  if (slug.includes("low")) {
    return "Low";
  }

  return toDisplayLabel(value, "Unknown");
}

function normalizeIdeaEvaluationDecision(decisionLabel, recommendedAction) {
  const candidates = [recommendedAction, decisionLabel]
    .map((value) => toSlug(value))
    .filter(Boolean);

  for (const value of candidates) {
    if (["promote", "promoted", "promotion_recommended", "promotion", "advance"].includes(value)) {
      return "promote";
    }
    if (
      [
        "refine",
        "needs_refinement",
        "need_refinement",
        "return_for_refinement",
        "further_refinement",
        "refinement",
        "refined_further",
      ].includes(value) ||
      value.includes("refine")
    ) {
      return "refine";
    }
    if (["reject", "rejected", "do_not_advance", "close_out", "close", "discard"].includes(value)) {
      return "reject";
    }
  }

  return null;
}

function mapDecisionToWorkflowState(decision) {
  switch (decision) {
    case "promote":
      return "PROMOTED";
    case "refine":
      return "NEEDS_REFINEMENT";
    case "reject":
      return "REJECTED";
    default:
      return "AWAITING_EVALUATION";
  }
}

function buildIdeaEvaluationPrompt(
  ideaCandidate,
  curatedOpportunities = [],
  agentIdentityMarkdown = loadIdeaEvaluationAgentIdentity(),
) {
  const candidateContext = {
    id: ideaCandidate?.id ?? null,
    proto_idea_id: ideaCandidate?.protoIdeaId ?? null,
    proto_idea_title: ideaCandidate?.protoIdea?.title ?? null,
    source_title: ideaCandidate?.protoIdea?.source?.sourceTitle ?? null,
    problem_statement: ideaCandidate?.problemStatement ?? "",
    target_customer: ideaCandidate?.targetCustomer ?? "",
    value_proposition: ideaCandidate?.valueProposition ?? "",
    opportunity_concept: ideaCandidate?.opportunityConcept ?? "",
    differentiation: ideaCandidate?.differentiation ?? "",
    assumptions: normalizeList(ideaCandidate?.assumptions),
    open_questions: normalizeList(ideaCandidate?.openQuestions),
    improvement_summary: ideaCandidate?.improvementSummary ?? "",
    applied_reasoning_summary: ideaCandidate?.appliedReasoningSummary ?? "",
    quality_check: {
      coherence: ideaCandidate?.qualityCheckCoherence ?? "",
      gaps: normalizeList(ideaCandidate?.qualityCheckGaps),
      risks: normalizeList(ideaCandidate?.qualityCheckRisks),
    },
    refinement_status: {
      label: ideaCandidate?.statusLabel ?? "",
      tone: ideaCandidate?.statusTone ?? "",
      agent_confidence: ideaCandidate?.agentConfidence ?? "",
      explanation: ideaCandidate?.statusExplanation ?? "",
    },
  };

  const duplicateCheckContext = (Array.isArray(curatedOpportunities) ? curatedOpportunities : []).map((entry) => ({
    id: entry?.id ?? null,
    title: entry?.title ?? null,
    value_proposition: entry?.valueProposition ?? null,
    target_customer: entry?.targetCustomer ?? null,
    product_service_description: entry?.productServiceDescription ?? null,
    differentiation: entry?.differentiation ?? null,
  }));

  return [
    "Use the following Idea Evaluation Agent identity and evaluation contract as the basis for this task.",
    "Return JSON only.",
    "",
    agentIdentityMarkdown.trim(),
    "",
    "Evaluate exactly one refined idea candidate.",
    "Be strict: this is the final quality gate before downstream strategy work.",
    "If the idea is not ready, identify the single highest-impact blocker and the minimum next action.",
    "",
    "Idea candidate payload:",
    JSON.stringify(candidateContext, null, 2),
    "",
    "Existing curated opportunities for duplicate checking:",
    JSON.stringify(duplicateCheckContext, null, 2),
  ].join("\n");
}

function buildIdeaEvaluationRepairPrompt(basePrompt, validationIssues = [], rawCandidate = null) {
  return [
    basePrompt,
    "",
    "The previous response did not satisfy the required JSON contract.",
    "Return only a corrected JSON object that matches the exact schema from the agent identity.",
    "",
    "Validation issues from the previous attempt:",
    JSON.stringify(validationIssues, null, 2),
    "",
    "Previous raw output:",
    typeof rawCandidate === "string" ? rawCandidate : JSON.stringify(rawCandidate ?? null, null, 2),
  ].join("\n");
}

function parseIdeaEvaluationCandidate(output) {
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
          message: "Output must be a JSON object matching the idea evaluation schema.",
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

function validateIdeaEvaluationOutput(output) {
  const parsed = parseIdeaEvaluationCandidate(output);
  if (!parsed.success) {
    return parsed;
  }

  const validation = ideaEvaluationOutputSchema.safeParse(parsed.rawCandidate);
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
    ["reply_to_user", "content"],
    ["evaluation_overview", "decision", "label"],
    ["evaluation_overview", "decision", "reason"],
    ["evaluation_overview", "decision", "next_best_action"],
    ["evaluation_overview", "readiness", "label"],
    ["evaluation_overview", "readiness", "reason"],
    ["problem_statement", "content"],
    ["target_customer", "content"],
    ["value_proposition", "content"],
    ["product_service_description", "content"],
    ["differentiation", "content"],
    ["early_monetization_idea", "content"],
    ["evaluation_summary", "strongest_aspect"],
    ["evaluation_summary", "biggest_risk"],
    ["evaluation_summary", "recommended_action"],
    ["evaluation_summary", "recommended_action_reason"],
    ["evaluation_summary", "duplicate_risk", "label"],
    ["evaluation_summary", "duplicate_risk", "explanation"],
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

  const normalizedDecisionFromLabel = normalizeIdeaEvaluationDecision(
    validation.data.evaluation_overview?.decision?.label,
    null,
  );
  const normalizedDecisionFromAction = normalizeIdeaEvaluationDecision(
    null,
    validation.data.evaluation_summary?.recommended_action,
  );
  const normalizedDecision = normalizeIdeaEvaluationDecision(
    validation.data.evaluation_overview?.decision?.label,
    validation.data.evaluation_summary?.recommended_action,
  );

  if (!normalizedDecision) {
    return {
      success: false,
      issues: [
        {
          path: "evaluation_summary.recommended_action",
          message: "The evaluation decision must normalize to promote, refine, or reject.",
        },
      ],
      rawCandidate: parsed.rawCandidate,
    };
  }

  if (
    normalizedDecisionFromLabel &&
    normalizedDecisionFromAction &&
    normalizedDecisionFromLabel !== normalizedDecisionFromAction
  ) {
    return {
      success: false,
      issues: [
        {
          path: "evaluation_overview.decision.label",
          message: "The decision label and recommended action disagree.",
        },
      ],
      rawCandidate: parsed.rawCandidate,
    };
  }

  return {
    success: true,
    rawCandidate: parsed.rawCandidate,
    data: {
      ...validation.data,
      evaluation_overview: {
        ...validation.data.evaluation_overview,
        decision: {
          ...validation.data.evaluation_overview.decision,
          label: toDisplayLabel(validation.data.evaluation_overview.decision.label),
        },
        readiness: {
          ...validation.data.evaluation_overview.readiness,
          label: toDisplayLabel(validation.data.evaluation_overview.readiness.label),
        },
      },
      tags: {
        industry: normalizeTagList(validation.data.tags.industry),
        capability: normalizeTagList(validation.data.tags.capability),
        customer_type: normalizeTagList(validation.data.tags.customer_type),
        problem_type: normalizeTagList(validation.data.tags.problem_type),
        solution_pattern: normalizeTagList(validation.data.tags.solution_pattern),
        business_model: normalizeTagList(validation.data.tags.business_model),
      },
      evaluation_summary: {
        ...validation.data.evaluation_summary,
        recommended_action: normalizedDecision,
        duplicate_risk: {
          ...validation.data.evaluation_summary.duplicate_risk,
          label: normalizeDuplicateRiskLabel(validation.data.evaluation_summary.duplicate_risk.label),
        },
      },
      normalizedDecision,
    },
  };
}

function extractIdeaEvaluationCandidate(summary) {
  const normalized = summary?.normalized_output;
  if (!normalized || typeof normalized !== "object") {
    return normalized ?? null;
  }

  if (
    [
      "reply_to_user",
      "evaluation_overview",
      "problem_statement",
      "target_customer",
      "value_proposition",
      "product_service_description",
      "differentiation",
      "early_monetization_idea",
      "evaluation_summary",
    ].every((key) => Object.prototype.hasOwnProperty.call(normalized, key))
  ) {
    return normalized;
  }

  const rawLlmOutput = summary?.normalized_output?.debug?.raw_llm_output;
  return typeof rawLlmOutput === "string" ? rawLlmOutput : normalized;
}

function isMissingIdeaEvaluationStorageError(error) {
  return (
    error?.code === "P2021" &&
    typeof error?.message === "string" &&
    (error.message.includes("idea_candidates") || error.message.includes("curated_opportunities"))
  );
}

function isMissingIdeaEvaluationColumnError(error, columnNames = []) {
  if (error?.code !== "P2022") {
    return false;
  }

  const haystack = String(error?.meta?.column ?? error?.message ?? "");
  return columnNames.some((columnName) => haystack.includes(columnName));
}

function createIdeaEvaluationStorageUnavailableError() {
  const error = new Error(
    "Idea Evaluation storage is not available yet. Apply the latest Prisma migrations for the Idea Evaluation stage, then retry.",
  );
  error.statusCode = 503;
  return error;
}

async function resolveIdeaEvaluationAgentKey(prisma) {
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
    IDEA_EVALUATION_AGENT_KEY_CANDIDATES.includes(entry.key) ||
    (typeof entry.name === "string" && entry.name.toLowerCase().includes("idea evaluation"))
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
      event: "idea_evaluation_gateway_registry_snapshot_unavailable",
      message: "Skipped idea evaluation gateway registry alignment because the runtime snapshot was unavailable.",
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
    `The agent gateway is online but does not have the '${requestedAgent}' agent registered for idea evaluation.`,
  );
  error.statusCode = 503;
  throw error;
}

function isAwaitingEvaluation(candidate) {
  return String(candidate?.workflowState ?? "AWAITING_EVALUATION").trim().toUpperCase() === "AWAITING_EVALUATION";
}

function isEvaluationFailed(candidate) {
  return String(candidate?.evaluationStatus ?? "").trim().toUpperCase() === "FAILED";
}

function isEvaluationProcessing(candidate) {
  return String(candidate?.evaluationStatus ?? "").trim().toUpperCase() === "PROCESSING";
}

function isEvaluationEligible(candidate, options = {}) {
  if (!candidate || isEvaluationProcessing(candidate)) {
    return false;
  }

  const requestedId = typeof options.ideaCandidateId === "string" ? options.ideaCandidateId.trim() : "";
  if (requestedId && requestedId === candidate.id) {
    return true;
  }

  if (isAwaitingEvaluation(candidate)) {
    return true;
  }

  if (options.retryFailed && isEvaluationFailed(candidate)) {
    return true;
  }

  return false;
}

async function listEligibleIdeaCandidates(prisma, options = {}) {
  if (!prisma?.ideaCandidate || typeof prisma.ideaCandidate.findMany !== "function") {
    return [];
  }

  const where = {};
  if (typeof options.ownerUserId === "string" && options.ownerUserId.trim().length > 0) {
    where.ownerUserId = options.ownerUserId.trim();
  }
  if (typeof options.ideaCandidateId === "string" && options.ideaCandidateId.trim().length > 0) {
    where.id = options.ideaCandidateId.trim();
  }

  try {
    const records = await prisma.ideaCandidate.findMany({
      where,
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
        updatedAt: "asc",
      },
    });

    return records.filter((candidate) => isEvaluationEligible(candidate, options));
  } catch (error) {
    if (
      isMissingIdeaEvaluationStorageError(error) ||
      isMissingIdeaEvaluationColumnError(error, [
        "workflow_state",
        "evaluation_status",
        "evaluation_started_at",
        "evaluation_completed_at",
        "evaluation_failed_at",
        "evaluation_attempts",
        "latest_evaluation_gateway_run_id",
        "latest_evaluation_error_message",
        "latest_evaluation_error_meta",
      ])
    ) {
      throw createIdeaEvaluationStorageUnavailableError();
    }
    throw error;
  }
}

async function claimIdeaCandidateForEvaluation(prisma, ideaCandidate) {
  if (!prisma?.ideaCandidate || !isEvaluationEligible(ideaCandidate, { ideaCandidateId: ideaCandidate?.id })) {
    return null;
  }

  const data = {
    evaluationStatus: "PROCESSING",
    evaluationStartedAt: new Date(),
    evaluationCompletedAt: null,
    evaluationFailedAt: null,
    evaluationAttempts: Number(ideaCandidate.evaluationAttempts ?? 0) + 1,
    latestEvaluationGatewayRunId: null,
    latestEvaluationErrorMessage: null,
    latestEvaluationErrorMeta: null,
  };

  if (typeof prisma.ideaCandidate.updateMany === "function") {
    const result = await prisma.ideaCandidate.updateMany({
      where: {
        id: ideaCandidate.id,
      },
      data,
    });
    if (result?.count !== 1) {
      return null;
    }
    if (typeof prisma.ideaCandidate.findUnique === "function") {
      return prisma.ideaCandidate.findUnique({
        where: {
          id: ideaCandidate.id,
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
      });
    }
  }

  if (typeof prisma.ideaCandidate.update === "function") {
    return prisma.ideaCandidate.update({
      where: {
        id: ideaCandidate.id,
      },
      data,
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
    });
  }

  return {
    ...ideaCandidate,
    ...data,
  };
}

async function getCuratedOpportunityPipelineContents(prisma, ownerUserId) {
  if (!prisma?.curatedOpportunity || typeof prisma.curatedOpportunity.findMany !== "function") {
    return [];
  }

  try {
    return await prisma.curatedOpportunity.findMany({
      where: {
        ...(typeof ownerUserId === "string" && ownerUserId.trim().length > 0 ? { ownerUserId: ownerUserId.trim() } : {}),
      },
      include: {
        ideaCandidate: {
          select: {
            id: true,
            protoIdeaId: true,
            protoIdea: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        promotedAt: "desc",
      },
    });
  } catch (error) {
    if (isMissingIdeaEvaluationStorageError(error)) {
      return [];
    }
    throw error;
  }
}

async function persistIdeaEvaluationSuccess({
  prisma,
  ideaCandidate,
  validation,
  gatewaySummary,
}) {
  const decision = validation.data.normalizedDecision;
  const workflowState = mapDecisionToWorkflowState(decision);
  const completedAt = new Date();
  const candidatePayload = {
    workflowState,
    evaluationStatus: "COMPLETED",
    evaluationDecision: decision.toUpperCase(),
    evaluationDecisionReason:
      validation.data.evaluation_overview.decision.reason ?? validation.data.evaluation_summary.recommended_action_reason,
    evaluationNextBestAction:
      validation.data.evaluation_overview.decision.next_best_action ?? validation.data.reply_to_user.content,
    evaluationRecommendedActionReason: validation.data.evaluation_summary.recommended_action_reason,
    evaluationReadinessLabel: validation.data.evaluation_overview.readiness.label,
    evaluationBlockingIssue: validation.data.evaluation_summary.blocking_issue ?? "",
    evaluationStrongestAspect: validation.data.evaluation_summary.strongest_aspect,
    evaluationBiggestRisk: validation.data.evaluation_summary.biggest_risk,
    evaluationDuplicateRiskLabel: validation.data.evaluation_summary.duplicate_risk.label,
    evaluationDuplicateRiskExplanation: validation.data.evaluation_summary.duplicate_risk.explanation,
    evaluationPayloadJson: validation.rawCandidate ?? validation.data,
    evaluationCompletedAt: completedAt,
    evaluationFailedAt: null,
    latestEvaluationGatewayRunId: gatewaySummary?.id ?? null,
    latestEvaluationErrorMessage: null,
    latestEvaluationErrorMeta: null,
  };

  const runInTransaction =
    typeof prisma?.$transaction === "function"
      ? (operation) => prisma.$transaction(operation)
      : async (operation) => operation(prisma);

  return runInTransaction(async (tx) => {
    const updatedCandidate =
      tx?.ideaCandidate && typeof tx.ideaCandidate.update === "function"
        ? await tx.ideaCandidate.update({
            where: {
              id: ideaCandidate.id,
            },
            data: candidatePayload,
          })
        : {
            ...ideaCandidate,
            ...candidatePayload,
          };

    let curatedOpportunityRecord = null;
    if (decision === "promote" && tx?.curatedOpportunity) {
      const existing =
        typeof tx.curatedOpportunity.findUnique === "function"
          ? await tx.curatedOpportunity.findUnique({
              where: {
                ideaCandidateId: ideaCandidate.id,
              },
            })
          : null;
      const curatedPayload = {
        ownerUserId: ideaCandidate.ownerUserId,
        ideaCandidateId: ideaCandidate.id,
        title:
          ideaCandidate.protoIdea?.title ??
          validation.data.product_service_description.content ??
          ideaCandidate.opportunityConcept,
        summary: validation.data.reply_to_user.content,
        problemStatement: validation.data.problem_statement.content,
        targetCustomer: validation.data.target_customer.content,
        valueProposition: validation.data.value_proposition.content,
        productServiceDescription: validation.data.product_service_description.content,
        differentiation: validation.data.differentiation.content,
        earlyMonetizationIdea: validation.data.early_monetization_idea.content,
        readinessLabel: validation.data.evaluation_overview.readiness.label,
        strongestAspect: validation.data.evaluation_summary.strongest_aspect,
        biggestRisk: validation.data.evaluation_summary.biggest_risk,
        blockingIssue: validation.data.evaluation_summary.blocking_issue ?? "",
        duplicateRiskLabel: validation.data.evaluation_summary.duplicate_risk.label,
        duplicateRiskExplanation: validation.data.evaluation_summary.duplicate_risk.explanation,
        nextBestAction: validation.data.evaluation_overview.decision.next_best_action,
        promotionReason: validation.data.evaluation_overview.decision.reason,
        tagsJson: validation.data.tags,
        evaluationPayloadJson: validation.rawCandidate ?? validation.data,
        promotedAt: completedAt,
      };

      if (existing && typeof tx.curatedOpportunity.update === "function") {
        curatedOpportunityRecord = await tx.curatedOpportunity.update({
          where: {
            ideaCandidateId: ideaCandidate.id,
          },
          data: curatedPayload,
        });
      } else if (typeof tx.curatedOpportunity.create === "function") {
        curatedOpportunityRecord = await tx.curatedOpportunity.create({
          data: {
            id: randomUUID(),
            ...curatedPayload,
          },
        });
      }
    }

    return {
      ideaCandidate: updatedCandidate,
      curatedOpportunity: curatedOpportunityRecord,
      workflowState,
      decision,
    };
  });
}

async function persistIdeaEvaluationFailure({
  prisma,
  ideaCandidate,
  error,
  gatewaySummary = null,
  validationIssues = [],
  rawCandidate = null,
}) {
  if (!prisma?.ideaCandidate || typeof prisma.ideaCandidate.update !== "function") {
    return;
  }

  await prisma.ideaCandidate.update({
    where: {
      id: ideaCandidate.id,
    },
    data: {
      evaluationStatus: "FAILED",
      evaluationFailedAt: new Date(),
      evaluationCompletedAt: null,
      latestEvaluationGatewayRunId: gatewaySummary?.id ?? null,
      latestEvaluationErrorMessage: error instanceof Error ? error.message : String(error),
      latestEvaluationErrorMeta: {
        validationIssues,
        rawCandidate,
      },
    },
  });
}

async function executeIdeaEvaluationWithRetries({
  prisma,
  agentGatewayClient,
  requestedAgent,
  ideaCandidate,
  curatedOpportunities,
  agentIdentityMarkdown,
}) {
  let prompt = buildIdeaEvaluationPrompt(ideaCandidate, curatedOpportunities, agentIdentityMarkdown);
  let lastValidation = null;
  let lastSummary = null;

  for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt += 1) {
    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "idea_evaluation_started",
      message: "Started idea evaluation for a candidate.",
      context: {
        ownerUserId: ideaCandidate.ownerUserId,
        ideaCandidateId: ideaCandidate.id,
        requestedAgent,
        attempt,
        promptPreview: prompt,
      },
    });

    const gatewayRun = await agentGatewayClient.startRun({
      input_text: prompt,
      request_type: "idea_evaluation",
      requested_agent: requestedAgent,
      session: {
        title: "Idea Evaluation",
        metadata: {
          module: "idea_foundry",
          feature: "idea_evaluation",
          owner_user_id: ideaCandidate.ownerUserId,
          idea_candidate_id: ideaCandidate.id,
          proto_idea_id: ideaCandidate.protoIdeaId,
        },
      },
      context: {
        idea_candidate: ideaCandidate,
        existing_curated_opportunities: curatedOpportunities,
      },
    });

    lastSummary = await agentGatewayClient.waitForRunCompletion(gatewayRun.id);
    lastValidation = validateIdeaEvaluationOutput(extractIdeaEvaluationCandidate(lastSummary));

    if (lastValidation.success) {
      return {
        validation: lastValidation,
        gatewaySummary: lastSummary,
      };
    }

    await createLogEntry(prisma, {
      level: "warn",
      scope: "idea-foundry",
      event: "idea_evaluation_validation_failed",
      message: "The idea evaluation gateway returned a non-compliant payload.",
      context: {
        ownerUserId: ideaCandidate.ownerUserId,
        ideaCandidateId: ideaCandidate.id,
        attempt,
        validationIssues: lastValidation.issues,
        rawCandidate: lastValidation.rawCandidate,
      },
    });

    if (attempt < MAX_VALIDATION_ATTEMPTS) {
      prompt = buildIdeaEvaluationRepairPrompt(prompt, lastValidation.issues, lastValidation.rawCandidate);
    }
  }

  const error = new Error(
    Array.isArray(lastValidation?.issues) && lastValidation.issues.length > 0
      ? lastValidation.issues.map((issue) => issue.message).join("; ")
      : "Idea evaluation failed validation.",
  );

  return {
    validation: lastValidation,
    gatewaySummary: lastSummary,
    error,
  };
}

async function runIdeaEvaluationPass(prisma, agentGatewayClient, options = {}) {
  const batchSize = Number.isInteger(options.batchSize)
    ? Math.max(1, Math.min(options.batchSize, 25))
    : DEFAULT_BATCH_SIZE;
  const retryFailed = Boolean(options.retryFailed);
  const ownerUserId =
    typeof options.ownerUserId === "string" && options.ownerUserId.trim().length > 0
      ? options.ownerUserId.trim()
      : null;
  const agentIdentityMarkdown = options.agentIdentityMarkdown ?? loadIdeaEvaluationAgentIdentity();
  const requestedAgent = await resolveIdeaEvaluationAgentKey(prisma);

  if (!requestedAgent) {
    const error = new Error("No active idea evaluation agent is registered in the database.");
    error.statusCode = 503;
    throw error;
  }

  const candidates = await listEligibleIdeaCandidates(prisma, {
    ownerUserId,
    ideaCandidateId: options.ideaCandidateId,
    retryFailed,
  });
  const outcome = {
    ...DEFAULT_RUNTIME_RESULT,
  };

  for (const candidate of candidates) {
    if (outcome.processedCount >= batchSize) {
      break;
    }

    const claimedIdeaCandidate = await claimIdeaCandidateForEvaluation(prisma, candidate);
    if (!claimedIdeaCandidate) {
      continue;
    }

    outcome.processedCount += 1;
    outcome.selectedIdeaCandidateIds.push(claimedIdeaCandidate.id);

    const curatedOpportunities = await getCuratedOpportunityPipelineContents(prisma, claimedIdeaCandidate.ownerUserId);

    try {
      await ensureGatewayAgentAvailable({
        prisma,
        agentGatewayClient,
        requestedAgent,
        ownerUserId: claimedIdeaCandidate.ownerUserId,
      });

      const execution = await executeIdeaEvaluationWithRetries({
        prisma,
        agentGatewayClient,
        requestedAgent,
        ideaCandidate: claimedIdeaCandidate,
        curatedOpportunities,
        agentIdentityMarkdown,
      });

      if (!execution.validation?.success) {
        await persistIdeaEvaluationFailure({
          prisma,
          ideaCandidate: claimedIdeaCandidate,
          error: execution.error,
          gatewaySummary: execution.gatewaySummary,
          validationIssues: execution.validation?.issues ?? [],
          rawCandidate: execution.validation?.rawCandidate ?? null,
        });
        outcome.failedCount += 1;
        continue;
      }

      const persistence = await persistIdeaEvaluationSuccess({
        prisma,
        ideaCandidate: claimedIdeaCandidate,
        validation: execution.validation,
        gatewaySummary: execution.gatewaySummary,
      });

      await createLogEntry(prisma, {
        level: "info",
        scope: "idea-foundry",
        event: "idea_evaluation_completed",
        message: "Completed idea evaluation for a candidate.",
        context: {
          ownerUserId: claimedIdeaCandidate.ownerUserId,
          ideaCandidateId: claimedIdeaCandidate.id,
          requestedAgent,
          decision: persistence.decision,
          workflowState: persistence.workflowState,
          curatedOpportunityId: persistence.curatedOpportunity?.id ?? null,
        },
      });

      const decisionEvent =
        persistence.decision === "promote"
          ? "idea_evaluation_promoted"
          : persistence.decision === "refine"
            ? "idea_evaluation_refine_requested"
            : "idea_evaluation_rejected";
      await createLogEntry(prisma, {
        level: persistence.decision === "reject" ? "warn" : "info",
        scope: "idea-foundry",
        event: decisionEvent,
        message: "Recorded the idea evaluation decision.",
        context: {
          ownerUserId: claimedIdeaCandidate.ownerUserId,
          ideaCandidateId: claimedIdeaCandidate.id,
          decision: persistence.decision,
          workflowState: persistence.workflowState,
          blockingIssue: execution.validation.data.evaluation_summary.blocking_issue ?? "",
          nextBestAction: execution.validation.data.evaluation_overview.decision.next_best_action,
        },
      });

      outcome.completedCount += 1;
      outcome.opportunityCount += persistence.curatedOpportunity ? 1 : 0;
      if (persistence.decision === "promote") {
        outcome.promotedCount += 1;
      } else if (persistence.decision === "refine") {
        outcome.refinedCount += 1;
      } else if (persistence.decision === "reject") {
        outcome.rejectedCount += 1;
      }
    } catch (error) {
      await createLogEntry(prisma, {
        level: "error",
        scope: "idea-foundry",
        event: "idea_evaluation_failed",
        message: "Idea evaluation failed.",
        context: {
          ownerUserId: claimedIdeaCandidate.ownerUserId,
          ideaCandidateId: claimedIdeaCandidate.id,
          requestedAgent,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      await persistIdeaEvaluationFailure({
        prisma,
        ideaCandidate: claimedIdeaCandidate,
        error,
      });
      outcome.failedCount += 1;
    }
  }

  return outcome;
}

async function runIdeaEvaluationStage(prisma, agentGatewayClient, currentUser, options = {}) {
  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "idea_evaluation_agent_run_started",
    message: "Started an Idea Evaluation agent run.",
    context: {
      actorUserId: currentUser?.id ?? null,
      ownerUserId: currentUser?.id ?? null,
      batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
      retryFailed: Boolean(options.retryFailed),
      ideaCandidateId: options.ideaCandidateId ?? null,
    },
  });

  try {
    const result = await runIdeaEvaluationPass(prisma, agentGatewayClient, {
      ...options,
      ownerUserId: currentUser?.id ?? null,
    });

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "idea_evaluation_agent_run_completed",
      message: "Completed an Idea Evaluation agent run.",
      context: {
        actorUserId: currentUser?.id ?? null,
        ownerUserId: currentUser?.id ?? null,
        result,
      },
    });

    return {
      result,
      opportunities: await getCuratedOpportunityPipelineContents(prisma, currentUser?.id ?? null),
    };
  } catch (error) {
    await createLogEntry(prisma, {
      level: "error",
      scope: "idea-foundry",
      event: "idea_evaluation_agent_run_failed",
      message: "Idea Evaluation agent run failed.",
      context: {
        actorUserId: currentUser?.id ?? null,
        ownerUserId: currentUser?.id ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

module.exports = {
  buildIdeaEvaluationPrompt,
  getCuratedOpportunityPipelineContents,
  loadIdeaEvaluationAgentIdentity,
  normalizeIdeaEvaluationDecision,
  runIdeaEvaluationPass,
  runIdeaEvaluationStage,
  validateIdeaEvaluationOutput,
};

