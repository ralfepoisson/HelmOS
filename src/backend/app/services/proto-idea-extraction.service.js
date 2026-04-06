const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { z } = require("zod");

const { createLogEntry } = require("./log-entry.service");

const PROTO_IDEA_AGENT_KEY_CANDIDATES = [
  "proto-idea",
  "proto_idea",
  "proto-idea-agent",
  "proto_idea_agent",
];
const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_AGENT_IDENTITY_PATH = path.resolve(
  __dirname,
  "../../../../docs/agents/proto-idea_agent.md",
);
const DEFAULT_POLICY_PROFILE = "default";
const DEFAULT_EXTRACTION_POLICY = Object.freeze({
  profileName: DEFAULT_POLICY_PROFILE,
  extractionBreadth: "standard",
  inferenceTolerance: "balanced",
  noveltyBias: "balanced",
  minimumSignalThreshold: "medium",
  maxProtoIdeasPerSource: 4,
});
const DEFAULT_RUNTIME_RESULT = {
  processedCount: 0,
  completedCount: 0,
  failedCount: 0,
  skippedCount: 0,
  selectedSourceIds: [],
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

const protoIdeaExtractionSchema = z
  .object({
    reply_to_user: z.object({
      content: z.string(),
    }),
    source_analysis: z.object({
      source_id: z.string(),
      source_type: z.string(),
      source_title: z.string(),
      summary: z.string(),
      primary_signals: z.array(z.string()),
      observed_problems_or_needs: z.array(z.string()),
      inferred_patterns: z.array(z.string()),
      overall_signal_strength: statusSchema,
    }),
    proto_idea_overview: z.object({
      extraction_readiness: z.object({
        label: z.string(),
        reason: z.string(),
        next_best_action: z.string(),
      }),
      extraction_notes: z.string(),
    }),
    proto_ideas: z.array(
      z.object({
        proto_idea_id: z.string(),
        title: z.string(),
        source_grounding: z.object({
          explicit_signals: z.array(z.string()),
          inferred_from_source: z.array(z.string()),
        }),
        problem_statement: z.string(),
        target_customer: z.string(),
        opportunity_hypothesis: z.string(),
        why_it_matters: z.string(),
        opportunity_type: z.string(),
        assumptions: z.array(z.string()),
        open_questions: z.array(z.string()),
        status: statusSchema,
        ui_hints: z.object({
          highlight: z.boolean(),
          needs_attention: z.boolean(),
        }),
      }),
    ),
    deduplication_notes: z.object({
      potential_overlap_detected: z.boolean(),
      explanation: z.string(),
    }),
  })
  .passthrough();

const protoIdeaExtractionPolicySchema = z.object({
  profileName: z.string().trim().min(1).default(DEFAULT_POLICY_PROFILE),
  extractionBreadth: z.enum(["conservative", "standard", "expansive"]).default("standard"),
  inferenceTolerance: z.enum(["strict_grounding", "balanced", "exploratory"]).default("balanced"),
  noveltyBias: z.enum(["pragmatic", "balanced", "exploratory"]).default("balanced"),
  minimumSignalThreshold: z.enum(["low", "medium", "high"]).default("medium"),
  maxProtoIdeasPerSource: z.number().int().min(1).max(12).default(4),
});

function loadProtoIdeaAgentIdentity(identityPath = DEFAULT_AGENT_IDENTITY_PATH) {
  try {
    return fs.readFileSync(identityPath, "utf8");
  } catch {
    return "";
  }
}

function toPolicyOptionLabel(value) {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "strict_grounding":
      return "Strict grounding";
    case "conservative":
      return "Conservative";
    case "expansive":
      return "Expansive";
    case "pragmatic":
      return "Pragmatic";
    case "exploratory":
      return "Exploratory";
    case "low":
      return "Low";
    case "high":
      return "High";
    default:
      return "Balanced";
  }
}

function normalizePolicyRecord(policy = {}) {
  const normalized = protoIdeaExtractionPolicySchema.parse({
    profileName: policy.profileName ?? policy.profile_name ?? DEFAULT_POLICY_PROFILE,
    extractionBreadth: policy.extractionBreadth ?? policy.extraction_breadth ?? DEFAULT_EXTRACTION_POLICY.extractionBreadth,
    inferenceTolerance:
      policy.inferenceTolerance ??
      policy.inference_tolerance ??
      DEFAULT_EXTRACTION_POLICY.inferenceTolerance,
    noveltyBias: policy.noveltyBias ?? policy.novelty_bias ?? DEFAULT_EXTRACTION_POLICY.noveltyBias,
    minimumSignalThreshold:
      policy.minimumSignalThreshold ??
      policy.minimum_signal_threshold ??
      DEFAULT_EXTRACTION_POLICY.minimumSignalThreshold,
    maxProtoIdeasPerSource:
      policy.maxProtoIdeasPerSource ??
      policy.max_proto_ideas_per_source ??
      DEFAULT_EXTRACTION_POLICY.maxProtoIdeasPerSource,
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

function buildProtoIdeaRuntimePolicySection(policy = DEFAULT_EXTRACTION_POLICY) {
  const normalizedPolicy = normalizePolicyRecord(policy);
  return {
    profile_name: normalizedPolicy.profileName,
    extraction_breadth: normalizedPolicy.extractionBreadth,
    extraction_breadth_guidance: toPolicyOptionLabel(normalizedPolicy.extractionBreadth),
    inference_tolerance: normalizedPolicy.inferenceTolerance,
    inference_tolerance_guidance: toPolicyOptionLabel(normalizedPolicy.inferenceTolerance),
    novelty_bias: normalizedPolicy.noveltyBias,
    novelty_bias_guidance: toPolicyOptionLabel(normalizedPolicy.noveltyBias),
    minimum_signal_threshold: normalizedPolicy.minimumSignalThreshold,
    minimum_signal_threshold_guidance: toPolicyOptionLabel(normalizedPolicy.minimumSignalThreshold),
    max_proto_ideas_per_source: normalizedPolicy.maxProtoIdeasPerSource,
  };
}

function buildProtoIdeaExtractionPrompt(
  sourceRecord,
  policy = DEFAULT_EXTRACTION_POLICY,
  agentIdentityMarkdown = loadProtoIdeaAgentIdentity(),
) {
  return [
    "Use the following Proto-Idea Agent identity and extraction contract as the basis for this task.",
    "Return JSON only.",
    "",
    agentIdentityMarkdown.trim(),
    "",
    "Process exactly one normalized source artefact.",
    "Preserve the difference between explicit signals and inferred signals.",
    "Do not collapse multiple grounded proto-ideas into one generic answer.",
    "Apply the runtime extraction policy below without rewriting the core agent identity.",
    "",
    "Runtime extraction policy:",
    JSON.stringify(buildProtoIdeaRuntimePolicySection(policy), null, 2),
    "",
    "Source artefact:",
    JSON.stringify(sourceRecord ?? {}, null, 2),
  ].join("\n");
}

function extractProtoIdeaCandidate(summary) {
  const normalized = summary?.normalized_output;

  if (!normalized || typeof normalized !== "object") {
    return normalized ?? null;
  }

  if (looksLikeProtoIdeaPayload(normalized)) {
    return normalized;
  }

  const rawLlmOutput = extractRawLlmOutputFromGatewaySummary(summary);
  if (typeof rawLlmOutput === "string" && rawLlmOutput.trim()) {
    return rawLlmOutput;
  }

  return normalized;
}

function extractRawLlmOutputFromGatewaySummary(summary) {
  const candidate = summary?.normalized_output?.debug?.raw_llm_output;
  return typeof candidate === "string" ? candidate : null;
}

function looksLikeProtoIdeaPayload(output) {
  if (!output || typeof output !== "object") {
    return false;
  }

  return [
    "reply_to_user",
    "source_analysis",
    "proto_idea_overview",
    "proto_ideas",
    "deduplication_notes",
  ].every((key) => Object.prototype.hasOwnProperty.call(output, key));
}

function parseProtoIdeaExtractionCandidate(output) {
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
          message: "Output must be a JSON object matching the proto-idea extraction schema.",
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

function validateProtoIdeaExtractionOutput(output) {
  const parsed = parseProtoIdeaExtractionCandidate(output);
  if (!parsed.success) {
    return parsed;
  }

  const validation = protoIdeaExtractionSchema.safeParse(parsed.rawCandidate);
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

  return {
    success: true,
    data: validation.data,
    rawCandidate: parsed.rawCandidate,
  };
}

async function ensureProtoIdeaExtractionPolicy(prisma) {
  const normalizedDefaults = normalizePolicyRecord(DEFAULT_EXTRACTION_POLICY);

  if (!prisma?.protoIdeaExtractionPolicy || typeof prisma.protoIdeaExtractionPolicy.upsert !== "function") {
    return normalizedDefaults;
  }

  try {
    const record = await prisma.protoIdeaExtractionPolicy.upsert({
      where: {
        profileName: DEFAULT_POLICY_PROFILE,
      },
      update: {},
      create: {
        profileName: normalizedDefaults.profileName,
        extractionBreadth: normalizedDefaults.extractionBreadth,
        inferenceTolerance: normalizedDefaults.inferenceTolerance,
        noveltyBias: normalizedDefaults.noveltyBias,
        minimumSignalThreshold: normalizedDefaults.minimumSignalThreshold,
        maxProtoIdeasPerSource: normalizedDefaults.maxProtoIdeasPerSource,
      },
    });

    return normalizePolicyRecord(record);
  } catch (error) {
    if (isMissingProtoIdeaStorageError(error)) {
      return normalizedDefaults;
    }
    throw error;
  }
}

function buildProtoIdeaExtractionRuntime(policy) {
  const normalizedPolicy = normalizePolicyRecord(policy);
  return {
    latestRunStatus: normalizedPolicy.latestRunStatus ?? DEFAULT_POLICY_RUNTIME.latestRunStatus,
    lastRunAt: formatTimestamp(normalizedPolicy.lastRunAt),
    latestRunSummary: normalizedPolicy.latestRunSummary ?? null,
  };
}

async function getProtoIdeaExtractionConfiguration(prisma) {
  const policy = await ensureProtoIdeaExtractionPolicy(prisma);
  return {
    policy: {
      id: policy.id ?? null,
      profileName: policy.profileName,
      extractionBreadth: policy.extractionBreadth,
      inferenceTolerance: policy.inferenceTolerance,
      noveltyBias: policy.noveltyBias,
      minimumSignalThreshold: policy.minimumSignalThreshold,
      maxProtoIdeasPerSource: policy.maxProtoIdeasPerSource,
    },
    runtime: buildProtoIdeaExtractionRuntime(policy),
  };
}

async function saveProtoIdeaExtractionConfiguration(prisma, payload, currentUser = null) {
  const nextPolicy = normalizePolicyRecord(payload ?? DEFAULT_EXTRACTION_POLICY);

  if (!prisma?.protoIdeaExtractionPolicy || typeof prisma.protoIdeaExtractionPolicy.upsert !== "function") {
    return {
      policy: {
        id: nextPolicy.id ?? null,
        profileName: nextPolicy.profileName,
        extractionBreadth: nextPolicy.extractionBreadth,
        inferenceTolerance: nextPolicy.inferenceTolerance,
        noveltyBias: nextPolicy.noveltyBias,
        minimumSignalThreshold: nextPolicy.minimumSignalThreshold,
        maxProtoIdeasPerSource: nextPolicy.maxProtoIdeasPerSource,
      },
      runtime: buildProtoIdeaExtractionRuntime(nextPolicy),
    };
  }

  const saved = await prisma.protoIdeaExtractionPolicy.upsert({
    where: {
      profileName: nextPolicy.profileName,
    },
    update: {
      extractionBreadth: nextPolicy.extractionBreadth,
      inferenceTolerance: nextPolicy.inferenceTolerance,
      noveltyBias: nextPolicy.noveltyBias,
      minimumSignalThreshold: nextPolicy.minimumSignalThreshold,
      maxProtoIdeasPerSource: nextPolicy.maxProtoIdeasPerSource,
    },
    create: {
      profileName: nextPolicy.profileName,
      extractionBreadth: nextPolicy.extractionBreadth,
      inferenceTolerance: nextPolicy.inferenceTolerance,
      noveltyBias: nextPolicy.noveltyBias,
      minimumSignalThreshold: nextPolicy.minimumSignalThreshold,
      maxProtoIdeasPerSource: nextPolicy.maxProtoIdeasPerSource,
    },
  });

  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "proto_idea_policy_saved",
    message: "Saved the Proto-Idea extraction policy.",
    context: {
      actorUserId: currentUser?.id ?? null,
      policyId: saved.id,
      profileName: saved.profileName,
      extractionBreadth: saved.extractionBreadth,
      inferenceTolerance: saved.inferenceTolerance,
      noveltyBias: saved.noveltyBias,
      minimumSignalThreshold: saved.minimumSignalThreshold,
      maxProtoIdeasPerSource: saved.maxProtoIdeasPerSource,
    },
  });

  return {
    policy: {
      id: saved.id,
      profileName: saved.profileName,
      extractionBreadth: saved.extractionBreadth,
      inferenceTolerance: saved.inferenceTolerance,
      noveltyBias: saved.noveltyBias,
      minimumSignalThreshold: saved.minimumSignalThreshold,
      maxProtoIdeasPerSource: saved.maxProtoIdeasPerSource,
    },
    runtime: buildProtoIdeaExtractionRuntime(saved),
  };
}

function normalizeSourceKey(sourceRecord = {}) {
  const sourceUrl = typeof sourceRecord.sourceUrl === "string" ? sourceRecord.sourceUrl.trim().toLowerCase() : "";
  if (sourceUrl) {
    return sourceUrl;
  }

  const sourceId = typeof sourceRecord.id === "string" ? sourceRecord.id.trim() : "";
  if (sourceId) {
    return `source-record:${sourceId}`;
  }

  const sourceTitle = typeof sourceRecord.sourceTitle === "string" ? sourceRecord.sourceTitle.trim().toLowerCase() : "";
  return sourceTitle ? `source-title:${sourceTitle}` : `source:${randomUUID()}`;
}

function toSortableTimestamp(value) {
  const date = value ? new Date(value) : null;
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function buildSourceCandidates(configurations = []) {
  const candidates = [];

  for (const configuration of configurations) {
    const records = Array.isArray(configuration?.lastResultRecords) ? configuration.lastResultRecords : [];
    const ownerUser = configuration?.ownerUser ?? null;
    for (const record of records) {
      candidates.push({
        configurationId: configuration.id ?? null,
        ownerUserId: configuration.ownerUserId ?? ownerUser?.id ?? null,
        ownerUser,
        sourceRecord: record,
        sourceKey: normalizeSourceKey(record),
      });
    }
  }

  return candidates.sort((left, right) => {
    const capturedDelta =
      toSortableTimestamp(left.sourceRecord?.capturedAt) - toSortableTimestamp(right.sourceRecord?.capturedAt);
    if (capturedDelta !== 0) {
      return capturedDelta;
    }

    return String(left.sourceKey).localeCompare(String(right.sourceKey));
  });
}

function isMissingProtoIdeaColumnError(error, columnNames = []) {
  if (error?.code !== "P2022") {
    return false;
  }

  const haystack = String(error?.meta?.column ?? error?.message ?? "");
  return columnNames.some((columnName) => haystack.includes(columnName));
}

function normalizeProcessingStatus(status) {
  return String(status ?? "").trim().toUpperCase();
}

function shouldSkipExistingSource(existingSource, { retryFailed = false } = {}) {
  const status = normalizeProcessingStatus(existingSource?.processingStatus);
  if (status === "COMPLETED" || status === "PROCESSING") {
    return true;
  }
  if (status === "FAILED" && !retryFailed) {
    return true;
  }
  return false;
}

async function claimProtoIdeaSource(prisma, candidate, policy, options = {}) {
  if (!prisma?.protoIdeaSource) {
    return null;
  }

  const existing = typeof prisma.protoIdeaSource.findUnique === "function"
    ? await prisma.protoIdeaSource.findUnique({
        where: {
          ownerUserId_sourceKey: {
            ownerUserId: candidate.ownerUserId,
            sourceKey: candidate.sourceKey,
          },
        },
      })
    : null;

  if (existing && shouldSkipExistingSource(existing, options)) {
    return null;
  }

  const now = new Date();

  if (!existing) {
    const createData = {
      ownerUserId: candidate.ownerUserId,
      prospectingConfigurationId: candidate.configurationId,
      extractionPolicyId: policy?.id ?? null,
      upstreamSourceRecordId: String(candidate.sourceRecord?.id ?? candidate.sourceKey),
      sourceKey: candidate.sourceKey,
      sourceTitle: candidate.sourceRecord?.sourceTitle ?? "",
      sourceUrl: candidate.sourceRecord?.sourceUrl ?? null,
      sourceType: candidate.sourceRecord?.provider ?? "web_search",
      sourceCapturedAt: candidate.sourceRecord?.capturedAt ? new Date(candidate.sourceRecord.capturedAt) : null,
      sourcePayload: candidate.sourceRecord,
      processingStatus: "PROCESSING",
      processingStartedAt: now,
      processingCompletedAt: null,
      processingFailedAt: null,
      lastErrorMessage: null,
      lastErrorMeta: null,
      latestGatewayRunId: null,
      extractionPolicySnapshot: buildProtoIdeaRuntimePolicySection(policy),
      attempts: 1,
    };
    try {
      return await prisma.protoIdeaSource.create({
        data: createData,
      });
    } catch (error) {
      if (error?.code === "P2002") {
        return null;
      }
      if (isMissingProtoIdeaColumnError(error, ["extraction_policy_id", "extraction_policy_snapshot"])) {
        const fallbackData = { ...createData };
        delete fallbackData.extractionPolicyId;
        delete fallbackData.extractionPolicySnapshot;
        return prisma.protoIdeaSource.create({
          data: fallbackData,
        });
      }
      throw error;
    }
  }

  const claimData = {
    processingStatus: "PROCESSING",
    processingStartedAt: now,
    processingCompletedAt: null,
    processingFailedAt: null,
    lastErrorMessage: null,
    lastErrorMeta: null,
    prospectingConfigurationId: candidate.configurationId,
    extractionPolicyId: policy?.id ?? null,
    upstreamSourceRecordId: String(candidate.sourceRecord?.id ?? candidate.sourceKey),
    sourceTitle: candidate.sourceRecord?.sourceTitle ?? "",
    sourceUrl: candidate.sourceRecord?.sourceUrl ?? null,
    sourceType: candidate.sourceRecord?.provider ?? "web_search",
    sourceCapturedAt: candidate.sourceRecord?.capturedAt ? new Date(candidate.sourceRecord.capturedAt) : null,
    sourcePayload: candidate.sourceRecord,
    extractionPolicySnapshot: buildProtoIdeaRuntimePolicySection(policy),
    attempts: Number(existing.attempts ?? 0) + 1,
  };
  let claimResult = { count: 1 };
  if (typeof prisma.protoIdeaSource.updateMany === "function") {
    try {
      claimResult = await prisma.protoIdeaSource.updateMany({
        where: {
          id: existing.id,
        },
        data: claimData,
      });
    } catch (error) {
      if (isMissingProtoIdeaColumnError(error, ["extraction_policy_id", "extraction_policy_snapshot"])) {
        const fallbackData = { ...claimData };
        delete fallbackData.extractionPolicyId;
        delete fallbackData.extractionPolicySnapshot;
        claimResult = await prisma.protoIdeaSource.updateMany({
          where: {
            id: existing.id,
          },
          data: fallbackData,
        });
      } else {
        throw error;
      }
    }
  }

  if (claimResult?.count !== 1) {
    return null;
  }

  if (typeof prisma.protoIdeaSource.update === "function") {
    return prisma.protoIdeaSource.update({
      where: {
        id: existing.id,
      },
      data: {},
    });
  }

  return {
    ...existing,
    prospectingConfigurationId: candidate.configurationId,
    extractionPolicyId: policy?.id ?? null,
    upstreamSourceRecordId: String(candidate.sourceRecord?.id ?? candidate.sourceKey),
    sourcePayload: candidate.sourceRecord,
    processingStatus: "PROCESSING",
    processingStartedAt: now,
    extractionPolicySnapshot: buildProtoIdeaRuntimePolicySection(policy),
    attempts: Number(existing.attempts ?? 0) + 1,
  };
}

async function listPendingProtoIdeaCandidates(prisma, options = {}) {
  if (!prisma?.prospectingConfiguration || typeof prisma.prospectingConfiguration.findMany !== "function") {
    return [];
  }

  const where = {};
  if (typeof options.ownerUserId === "string" && options.ownerUserId.trim().length > 0) {
    where.ownerUserId = options.ownerUserId.trim();
  }

  const configurations = await prisma.prospectingConfiguration.findMany({
    where,
    include: {
      ownerUser: {
        select: {
          id: true,
          email: true,
          displayName: true,
          appRole: true,
        },
      },
    },
    orderBy: {
      lastRunAt: "asc",
    },
  });

  return buildSourceCandidates(configurations);
}

async function resolveProtoIdeaAgentKey(prisma) {
  if (!prisma?.agentDefinition) {
    return null;
  }

  if (typeof prisma.agentDefinition.findMany === "function") {
    const candidates = await prisma.agentDefinition.findMany({
      where: {
        active: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    const match = candidates.find((entry) =>
      PROTO_IDEA_AGENT_KEY_CANDIDATES.includes(entry.key) ||
      (typeof entry.name === "string" && entry.name.toLowerCase().includes("proto-idea"))
    );
    return match?.key ?? null;
  }

  return null;
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
      event: "proto_idea_gateway_registry_snapshot_unavailable",
      message: "Skipped proto-idea gateway registry alignment because the runtime snapshot was unavailable.",
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
    `The agent gateway is online but does not have the '${requestedAgent}' agent registered for proto-idea extraction.`,
  );
  error.statusCode = 503;
  throw error;
}

function normalizeTextArray(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function canonicalIdeaFingerprint(protoIdea) {
  return [
    protoIdea.title,
    protoIdea.problem_statement,
    protoIdea.target_customer,
    protoIdea.opportunity_hypothesis,
  ]
    .map((entry) => String(entry ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

function deduplicateProtoIdeas(protoIdeas = []) {
  const keptIdeas = [];
  const seen = new Map();
  const notes = [];

  for (const protoIdea of protoIdeas) {
    const fingerprint = canonicalIdeaFingerprint(protoIdea);
    if (!fingerprint.trim()) {
      keptIdeas.push(protoIdea);
      continue;
    }

    const existingIndex = seen.get(fingerprint);
    if (typeof existingIndex !== "number") {
      seen.set(fingerprint, keptIdeas.length);
      keptIdeas.push(protoIdea);
      continue;
    }

    const existing = keptIdeas[existingIndex];
    keptIdeas[existingIndex] = {
      ...existing,
      source_grounding: {
        explicit_signals: normalizeTextArray([
          ...(existing.source_grounding?.explicit_signals ?? []),
          ...(protoIdea.source_grounding?.explicit_signals ?? []),
        ]),
        inferred_from_source: normalizeTextArray([
          ...(existing.source_grounding?.inferred_from_source ?? []),
          ...(protoIdea.source_grounding?.inferred_from_source ?? []),
        ]),
      },
      assumptions: normalizeTextArray([...(existing.assumptions ?? []), ...(protoIdea.assumptions ?? [])]),
      open_questions: normalizeTextArray([...(existing.open_questions ?? []), ...(protoIdea.open_questions ?? [])]),
    };
    notes.push(`Merged duplicate proto-idea variant "${protoIdea.title}".`);
  }

  return {
    protoIdeas: keptIdeas,
    notes,
  };
}

function applyProtoIdeaPolicyLimit(deduplication, policy) {
  const normalizedPolicy = normalizePolicyRecord(policy);
  const cappedProtoIdeas = deduplication.protoIdeas.slice(0, normalizedPolicy.maxProtoIdeasPerSource);
  const notes = [...deduplication.notes];

  if (deduplication.protoIdeas.length > cappedProtoIdeas.length) {
    notes.push(
      `Trimmed ${deduplication.protoIdeas.length - cappedProtoIdeas.length} proto-idea${
        deduplication.protoIdeas.length - cappedProtoIdeas.length === 1 ? "" : "s"
      } to respect the max-per-source policy.`,
    );
  }

  return {
    protoIdeas: cappedProtoIdeas,
    notes,
  };
}

async function persistProtoIdeaSuccess({
  prisma,
  claimedSource,
  validation,
  deduplication,
  gatewaySummary,
}) {
  const runInTransaction =
    typeof prisma?.$transaction === "function"
      ? (operation) => prisma.$transaction(operation)
      : async (operation) => operation(prisma);

  await runInTransaction(async (tx) => {
    if (tx?.protoIdea && typeof tx.protoIdea.deleteMany === "function") {
      await tx.protoIdea.deleteMany({
        where: {
          sourceId: claimedSource.id,
        },
      });
    }

    if (tx?.protoIdea && typeof tx.protoIdea.create === "function") {
      for (const protoIdea of deduplication.protoIdeas) {
        await tx.protoIdea.create({
          data: {
            id: randomUUID(),
            ownerUserId: claimedSource.ownerUserId,
            sourceId: claimedSource.id,
            title: protoIdea.title,
            problemStatement: protoIdea.problem_statement,
            targetCustomer: protoIdea.target_customer,
            opportunityHypothesis: protoIdea.opportunity_hypothesis,
            whyItMatters: protoIdea.why_it_matters,
            opportunityType: protoIdea.opportunity_type,
            explicitSignals: normalizeTextArray(protoIdea.source_grounding?.explicit_signals),
            inferredSignals: normalizeTextArray(protoIdea.source_grounding?.inferred_from_source),
            assumptions: normalizeTextArray(protoIdea.assumptions),
            openQuestions: normalizeTextArray(protoIdea.open_questions),
            statusLabel: protoIdea.status?.label ?? "",
            statusTone: protoIdea.status?.tone ?? "",
            agentConfidence: protoIdea.status?.agent_confidence ?? "",
            statusExplanation: protoIdea.status?.explanation ?? "",
            rawLlmPayload: protoIdea,
          },
        });
      }
    }

    await tx.protoIdeaSource.update({
      where: {
        id: claimedSource.id,
      },
      data: {
        processingStatus: "COMPLETED",
        processingCompletedAt: new Date(),
        processingFailedAt: null,
        lastErrorMessage: null,
        lastErrorMeta: null,
        latestGatewayRunId: gatewaySummary?.id ?? null,
        rawLlmPayload: validation.rawCandidate ?? null,
        parsedResponse: validation.data,
        sourceSummary: validation.data.source_analysis.summary,
        overallSignalStrengthLabel: validation.data.source_analysis.overall_signal_strength.label,
        overallSignalStrengthTone: validation.data.source_analysis.overall_signal_strength.tone,
        overallSignalAgentConfidence: validation.data.source_analysis.overall_signal_strength.agent_confidence,
        overallSignalExplanation: validation.data.source_analysis.overall_signal_strength.explanation,
        extractionNotes: validation.data.proto_idea_overview.extraction_notes,
        deduplicationNotes: buildDeduplicationNotes(validation.data.deduplication_notes, deduplication.notes),
      },
    });
  });
}

function buildDeduplicationNotes(modelNotes = {}, mergeNotes = []) {
  const parts = [];
  if (modelNotes?.potential_overlap_detected) {
    parts.push(modelNotes.explanation || "Potential overlap detected by the model.");
  }
  if (Array.isArray(mergeNotes) && mergeNotes.length > 0) {
    parts.push(`Stage merged ${mergeNotes.length} obvious duplicate${mergeNotes.length === 1 ? "" : "s"}.`);
    parts.push(...mergeNotes);
  }
  return parts.filter(Boolean).join(" ");
}

async function persistProtoIdeaFailure({
  prisma,
  claimedSource,
  error,
  gatewaySummary = null,
  validationIssues = [],
  rawCandidate = null,
}) {
  if (!prisma?.protoIdeaSource || typeof prisma.protoIdeaSource.update !== "function") {
    return;
  }

  await prisma.protoIdeaSource.update({
    where: {
      id: claimedSource.id,
    },
    data: {
      processingStatus: "FAILED",
      processingFailedAt: new Date(),
      processingCompletedAt: null,
      latestGatewayRunId: gatewaySummary?.id ?? null,
      lastErrorMessage: error instanceof Error ? error.message : String(error),
      lastErrorMeta: {
        validationIssues,
        rawCandidate,
      },
    },
  });
}

async function getProtoIdeaPipelineContents(prisma, ownerUserId) {
  if (!prisma?.protoIdea || typeof prisma.protoIdea.findMany !== "function") {
    return [];
  }

  try {
    return await prisma.protoIdea.findMany({
      where: {
        ownerUserId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    if (isMissingProtoIdeaStorageError(error)) {
      return [];
    }
    throw error;
  }
}

async function updateProtoIdeaPolicyRuntime(prisma, policyId, data) {
  if (!policyId || !prisma?.protoIdeaExtractionPolicy || typeof prisma.protoIdeaExtractionPolicy.update !== "function") {
    return null;
  }

  try {
    return await prisma.protoIdeaExtractionPolicy.update({
      where: {
        id: policyId,
      },
      data,
    });
  } catch (error) {
    if (
      isMissingProtoIdeaStorageError(error) ||
      isMissingProtoIdeaColumnError(error, ["latest_run_status", "last_run_at", "latest_run_summary_json"])
    ) {
      return null;
    }
    throw error;
  }
}

function isMissingProtoIdeaStorageError(error) {
  return (
    error?.code === "P2021" &&
    typeof error?.message === "string" &&
    (
      error.message.includes("proto_idea_sources") ||
      error.message.includes("proto_ideas") ||
      error.message.includes("proto_idea_extraction_policies")
    )
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

async function runProtoIdeaExtractionPass(prisma, agentGatewayClient, options = {}) {
  const batchSize = Number.isInteger(options.batchSize)
    ? Math.max(1, Math.min(options.batchSize, 10))
    : DEFAULT_BATCH_SIZE;
  const retryFailed = Boolean(options.retryFailed);
  const ownerUserId =
    typeof options.ownerUserId === "string" && options.ownerUserId.trim().length > 0
      ? options.ownerUserId.trim()
      : null;
  const agentIdentityMarkdown = options.agentIdentityMarkdown ?? loadProtoIdeaAgentIdentity();
  const requestedAgent = await resolveProtoIdeaAgentKey(prisma);
  const policy = options.policy ? normalizePolicyRecord(options.policy) : await ensureProtoIdeaExtractionPolicy(prisma);

  if (!requestedAgent) {
    const error = new Error("No active proto-idea agent is registered in the database.");
    error.statusCode = 503;
    throw error;
  }

  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "proto_idea_policy_loaded",
    message: "Loaded the Proto-Idea extraction policy.",
    context: {
      policyId: policy.id ?? null,
      profileName: policy.profileName,
      extractionBreadth: policy.extractionBreadth,
      inferenceTolerance: policy.inferenceTolerance,
      noveltyBias: policy.noveltyBias,
      minimumSignalThreshold: policy.minimumSignalThreshold,
      maxProtoIdeasPerSource: policy.maxProtoIdeasPerSource,
      ownerUserId,
    },
  });

  await updateProtoIdeaPolicyRuntime(prisma, policy.id, {
    latestRunStatus: "RUNNING",
    latestRunSummaryJson: {
      startedAt: new Date().toISOString(),
      policyId: policy.id ?? null,
      policyProfileName: policy.profileName,
    },
  });

  const candidates = await listPendingProtoIdeaCandidates(prisma, { ownerUserId });
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

    const claimedSource = await claimProtoIdeaSource(prisma, candidate, policy, { retryFailed });
    if (!claimedSource) {
      continue;
    }

    outcome.processedCount += 1;
    outcome.selectedSourceIds.push(claimedSource.id);

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "proto_idea_source_selected",
      message: "Selected a source artefact for proto-idea extraction.",
      context: {
        ownerUserId: candidate.ownerUserId,
        protoIdeaSourceId: claimedSource.id,
        upstreamSourceRecordId: claimedSource.upstreamSourceRecordId,
        policyId: policy.id ?? null,
        sourceUrl: claimedSource.sourceUrl ?? null,
        sourceCapturedAt: claimedSource.sourceCapturedAt ?? null,
      },
    });

    let gatewayRun = null;
    let gatewaySummary = null;

    try {
      await ensureGatewayAgentAvailable({
        prisma,
        agentGatewayClient,
        requestedAgent,
        ownerUserId: candidate.ownerUserId,
      });

      const prompt = buildProtoIdeaExtractionPrompt(candidate.sourceRecord, policy, agentIdentityMarkdown);

      await createLogEntry(prisma, {
        level: "info",
        scope: "idea-foundry",
        event: "proto_idea_extraction_started",
        message: "Started proto-idea extraction for a source artefact.",
        context: {
          ownerUserId: candidate.ownerUserId,
          protoIdeaSourceId: claimedSource.id,
          requestedAgent,
          policyId: policy.id ?? null,
          policyProfileName: policy.profileName,
          promptPreview: prompt,
        },
      });

      gatewayRun = await agentGatewayClient.startRun({
        input_text: prompt,
        request_type: "proto_idea_extraction",
        requested_agent: requestedAgent,
        session: {
          title: "Proto-Idea Extraction",
          metadata: {
            module: "idea_foundry",
            feature: "proto_idea_extraction",
            owner_user_id: candidate.ownerUserId,
            proto_idea_source_id: claimedSource.id,
            upstream_source_record_id: claimedSource.upstreamSourceRecordId,
            extraction_policy_id: policy.id ?? null,
            extraction_policy_profile: policy.profileName,
          },
        },
        context: {
          source_record: candidate.sourceRecord,
          proto_idea_source_id: claimedSource.id,
          upstream_source_record_id: claimedSource.upstreamSourceRecordId,
          extraction_policy: buildProtoIdeaRuntimePolicySection(policy),
        },
      });

      gatewaySummary = await agentGatewayClient.waitForRunCompletion(gatewayRun.id);
      const validation = validateProtoIdeaExtractionOutput(extractProtoIdeaCandidate(gatewaySummary));

      if (!validation.success) {
        const error = new Error(validation.issues.map((issue) => issue.message).join("; "));
        await createLogEntry(prisma, {
          level: "warn",
          scope: "idea-foundry",
          event: "proto_idea_validation_failed",
          message: "The proto-idea gateway returned a non-compliant payload.",
          context: {
            ownerUserId: candidate.ownerUserId,
            protoIdeaSourceId: claimedSource.id,
            requestedAgent,
            validationIssues: validation.issues,
            rawCandidate: validation.rawCandidate,
          },
        });
        await persistProtoIdeaFailure({
          prisma,
          claimedSource,
          error,
          gatewaySummary,
          validationIssues: validation.issues,
          rawCandidate: validation.rawCandidate,
        });
        outcome.failedCount += 1;
        continue;
      }

      const deduplication = applyProtoIdeaPolicyLimit(deduplicateProtoIdeas(validation.data.proto_ideas), policy);

      await persistProtoIdeaSuccess({
        prisma,
        claimedSource,
        validation,
        deduplication,
        gatewaySummary,
      });

      await createLogEntry(prisma, {
        level: "info",
        scope: "idea-foundry",
        event: "proto_idea_extraction_completed",
        message: "Completed proto-idea extraction for a source artefact.",
        context: {
          ownerUserId: candidate.ownerUserId,
          protoIdeaSourceId: claimedSource.id,
          requestedAgent,
          policyId: policy.id ?? null,
          extractedProtoIdeaCount: deduplication.protoIdeas.length,
          duplicateMergeCount: deduplication.notes.length,
          sourceUrl: claimedSource.sourceUrl ?? null,
        },
      });

      outcome.completedCount += 1;
    } catch (error) {
      await createLogEntry(prisma, {
        level: "error",
        scope: "idea-foundry",
        event: "proto_idea_persistence_failed",
        message: "Proto-idea extraction failed.",
        context: {
          ownerUserId: candidate.ownerUserId,
          protoIdeaSourceId: claimedSource.id,
          requestedAgent,
          policyId: policy.id ?? null,
          gatewayRunId: gatewaySummary?.id ?? gatewayRun?.id ?? null,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      await persistProtoIdeaFailure({
        prisma,
        claimedSource,
        error,
        gatewaySummary,
      });
      outcome.failedCount += 1;
    }
  }

  const finalStatus = outcome.failedCount > 0 && outcome.completedCount === 0 ? "FAILED" : "COMPLETED";
  const finishedAt = new Date();
  await updateProtoIdeaPolicyRuntime(prisma, policy.id, {
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

async function runProtoIdeaExtractionStage(prisma, agentGatewayClient, currentUser, options = {}) {
  const policy = await ensureProtoIdeaExtractionPolicy(prisma);

  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "proto_idea_agent_run_started",
    message: "Started a Proto-Idea extraction agent run.",
    context: {
      actorUserId: currentUser?.id ?? null,
      policyId: policy.id ?? null,
      profileName: policy.profileName,
      batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
      retryFailed: Boolean(options.retryFailed),
      ownerUserId: currentUser?.id ?? null,
    },
  });

  try {
    const result = await runProtoIdeaExtractionPass(prisma, agentGatewayClient, {
      ...options,
      policy,
      ownerUserId: currentUser?.id ?? null,
    });
    const refreshed = await getProtoIdeaExtractionConfiguration(prisma);

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "proto_idea_agent_run_completed",
      message: "Completed a Proto-Idea extraction agent run.",
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
    await updateProtoIdeaPolicyRuntime(prisma, policy.id, {
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
      event: "proto_idea_agent_run_failed",
      message: "Proto-Idea extraction agent run failed.",
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
  buildProtoIdeaExtractionPrompt,
  getProtoIdeaExtractionConfiguration,
  getProtoIdeaPipelineContents,
  loadProtoIdeaAgentIdentity,
  runProtoIdeaExtractionStage,
  runProtoIdeaExtractionPass,
  saveProtoIdeaExtractionConfiguration,
  validateProtoIdeaExtractionOutput,
};
