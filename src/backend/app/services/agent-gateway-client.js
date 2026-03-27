const { createLogEntry } = require("./log-entry.service");

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_RUN_POLL_ATTEMPTS = 90;
const DEFAULT_RUN_POLL_DELAY_MS = 1000;
const MAX_LOG_PREVIEW_LENGTH = 4000;
const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled", "waiting_for_approval"]);

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string") {
    return null;
  }

  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

function buildOfflineSnapshot({ baseUrl, checkedAt, message, configured }) {
  return {
    configured,
    status: configured ? "offline" : "not_configured",
    message,
    baseUrl,
    service: null,
    checkedAt,
    agents: [],
  };
}

function toPreview(value) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  return value.length > MAX_LOG_PREVIEW_LENGTH ? `${value.slice(0, MAX_LOG_PREVIEW_LENGTH)}…` : value;
}

function normalizeRunStatus(status) {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

function createAgentGatewayClient({
  baseUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  prisma = null,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  async function requestJson(path, { method = "GET", body, timeoutOverrideMs } = {}) {
    const startedAt = Date.now();

    if (!normalizedBaseUrl) {
      const error = new Error("Agent gateway URL is not configured.");
      error.statusCode = 503;
      throw error;
    }

    if (typeof fetchImpl !== "function") {
      const error = new Error("Fetch API is not available in this Node runtime.");
      error.statusCode = 503;
      throw error;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutOverrideMs ?? timeoutMs);

    try {
      await createLogEntry(prisma, {
        level: "info",
        scope: "agentic-layer",
        event: "agent_gateway_request_started",
        message: `${method} ${path} requested from agent gateway`,
        context: {
          baseUrl: normalizedBaseUrl,
          path,
          method,
          body: body ?? null,
          timeoutMs: timeoutOverrideMs ?? timeoutMs,
        },
      });

      const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        await createLogEntry(prisma, {
          level: response.status >= 500 ? "error" : "warn",
          scope: "agentic-layer",
          event: "agent_gateway_request_failed",
          message: `${method} ${path} failed with ${response.status}`,
          context: {
            baseUrl: normalizedBaseUrl,
            path,
            method,
            statusCode: response.status,
            body: body ?? null,
            responseBody: toPreview(detail),
            durationMs: Date.now() - startedAt,
          },
        });
        throw new Error(detail || `Gateway returned ${response.status}`);
      }

      const payload = await response.json();
      await createLogEntry(prisma, {
        level: "info",
        scope: "agentic-layer",
        event: "agent_gateway_request_succeeded",
        message: `${method} ${path} succeeded`,
        context: {
          baseUrl: normalizedBaseUrl,
          path,
          method,
          body: body ?? null,
          response: payload ?? null,
          durationMs: Date.now() - startedAt,
        },
      });

      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        await createLogEntry(prisma, {
          level: "error",
          scope: "agentic-layer",
          event: "agent_gateway_request_timed_out",
          message: `${method} ${path} timed out while contacting the agent gateway`,
          context: {
            baseUrl: normalizedBaseUrl,
            path,
            method,
            body: body ?? null,
            timeoutMs: timeoutOverrideMs ?? timeoutMs,
            durationMs: Date.now() - startedAt,
          },
        });
        const timeoutError = new Error("Timed out while contacting the agent gateway.");
        timeoutError.statusCode = 504;
        throw timeoutError;
      }

      await createLogEntry(prisma, {
        level: "error",
        scope: "agentic-layer",
        event: "agent_gateway_request_error",
        message: `${method} ${path} failed while contacting the agent gateway`,
        context: {
          baseUrl: normalizedBaseUrl,
          path,
          method,
          body: body ?? null,
          error: error?.message ?? String(error),
          durationMs: Date.now() - startedAt,
        },
      });

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async getAdminSnapshot() {
      const checkedAt = new Date().toISOString();

      if (!normalizedBaseUrl) {
        return buildOfflineSnapshot({
          baseUrl: null,
          checkedAt,
          configured: false,
          message: "Agent gateway URL is not configured.",
        });
      }

      if (typeof fetchImpl !== "function") {
        return buildOfflineSnapshot({
          baseUrl: normalizedBaseUrl,
          checkedAt,
          configured: true,
          message: "Fetch API is not available in this Node runtime.",
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(`${normalizedBaseUrl}/admin/agents`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Gateway returned ${response.status}`);
        }

        const payload = await response.json();

        return {
          configured: true,
          status: "online",
          message: "Agent gateway responded successfully.",
          baseUrl: normalizedBaseUrl,
          service: payload.service ?? "helmos-agent-gateway",
          checkedAt: payload.timestamp ?? checkedAt,
          agents: Array.isArray(payload.agents) ? payload.agents : [],
        };
      } catch (error) {
        const message =
          error?.name === "AbortError"
            ? "Timed out while contacting the agent gateway."
            : error?.message ?? "Unable to contact the agent gateway.";

        return buildOfflineSnapshot({
          baseUrl: normalizedBaseUrl,
          checkedAt,
          configured: true,
          message,
        });
      } finally {
        clearTimeout(timeout);
      }
    },

    async startRun(payload) {
      return requestJson("/runs", {
        method: "POST",
        body: payload,
        timeoutOverrideMs: 10000,
      });
    },

    async getRunSummary(runId) {
      return requestJson(`/runs/${runId}/summary`, {
        method: "GET",
        timeoutOverrideMs: 10000,
      });
    },

    async waitForRunCompletion(
      runId,
      { maxAttempts = DEFAULT_RUN_POLL_ATTEMPTS, delayMs = DEFAULT_RUN_POLL_DELAY_MS } = {}
    ) {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const summary = await this.getRunSummary(runId);

        if (TERMINAL_RUN_STATUSES.has(normalizeRunStatus(summary.status))) {
          return summary;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const summary = await this.getRunSummary(runId);
      if (TERMINAL_RUN_STATUSES.has(normalizeRunStatus(summary.status))) {
        return summary;
      }

      const error = new Error(
        `Agent gateway run ${runId} did not reach a terminal state in time (last status: ${summary.status ?? "unknown"}).`
      );
      error.statusCode = 504;
      error.summary = summary;
      throw error;
    },

    async runIdeationWorkflow({
      inputText,
      sessionTitle,
      sessionId,
      founderId,
      tenantId,
      metadata,
      context,
    }) {
      const run = await this.startRun({
        input_text: inputText,
        request_type: "ideation_chat",
        requested_agent: "ideation",
        session: {
          ...(sessionId ? { id: sessionId } : {}),
          ...(sessionTitle ? { title: sessionTitle } : {}),
          ...(founderId ? { founder_id: founderId } : {}),
          ...(tenantId ? { tenant_id: tenantId } : {}),
          metadata: metadata ?? {},
        },
        context: context ?? {},
      });

      return this.waitForRunCompletion(run.id);
    },
  };
}

module.exports = {
  createAgentGatewayClient,
};
