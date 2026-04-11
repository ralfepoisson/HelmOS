const { randomUUID } = require("node:crypto");

const { createLogEntry } = require("./log-entry.service");

const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_POLL_MS = 60_000;
const DEFAULT_UPCOMING_RUN_COUNT = 5;

function normalizeIntervalMinutes(value) {
  const candidate = Number(value);
  if (!Number.isInteger(candidate) || candidate < 60) {
    return DEFAULT_INTERVAL_MINUTES;
  }

  return candidate;
}

function toDate(value) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoString(value) {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
}

function buildUpcomingPipelineRuns(schedule, options = {}) {
  const count = Number.isInteger(options.count) && options.count > 0 ? options.count : DEFAULT_UPCOMING_RUN_COUNT;
  const enabled = Boolean(schedule?.enabled);
  const intervalMinutes = normalizeIntervalMinutes(schedule?.intervalMinutes);
  const nextRunAt = toDate(schedule?.nextRunAt);

  if (!enabled || !nextRunAt) {
    return [];
  }

  return Array.from({ length: count }, (_value, index) => {
    const slot = new Date(nextRunAt.getTime() + index * intervalMinutes * 60 * 1000);
    return slot.toISOString();
  });
}

function normalizeScheduleRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: typeof record.id === "string" ? record.id : null,
    ownerUserId: record.ownerUserId ?? record.owner_user_id ?? null,
    enabled: Boolean(record.enabled),
    intervalMinutes: normalizeIntervalMinutes(record.intervalMinutes ?? record.interval_minutes),
    lastRunAt: toIsoString(record.lastRunAt ?? record.last_run_at),
    nextRunAt: toIsoString(record.nextRunAt ?? record.next_run_at),
    updatedAt: toIsoString(record.updatedAt ?? record.updated_at),
  };
}

function buildScheduleResponse(record) {
  const normalized = normalizeScheduleRecord(record);
  if (!normalized) {
    return {
      enabled: false,
      intervalMinutes: DEFAULT_INTERVAL_MINUTES,
      lastRunAt: null,
      nextRunAt: null,
      upcomingRuns: [],
    };
  }

  return {
    enabled: normalized.enabled,
    intervalMinutes: normalized.intervalMinutes,
    lastRunAt: normalized.lastRunAt,
    nextRunAt: normalized.nextRunAt,
    upcomingRuns: buildUpcomingPipelineRuns(normalized),
  };
}

function computeNextRunAt(enabled, intervalMinutes, currentTime) {
  if (!enabled) {
    return null;
  }

  const baseTime = toDate(currentTime) ?? new Date();
  return new Date(baseTime.getTime() + intervalMinutes * 60 * 1000);
}

async function ensureIdeaFoundryPipelineScheduleTable(prisma) {
  if (!prisma || typeof prisma.$executeRawUnsafe !== "function") {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS idea_foundry_pipeline_schedules (
      id UUID PRIMARY KEY,
      owner_user_id UUID NOT NULL UNIQUE,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      interval_minutes INTEGER NOT NULL DEFAULT 60,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_if_pipeline_schedules_owner_user_id ON idea_foundry_pipeline_schedules (owner_user_id)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_if_pipeline_schedules_next_run_at ON idea_foundry_pipeline_schedules (next_run_at)`,
  );
}

async function loadPipelineScheduleRecord(prisma, ownerUserId) {
  if (!prisma || typeof prisma.$queryRawUnsafe !== "function") {
    return null;
  }

  await ensureIdeaFoundryPipelineScheduleTable(prisma);
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT id, owner_user_id, enabled, interval_minutes, last_run_at, next_run_at, updated_at
      FROM idea_foundry_pipeline_schedules
      WHERE owner_user_id = $1::uuid
      LIMIT 1
    `,
    ownerUserId,
  );

  return normalizeScheduleRecord(Array.isArray(rows) ? rows[0] : null);
}

async function upsertPipelineScheduleRecord(prisma, ownerUserId, data) {
  await ensureIdeaFoundryPipelineScheduleTable(prisma);

  const nextRunAt = data.nextRunAt ? toDate(data.nextRunAt) : null;
  const updatedAt = toDate(data.updatedAt) ?? new Date();
  const rows = await prisma.$queryRawUnsafe(
    `
      INSERT INTO idea_foundry_pipeline_schedules (
        id,
        owner_user_id,
        enabled,
        interval_minutes,
        last_run_at,
        next_run_at,
        updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3::boolean, $4::integer, $5::timestamptz, $6::timestamptz, $7::timestamptz)
      ON CONFLICT (owner_user_id)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        interval_minutes = EXCLUDED.interval_minutes,
        next_run_at = EXCLUDED.next_run_at,
        updated_at = EXCLUDED.updated_at
      RETURNING id, owner_user_id, enabled, interval_minutes, last_run_at, next_run_at, updated_at
    `,
    randomUUID(),
    ownerUserId,
    Boolean(data.enabled),
    normalizeIntervalMinutes(data.intervalMinutes),
    null,
    nextRunAt,
    updatedAt,
  );

  return normalizeScheduleRecord(Array.isArray(rows) ? rows[0] : null);
}

const testOnly = {
  upsertPipelineScheduleRecord,
};

async function getIdeaFoundryPipelineSchedule(prisma, ownerUserId) {
  const record = await loadPipelineScheduleRecord(prisma, ownerUserId);
  return buildScheduleResponse(record);
}

async function saveIdeaFoundryPipelineSchedule(prisma, ownerUserId, payload, options = {}) {
  const now = typeof options.now === "function" ? options.now() : new Date();
  const enabled = Boolean(payload?.enabled);
  const intervalMinutes = normalizeIntervalMinutes(payload?.intervalMinutes);
  const nextRunAt = computeNextRunAt(enabled, intervalMinutes, now);
  const savedRecord =
    prisma && typeof prisma.$transaction === "function"
      ? await prisma.$transaction(async (tx) =>
          testOnly.upsertPipelineScheduleRecord(tx, ownerUserId, {
            enabled,
            intervalMinutes,
            nextRunAt,
            updatedAt: now,
          }),
        )
      : await testOnly.upsertPipelineScheduleRecord(prisma, ownerUserId, {
          enabled,
          intervalMinutes,
          nextRunAt,
          updatedAt: now,
        });

  return buildScheduleResponse(
    savedRecord ?? {
      enabled,
      intervalMinutes,
      lastRunAt: null,
      nextRunAt,
    },
  );
}

async function loadDuePipelineSchedules(prisma, currentTime) {
  if (!prisma || typeof prisma.$queryRawUnsafe !== "function") {
    return [];
  }

  await ensureIdeaFoundryPipelineScheduleTable(prisma);
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT id, owner_user_id, enabled, interval_minutes, last_run_at, next_run_at, updated_at
      FROM idea_foundry_pipeline_schedules
      WHERE enabled = TRUE
        AND next_run_at IS NOT NULL
        AND next_run_at <= $1::timestamptz
      ORDER BY next_run_at ASC
    `,
    toDate(currentTime) ?? new Date(),
  );

  return (Array.isArray(rows) ? rows : []).map((row) => normalizeScheduleRecord(row)).filter(Boolean);
}

async function claimScheduleRun(prisma, schedule, claimedAt) {
  if (!prisma || typeof prisma.$queryRawUnsafe !== "function" || !schedule?.id || !schedule?.updatedAt) {
    return true;
  }

  const rows = await prisma.$queryRawUnsafe(
    `
      UPDATE idea_foundry_pipeline_schedules
      SET updated_at = $2::timestamptz
      WHERE id = $1::uuid
        AND updated_at = $3::timestamptz
      RETURNING id
    `,
    schedule.id,
    toDate(claimedAt) ?? new Date(),
    toDate(schedule.updatedAt),
  );

  return Array.isArray(rows) && rows.length === 1;
}

async function persistScheduleAfterTrigger(prisma, schedule, triggeredAt) {
  if (!prisma || typeof prisma.$queryRawUnsafe !== "function" || !schedule?.id) {
    return null;
  }

  const timestamp = toDate(triggeredAt) ?? new Date();
  const nextRunAt = computeNextRunAt(true, schedule.intervalMinutes, timestamp);
  const rows = await prisma.$queryRawUnsafe(
    `
      UPDATE idea_foundry_pipeline_schedules
      SET last_run_at = $2::timestamptz,
          next_run_at = $3::timestamptz,
          updated_at = $2::timestamptz
      WHERE id = $1::uuid
      RETURNING id, owner_user_id, enabled, interval_minutes, last_run_at, next_run_at, updated_at
    `,
    schedule.id,
    timestamp,
    nextRunAt,
  );

  return normalizeScheduleRecord(Array.isArray(rows) ? rows[0] : null);
}

function createIdeaFoundryPipelineScheduleRuntime({
  prisma,
  agentGatewayClient,
  pipelineRuntime,
  config = {},
  now = () => new Date(),
  loadDueSchedules = loadDuePipelineSchedules,
  claimScheduleRun: claimScheduleRunImpl = claimScheduleRun,
  persistScheduleAfterTrigger: persistScheduleAfterTriggerImpl = persistScheduleAfterTrigger,
  logEntryWriter = createLogEntry,
  onError = defaultRuntimeErrorReporter,
} = {}) {
  let timer = null;
  let draining = false;
  let schemaReady = true;
  const inFlightScheduleIds = new Set();

  async function tick() {
    if (draining || !pipelineRuntime || typeof pipelineRuntime.start !== "function") {
      return;
    }

    draining = true;
    try {
      const timestamp = now();
      const dueSchedules = await loadDueSchedules(prisma, timestamp);

      for (const schedule of dueSchedules) {
        if (!schedule?.id || inFlightScheduleIds.has(schedule.id)) {
          continue;
        }

        const claimed = await claimScheduleRunImpl(prisma, schedule, timestamp);
        if (!claimed) {
          continue;
        }

        inFlightScheduleIds.add(schedule.id);
        try {
          const result = await pipelineRuntime.start(prisma, agentGatewayClient, {
            ownerUserId: schedule.ownerUserId,
            startStage: "sources",
          });

          if (!result?.started) {
            continue;
          }

          await persistScheduleAfterTriggerImpl(prisma, schedule, timestamp);
          await logEntryWriter(prisma, {
            level: "info",
            scope: "idea-foundry",
            event: "idea_foundry_pipeline_schedule_triggered",
            message: "Triggered a scheduled Idea Foundry pipeline run.",
            context: {
              ownerUserId: schedule.ownerUserId,
              scheduleId: schedule.id,
              runId: result?.run?.runId ?? null,
              intervalMinutes: schedule.intervalMinutes,
              triggeredAt: toIsoString(timestamp),
            },
          });
        } finally {
          inFlightScheduleIds.delete(schedule.id);
        }
      }
    } finally {
      draining = false;
    }
  }

  return {
    async start() {
      if (timer) {
        return;
      }

      timer = setInterval(() => {
        tick().catch((error) => {
          onError(error);
        });
      }, Number.isFinite(config.pollMs) ? config.pollMs : DEFAULT_POLL_MS);

      if (typeof timer.unref === "function") {
        timer.unref();
      }

      try {
        await tick();
      } catch (error) {
        if (isPipelineScheduleSchemaMissing(error)) {
          schemaReady = false;
          return;
        }
        throw error;
      }
    },
    async stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    async triggerProcessingPass() {
      try {
        await tick();
      } catch (error) {
        if (isPipelineScheduleSchemaMissing(error)) {
          schemaReady = false;
          return;
        }
        throw error;
      }
    },
    isAvailable() {
      return schemaReady;
    },
  };
}

function isPipelineScheduleSchemaMissing(error) {
  return (
    error?.code === "P2021" &&
    typeof error?.message === "string" &&
    error.message.includes("idea_foundry_pipeline_schedules")
  );
}

function defaultRuntimeErrorReporter(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Idea Foundry pipeline schedule runtime tick failed: ${message}\n`);
}

module.exports = {
  __testOnly: testOnly,
  buildUpcomingPipelineRuns,
  claimScheduleRun,
  createIdeaFoundryPipelineScheduleRuntime,
  getIdeaFoundryPipelineSchedule,
  persistScheduleAfterTrigger,
  saveIdeaFoundryPipelineSchedule,
};
