const test = require("node:test");
const assert = require("node:assert/strict");

const { sanitizeSupportClientContext } = require("../app/services/support-telemetry.service");

test("sanitizeSupportClientContext redacts secrets and bounds noisy payloads", () => {
  const sanitized = sanitizeSupportClientContext({
    pageUrl: "https://app.helmos.test/#/idea-foundry?token=secret-token&safe=1",
    route: "/idea-foundry",
    userAgent: "Mozilla/5.0",
    release: {
      appVersion: "1.2.3",
      gitCommit: "abcdef123456",
    },
    consoleErrors: new Array(30).fill(null).map((_, index) => ({
      level: "error",
      message: `Error ${index}`,
      stack: `stack-${index}`,
    })),
    failedRequests: [
      {
        method: "GET",
        url: "https://api.helmos.test/data?authorization=bearer-token",
        status: 500,
        requestHeaders: {
          Authorization: "Bearer super-secret",
          Cookie: "session=abc",
          "X-Request-Id": "req-1",
        },
        responseBodyPreview: "token=abc123",
      },
    ],
    recentEvents: new Array(40).fill(null).map((_, index) => ({
      type: "click",
      label: `button-${index}`,
    })),
  });

  assert.equal(sanitized.pageUrl.includes("secret-token"), false);
  assert.equal(sanitized.failedRequests[0].url.includes("bearer-token"), false);
  assert.equal(sanitized.failedRequests[0].requestHeaders.Authorization, "[REDACTED]");
  assert.equal(sanitized.failedRequests[0].requestHeaders.Cookie, "[REDACTED]");
  assert.equal(sanitized.consoleErrors.length, 20);
  assert.equal(sanitized.recentEvents.length, 25);
  assert.match(sanitized.failedRequests[0].responseBodyPreview, /\[REDACTED\]/);
});
