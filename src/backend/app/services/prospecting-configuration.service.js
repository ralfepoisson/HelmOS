const { randomUUID } = require("node:crypto");
const { z } = require("zod");

const { createLogEntry } = require("./log-entry.service");

const PROSPECTING_AGENT_KEY_CANDIDATES = ["prospecting", "prospecting_agent", "prospecting-agent"];
const MAX_PROSPECTING_REPAIR_ATTEMPTS = 3;
const MAX_EXECUTION_QUERIES = 10;
const MAX_RESULTS_PER_QUERY = 5;
const MAX_STORED_RESULT_RECORDS = 30;
const DEFAULT_RUNTIME_STATE = {
  agentState: "active",
  latestRunStatus: "idle",
  isRunning: false,
  lastRun: null,
  nextRun: null,
  resultRecordCount: 0,
};

const strategyPatternSchema = z.object({
  key: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  priority: z.enum(["high", "medium", "low"]),
  rationale: z.string(),
});

const searchThemeSchema = z.object({
  label: z.string(),
  status: z.enum(["active", "paused"]),
  priority: z.enum(["high", "medium", "low"]),
  rationale: z.string(),
});

const sourceMixSchema = z.object({
  label: z.string(),
  enabled: z.boolean(),
  expected_signal_type: z.string(),
  rationale: z.string(),
  review_frequency: z.string(),
});

const queryFamilySchema = z.object({
  title: z.string(),
  intent: z.string(),
  representative_queries: z.array(z.string()),
  theme_link: z.string(),
  source_applicability: z.array(z.string()),
  status: z.enum(["active", "paused"]),
  rationale: z.string(),
});

const signalQualityCriterionSchema = z.object({
  title: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  strictness: z.enum(["high", "medium", "low"]),
  rationale: z.string(),
});

const proposedChangeSchema = z.object({
  change_type: z.string(),
  target: z.string(),
  summary: z.string(),
  reason: z.string(),
  expected_effect: z.string(),
  risk: z.string(),
});

const reviewFlagSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  area: z.string(),
  message: z.string(),
  recommended_operator_action: z.string(),
});

const prospectingReviewSchema = z
  .object({
    reply_to_user: z.object({
      content: z.string(),
    }),
    strategy_review_overview: z.object({
      assessment: z.object({
        label: z.string(),
        reason: z.string(),
        next_best_action: z.string(),
      }),
    }),
    current_strategy_assessment: z.object({
      summary: z.string(),
      observed_strengths: z.array(z.string()),
      observed_weaknesses: z.array(z.string()),
      notable_gaps: z.array(z.string()),
      status: z.object({
        label: z.string(),
        tone: z.string(),
        agent_confidence: z.string(),
        explanation: z.string(),
      }),
    }),
    recommended_strategy_update: z.object({
      prospecting_objective: z.object({
        objective_name: z.string(),
        description: z.string(),
        target_domain: z.string(),
        include_themes: z.array(z.string()),
        exclude_themes: z.array(z.string()),
      }),
      search_strategy: z.object({
        summary: z.string(),
        strategy_patterns: z.array(strategyPatternSchema),
        steering_hypothesis: z.string(),
      }),
      search_themes: z.array(searchThemeSchema),
      source_mix: z.array(sourceMixSchema),
      query_families: z.array(queryFamilySchema),
      signal_quality_criteria: z.array(signalQualityCriterionSchema),
      scan_policy: z.object({
        run_mode: z.enum(["continuous", "scheduled", "manual-only"]),
        cadence: z.string(),
        max_results_per_run: z.number(),
        promotion_threshold: z.string(),
        geographic_scope: z.array(z.string()),
        language_scope: z.array(z.string()),
        guardrails: z.array(z.string()),
      }),
    }),
    proposed_changes: z.array(proposedChangeSchema),
    review_flags: z.array(reviewFlagSchema),
  })
  .passthrough();

async function getProspectingConfiguration(prisma, currentUser) {
  const record = await loadProspectingConfiguration(prisma, currentUser.id);

  return {
    snapshot: record?.uiSnapshotJson ?? null,
    latestReview: record?.latestReviewJson ?? null,
    runtime: buildRuntimeState(record),
  };
}

async function getProspectingPipelineContents(prisma, currentUser) {
  const record = await loadProspectingConfiguration(prisma, currentUser.id);

  return {
    sources: Array.isArray(record?.lastResultRecords) ? record.lastResultRecords : [],
    protoIdeas: [],
    ideaCandidates: [],
    curatedOpportunities: [],
    runtime: buildRuntimeState(record),
  };
}

async function runProspectingConfigurationReview(prisma, agentGatewayClient, payload, currentUser) {
  if (!agentGatewayClient || typeof agentGatewayClient.startRun !== "function") {
    const error = new Error("The agent gateway client is not configured for prospecting reviews.");
    error.statusCode = 503;
    throw error;
  }

  const record = await loadProspectingConfiguration(prisma, currentUser.id);
  const currentSnapshot = normalizeSnapshotInput(payload?.snapshot, record?.uiSnapshotJson);
  const recentResultRecords = Array.isArray(record?.lastResultRecords)
    ? record.lastResultRecords.slice(0, 30)
    : [];
  const requestedAgent = await resolveProspectingAgentKey(prisma);

  if (!requestedAgent) {
    const error = new Error("No active prospecting agent is registered in the database.");
    error.statusCode = 503;
    throw error;
  }

  await ensureGatewayAgentAvailable({
    prisma,
    agentGatewayClient,
    requestedAgent,
    currentUser,
  });

  const inputText = buildProspectingReviewPrompt(currentSnapshot, recentResultRecords);

  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "prospecting_configuration_run_started",
    message: "Started a prospecting configuration review run.",
    context: {
      userId: currentUser.id,
      requestedAgent,
      hasStoredConfiguration: record !== null,
      resultRecordCount: recentResultRecords.length,
    },
  });

  await upsertProspectingConfiguration(prisma, currentUser.id, {
    agentState: "active",
    latestRunStatus: "RUNNING",
    uiSnapshotJson: currentSnapshot,
    latestGatewayRunId: null,
    lastRunAt: record?.lastRunAt ?? null,
    nextRunAt: record?.nextRunAt ?? null,
    latestReviewJson: record?.latestReviewJson ?? null,
    lastResultRecords: record?.lastResultRecords ?? null,
  });

  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "prospecting_configuration_prompt_prepared",
    message: "Prepared the prospecting configuration review prompt.",
    context: {
      userId: currentUser.id,
      requestedAgent,
      inputPreview: inputText,
      currentSnapshot,
      recentResultRecords,
    },
  });

  let gatewayRun = null;
  let gatewaySummary = null;

  try {
    gatewayRun = await agentGatewayClient.startRun({
      input_text: inputText,
      request_type: "prospecting_configuration_review",
      requested_agent: requestedAgent,
      session: {
        title: "Prospecting Configuration Review",
        metadata: {
          module: "idea_foundry",
          feature: "prospecting_configuration_review",
          user_id: currentUser.id,
        },
      },
      context: {
        current_prospecting_configuration: currentSnapshot,
        recent_result_records: recentResultRecords,
      },
    });

    await upsertProspectingConfiguration(prisma, currentUser.id, {
      agentState: "active",
      latestRunStatus: "RUNNING",
      latestGatewayRunId: gatewayRun.id ?? null,
      uiSnapshotJson: currentSnapshot,
      latestReviewJson: record?.latestReviewJson ?? null,
      lastResultRecords: record?.lastResultRecords ?? null,
      lastRunAt: record?.lastRunAt ?? null,
      nextRunAt: record?.nextRunAt ?? null,
    });

    gatewaySummary = await agentGatewayClient.waitForRunCompletion(gatewayRun.id);

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "prospecting_configuration_gateway_summary_received",
      message: "Received the prospecting review output from the agent gateway.",
      context: {
        userId: currentUser.id,
        requestedAgent,
        gatewayRunId: gatewaySummary?.id ?? gatewayRun.id ?? null,
        gatewayStatus: gatewaySummary?.status ?? null,
        normalizedOutput: gatewaySummary?.normalized_output ?? null,
        rawLlmOutput: extractRawLlmOutputFromGatewaySummary(gatewaySummary),
        parsedJsonOutput: extractParsedJsonOutputFromGatewaySummary(gatewaySummary),
      },
    });

    const {
      normalizedOutput,
      effectiveGatewaySummary,
    } = await ensureCompliantProspectingReviewOutput({
      prisma,
      agentGatewayClient,
      requestedAgent,
      currentSnapshot,
      recentResultRecords,
      currentUser,
      initialGatewayRun: gatewayRun,
      initialGatewaySummary: gatewaySummary,
    });
    if (normalizedOutput.meta?.usedFallback) {
      await createLogEntry(prisma, {
        level: "warn",
        scope: "idea-foundry",
        event: "prospecting_configuration_unstructured_gateway_output",
        message: "The prospecting gateway completed without returning a structured configuration update.",
        context: {
          userId: currentUser.id,
          requestedAgent,
          gatewayRunId: effectiveGatewaySummary?.id ?? gatewayRun.id ?? null,
          gatewayStatus: effectiveGatewaySummary?.status ?? null,
          fallbackReason: normalizedOutput.meta?.fallbackReason ?? null,
          artifactKind: normalizedOutput.meta?.artifactKind ?? null,
        },
      });
    }
    const updatedSnapshot = enforceHourlyCadence(
      buildUiSnapshotFromAgentReview(normalizedOutput, currentSnapshot),
    );
    const now = new Date();
    const nextRunAt = inferNextRunAt(buildReviewScanPolicy(updatedSnapshot), now);

    const persisted = await upsertProspectingConfiguration(prisma, currentUser.id, {
      agentState: "active",
      latestRunStatus: "COMPLETED",
      latestGatewayRunId: effectiveGatewaySummary?.id ?? gatewayRun.id ?? null,
      uiSnapshotJson: updatedSnapshot,
      latestReviewJson: normalizedOutput,
      lastResultRecords: record?.lastResultRecords ?? null,
      lastRunAt: now,
      nextRunAt,
    });

    await createLogEntry(prisma, {
        level: "info",
        scope: "idea-foundry",
        event: "prospecting_configuration_persisted",
        message: "Persisted the updated prospecting configuration returned by the agent.",
        context: {
          userId: currentUser.id,
          requestedAgent,
          gatewayRunId: effectiveGatewaySummary?.id ?? gatewayRun.id ?? null,
          latestRunStatus: "COMPLETED",
          persistedConfigurationId: persisted.id,
          updatedSnapshot,
        },
      });

    return {
      snapshot: updatedSnapshot,
      latestReview: normalizedOutput,
      runtime: buildRuntimeState({
        ...persisted,
        uiSnapshotJson: updatedSnapshot,
        latestReviewJson: normalizedOutput,
      }),
    };
  } catch (error) {
    await upsertProspectingConfiguration(prisma, currentUser.id, {
      agentState: "active",
      latestRunStatus: "FAILED",
      latestGatewayRunId: gatewaySummary?.id ?? gatewayRun?.id ?? null,
      uiSnapshotJson: currentSnapshot,
      latestReviewJson: record?.latestReviewJson ?? null,
      lastResultRecords: record?.lastResultRecords ?? null,
      lastRunAt: record?.lastRunAt ?? null,
      nextRunAt: record?.nextRunAt ?? null,
    });

    await createLogEntry(prisma, {
      level: "error",
      scope: "idea-foundry",
      event: "prospecting_configuration_run_failed",
      message: "The prospecting configuration review failed.",
      context: {
        userId: currentUser.id,
        requestedAgent,
        gatewayRunId: gatewaySummary?.id ?? gatewayRun?.id ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}

async function runProspectingOptimizationCycle(prisma, agentGatewayClient, payload, currentUser) {
  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "prospecting_optimization_cycle_started",
    message: "Started a full prospecting optimization cycle.",
    context: {
      userId: currentUser.id,
    },
  });

  try {
    const reviewed = await runProspectingConfigurationReview(
      prisma,
      agentGatewayClient,
      payload,
      currentUser,
    );
    const executed = await executeProspectingConfiguration(
      prisma,
      agentGatewayClient,
      currentUser,
      {
        snapshot: reviewed.snapshot,
        latestReview: reviewed.latestReview,
      },
    );

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "prospecting_optimization_cycle_completed",
      message: "Completed a full prospecting optimization cycle.",
      context: {
        userId: currentUser.id,
        latestRunStatus: executed?.runtime?.latestRunStatus ?? null,
        resultRecordCount: executed?.runtime?.resultRecordCount ?? 0,
      },
    });

    return {
      snapshot: executed.snapshot,
      latestReview: reviewed.latestReview ?? executed.latestReview ?? null,
      runtime: executed.runtime,
    };
  } catch (error) {
    await createLogEntry(prisma, {
      level: "error",
      scope: "idea-foundry",
      event: "prospecting_optimization_cycle_failed",
      message: "The full prospecting optimization cycle failed.",
      context: {
        userId: currentUser.id,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}

async function executeProspectingConfiguration(prisma, agentGatewayClient, currentUser, options = {}) {
  if (!agentGatewayClient || typeof agentGatewayClient.searchWeb !== "function") {
    const error = new Error("The agent gateway client is not configured for prospecting execution.");
    error.statusCode = 503;
    throw error;
  }

  const record = await loadProspectingConfiguration(prisma, currentUser.id);
  const currentSnapshot = enforceHourlyCadence(
    normalizeSnapshotInput(options?.snapshot, record?.uiSnapshotJson),
  );
  const latestReview = options?.latestReview ?? record?.latestReviewJson ?? null;
  const executionPlan = buildProspectingExecutionPlan(currentSnapshot);

  if (Object.keys(currentSnapshot).length === 0) {
    const error = new Error("No saved prospecting strategy is available yet. Run the Prospecting Agent first.");
    error.statusCode = 409;
    throw error;
  }

  await createLogEntry(prisma, {
    level: "info",
    scope: "idea-foundry",
    event: "prospecting_execution_started",
    message: "Started prospecting execution from the saved strategy.",
    context: {
      userId: currentUser.id,
      queryCount: executionPlan.length,
      strategyMode: currentSnapshot.strategyMode ?? null,
    },
  });

  await upsertProspectingConfiguration(prisma, currentUser.id, {
    agentState: "active",
    latestRunStatus: "RUNNING",
    latestGatewayRunId: record?.latestGatewayRunId ?? null,
    uiSnapshotJson: currentSnapshot,
    latestReviewJson: latestReview,
    lastResultRecords: record?.lastResultRecords ?? null,
    lastRunAt: record?.lastRunAt ?? null,
    nextRunAt: record?.nextRunAt ?? null,
  });

  try {
    const collectedResults = [];

    for (const queryPlan of executionPlan) {
      const primarySearchResponse = await agentGatewayClient.searchWeb({
        query: queryPlan.query,
        maxResults: MAX_RESULTS_PER_QUERY,
        actor: "prospecting_execution",
      });
      let executedQuery = queryPlan.query;
      let normalizedResults = normalizeProspectingSearchResults(
        primarySearchResponse?.payload?.results,
        queryPlan,
        { executedQuery },
      );

      if (normalizedResults.length === 0) {
        const retryQuery = buildSimplifiedSearchRetryQuery(queryPlan.query);
        if (retryQuery && retryQuery !== queryPlan.query) {
          const retrySearchResponse = await agentGatewayClient.searchWeb({
            query: retryQuery,
            maxResults: MAX_RESULTS_PER_QUERY,
            actor: "prospecting_execution",
          });
          executedQuery = retryQuery;
          normalizedResults = normalizeProspectingSearchResults(
            retrySearchResponse?.payload?.results,
            queryPlan,
            { executedQuery },
          );

          await createLogEntry(prisma, {
            level: normalizedResults.length > 0 ? "info" : "warn",
            scope: "idea-foundry",
            event:
              normalizedResults.length > 0
                ? "prospecting_execution_query_retry_succeeded"
                : "prospecting_execution_query_retry_empty",
            message:
              normalizedResults.length > 0
                ? "Recovered prospecting results by retrying a simplified query."
                : "Retrying a simplified prospecting query still returned no results.",
            context: {
              userId: currentUser.id,
              originalQuery: queryPlan.query,
              retryQuery,
              queryFamilyTitle: queryPlan.queryFamilyTitle,
              normalizedResultCount: normalizedResults.length,
            },
          });
        }
      }

      collectedResults.push(...normalizedResults);

      await createLogEntry(prisma, {
        level: "info",
        scope: "idea-foundry",
        event: "prospecting_execution_query_completed",
        message: "Completed a prospecting web-search query.",
        context: {
          userId: currentUser.id,
          query: queryPlan.query,
          queryFamilyTitle: queryPlan.queryFamilyTitle,
          normalizedResultCount: normalizedResults.length,
          executedQuery,
        },
      });
    }

    const deduplicatedResults = deduplicateResultRecords(collectedResults).slice(0, MAX_STORED_RESULT_RECORDS);
    const now = new Date();
    const nextRunAt = inferNextRunAt(buildReviewScanPolicy(currentSnapshot), now);
    const persisted = await upsertProspectingConfiguration(prisma, currentUser.id, {
      agentState: "active",
      latestRunStatus: "COMPLETED",
      latestGatewayRunId: record?.latestGatewayRunId ?? null,
      uiSnapshotJson: currentSnapshot,
      latestReviewJson: latestReview,
      lastResultRecords: deduplicatedResults,
      lastRunAt: now,
      nextRunAt,
    });

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "prospecting_execution_persisted",
      message: "Persisted normalized prospecting execution results.",
      context: {
        userId: currentUser.id,
        resultRecordCount: deduplicatedResults.length,
        queryCount: executionPlan.length,
      },
    });

    return {
      snapshot: currentSnapshot,
      latestReview,
      runtime: buildRuntimeState({
        ...persisted,
        uiSnapshotJson: currentSnapshot,
        latestReviewJson: latestReview,
        lastResultRecords: deduplicatedResults,
      }),
    };
  } catch (error) {
    await upsertProspectingConfiguration(prisma, currentUser.id, {
      agentState: "active",
      latestRunStatus: "FAILED",
      latestGatewayRunId: record?.latestGatewayRunId ?? null,
      uiSnapshotJson: currentSnapshot,
      latestReviewJson: latestReview,
      lastResultRecords: record?.lastResultRecords ?? null,
      lastRunAt: record?.lastRunAt ?? null,
      nextRunAt: record?.nextRunAt ?? null,
    });

    await createLogEntry(prisma, {
      level: "error",
      scope: "idea-foundry",
      event: "prospecting_execution_failed",
      message: "Prospecting execution failed.",
      context: {
        userId: currentUser.id,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}

function enforceHourlyCadence(snapshot = {}) {
  const nextSnapshot = {
    ...snapshot,
    nextRun: "Every hour",
    cadence: {
      ...(snapshot?.cadence ?? {}),
      runMode: "Scheduled",
      cadence: "Every hour",
    },
  };

  return nextSnapshot;
}

async function ensureGatewayAgentAvailable({ prisma, agentGatewayClient, requestedAgent, currentUser }) {
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
      event: "prospecting_configuration_gateway_registry_snapshot_unavailable",
      message: "Skipped gateway registry alignment check because the runtime snapshot was unavailable.",
      context: {
        userId: currentUser.id,
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

  await createLogEntry(prisma, {
    level: "error",
    scope: "idea-foundry",
    event: "prospecting_configuration_gateway_registry_mismatch",
    message: "The agent gateway registry does not contain the requested prospecting agent.",
    context: {
      userId: currentUser.id,
      requestedAgent,
      gatewayStatus: snapshot.status,
      gatewayMessage: snapshot.message ?? null,
      availableAgents,
      gatewayBaseUrl: snapshot.baseUrl ?? null,
    },
  });

  const error = new Error(
    `The agent gateway is online but does not have the '${requestedAgent}' agent registered. Restart the gateway with the shared registry database or align its agent registry before running prospecting reviews.`
  );
  error.statusCode = 503;
  throw error;
}

async function loadProspectingConfiguration(prisma, ownerUserId) {
  if (!prisma?.prospectingConfiguration || typeof prisma.prospectingConfiguration.findUnique !== "function") {
    return null;
  }

  try {
    return await prisma.prospectingConfiguration.findUnique({
      where: {
        ownerUserId,
      },
    });
  } catch (error) {
    if (isMissingProspectingConfigurationStorageError(error)) {
      return null;
    }

    throw error;
  }
}

async function upsertProspectingConfiguration(prisma, ownerUserId, data) {
  if (!prisma?.prospectingConfiguration || typeof prisma.prospectingConfiguration.upsert !== "function") {
    return {
      id: randomUUID(),
      ownerUserId,
      ...data,
    };
  }

  try {
    return await prisma.prospectingConfiguration.upsert({
      where: {
        ownerUserId,
      },
      update: data,
      create: {
        ownerUserId,
        ...data,
      },
    });
  } catch (error) {
    if (isMissingProspectingConfigurationStorageError(error)) {
      const storageError = new Error(
        "Prospecting configuration storage is not available yet. Apply the database migration for prospecting configurations and try again."
      );
      storageError.statusCode = 503;
      throw storageError;
    }

    throw error;
  }
}

function isMissingProspectingConfigurationStorageError(error) {
  return (
    error?.code === "P2021" &&
    typeof error?.message === "string" &&
    error.message.includes("prospecting_configurations")
  );
}

async function resolveProspectingAgentKey(prisma) {
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
      PROSPECTING_AGENT_KEY_CANDIDATES.includes(entry.key) ||
      (typeof entry.name === "string" && entry.name.toLowerCase().includes("prospecting"))
    );
    return match?.key ?? null;
  }

  if (typeof prisma.agentDefinition.findFirst === "function") {
    const match = await prisma.agentDefinition.findFirst({
      where: {
        active: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    return match?.key ?? null;
  }

  return null;
}

function buildRuntimeState(record) {
  if (!record) {
    return { ...DEFAULT_RUNTIME_STATE };
  }

  return {
    agentState: record.agentState ?? "active",
    latestRunStatus: record.latestRunStatus ?? "idle",
    isRunning: record.latestRunStatus === "RUNNING",
    lastRun: record.lastRunAt ? formatTimestamp(record.lastRunAt) : null,
    nextRun: record.nextRunAt ? formatTimestamp(record.nextRunAt) : null,
    resultRecordCount: Array.isArray(record.lastResultRecords) ? record.lastResultRecords.length : 0,
  };
}

function buildProspectingReviewPrompt(currentSnapshot, recentResultRecords) {
  return [
    "Review the current prospecting strategy and the recent search results.",
    "Make only minor adjustments that improve the search strategy while preserving what is already working.",
    "Return only the updated prospecting configuration JSON using the agreed response schema.",
    "",
    "Current prospecting configuration:",
    JSON.stringify(currentSnapshot, null, 2),
    "",
    "Recent search results from the last run (first 30 records, if available):",
    JSON.stringify(recentResultRecords ?? [], null, 2),
  ].join("\n");
}

function normalizeSnapshotInput(inputSnapshot, fallbackSnapshot) {
  if (inputSnapshot && typeof inputSnapshot === "object") {
    return inputSnapshot;
  }

  if (fallbackSnapshot && typeof fallbackSnapshot === "object") {
    return fallbackSnapshot;
  }

  return {};
}

async function ensureCompliantProspectingReviewOutput({
  prisma,
  agentGatewayClient,
  requestedAgent,
  currentSnapshot,
  recentResultRecords,
  currentUser,
  initialGatewayRun,
  initialGatewaySummary,
}) {
  let latestValidation = validateProspectingReviewOutput(extractProspectingReviewCandidate(initialGatewaySummary));
  let latestGatewaySummary = initialGatewaySummary;
  const initialGatewayRunId = initialGatewaySummary?.id ?? initialGatewayRun?.id ?? null;

  if (latestValidation.success) {
    return {
      normalizedOutput: attachProspectingReviewMeta(latestValidation.data),
      effectiveGatewaySummary: initialGatewaySummary,
    };
  }

  await createLogEntry(prisma, {
    level: "warn",
    scope: "idea-foundry",
    event: "prospecting_configuration_output_validation_failed",
    message: "The prospecting gateway returned a non-compliant review payload.",
      context: {
        userId: currentUser.id,
        requestedAgent,
        gatewayRunId: initialGatewayRunId,
        validationIssues: latestValidation.issues,
        rawOutput: latestValidation.rawCandidate,
        rawLlmOutput: extractRawLlmOutputFromGatewaySummary(initialGatewaySummary),
      },
    });

  for (let attempt = 1; attempt <= MAX_PROSPECTING_REPAIR_ATTEMPTS; attempt += 1) {
    const repairPrompt = buildProspectingComplianceRepairPrompt({
      validationIssues: latestValidation.issues,
      invalidOutput: latestValidation.rawCandidate,
      attempt,
      maxAttempts: MAX_PROSPECTING_REPAIR_ATTEMPTS,
    });

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "prospecting_configuration_repair_requested",
      message: "Requested a compliant prospecting review payload from the agent.",
      context: {
        userId: currentUser.id,
        requestedAgent,
        gatewayRunId: latestGatewaySummary?.id ?? initialGatewayRunId,
        repairPrompt,
        validationIssues: latestValidation.issues,
        repairAttempt: attempt,
        maxRepairAttempts: MAX_PROSPECTING_REPAIR_ATTEMPTS,
      },
    });

    const repairRun = await agentGatewayClient.startRun({
      input_text: repairPrompt,
      request_type: "prospecting_configuration_review_repair",
      requested_agent: requestedAgent,
      session: {
        title: "Prospecting Configuration Review Repair",
        metadata: {
          module: "idea_foundry",
          feature: "prospecting_configuration_review_repair",
          user_id: currentUser.id,
          repair_attempt: attempt,
          max_repair_attempts: MAX_PROSPECTING_REPAIR_ATTEMPTS,
          repair_for_gateway_run_id: latestGatewaySummary?.id ?? initialGatewayRunId,
          initial_gateway_run_id: initialGatewayRunId,
        },
      },
      context: {
        current_prospecting_configuration: currentSnapshot,
        recent_result_records: recentResultRecords,
        invalid_review_output: latestValidation.rawCandidate,
        compliance_issues: latestValidation.issues,
        repair_attempt: attempt,
        max_repair_attempts: MAX_PROSPECTING_REPAIR_ATTEMPTS,
      },
    });

    latestGatewaySummary = await agentGatewayClient.waitForRunCompletion(repairRun.id);

    await createLogEntry(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "prospecting_configuration_repair_summary_received",
      message: "Received the repaired prospecting review output from the agent gateway.",
      context: {
        userId: currentUser.id,
        requestedAgent,
        gatewayRunId: latestGatewaySummary?.id ?? repairRun.id ?? null,
        gatewayStatus: latestGatewaySummary?.status ?? null,
        normalizedOutput: latestGatewaySummary?.normalized_output ?? null,
        rawLlmOutput: extractRawLlmOutputFromGatewaySummary(latestGatewaySummary),
        parsedJsonOutput: extractParsedJsonOutputFromGatewaySummary(latestGatewaySummary),
        repairAttempt: attempt,
        maxRepairAttempts: MAX_PROSPECTING_REPAIR_ATTEMPTS,
      },
    });

    latestValidation = validateProspectingReviewOutput(extractProspectingReviewCandidate(latestGatewaySummary));
    if (latestValidation.success) {
      return {
        normalizedOutput: attachProspectingReviewMeta(latestValidation.data, {
          repairedAfterValidationFailure: true,
          initialGatewayRunId,
          repairAttemptsUsed: attempt,
          maxRepairAttempts: MAX_PROSPECTING_REPAIR_ATTEMPTS,
        }),
        effectiveGatewaySummary: latestGatewaySummary,
      };
    }

    await createLogEntry(prisma, {
      level: "warn",
      scope: "idea-foundry",
      event: "prospecting_configuration_repair_validation_failed",
      message: "The repaired prospecting review payload was still non-compliant.",
      context: {
        userId: currentUser.id,
        requestedAgent,
        gatewayRunId: latestGatewaySummary?.id ?? repairRun.id ?? null,
        validationIssues: latestValidation.issues,
        rawOutput: latestValidation.rawCandidate,
        rawLlmOutput: extractRawLlmOutputFromGatewaySummary(latestGatewaySummary),
        repairAttempt: attempt,
        maxRepairAttempts: MAX_PROSPECTING_REPAIR_ATTEMPTS,
      },
    });
  }

  return {
    normalizedOutput: buildFallbackProspectingReview(
      latestValidation.rawCandidate,
      currentSnapshot,
      {
        fallbackReason: "non_compliant_output_after_max_repairs",
        validationIssues: latestValidation.issues,
        initialGatewayRunId,
        repairGatewayRunId: latestGatewaySummary?.id ?? null,
        repairAttemptsUsed: MAX_PROSPECTING_REPAIR_ATTEMPTS,
        maxRepairAttempts: MAX_PROSPECTING_REPAIR_ATTEMPTS,
      }
    ),
    effectiveGatewaySummary: latestGatewaySummary,
  };
}

function validateProspectingReviewOutput(output) {
  const parsed = parseProspectingReviewCandidate(output);
  if (!parsed.success) {
    return parsed;
  }

  const validation = prospectingReviewSchema.safeParse(parsed.rawCandidate);
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

function extractProspectingReviewCandidate(summary) {
  const normalized = summary?.normalized_output;

  if (!normalized || typeof normalized !== "object") {
    return normalized ?? null;
  }

  if (looksLikeProspectingReviewPayload(normalized)) {
    return normalized;
  }

  const rawLlmOutput = extractRawLlmOutputFromGatewaySummary(summary);
  if (typeof rawLlmOutput === "string" && rawLlmOutput.trim()) {
    return rawLlmOutput;
  }

  const generatedOutput = extractGeneratedOutputFromArtifact(normalized);
  if (typeof generatedOutput === "string" && generatedOutput.trim()) {
    return generatedOutput;
  }

  return normalized;
}

function parseProspectingReviewCandidate(output) {
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      return {
        success: true,
        rawCandidate: parsed,
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
          message: "Output must be a JSON object matching the prospecting review schema.",
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

function looksLikeProspectingReviewPayload(output) {
  if (!output || typeof output !== "object") {
    return false;
  }

  return [
    "reply_to_user",
    "strategy_review_overview",
    "current_strategy_assessment",
    "recommended_strategy_update",
    "proposed_changes",
    "review_flags",
  ].every((key) => Object.prototype.hasOwnProperty.call(output, key));
}

function attachProspectingReviewMeta(review, metaPatch = {}) {
  return {
    ...review,
    meta: {
      ...(review?.meta && typeof review.meta === "object" ? review.meta : {}),
      ...metaPatch,
    },
  };
}

function extractRawLlmOutputFromGatewaySummary(summary) {
  const candidate = summary?.normalized_output?.debug?.raw_llm_output;
  return typeof candidate === "string" ? candidate : null;
}

function extractParsedJsonOutputFromGatewaySummary(summary) {
  const rawLlmOutput = extractRawLlmOutputFromGatewaySummary(summary);
  if (typeof rawLlmOutput === "string" && rawLlmOutput.trim()) {
    try {
      return JSON.parse(rawLlmOutput);
    } catch {
      return null;
    }
  }

  const normalizedOutput = summary?.normalized_output;
  return normalizedOutput && typeof normalizedOutput === "object" ? normalizedOutput : null;
}

function extractGeneratedOutputFromArtifact(normalizedOutput) {
  const sections = Array.isArray(normalizedOutput?.artifact?.sections)
    ? normalizedOutput.artifact.sections
    : [];
  const generatedOutputSection = sections.find(
    (section) =>
      typeof section?.heading === "string" &&
      section.heading.trim().toLowerCase() === "generated output" &&
      typeof section?.content === "string"
  );

  return generatedOutputSection?.content ?? null;
}

function buildProspectingComplianceRepairPrompt({ validationIssues, invalidOutput, attempt, maxAttempts }) {
  return [
    `Your previous reply did not comply with the required prospecting configuration review JSON schema. This is repair attempt ${attempt} of ${maxAttempts}.`,
    "Please return the response again and comply exactly with the required output format.",
    "Do not wrap the response in markdown.",
    "Do not include commentary outside the JSON object.",
    "Every required field must be present and use the expected types and enum values.",
    "",
    "Validation issues to fix:",
    JSON.stringify(validationIssues ?? [], null, 2),
    "",
    "Previous non-compliant output:",
    JSON.stringify(invalidOutput ?? null, null, 2),
    "",
    "Return only one JSON object with these top-level keys:",
    JSON.stringify(
      [
        "reply_to_user",
        "strategy_review_overview",
        "current_strategy_assessment",
        "recommended_strategy_update",
        "proposed_changes",
        "review_flags",
      ],
      null,
      2
    ),
  ].join("\n");
}

function buildFallbackProspectingReview(candidate, currentSnapshot = {}, metaOverrides = {}) {
  const artifact = candidate?.artifact;
  if (!artifact || typeof artifact !== "object") {
    return attachProspectingReviewMeta({
      reply_to_user: {
        content:
          "The Prospecting Agent did not return a compliant structured configuration update, so the current configuration was kept unchanged.",
      },
      strategy_review_overview: {
        assessment: {
          label: "No structured update returned",
          reason: "The gateway response could not be validated against the agreed prospecting configuration schema.",
          next_best_action: "Keep the current configuration active and update the prospecting agent to return the agreed schema.",
        },
      },
      current_strategy_assessment: {
        summary: "The current strategy was preserved because the gateway response was not schema-compliant.",
        observed_strengths: [],
        observed_weaknesses: [],
        notable_gaps: ["Structured prospecting review output was not returned by the gateway."],
        status: {
          label: "Configuration preserved",
          tone: "cautious",
          agent_confidence: "Low confidence",
          explanation: "The completed run did not contain the agreed structured review schema, so no automatic strategy edits were applied.",
        },
      },
      recommended_strategy_update: buildFallbackProspectingUpdate(currentSnapshot),
      proposed_changes: [],
      review_flags: [
        {
          severity: "medium",
          area: "Agent output contract",
          message: "The gateway completed the run without returning the agreed structured prospecting review schema.",
          recommended_operator_action: "Keep the current configuration active and update the prospecting agent contract before relying on automatic changes.",
        },
      ],
    }, {
      usedFallback: true,
      fallbackReason: "non_object_or_missing_artifact",
      ...metaOverrides,
    });
  }

  const artifactSummary = String(artifact.summary ?? "").trim();
  const artifactKind = typeof artifact.kind === "string" ? artifact.kind : "unknown";

  return attachProspectingReviewMeta({
    reply_to_user: {
      content: artifactSummary
        ? `The Prospecting Agent completed a review but did not return a structured configuration update, so the current configuration was kept unchanged. Gateway summary: ${artifactSummary}`
        : "The Prospecting Agent completed a review but did not return a structured configuration update, so the current configuration was kept unchanged.",
    },
    strategy_review_overview: {
      assessment: {
        label: "No structured update returned",
        reason:
          artifactSummary ||
          "The gateway completed the request without returning the agreed prospecting configuration schema.",
        next_best_action: "Keep the current configuration active and update the prospecting agent to return the agreed schema.",
      },
    },
    current_strategy_assessment: {
      summary:
        artifactSummary ||
        "The current strategy was preserved because the gateway response did not include a structured review payload.",
      observed_strengths: [],
      observed_weaknesses: [],
      notable_gaps: ["Structured prospecting review output was not returned by the gateway."],
      status: {
        label: "Configuration preserved",
        tone: "cautious",
        agent_confidence: "Low confidence",
        explanation: "The completed run did not contain the agreed structured review schema, so no automatic strategy edits were applied.",
      },
    },
    recommended_strategy_update: buildFallbackProspectingUpdate(currentSnapshot),
    proposed_changes: [],
    review_flags: [
      {
        severity: "medium",
        area: "Agent output contract",
        message: "The gateway completed the run without returning the agreed structured prospecting review schema.",
        recommended_operator_action: "Keep the current configuration active and update the prospecting agent contract before relying on automatic changes.",
      },
    ],
  }, {
      usedFallback: true,
      fallbackReason: "missing_recommended_strategy_update",
      artifactKind,
      ...metaOverrides,
    });
}

function buildFallbackProspectingUpdate(currentSnapshot = {}) {
  const safeObjective = currentSnapshot?.objective ?? {};
  const safeCadence = currentSnapshot?.cadence ?? {};

  return {
    prospecting_objective: {
      objective_name: safeObjective.name ?? "",
      description: safeObjective.description ?? "",
      target_domain: safeObjective.targetDomain ?? "",
      include_themes: splitTextList(safeObjective.includeKeywords),
      exclude_themes: splitTextList(safeObjective.excludeThemes),
    },
    search_strategy: {
      summary: currentSnapshot?.strategySummary ?? "",
      strategy_patterns: buildFallbackStrategyPatterns(currentSnapshot?.strategyPatterns),
      steering_hypothesis: currentSnapshot?.steeringHypothesis ?? "",
    },
    search_themes: buildFallbackThemes(currentSnapshot?.themes),
    source_mix: buildFallbackSources(currentSnapshot?.sources),
    query_families: buildFallbackQueryFamilies(currentSnapshot?.queryFamilies),
    signal_quality_criteria: buildFallbackSignalRules(currentSnapshot?.signalRules),
    scan_policy: {
      run_mode: normalizeRunMode(safeCadence.runMode),
      cadence: safeCadence.cadence ?? "",
      max_results_per_run: Number.isFinite(safeCadence.maxResultsPerRun) ? safeCadence.maxResultsPerRun : 0,
      promotion_threshold: safeCadence.reviewThreshold ?? "",
      geographic_scope: splitTextList(safeCadence.geographicScope),
      language_scope: splitTextList(safeCadence.languageScope),
      guardrails: splitTextList(safeCadence.budgetGuardrail),
    },
  };
}

function splitTextList(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildFallbackStrategyPatterns(patterns) {
  if (!Array.isArray(patterns)) {
    return [];
  }

  return patterns.map((pattern) => ({
    key: pattern.id ?? pattern.key ?? pattern.label ?? "strategy-pattern",
    label: pattern.label ?? "",
    enabled: Boolean(pattern.selected ?? pattern.enabled),
    priority: normalizePriorityValue(pattern.priority),
    rationale: pattern.description ?? "",
  }));
}

function buildFallbackThemes(themes) {
  if (!Array.isArray(themes)) {
    return [];
  }

  return themes.map((theme) => ({
    label: theme.label ?? "",
    status: normalizeThemeStatus(theme.status),
    priority: normalizePriorityValue(theme.priority),
    rationale: theme.rationale ?? "",
  }));
}

function buildFallbackSources(sources) {
  if (!Array.isArray(sources)) {
    return [];
  }

  return sources.map((source) => ({
    label: source.label ?? "",
    enabled: Boolean(source.enabled),
    expected_signal_type: source.signalType ?? "",
    rationale: source.description ?? "",
    review_frequency: source.reviewFrequency ?? "",
  }));
}

function buildFallbackQueryFamilies(queryFamilies) {
  if (!Array.isArray(queryFamilies)) {
    return [];
  }

  return queryFamilies.map((family) => ({
    title: family.title ?? "",
    intent: family.intent ?? "",
    representative_queries: Array.isArray(family.representativeQueries) ? family.representativeQueries : [],
    theme_link: family.themeLink ?? "",
    source_applicability: Array.isArray(family.sourceApplicability) ? family.sourceApplicability : [],
    status: normalizeQueryFamilyStatus(family.status),
    rationale: family.confidence ?? "",
  }));
}

function buildFallbackSignalRules(signalRules) {
  if (!Array.isArray(signalRules)) {
    return [];
  }

  return signalRules.map((rule) => ({
    title: rule.title ?? "",
    description: rule.description ?? "",
    enabled: Boolean(rule.enabled),
    strictness: normalizeStrictnessValue(rule.strictness),
    rationale: "",
  }));
}

function normalizeRunMode(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.includes("manual")) {
    return "manual-only";
  }
  if (normalized.includes("continuous")) {
    return "continuous";
  }
  return "scheduled";
}

function normalizePriorityValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function normalizeThemeStatus(value) {
  return String(value ?? "").trim().toLowerCase() === "paused" ? "paused" : "active";
}

function normalizeQueryFamilyStatus(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "paused") {
    return "paused";
  }
  return "active";
}

function normalizeStrictnessValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function buildUiSnapshotFromAgentReview(review, previousSnapshot = {}) {
  const config = review.recommended_strategy_update ?? {};
  const objective = config.prospecting_objective ?? {};
  const strategy = config.search_strategy ?? {};
  const scanPolicy = config.scan_policy ?? {};

  return {
    ...previousSnapshot,
    agentState: "active",
    strategyMode: inferStrategyMode(strategy),
    lastRun: "Just now",
    nextRun: inferNextRunLabel(scanPolicy),
    objective: {
      name: objective.objective_name ?? "",
      description: objective.description ?? "",
      targetDomain: objective.target_domain ?? "",
      searchPosture: inferSearchPosture(strategy),
      includeKeywords: Array.isArray(objective.include_themes) ? objective.include_themes.join(", ") : "",
      excludeThemes: Array.isArray(objective.exclude_themes) ? objective.exclude_themes.join(", ") : "",
      operatorNote:
        review.meta?.usedFallback
          ? previousSnapshot.objective?.operatorNote ?? ""
          : review.strategy_review_overview?.assessment?.next_best_action ??
            review.reply_to_user?.content ??
            previousSnapshot.objective?.operatorNote ??
            "",
    },
    strategySummary: strategy.summary ?? "",
    steeringHypothesis: strategy.steering_hypothesis ?? "",
    strategyPatterns: Array.isArray(strategy.strategy_patterns)
      ? strategy.strategy_patterns.map((pattern) => ({
          id: pattern.key ?? slugify(pattern.label ?? "pattern"),
          label: pattern.label ?? pattern.key ?? "Strategy pattern",
          description: pattern.rationale ?? "",
          selected: Boolean(pattern.enabled),
          priority: capitalizePriority(pattern.priority),
        }))
      : previousSnapshot.strategyPatterns ?? [],
    themes: Array.isArray(config.search_themes)
      ? config.search_themes.map((theme) => ({
          id: slugify(theme.label ?? "theme"),
          label: theme.label ?? "",
          status: theme.status === "paused" ? "paused" : "active",
          priority: capitalizePriority(theme.priority),
          rationale: theme.rationale ?? "",
        }))
      : previousSnapshot.themes ?? [],
    sources: Array.isArray(config.source_mix)
      ? config.source_mix.map((source) => ({
          id: slugify(source.label ?? "source"),
          label: source.label ?? "",
          description: source.rationale ?? "",
          enabled: Boolean(source.enabled),
          freshness: "Unknown",
          signalType: source.expected_signal_type ?? "",
          noiseProfile: "Unknown",
          reviewFrequency: source.review_frequency ?? "",
        }))
      : previousSnapshot.sources ?? [],
    queryFamilies: Array.isArray(config.query_families)
      ? config.query_families.map((family, index) => ({
          id: slugify(family.title ?? `query-family-${index + 1}`),
          title: family.title ?? "",
          intent: family.intent ?? "",
          representativeQueries: Array.isArray(family.representative_queries) ? family.representative_queries : [],
          themeLink: family.theme_link ?? "",
          sourceApplicability: Array.isArray(family.source_applicability) ? family.source_applicability : [],
          status: capitalizeStatus(family.status),
          confidence: family.status === "watch" ? "Watching" : family.status === "paused" ? "Useful" : "Promising",
          expanded: index < 2,
          priorityRank: index + 1,
        }))
      : previousSnapshot.queryFamilies ?? [],
    signalRules: Array.isArray(config.signal_quality_criteria)
      ? config.signal_quality_criteria.map((rule) => ({
          id: slugify(rule.title ?? "rule"),
          title: rule.title ?? "",
          description: rule.description ?? "",
          enabled: Boolean(rule.enabled),
          strictness: capitalizePriority(rule.strictness),
        }))
      : previousSnapshot.signalRules ?? [],
    cadence: {
      runMode: capitalizeRunMode(scanPolicy.run_mode),
      cadence: scanPolicy.cadence ?? "",
      maxResultsPerRun: scanPolicy.max_results_per_run ?? 0,
      reviewThreshold: scanPolicy.promotion_threshold ?? "",
      geographicScope: Array.isArray(scanPolicy.geographic_scope) ? scanPolicy.geographic_scope.join(", ") : "",
      languageScope: Array.isArray(scanPolicy.language_scope) ? scanPolicy.language_scope.join(", ") : "",
      budgetGuardrail: Array.isArray(scanPolicy.guardrails) ? scanPolicy.guardrails.join("\n") : "",
    },
    recentMetrics: Array.isArray(previousSnapshot.recentMetrics) ? previousSnapshot.recentMetrics : [],
    recentChanges: buildRecentChanges(review, previousSnapshot.recentChanges),
  };
}

function buildRecentChanges(review, previousChanges = []) {
  if (!Array.isArray(review.proposed_changes) || review.proposed_changes.length === 0) {
    return previousChanges ?? [];
  }

  return review.proposed_changes.slice(0, 6).map((change, index) => ({
    id: `change-${index + 1}-${slugify(change.target ?? change.change_type ?? "change")}`,
    title: change.summary ?? change.change_type ?? "Proposed change",
    detail: change.reason ?? change.expected_effect ?? "",
    timestamp: "Just now",
  }));
}

function inferStrategyMode(strategy) {
  const hasHypothesis = typeof strategy?.steering_hypothesis === "string" && strategy.steering_hypothesis.trim().length > 0;
  const highPriorityPatterns = Array.isArray(strategy?.strategy_patterns)
    ? strategy.strategy_patterns.filter((pattern) => pattern.enabled && pattern.priority === "high").length
    : 0;

  if (hasHypothesis && highPriorityPatterns >= 3) {
    return "Focused search";
  }

  if (hasHypothesis) {
    return "Hypothesis test";
  }

  return "Broad exploration";
}

function inferSearchPosture(strategy) {
  return inferStrategyMode(strategy) === "Broad exploration" ? "Broad exploration" : "Targeted exploration";
}

function capitalizePriority(priority) {
  switch ((priority ?? "").toLowerCase()) {
    case "high":
      return "High";
    case "low":
      return "Low";
    default:
      return "Medium";
  }
}

function capitalizeStatus(status) {
  switch ((status ?? "").toLowerCase()) {
    case "paused":
      return "Paused";
    case "watch":
      return "Watch";
    default:
      return "Active";
  }
}

function capitalizeRunMode(runMode) {
  switch ((runMode ?? "").toLowerCase()) {
    case "continuous":
      return "Continuous";
    case "manual-only":
      return "Manual only";
    default:
      return "Scheduled";
  }
}

function inferNextRunAt(scanPolicy, now) {
  if ((scanPolicy?.run_mode ?? "").toLowerCase() === "manual-only") {
    return null;
  }

  const cadence = (scanPolicy?.cadence ?? "").toLowerCase();
  const next = new Date(now.getTime());

  if (cadence.includes("hour")) {
    next.setHours(next.getHours() + 1);
    return next;
  }

  if (cadence.includes("daily")) {
    next.setDate(next.getDate() + 1);
    return next;
  }

  next.setHours(next.getHours() + 4);
  return next;
}

function inferNextRunLabel(scanPolicy) {
  if ((scanPolicy?.run_mode ?? "").toLowerCase() === "manual-only") {
    return "Manual only";
  }

  return scanPolicy?.cadence ?? "Scheduled";
}

function buildReviewScanPolicy(snapshot = {}) {
  const cadence = snapshot?.cadence ?? {};

  return {
    run_mode: "scheduled",
    cadence: "Every hour",
  };
}

function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function buildProspectingExecutionPlan(snapshot = {}) {
  const activeFamilies = Array.isArray(snapshot.queryFamilies)
    ? snapshot.queryFamilies
        .filter((family) => String(family?.status ?? "").toLowerCase() !== "paused")
        .sort((left, right) => (left.priorityRank ?? Number.MAX_SAFE_INTEGER) - (right.priorityRank ?? Number.MAX_SAFE_INTEGER))
    : [];
  const plan = [];

  for (const family of activeFamilies) {
    const queries = Array.isArray(family.representativeQueries) ? family.representativeQueries : [];
    for (const query of queries.slice(0, 2)) {
      if (typeof query !== "string" || !query.trim()) {
        continue;
      }
      plan.push({
        query: query.trim(),
        queryFamilyId: family.id ?? slugify(family.title ?? "query-family"),
        queryFamilyTitle: family.title ?? "Query family",
        themeLink: family.themeLink ?? "",
        sourceApplicability: Array.isArray(family.sourceApplicability) ? family.sourceApplicability : [],
      });
      if (plan.length >= MAX_EXECUTION_QUERIES) {
        return plan;
      }
    }
  }

  return plan;
}

function normalizeProspectingSearchResults(results, queryPlan, { executedQuery = queryPlan?.query } = {}) {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .filter((result) => typeof result?.url === "string" && result.url.trim())
    .map((result, index) => ({
      id: randomUUID(),
      query: queryPlan.query,
      executedQuery,
      queryFamilyId: queryPlan.queryFamilyId,
      queryFamilyTitle: queryPlan.queryFamilyTitle,
      themeLink: queryPlan.themeLink,
      sourceApplicability: queryPlan.sourceApplicability,
      sourceTitle: typeof result.title === "string" ? result.title.trim() : "",
      sourceUrl: result.url.trim(),
      snippet: typeof result.snippet === "string" ? result.snippet.trim() : "",
      provider: typeof result.provider === "string" ? result.provider : "web_search",
      rank: Number.isFinite(result.rank) ? result.rank : index + 1,
      capturedAt: new Date().toISOString(),
    }));
}

function deduplicateResultRecords(records) {
  const seenUrls = new Set();
  const deduplicated = [];

  for (const record of records) {
    const key = String(record?.sourceUrl ?? "").trim().toLowerCase();
    if (!key || seenUrls.has(key)) {
      continue;
    }
    seenUrls.add(key);
    deduplicated.push(record);
  }

  return deduplicated;
}

function buildSimplifiedSearchRetryQuery(query) {
  const normalized = String(query ?? "").trim();
  if (!normalized) {
    return null;
  }

  const hasBooleanSyntax = /\bOR\b|\bAND\b|"/i.test(normalized);
  if (!hasBooleanSyntax) {
    return null;
  }

  const simplified = normalized
    .replace(/"/g, " ")
    .replace(/\bOR\b/gi, " ")
    .replace(/\bAND\b/gi, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!simplified || simplified.toLowerCase() === normalized.toLowerCase()) {
    return null;
  }

  return simplified;
}

module.exports = {
  executeProspectingConfiguration,
  buildProspectingReviewPrompt,
  buildUiSnapshotFromAgentReview,
  getProspectingConfiguration,
  getProspectingPipelineContents,
  runProspectingOptimizationCycle,
  validateProspectingReviewOutput,
  runProspectingConfigurationReview,
};
