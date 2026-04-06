const test = require("node:test");
const assert = require("node:assert/strict");

const { createSupportLogAnalysisService } = require("../app/services/support-log-analysis.service");

test("support log analysis groups repeated stack traces and derives filters from a natural-language query", async () => {
  const provider = {
    async search(filters) {
      assert.equal(filters.requestId, "req-7");
      assert.equal(filters.userId, "user-123");
      assert.equal(filters.route, "/api/support");
      assert.equal(filters.severity, "error");

      return [
        {
          id: "1",
          level: "error",
          scope: "api",
          event: "request_failed",
          message: "TypeError: Cannot read properties of undefined",
          context: { requestId: "req-7", route: "/api/support", userId: "user-123" },
          createdAt: "2026-04-06T08:00:00.000Z",
        },
        {
          id: "2",
          level: "error",
          scope: "api",
          event: "request_failed",
          message: "TypeError: Cannot read properties of undefined",
          context: { requestId: "req-7", route: "/api/support", userId: "user-123" },
          createdAt: "2026-04-06T08:05:00.000Z",
        },
        {
          id: "3",
          level: "warn",
          scope: "worker",
          event: "fallback_used",
          message: "Retrying upstream dependency",
          context: { requestId: "req-7" },
          createdAt: "2026-04-06T08:06:00.000Z",
        },
      ];
    },
  };

  const service = createSupportLogAnalysisService({ provider });
  const result = await service.analyze({
    query: "Investigate error on /api/support for user user-123 request req-7",
  });

  assert.equal(result.filters.requestId, "req-7");
  assert.equal(result.summary.matchCount, 3);
  assert.equal(result.summary.repeatedErrorCount, 1);
  assert.equal(result.groups[0].occurrences, 2);
  assert.equal(result.groups[0].firstSeen, "2026-04-06T08:00:00.000Z");
  assert.equal(result.groups[0].lastSeen, "2026-04-06T08:05:00.000Z");
  assert.equal(result.rawExcerpts.length <= 3, true);
});
