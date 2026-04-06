const { searchLogEntries } = require("./log-entry.service");

const DEFAULT_TIME_RANGE = "24h";

function normalizeSeverity(value) {
  const candidate = `${value ?? ""}`.trim().toLowerCase();
  if (["error", "warn", "info"].includes(candidate)) {
    return candidate;
  }
  return null;
}

function parseNaturalLanguageFilters(query = "") {
  const text = `${query}`.trim();
  const lowered = text.toLowerCase();
  const requestIdMatch =
    text.match(/\b(req-[a-z0-9._-]+)\b/i) ??
    text.match(/\b(?:request|correlation)(?:\s+id)?[-_:\s#]*([a-z0-9][a-z0-9._-]*)\b/i);
  const userMatch = text.match(/\buser[-_\s:]*([a-z0-9][a-z0-9._-]*)\b/i);
  const tenantMatch = text.match(/\btenant[-_\s:]*([a-z0-9][a-z0-9._-]*)\b/i);
  const routeMatch = text.match(/(\/[a-z0-9/_:-]+)/i);
  const timeMatch = text.match(/\b(?:last|past)\s+(\d+)(m|h|d)\b/i) ?? text.match(/\b(\d+)(m|h|d)\b/i);

  return {
    severity: normalizeSeverity(
      lowered.includes(" error") || lowered.startsWith("error") ? "error" :
      lowered.includes(" warn") || lowered.startsWith("warn") ? "warn" :
      lowered.includes(" info") || lowered.startsWith("info") ? "info" : null
    ),
    requestId: requestIdMatch ? requestIdMatch[1] : null,
    userId: userMatch ? `user-${userMatch[1].replace(/^user[-_]?/i, "")}` : null,
    tenantId: tenantMatch ? `tenant-${tenantMatch[1].replace(/^tenant[-_]?/i, "")}` : null,
    route: routeMatch ? routeMatch[1] : null,
    timeRange: timeMatch ? `${timeMatch[1]}${timeMatch[2].toLowerCase()}` : DEFAULT_TIME_RANGE,
  };
}

function fingerprintLog(log) {
  const normalizedMessage = `${log.message ?? ""}`
    .toLowerCase()
    .replace(/\b[0-9a-f]{8,}\b/g, ":id")
    .replace(/\d+/g, ":n")
    .replace(/\s+/g, " ")
    .trim();

  return `${log.scope ?? "scope"}::${log.event ?? "event"}::${normalizedMessage}`;
}

function buildIncidentSummary(logs, groups) {
  if (logs.length === 0) {
    return "No matching logs were found for the requested support investigation window.";
  }

  const primary = groups[0];
  if (!primary) {
    return `Found ${logs.length} matching log entries but no repeated pattern dominated the result set.`;
  }

  return `Found ${logs.length} matching log entries. The most common pattern occurred ${primary.occurrences} times in ${primary.scope}.`;
}

function truncateExcerpt(value, max = 400) {
  const text = `${value ?? ""}`.trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

class PrismaLogProvider {
  constructor({ prisma }) {
    this.prisma = prisma;
  }

  async search(filters) {
    const base = await searchLogEntries(this.prisma, {
      query: filters.query,
      timeRange: filters.timeRange,
      levels: filters.severity ? [filters.severity] : undefined,
      scope: filters.scope,
      limit: 200,
    });

    return (base.logs ?? []).filter((entry) => {
      const context = entry.context ?? {};
      if (filters.requestId && `${context.requestId ?? context.correlationId ?? ""}` !== filters.requestId) {
        return false;
      }
      if (filters.userId && `${context.userId ?? context.actorUserId ?? ""}` !== filters.userId) {
        return false;
      }
      if (filters.tenantId && `${context.tenantId ?? context.accountId ?? ""}` !== filters.tenantId) {
        return false;
      }
      if (filters.route && `${context.route ?? context.path ?? ""}` !== filters.route) {
        return false;
      }
      return true;
    });
  }
}

function createSupportLogAnalysisService({ provider }) {
  return {
    async analyze({
      query = "",
      severity,
      requestId,
      userId,
      tenantId,
      route,
      timeRange,
      scope,
    }) {
      const inferred = parseNaturalLanguageFilters(query);
      const filters = {
        query,
        severity: normalizeSeverity(severity) ?? inferred.severity,
        requestId: requestId ?? inferred.requestId,
        userId: userId ?? inferred.userId,
        tenantId: tenantId ?? inferred.tenantId,
        route: route ?? inferred.route,
        timeRange: timeRange ?? inferred.timeRange,
        scope: scope ?? null,
      };

      const logs = await provider.search(filters);
      const groupedByFingerprint = new Map();

      for (const log of logs) {
        const key = fingerprintLog(log);
        const existing = groupedByFingerprint.get(key) ?? {
          fingerprint: key,
          scope: log.scope,
          event: log.event,
          sampleMessage: log.message,
          occurrences: 0,
          firstSeen: log.createdAt,
          lastSeen: log.createdAt,
          requestIds: new Set(),
        };
        existing.occurrences += 1;
        existing.firstSeen = existing.firstSeen < log.createdAt ? existing.firstSeen : log.createdAt;
        existing.lastSeen = existing.lastSeen > log.createdAt ? existing.lastSeen : log.createdAt;
        if (log.context?.requestId || log.context?.correlationId) {
          existing.requestIds.add(log.context.requestId ?? log.context.correlationId);
        }
        groupedByFingerprint.set(key, existing);
      }

      const groups = Array.from(groupedByFingerprint.values())
        .sort((left, right) => right.occurrences - left.occurrences)
        .slice(0, 10)
        .map((group) => ({
          fingerprint: group.fingerprint,
          scope: group.scope,
          event: group.event,
          sampleMessage: truncateExcerpt(group.sampleMessage),
          occurrences: group.occurrences,
          firstSeen: group.firstSeen,
          lastSeen: group.lastSeen,
          requestIds: Array.from(group.requestIds).slice(0, 10),
        }));

      return {
        filters,
        summary: {
          matchCount: logs.length,
          repeatedErrorCount: groups.filter((group) => group.occurrences > 1).length,
          firstSeen: logs.length > 0 ? logs[logs.length - 1].createdAt : null,
          lastSeen: logs.length > 0 ? logs[0].createdAt : null,
          incidentSummary: buildIncidentSummary(logs, groups),
        },
        groups,
        rawExcerpts: logs.slice(0, 5).map((log) => ({
          id: log.id,
          createdAt: log.createdAt,
          level: log.level,
          scope: log.scope,
          event: log.event,
          message: truncateExcerpt(log.message),
          context: log.context ?? {},
        })),
      };
    },
  };
}

function createPrismaSupportLogAnalysisService({ prisma }) {
  return createSupportLogAnalysisService({
    provider: new PrismaLogProvider({ prisma }),
  });
}

module.exports = {
  PrismaLogProvider,
  createSupportLogAnalysisService,
  createPrismaSupportLogAnalysisService,
  parseNaturalLanguageFilters,
};
