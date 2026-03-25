const express = require("express");

function getModelDelegate(prisma, config) {
  const delegate = prisma[config.model];

  if (!delegate) {
    throw new Error(`Prisma model delegate "${config.model}" is not configured`);
  }

  return delegate;
}

function parseLimit(rawLimit) {
  if (typeof rawLimit === "undefined") {
    return 50;
  }

  const parsed = Number.parseInt(rawLimit, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 50;
  }

  return Math.min(parsed, 100);
}

function coerceQueryValue(value) {
  if (Array.isArray(value)) {
    return {
      in: value.map((entry) => coerceQueryValue(entry)),
    };
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  if (/^-?\d+\.\d+$/.test(value)) {
    return Number.parseFloat(value);
  }

  return value;
}

function buildWhere(query, filterFields) {
  return filterFields.reduce((where, field) => {
    if (typeof query[field] === "undefined") {
      return where;
    }

    return {
      ...where,
      [field]: coerceQueryValue(query[field]),
    };
  }, {});
}

function ensureUpdatePayload(data) {
  if (Object.keys(data).length === 0) {
    const error = new Error("Update payload must contain at least one field");
    error.statusCode = 400;
    throw error;
  }
}

function createCrudRouter({ prisma, config }) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const delegate = getModelDelegate(prisma, config);
    const records = await delegate.findMany({
      where: buildWhere(req.query, config.filterFields ?? []),
      orderBy: config.orderBy,
      take: parseLimit(req.query.limit),
    });

    res.json({
      data: records,
    });
  });

  router.post("/", async (req, res) => {
    const delegate = getModelDelegate(prisma, config);
    let data = config.createSchema.parse(req.body);

    if (typeof config.beforeCreate === "function") {
      data = await config.beforeCreate({ prisma, data });
    }

    const record = await delegate.create({
      data,
    });

    res.status(201).json({
      data: record,
    });
  });

  router.get("/:id", async (req, res) => {
    const delegate = getModelDelegate(prisma, config);
    const record = await delegate.findUniqueOrThrow({
      where: {
        id: req.params.id,
      },
    });

    res.json({
      data: record,
    });
  });

  router.patch("/:id", async (req, res) => {
    const delegate = getModelDelegate(prisma, config);
    const data = config.updateSchema.parse(req.body);

    ensureUpdatePayload(data);

    const record = await delegate.update({
      where: {
        id: req.params.id,
      },
      data,
    });

    res.json({
      data: record,
    });
  });

  router.delete("/:id", async (req, res) => {
    const delegate = getModelDelegate(prisma, config);

    await delegate.delete({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).send();
  });

  return router;
}

module.exports = {
  createCrudRouter,
};
