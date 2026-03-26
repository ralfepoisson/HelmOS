const test = require("node:test");
const assert = require("node:assert/strict");

const { createAgentGatewayClient } = require("../app/services/agent-gateway-client");

test("agent gateway client waits for a terminal run state", async () => {
  const responses = [
    {
      ok: true,
      json: async () => ({ id: "run-1", status: "pending" }),
    },
    {
      ok: true,
      json: async () => ({ id: "run-1", status: "pending" }),
    },
    {
      ok: true,
      json: async () => ({ id: "run-1", status: "completed", artifacts: [] }),
    },
  ];

  const fetchImpl = async () => responses.shift();
  const client = createAgentGatewayClient({
    baseUrl: "http://127.0.0.1:8000/api/v1",
    fetchImpl,
  });

  const summary = await client.waitForRunCompletion("run-1", {
    maxAttempts: 3,
    delayMs: 0,
  });

  assert.equal(summary.status, "completed");
});

test("agent gateway client throws when a run never reaches a terminal state", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ id: "run-2", status: "pending" }),
  });
  const client = createAgentGatewayClient({
    baseUrl: "http://127.0.0.1:8000/api/v1",
    fetchImpl,
  });

  await assert.rejects(
    () =>
      client.waitForRunCompletion("run-2", {
        maxAttempts: 2,
        delayMs: 0,
      }),
    (error) => {
      assert.equal(error.statusCode, 504);
      assert.match(error.message, /did not reach a terminal state in time/i);
      return true;
    }
  );
});
