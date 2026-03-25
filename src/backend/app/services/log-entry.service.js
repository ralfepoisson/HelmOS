const { randomUUID } = require("node:crypto");

const DEFAULT_TIME_RANGE = "30m";
const SUPPORTED_LEVELS = ["info", "warn", "error"];
const TIME_RANGE_TO_MINUTES = {
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "6h": 360,
  "24h": 1440,
};

function getLogEntryDelegate(prisma) {
  return prisma?.logEntry && typeof prisma.logEntry.create === "function" ? prisma.logEntry : null;
}

function normalizeLevel(level) {
  const candidate = typeof level === "string" ? level.trim().toLowerCase() : "";
  return SUPPORTED_LEVELS.includes(candidate) ? candidate : "info";
}

function normalizeScope(scope) {
  if (typeof scope !== "string" || scope.trim().length === 0) {
    return "api";
  }

  return scope.trim().slice(0, 120);
}

function normalizeEvent(event) {
  if (typeof event !== "string" || event.trim().length === 0) {
    return "log_entry_created";
  }

  return event.trim().slice(0, 120);
}

function toSafeContext(context) {
  if (typeof context === "undefined") {
    return null;
  }

  return context;
}

async function ensureLogEntriesTable(prisma) {
  if (!prisma || typeof prisma.$executeRawUnsafe !== "function") {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS log_entries (
      id UUID PRIMARY KEY,
      level VARCHAR(20) NOT NULL,
      scope VARCHAR(120) NOT NULL,
      event VARCHAR(120) NOT NULL,
      message TEXT NOT NULL,
      context JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_log_entries_created_at ON log_entries (created_at DESC)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_log_entries_level_created_at ON log_entries (level, created_at DESC)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_log_entries_scope_created_at ON log_entries (scope, created_at DESC)`,
  );
}

async function createLogEntry(prisma, entry) {
  const delegate = getLogEntryDelegate(prisma);
  if (!delegate) {
    return null;
  }

  try {
    return await delegate.create({
      data: {
        id: entry.id ?? randomUUID(),
        level: normalizeLevel(entry.level),
        scope: normalizeScope(entry.scope),
        event: normalizeEvent(entry.event),
        message: typeof entry.message === "string" && entry.message.trim().length > 0
          ? entry.message.trim()
          : normalizeEvent(entry.event),
        context: toSafeContext(entry.context),
        createdAt: entry.createdAt ?? undefined,
      },
    });
  } catch (error) {
    if (error?.code === "P2021") {
      try {
        await ensureLogEntriesTable(prisma);
        return await delegate.create({
          data: {
            id: entry.id ?? randomUUID(),
            level: normalizeLevel(entry.level),
            scope: normalizeScope(entry.scope),
            event: normalizeEvent(entry.event),
            message: typeof entry.message === "string" && entry.message.trim().length > 0
              ? entry.message.trim()
              : normalizeEvent(entry.event),
            context: toSafeContext(entry.context),
            createdAt: entry.createdAt ?? undefined,
          },
        });
      } catch {
        return null;
      }
    }

    return null;
  }
}

function normalizeLevels(value) {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const normalized = rawValues
    .map((entry) => normalizeLevel(entry))
    .filter((entry, index, values) => values.indexOf(entry) === index);

  return normalized.length > 0 ? normalized : [...SUPPORTED_LEVELS];
}

function normalizeTimeRange(value) {
  const candidate = typeof value === "string" ? value.trim() : DEFAULT_TIME_RANGE;
  return Object.hasOwn(TIME_RANGE_TO_MINUTES, candidate) ? candidate : DEFAULT_TIME_RANGE;
}

function getCutoffDate(timeRange) {
  const minutes = TIME_RANGE_TO_MINUTES[normalizeTimeRange(timeRange)] ?? TIME_RANGE_TO_MINUTES[DEFAULT_TIME_RANGE];
  return new Date(Date.now() - minutes * 60 * 1000);
}

function matchesQuery(log, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    log.level,
    log.scope,
    log.event,
    log.message,
    log.context ? JSON.stringify(log.context) : "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function countByLevel(logs) {
  return SUPPORTED_LEVELS.reduce(
    (summary, level) => ({
      ...summary,
      [level]: logs.filter((entry) => entry.level === level).length,
    }),
    { info: 0, warn: 0, error: 0 },
  );
}

async function searchLogEntries(prisma, filters = {}) {
  const delegate = getLogEntryDelegate(prisma);
  const timeRange = normalizeTimeRange(filters.timeRange);
  const levels = normalizeLevels(filters.levels);
  const query = typeof filters.query === "string" ? filters.query.trim().toLowerCase() : "";
  const limit = Number.isInteger(filters.limit) ? Math.max(1, Math.min(filters.limit, 250)) : 100;

  if (!delegate || typeof delegate.findMany !== "function") {
    return {
      filters: {
        query: filters.query ?? "",
        timeRange,
        levels,
      },
      summary: {
        matchingLogs: 0,
        filtered: { info: 0, warn: 0, error: 0 },
        stored: { info: 0, warn: 0, error: 0 },
      },
      logs: [],
    };
  }

  const baseWhere = {
    createdAt: {
      gte: getCutoffDate(timeRange),
    },
    level: {
      in: levels,
    },
  };

  let candidateLogs = [];
  let storedCounts = SUPPORTED_LEVELS.map((level) => [level, 0]);

  try {
    [candidateLogs, storedCounts] = await Promise.all([
      delegate.findMany({
        where: baseWhere,
        orderBy: {
          createdAt: "desc",
        },
      }),
      Promise.all(
        SUPPORTED_LEVELS.map(async (level) => [
          level,
          typeof delegate.count === "function"
            ? await delegate.count({
                where: {
                  level,
                },
              })
            : 0,
        ]),
      ),
    ]);
  } catch {
    candidateLogs = [];
    storedCounts = SUPPORTED_LEVELS.map((level) => [level, 0]);
  }

  const matchingLogs = candidateLogs.filter((log) => matchesQuery(log, query));
  const filteredCounts = countByLevel(matchingLogs);

  return {
    filters: {
      query: filters.query ?? "",
      timeRange,
      levels,
    },
    summary: {
      matchingLogs: matchingLogs.length,
      filtered: filteredCounts,
      stored: Object.fromEntries(storedCounts),
    },
    logs: matchingLogs.slice(0, limit).map((log) => ({
      id: log.id,
      level: normalizeLevel(log.level),
      scope: log.scope,
      event: log.event,
      message: log.message,
      context: log.context ?? {},
      createdAt: log.createdAt,
    })),
  };
}

module.exports = {
  DEFAULT_TIME_RANGE,
  SUPPORTED_LEVELS,
  createLogEntry,
  searchLogEntries,
};
