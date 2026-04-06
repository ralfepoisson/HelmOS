const MAX_CONSOLE_ERRORS = 20;
const MAX_FAILED_REQUESTS = 20;
const MAX_RECENT_EVENTS = 25;
const MAX_STRING_LENGTH = 1_000;
const SENSITIVE_KEY_PATTERN = /(authorization|cookie|token|secret|password|passwd|api[-_]?key|session)/i;

function truncateString(value, max = MAX_STRING_LENGTH) {
  if (typeof value !== "string") {
    return value;
  }

  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function redactString(value) {
  if (typeof value !== "string") {
    return value;
  }

  return truncateString(
    value
      .replace(/((?:token|secret|password|passwd|authorization|cookie|session)\s*[:=]\s*)([^,\s]+)/gi, "$1[REDACTED]")
      .replace(/(bearer\s+)([a-z0-9._-]+)/gi, "$1[REDACTED]")
  );
}

function sanitizeUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    const parsed = new URL(value);
    for (const key of parsed.searchParams.keys()) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    if (parsed.hash.includes("?")) {
      const [hashPath, hashQuery = ""] = parsed.hash.slice(1).split("?", 2);
      const hashParams = new URLSearchParams(hashQuery);
      for (const key of hashParams.keys()) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          hashParams.set(key, "[REDACTED]");
        }
      }
      const nextHashQuery = hashParams.toString();
      parsed.hash = nextHashQuery ? `#${hashPath}?${nextHashQuery}` : `#${hashPath}`;
    }
    return truncateString(parsed.toString(), 1_500);
  } catch {
    return redactString(value);
  }
}

function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers)
      .slice(0, 25)
      .map(([key, value]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactString(String(value ?? "")),
      ])
  );
}

function sanitizeConsoleErrors(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.slice(-MAX_CONSOLE_ERRORS).map((entry) => ({
    level: truncateString(String(entry?.level ?? "error"), 20),
    message: redactString(String(entry?.message ?? "")),
    stack: redactString(String(entry?.stack ?? "")),
    timestamp: entry?.timestamp ?? null,
  }));
}

function sanitizeFailedRequests(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.slice(-MAX_FAILED_REQUESTS).map((entry) => ({
    method: truncateString(String(entry?.method ?? "GET"), 16),
    url: sanitizeUrl(entry?.url ?? ""),
    route: truncateString(String(entry?.route ?? ""), 255),
    status: Number.isFinite(entry?.status) ? entry.status : null,
    requestId: truncateString(String(entry?.requestId ?? ""), 120),
    durationMs: Number.isFinite(entry?.durationMs) ? Math.max(0, entry.durationMs) : null,
    requestHeaders: sanitizeHeaders(entry?.requestHeaders),
    responseBodyPreview: redactString(String(entry?.responseBodyPreview ?? "")),
  }));
}

function sanitizeRecentEvents(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.slice(-MAX_RECENT_EVENTS).map((entry) => ({
    type: truncateString(String(entry?.type ?? "event"), 80),
    label: redactString(String(entry?.label ?? "")),
    route: truncateString(String(entry?.route ?? ""), 255),
    timestamp: entry?.timestamp ?? null,
    metadata: sanitizePlainObject(entry?.metadata, { maxEntries: 12 }),
  }));
}

function sanitizePlainObject(value, { maxEntries = 20 } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, maxEntries)
      .map(([key, entryValue]) => {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          return [key, "[REDACTED]"];
        }

        if (entryValue == null) {
          return [key, null];
        }

        if (typeof entryValue === "string") {
          return [key, redactString(entryValue)];
        }

        if (typeof entryValue === "number" || typeof entryValue === "boolean") {
          return [key, entryValue];
        }

        return [key, truncateString(JSON.stringify(entryValue), 500)];
      })
  );
}

function sanitizeSupportClientContext(context) {
  const candidate = context && typeof context === "object" ? context : {};

  return {
    pageUrl: sanitizeUrl(candidate.pageUrl ?? candidate.url ?? ""),
    route: truncateString(String(candidate.route ?? candidate.routeId ?? ""), 255),
    screenId: truncateString(String(candidate.screenId ?? ""), 120),
    userAgent: truncateString(String(candidate.userAgent ?? ""), 500),
    browser: sanitizePlainObject(candidate.browser, { maxEntries: 8 }),
    platform: sanitizePlainObject(candidate.platform, { maxEntries: 8 }),
    release: sanitizePlainObject(candidate.release, { maxEntries: 8 }),
    viewport: sanitizePlainObject(candidate.viewport, { maxEntries: 6 }),
    capturedAt: candidate.capturedAt ?? new Date().toISOString(),
    consoleErrors: sanitizeConsoleErrors(candidate.consoleErrors),
    uncaughtErrors: sanitizeConsoleErrors(candidate.uncaughtErrors),
    promiseRejections: sanitizeConsoleErrors(candidate.promiseRejections),
    failedRequests: sanitizeFailedRequests(candidate.failedRequests),
    recentEvents: sanitizeRecentEvents(candidate.recentEvents),
    correlationIds: Array.isArray(candidate.correlationIds)
      ? candidate.correlationIds.slice(-10).map((entry) => truncateString(String(entry), 120))
      : [],
    freeTextDetails: redactString(String(candidate.freeTextDetails ?? "")),
  };
}

module.exports = {
  sanitizeSupportClientContext,
};
