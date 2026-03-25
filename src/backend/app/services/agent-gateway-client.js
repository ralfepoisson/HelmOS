const DEFAULT_TIMEOUT_MS = 2500;

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

function createAgentGatewayClient({
  baseUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

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
  };
}

module.exports = {
  createAgentGatewayClient,
};
