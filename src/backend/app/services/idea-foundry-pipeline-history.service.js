const { buildPendingStageStates, normalizeStageKey } = require("./idea-foundry-pipeline.service");

const PIPELINE_RUN_START_EVENT = "idea_foundry_pipeline_run_started";
const PIPELINE_RUN_COMPLETED_EVENT = "idea_foundry_pipeline_run_completed";
const PIPELINE_RUN_FAILED_EVENT = "idea_foundry_pipeline_run_failed";
const STAGE_ORDER = ["sources", "proto-ideas", "idea-candidates", "curated-opportunities"];

async function listIdeaFoundryPipelineRuns(prisma, ownerUserId) {
  const runs = buildRunHistory(await loadIdeaFoundryRunLogs(prisma, ownerUserId));
  return runs.map(summarizeRun);
}

async function getIdeaFoundryPipelineRunDetail(prisma, ownerUserId, runId) {
  const runs = buildRunHistory(await loadIdeaFoundryRunLogs(prisma, ownerUserId));
  const match = runs.find((run) => run.runId === runId);
  if (!match) {
    return null;
  }

  return summarizeRunDetail(match);
}

async function loadIdeaFoundryRunLogs(prisma, ownerUserId) {
  const delegate = prisma?.logEntry;
  if (!delegate || typeof delegate.findMany !== "function") {
    return [];
  }

  try {
    const entries = await delegate.findMany({
      where: {
        scope: "idea-foundry",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1000,
    });

    return entries.filter((entry) => {
      const context = entry?.context;
      return context && context.ownerUserId === ownerUserId && typeof context.runId === "string" && context.runId.trim();
    });
  } catch {
    return [];
  }
}

function buildRunHistory(logEntries = []) {
  const grouped = new Map();
  const orderedLogs = [...(Array.isArray(logEntries) ? logEntries : [])].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  for (const entry of orderedLogs) {
    const runId = String(entry?.context?.runId ?? "").trim();
    if (!runId) {
      continue;
    }

    const current = grouped.get(runId) ?? {
      runId,
      ownerUserId: entry.context.ownerUserId ?? null,
      requestedStartStage: entry.context.requestedStartStage ?? "sources",
      startedAt: null,
      endedAt: null,
      status: "RUNNING",
      completedStageCount: 0,
      failedStageCount: 0,
      errorMessage: null,
      stageStates: buildPendingStageStates(),
      stages: [],
    };

    if (entry.event === PIPELINE_RUN_START_EVENT) {
      current.startedAt = toIsoString(entry.createdAt);
      current.requestedStartStage = entry.context?.requestedStartStage ?? current.requestedStartStage;
    } else if (entry.event === PIPELINE_RUN_COMPLETED_EVENT || entry.event === PIPELINE_RUN_FAILED_EVENT) {
      current.endedAt = toIsoString(entry.createdAt);
      current.status = String(entry.context?.status ?? (entry.event === PIPELINE_RUN_FAILED_EVENT ? "FAILED" : "COMPLETED"));
      current.completedStageCount = Number(entry.context?.completedStageCount ?? current.completedStageCount);
      current.failedStageCount = Number(entry.context?.failedStageCount ?? current.failedStageCount);
      current.errorMessage = entry.context?.errorMessage ?? null;
      current.stageStates = normalizeStageStates(entry.context?.stageStates, current.stageStates);
    } else if (entry.event.startsWith("idea_foundry_pipeline_stage_")) {
      current.stages.push({
        stageKey: normalizeStageKey(entry.context?.normalizedStageKey ?? entry.context?.stageKey) ?? String(entry.context?.stageKey ?? ""),
        status: String(entry.context?.status ?? "COMPLETED"),
        attempts: Number(entry.context?.attempts ?? 0),
        processedCount: Number(entry.context?.processedCount ?? entry.context?.totals?.processedCount ?? 0),
        producedCount: Number(entry.context?.producedCount ?? 0),
        totals: entry.context?.totals ?? {},
        startedAt: entry.context?.stageTimeline?.startedAt ?? null,
        endedAt: entry.context?.stageTimeline?.endedAt ?? toIsoString(entry.createdAt),
        history: Array.isArray(entry.context?.history) ? entry.context.history : [],
      });
    }

    grouped.set(runId, current);
  }

  return Array.from(grouped.values()).sort((left, right) => {
    return new Date(right.startedAt ?? 0).getTime() - new Date(left.startedAt ?? 0).getTime();
  });
}

function summarizeRun(run) {
  return {
    runId: run.runId,
    ownerUserId: run.ownerUserId,
    requestedStartStage: run.requestedStartStage,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    completedStageCount: run.completedStageCount,
    failedStageCount: run.failedStageCount,
    errorMessage: run.errorMessage,
  };
}

function summarizeRunDetail(run) {
  return {
    ...summarizeRun(run),
    stageStates: normalizeStageStates(run.stageStates),
    stages: [...run.stages].sort(
      (left, right) => STAGE_ORDER.indexOf(left.stageKey) - STAGE_ORDER.indexOf(right.stageKey),
    ),
  };
}

function normalizeStageStates(stageStates = {}, fallback = buildPendingStageStates()) {
  const normalized = { ...fallback };
  for (const key of STAGE_ORDER) {
    const value = stageStates?.[key];
    if (value === "pending" || value === "running" || value === "completed" || value === "failed") {
      normalized[key] = value;
    }
  }
  return normalized;
}

function toIsoString(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

module.exports = {
  getIdeaFoundryPipelineRunDetail,
  listIdeaFoundryPipelineRuns,
};
