function isKnownPrismaError(error) {
  return typeof error?.code === "string" && error.code.startsWith("P");
}

function errorHandler(error, _req, res, _next) {
  if (typeof error?.statusCode === "number") {
    return res.status(error.statusCode).json({
      error: error.message,
    });
  }

  if (isKnownPrismaError(error)) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "Unique constraint violation",
        code: error.code,
        details: error.meta?.target ?? null,
      });
    }

    if (error.code === "P2003") {
      return res.status(400).json({
        error: "Foreign key constraint violation",
        code: error.code,
        details: error.meta?.field_name ?? null,
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({
        error: "Resource not found",
        code: error.code,
      });
    }
  }

  if (error?.name === "ZodError") {
    return res.status(400).json({
      error: "Validation failed",
      details: error.issues,
    });
  }

  return res.status(500).json({
    error: "Internal server error",
  });
}

module.exports = {
  errorHandler,
};
