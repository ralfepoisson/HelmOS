const { executeProspectingConfiguration } = require("./prospecting-configuration.service");
const { runIdeaEvaluationPass } = require("./idea-evaluation.service");
const { runIdeaRefinementPass } = require("./idea-refinement.service");
const { createLogEntry } = require("./log-entry.service");
const { runProtoIdeaExtractionPass } = require("./proto-idea-extraction.service");
const { randomUUID } = require("node:crypto");

const DEFAULT_MAX_STAGE_ITERATIONS = 100;
const PIPELINE_STAGE_KEYS = ["sources", "proto-ideas", "idea-candidates", "curated-opportunities"];

function buildPendingStageStates() {
  return {
    sources: "pending",
    "proto-ideas": "pending",
    "idea-candidates": "pending",
    "curated-opportunities": "pending",
  };
}

function normalizeStageKey(key) {
  switch (String(key ?? "").trim()) {
    case "proto-ideas":
    case "proto-idea":
      return "proto-ideas";
    case "idea-candidates":
    case "idea-refinement":
      return "idea-candidates";
    case "curated-opportunities":
    case "idea-evaluation":
    case "idea-evaluator":
      return "curated-opportunities";
    case "sources":
      return "sources";
    default:
      return null;
  }
}

function buildIdleRunState(ownerUserId = null) {
  return {
    runId: null,
    ownerUserId,
    status: "IDLE",
    startedAt: null,
    endedAt: null,
    stageStates: buildPendingStageStates(),
    stageResults: [],
    completedStageCount: 0,
    failedStageCount: 0,
    errorMessage: null,
  };
}

function deriveStageStatesFromStageResults(stageResults = [], baseState = buildPendingStageStates()) {
  const derived = {
    ...baseState,
  };

  for (const stageResult of Array.isArray(stageResults) ? stageResults : []) {
    const normalizedStageKey = normalizeStageKey(stageResult?.key);
    if (!normalizedStageKey) {
      continue;
    }

    const status = String(stageResult?.status ?? "").trim().toUpperCase();
    if (status === "COMPLETED") {
      derived[normalizedStageKey] = "completed";
      continue;
    }

    if (status === "FAILED" || status === "HALTED") {
      derived[normalizedStageKey] = "failed";
    }
  }

  const hasStageResults = Array.isArray(stageResults) && stageResults.length > 0;
  if (hasStageResults && derived.sources === "pending") {
    derived.sources = "completed";
  }

  return derived;
}

function shouldContinueStage(result) {
  if (!result || typeof result !== "object") {
    return false;
  }

  const processedCount = Number(result.processedCount ?? 0);
  const failedCount = Number(result.failedCount ?? 0);
  return processedCount > 0 && failedCount === 0;
}

function accumulateTotals(accumulator, result) {
  return {
    processedCount: Number(accumulator.processedCount ?? 0) + Number(result?.processedCount ?? 0),
    completedCount: Number(accumulator.completedCount ?? 0) + Number(result?.completedCount ?? 0),
    failedCount: Number(accumulator.failedCount ?? 0) + Number(result?.failedCount ?? 0),
    skippedCount: Number(accumulator.skippedCount ?? 0) + Number(result?.skippedCount ?? 0),
    createdCount: Number(accumulator.createdCount ?? 0) + Number(result?.createdCount ?? 0),
    updatedCount: Number(accumulator.updatedCount ?? 0) + Number(result?.updatedCount ?? 0),
    candidateCount: Number(accumulator.candidateCount ?? 0) + Number(result?.candidateCount ?? 0),
    promotedCount: Number(accumulator.promotedCount ?? 0) + Number(result?.promotedCount ?? 0),
    refinedCount: Number(accumulator.refinedCount ?? 0) + Number(result?.refinedCount ?? 0),
    rejectedCount: Number(accumulator.rejectedCount ?? 0) + Number(result?.rejectedCount ?? 0),
    opportunityCount: Number(accumulator.opportunityCount ?? 0) + Number(result?.opportunityCount ?? 0),
    resultRecordCount: Number(accumulator.resultRecordCount ?? 0) + Number(result?.resultRecordCount ?? 0),
  };
}

function buildDefaultStages() {
  return [
    {
      key: "sources",
      repeatWhileProgress: false,
      run: async (prisma, agentGatewayClient, options) =>
        executeProspectingConfiguration(prisma, agentGatewayClient, { id: options.ownerUserId }, options),
      mapResult: (result) => ({
        processedCount: Number(result?.runtime?.resultRecordCount ?? 0) > 0 ? 1 : 0,
        completedCount: 1,
        failedCount: 0,
        resultRecordCount: Number(result?.runtime?.resultRecordCount ?? 0),
      }),
    },
    {
      key: "proto-idea",
      run: runProtoIdeaExtractionPass,
    },
    {
      key: "idea-refinement",
      run: runIdeaRefinementPass,
    },
    {
      key: "curated-opportunities",
      run: runIdeaEvaluationPass,
    },
  ];
}

function createIdeaFoundryPipelineExecutor({
  stages = buildDefaultStages(),
  maxStageIterations = DEFAULT_MAX_STAGE_ITERATIONS,
  logEntryWriter = createLogEntry,
} = {}) {
  async function execute(prisma, agentGatewayClient, options = {}) {
    const stageResults = [];
    const onStageStateChange = typeof options.onStageStateChange === "function" ? options.onStageStateChange : null;
    const requestedStartStage = normalizeStageKey(options.startStage) ?? "sources";
    const ownerUserId =
      typeof options.ownerUserId === "string" && options.ownerUserId.trim().length > 0
        ? options.ownerUserId.trim()
        : null;
    const firstStageIndex = stages.findIndex((stage) => normalizeStageKey(stage.key) === requestedStartStage);
    const executableStages = firstStageIndex >= 0 ? stages.slice(firstStageIndex) : stages;

    for (const stage of executableStages) {
      const attempts = [];
      let totals = accumulateTotals({}, null);
      let status = "COMPLETED";
      let stopReason = "no_work_remaining";
      const normalizedStageKey = normalizeStageKey(stage.key);
      const stageStartedAt = new Date().toISOString();
      const beforeSnapshot = await snapshotStageData(prisma, ownerUserId, normalizedStageKey);

      if (normalizedStageKey) {
        onStageStateChange?.({
          stageKey: normalizedStageKey,
          status: "running",
        });
      }

      for (let iteration = 1; iteration <= maxStageIterations; iteration += 1) {
        const rawResult = await stage.run(prisma, agentGatewayClient, options);
        const result = typeof stage.mapResult === "function" ? stage.mapResult(rawResult) : rawResult;
        attempts.push(rawResult);
        totals = accumulateTotals(totals, result);

        if (Number(result?.failedCount ?? 0) > 0) {
          status = "FAILED";
          stopReason = "stage_failed";
          break;
        }

        if (!shouldContinueStage(result)) {
          stopReason = "no_work_remaining";
          break;
        }

        if (stage.repeatWhileProgress === false) {
          stopReason = "single_pass_stage";
          break;
        }

        if (iteration === maxStageIterations) {
          status = "HALTED";
          stopReason = "iteration_limit_reached";
        }
      }

      const stageEndedAt = new Date().toISOString();
      const afterSnapshot = await snapshotStageData(prisma, ownerUserId, normalizedStageKey);
      const history = buildStageHistory(normalizedStageKey, beforeSnapshot, afterSnapshot);
      const processedCount = Number(totals.processedCount ?? 0);
      const producedCount = deriveProducedCount(normalizedStageKey, totals, attempts.at(-1), history);

      stageResults.push({
        key: stage.key,
        status,
        stopReason,
        attempts: attempts.length,
        lastResult: attempts.at(-1) ?? null,
        totals,
        processedCount,
        producedCount,
        history,
        startedAt: stageStartedAt,
        endedAt: stageEndedAt,
      });

      if (normalizedStageKey) {
        onStageStateChange?.({
          stageKey: normalizedStageKey,
          status:
            status === "FAILED"
              ? "failed"
              : status === "COMPLETED"
                ? "completed"
                : "pending",
        });
      }

      await logEntryWriter(prisma, {
        level: status === "FAILED" ? "error" : "info",
        scope: "idea-foundry",
        event: `idea_foundry_pipeline_stage_${String(stage.key).replace(/[^a-z0-9]+/gi, "_")}`,
        message: "Executed an Idea Foundry pipeline stage.",
        context: {
          ownerUserId,
          runId: options.runId ?? null,
          stageKey: stage.key,
          normalizedStageKey,
          status,
          stopReason,
          attempts: attempts.length,
          totals,
          processedCount,
          producedCount,
          stageTimeline: {
            startedAt: stageStartedAt,
            endedAt: stageEndedAt,
          },
          history,
        },
      });

      if (status !== "COMPLETED") {
        return {
          status: status === "FAILED" ? "FAILED" : "HALTED",
          completedStageCount: stageResults.filter((entry) => entry.status === "COMPLETED").length,
          failedStageCount: stageResults.filter((entry) => entry.status === "FAILED").length,
          stageResults,
        };
      }
    }

    return {
      status: "COMPLETED",
      completedStageCount: stageResults.filter((entry) => entry.status === "COMPLETED").length,
      failedStageCount: 0,
      stageResults,
    };
  }

  return {
    execute,
  };
}

async function snapshotStageData(prisma, ownerUserId, normalizedStageKey) {
  if (!normalizedStageKey) {
    return {};
  }

  switch (normalizedStageKey) {
    case "sources":
      return { sources: await loadProspectingSourceSnapshot(prisma, ownerUserId) };
    case "proto-ideas":
      return {
        sourceProcessing: await loadProtoIdeaSourceSnapshot(prisma, ownerUserId),
        protoIdeas: await loadProtoIdeaSnapshot(prisma, ownerUserId),
      };
    case "idea-candidates":
      return {
        protoIdeas: await loadProtoIdeaSnapshot(prisma, ownerUserId),
        ideaCandidates: await loadIdeaCandidateSnapshot(prisma, ownerUserId),
      };
    case "curated-opportunities":
      return {
        ideaCandidates: await loadIdeaCandidateEvaluationSnapshot(prisma, ownerUserId),
        curatedOpportunities: await loadCuratedOpportunitySnapshot(prisma, ownerUserId),
      };
    default:
      return {};
  }
}

async function loadProspectingSourceSnapshot(prisma, ownerUserId) {
  if (!prisma?.prospectingConfiguration || typeof prisma.prospectingConfiguration.findFirst !== "function") {
    return [];
  }

  try {
    const record = await prisma.prospectingConfiguration.findFirst({
      where: {
        ownerUserId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        lastResultRecords: true,
      },
    });
    const records = Array.isArray(record?.lastResultRecords) ? record.lastResultRecords : [];
    return records.map((entry) => ({
      id: String(entry?.id ?? entry?.sourceKey ?? entry?.sourceUrl ?? ""),
      title: String(entry?.sourceTitle ?? entry?.title ?? entry?.query ?? "Untitled source"),
      summary: String(entry?.snippet ?? entry?.queryFamilyTitle ?? ""),
    }));
  } catch {
    return [];
  }
}

async function loadProtoIdeaSourceSnapshot(prisma, ownerUserId) {
  if (!prisma?.protoIdeaSource || typeof prisma.protoIdeaSource.findMany !== "function") {
    return [];
  }

  try {
    return await prisma.protoIdeaSource.findMany({
      where: {
        ownerUserId,
      },
      select: {
        id: true,
        sourceTitle: true,
        processingStatus: true,
      },
    });
  } catch {
    return [];
  }
}

async function loadProtoIdeaSnapshot(prisma, ownerUserId) {
  if (!prisma?.protoIdea || typeof prisma.protoIdea.findMany !== "function") {
    return [];
  }

  try {
    return await prisma.protoIdea.findMany({
      where: {
        ownerUserId,
      },
      select: {
        id: true,
        title: true,
        refinementStatus: true,
      },
    });
  } catch {
    return [];
  }
}

async function loadIdeaCandidateSnapshot(prisma, ownerUserId) {
  if (!prisma?.ideaCandidate || typeof prisma.ideaCandidate.findMany !== "function") {
    return [];
  }

  try {
    return await prisma.ideaCandidate.findMany({
      where: {
        ownerUserId,
      },
      select: {
        id: true,
        protoIdeaId: true,
        opportunityConcept: true,
        workflowState: true,
      },
    });
  } catch {
    return [];
  }
}

async function loadIdeaCandidateEvaluationSnapshot(prisma, ownerUserId) {
  if (!prisma?.ideaCandidate || typeof prisma.ideaCandidate.findMany !== "function") {
    return [];
  }

  try {
    return await prisma.ideaCandidate.findMany({
      where: {
        ownerUserId,
      },
      select: {
        id: true,
        opportunityConcept: true,
        workflowState: true,
        evaluationStatus: true,
        evaluationDecision: true,
      },
    });
  } catch {
    return [];
  }
}

async function loadCuratedOpportunitySnapshot(prisma, ownerUserId) {
  if (!prisma?.curatedOpportunity || typeof prisma.curatedOpportunity.findMany !== "function") {
    return [];
  }

  try {
    return await prisma.curatedOpportunity.findMany({
      where: {
        ownerUserId,
      },
      select: {
        id: true,
        ideaCandidateId: true,
        title: true,
      },
    });
  } catch {
    return [];
  }
}

function buildStageHistory(normalizedStageKey, beforeSnapshot = {}, afterSnapshot = {}) {
  switch (normalizedStageKey) {
    case "sources":
      return buildCreatedEvents({
        entityType: "source",
        beforeItems: beforeSnapshot.sources,
        afterItems: afterSnapshot.sources,
        summaryText: "Captured a new source result from the prospecting execution.",
      });
    case "proto-ideas":
      return [
        ...buildCreatedEvents({
          entityType: "proto-idea",
          beforeItems: beforeSnapshot.protoIdeas,
          afterItems: afterSnapshot.protoIdeas,
          summaryText: "Created a new proto-idea from the strongest source signal.",
        }),
        ...buildStateChangeEvents({
          entityType: "proto-idea-source",
          beforeItems: beforeSnapshot.sourceProcessing,
          afterItems: afterSnapshot.sourceProcessing,
          getState: (entry) => entry.processingStatus,
        }),
      ];
    case "idea-candidates":
      return [
        ...buildCreatedEvents({
          entityType: "idea-candidate",
          beforeItems: beforeSnapshot.ideaCandidates,
          afterItems: afterSnapshot.ideaCandidates,
          getTitle: (entry) => entry.opportunityConcept,
          summaryText: "Created a new idea candidate during refinement.",
        }),
        ...buildStateChangeEvents({
          entityType: "proto-idea",
          beforeItems: beforeSnapshot.protoIdeas,
          afterItems: afterSnapshot.protoIdeas,
          getTitle: (entry) => entry.title,
          getState: (entry) => entry.refinementStatus,
        }),
      ];
    case "curated-opportunities":
      return [
        ...buildCreatedEvents({
          entityType: "curated-opportunity",
          beforeItems: beforeSnapshot.curatedOpportunities,
          afterItems: afterSnapshot.curatedOpportunities,
          summaryText: "Promoted a new curated opportunity.",
        }),
        ...buildStateChangeEvents({
          entityType: "idea-candidate",
          beforeItems: beforeSnapshot.ideaCandidates,
          afterItems: afterSnapshot.ideaCandidates,
          getTitle: (entry) => entry.opportunityConcept,
          getState: (entry) =>
            [entry.workflowState, entry.evaluationStatus, entry.evaluationDecision].filter(Boolean).join(" / "),
        }),
      ];
    default:
      return [];
  }
}

function buildCreatedEvents({
  entityType,
  beforeItems = [],
  afterItems = [],
  getTitle = (entry) => entry.title,
  summaryText,
}) {
  const beforeIds = new Set((Array.isArray(beforeItems) ? beforeItems : []).map((entry) => String(entry?.id ?? "")));
  return (Array.isArray(afterItems) ? afterItems : [])
    .filter((entry) => {
      const id = String(entry?.id ?? "");
      return id.length > 0 && !beforeIds.has(id);
    })
    .map((entry) => ({
      kind: "created",
      entityType,
      entityId: String(entry.id),
      title: String(getTitle(entry) ?? "Untitled item"),
      summary: summaryText,
    }));
}

function buildStateChangeEvents({
  entityType,
  beforeItems = [],
  afterItems = [],
  getTitle = (entry) => entry.sourceTitle ?? entry.title ?? entry.opportunityConcept ?? "Untitled item",
  getState,
}) {
  if (typeof getState !== "function") {
    return [];
  }

  const beforeMap = new Map(
    (Array.isArray(beforeItems) ? beforeItems : []).map((entry) => [String(entry?.id ?? ""), entry]),
  );
  const events = [];

  for (const entry of Array.isArray(afterItems) ? afterItems : []) {
    const id = String(entry?.id ?? "");
    if (!id || !beforeMap.has(id)) {
      continue;
    }

    const previous = beforeMap.get(id);
    const fromState = String(getState(previous) ?? "");
    const toState = String(getState(entry) ?? "");
    if (!fromState || !toState || fromState === toState) {
      continue;
    }

    events.push({
      kind: "state_changed",
      entityType,
      entityId: id,
      title: String(getTitle(entry)),
      summary: `State changed from ${fromState} to ${toState}.`,
      fromState,
      toState,
    });
  }

  return events;
}

function deriveProducedCount(normalizedStageKey, totals = {}, lastResult = null, history = []) {
  switch (normalizedStageKey) {
    case "sources":
      return Number(totals.resultRecordCount ?? lastResult?.runtime?.resultRecordCount ?? history.length ?? 0);
    case "proto-ideas":
      return Number(totals.createdCount ?? history.filter((entry) => entry.kind === "created").length);
    case "idea-candidates":
      return Number(
        totals.candidateCount ??
          (Number(totals.createdCount ?? 0) + Number(totals.updatedCount ?? 0)) ??
          history.filter((entry) => entry.kind === "created").length,
      );
    case "curated-opportunities":
      return Number(
        totals.opportunityCount ??
          totals.promotedCount ??
          history.filter((entry) => entry.kind === "created").length,
      );
    default:
      return 0;
  }
}

function createIdeaFoundryPipelineRuntime({
  executor = createIdeaFoundryPipelineExecutor(),
  now = () => new Date().toISOString(),
  logEntryWriter = createLogEntry,
  createRunId = () => randomUUID(),
} = {}) {
  const runsByOwner = new Map();

  function getOwnerKey(ownerUserId) {
    if (typeof ownerUserId === "string" && ownerUserId.trim().length > 0) {
      return ownerUserId.trim();
    }

    return "__global__";
  }

  function getStatus(ownerUserId) {
    const ownerKey = getOwnerKey(ownerUserId);
    const current = runsByOwner.get(ownerKey);
    if (!current) {
      return buildIdleRunState(ownerUserId ?? null);
    }

    return {
      ...current,
      stageStates: deriveStageStatesFromStageResults(current.stageResults, current.stageStates),
      stageResults: Array.isArray(current.stageResults) ? [...current.stageResults] : [],
    };
  }

  async function start(prisma, agentGatewayClient, options = {}) {
    const ownerUserId =
      typeof options.ownerUserId === "string" && options.ownerUserId.trim().length > 0
        ? options.ownerUserId.trim()
        : null;
    const ownerKey = getOwnerKey(ownerUserId);
    const current = runsByOwner.get(ownerKey);

    if (current?.status === "RUNNING") {
      return {
        started: false,
        run: getStatus(ownerUserId),
      };
    }

    const runId = createRunId();
    const startedAt = now();
    const runState = {
      runId,
      ownerUserId,
      status: "RUNNING",
      startedAt,
      endedAt: null,
      stageStates: buildPendingStageStates(),
      stageResults: [],
      completedStageCount: 0,
      failedStageCount: 0,
      errorMessage: null,
    };

    runsByOwner.set(ownerKey, runState);

    await logEntryWriter(prisma, {
      level: "info",
      scope: "idea-foundry",
      event: "idea_foundry_pipeline_run_started",
      message: "Started an Idea Foundry pipeline run.",
      context: {
        ownerUserId,
        runId,
        requestedStartStage: normalizeStageKey(options.startStage) ?? "sources",
      },
    });

    void executor
      .execute(prisma, agentGatewayClient, {
        ...options,
        runId,
        ownerUserId,
        onStageStateChange(event) {
          const normalizedStageKey = normalizeStageKey(event?.stageKey);
          if (!normalizedStageKey) {
            return;
          }

          const latest = runsByOwner.get(ownerKey);
          if (!latest || latest.runId !== runId) {
            return;
          }

          latest.stageStates[normalizedStageKey] = event.status;
        },
      })
      .then(async (result) => {
        const latest = runsByOwner.get(ownerKey);
        if (!latest || latest.runId !== runId) {
          return;
        }

        latest.status = result.status;
        latest.endedAt = now();
        latest.stageResults = Array.isArray(result.stageResults) ? result.stageResults : [];
        latest.completedStageCount = Number(result.completedStageCount ?? 0);
        latest.failedStageCount = Number(result.failedStageCount ?? 0);
        latest.errorMessage = null;
        latest.stageStates = deriveStageStatesFromStageResults(latest.stageResults, latest.stageStates);

        await logEntryWriter(prisma, {
          level: result.status === "FAILED" ? "error" : "info",
          scope: "idea-foundry",
          event: "idea_foundry_pipeline_run_completed",
          message: "Completed an Idea Foundry pipeline run.",
          context: {
            ownerUserId,
            runId,
            status: result.status,
            completedStageCount: latest.completedStageCount,
            failedStageCount: latest.failedStageCount,
            stageStates: latest.stageStates,
          },
        });
      })
      .catch(async (error) => {
        const latest = runsByOwner.get(ownerKey);
        if (!latest || latest.runId !== runId) {
          return;
        }

        latest.status = "FAILED";
        latest.endedAt = now();
        latest.errorMessage = error instanceof Error ? error.message : "Pipeline execution failed.";
        const activeStageKey = PIPELINE_STAGE_KEYS.find((stageKey) => latest.stageStates[stageKey] === "running");
        if (activeStageKey) {
          latest.stageStates[activeStageKey] = "failed";
        }

        await logEntryWriter(prisma, {
          level: "error",
          scope: "idea-foundry",
          event: "idea_foundry_pipeline_run_failed",
          message: "Idea Foundry pipeline run failed.",
          context: {
            ownerUserId,
            runId,
            errorMessage: latest.errorMessage,
            status: latest.status,
            completedStageCount: latest.completedStageCount,
            failedStageCount: latest.failedStageCount,
            stageStates: latest.stageStates,
          },
        });
      });

    return {
      started: true,
      run: getStatus(ownerUserId),
    };
  }

  return {
    start,
    getStatus,
  };
}

module.exports = {
  buildPendingStageStates,
  createIdeaFoundryPipelineRuntime,
  createIdeaFoundryPipelineExecutor,
  deriveStageStatesFromStageResults,
  normalizeStageKey,
  shouldContinueStage,
};
