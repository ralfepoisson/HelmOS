const { createLogEntry } = require("../services/log-entry.service");

function normalizeRoutePath(pathname) {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi, "/:id")
    .replace(/\/\d+(?=\/|$)/g, "/:id");
}

function deriveScope(pathname) {
  const [, apiPrefix, scope = "api"] = pathname.split("/");
  return apiPrefix === "api" ? scope : "api";
}

function buildEventName(method, pathname, statusCode) {
  const normalizedPath = normalizeRoutePath(pathname)
    .replace(/^\/api\//, "")
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9:_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${method.toLowerCase()}_${normalizedPath || "root"}_${statusCode}`;
}

function buildLevel(statusCode) {
  if (statusCode >= 500) {
    return "error";
  }

  if (statusCode >= 400) {
    return "warn";
  }

  return "info";
}

function shouldSuppressRequestLog(method, pathname) {
  return method === "GET" && pathname === "/api/admin/logs";
}

function buildRequestLogger({ prisma }) {
  return (req, res, next) => {
    let logged = false;
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const persistLogEntry = async (body) => {
      const pathname = req.originalUrl.split("?")[0];

      if (logged || !req.originalUrl.startsWith("/api") || shouldSuppressRequestLog(req.method, pathname)) {
        return;
      }

      logged = true;
      const statusCode = res.statusCode || 200;
      const level = buildLevel(statusCode);

      await createLogEntry(prisma, {
        level,
        scope: deriveScope(pathname),
        event: buildEventName(req.method, pathname, statusCode),
        message: `${req.method} ${normalizeRoutePath(pathname)} responded with ${statusCode}`,
        context: {
          method: req.method,
          path: pathname,
          normalizedPath: normalizeRoutePath(pathname),
          statusCode,
          query: req.query ?? {},
          params: req.params ?? {},
          body:
            req.method === "GET" || typeof req.body === "undefined" || req.body === null
              ? null
              : req.body,
          error:
            body && typeof body === "object" && "error" in body
              ? body.error
              : null,
        },
      });
    };

    res.json = function patchedJson(body) {
      void persistLogEntry(body);
      return originalJson(body);
    };

    res.send = function patchedSend(body) {
      void persistLogEntry(
        typeof body === "object" && body !== null
          ? body
          : typeof body === "string"
            ? { body }
            : null,
      );
      return originalSend(body);
    };

    next();
  };
}

module.exports = {
  buildRequestLogger,
};
