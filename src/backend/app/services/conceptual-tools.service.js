const { randomUUID } = require("node:crypto");

const { createLogEntry } = require("./log-entry.service");

const TOOL_STATUSES = ["ACTIVE", "INACTIVE"];
const SEEDED_CONCEPTUAL_TOOLS = [
  {
    id: "8a8e7708-8225-4a37-bbe0-fd0d3040b001",
    name: "Inversion",
    category: "transformative",
    purpose: "Challenge the default model by reversing core assumptions.",
    whenToUse: ["high market saturation", "weak differentiation"],
    whenNotToUse: ["problem statement unclear"],
    instructions: [
      "Identify the dominant operating assumption",
      "Reverse it",
      "Explore whether the reversed model creates a viable opportunity",
    ],
    expectedEffect: "Increase novelty and differentiation while preserving grounding.",
    status: "ACTIVE",
    version: 1,
  },
  {
    id: "8a8e7708-8225-4a37-bbe0-fd0d3040b002",
    name: "Analogy Transfer",
    category: "cross-domain",
    purpose: "Borrow structural patterns from adjacent domains and reapply them to the current problem.",
    whenToUse: ["category conventions feel stale", "a transfer pattern may unlock a new framing"],
    whenNotToUse: ["domain constraints are highly specific and non-transferable"],
    instructions: [
      "Pick an adjacent domain with a comparable dynamic",
      "Extract the governing pattern",
      "Test how that pattern maps onto the current opportunity",
    ],
    expectedEffect: "Expand the design space using grounded but unfamiliar reference models.",
    status: "ACTIVE",
    version: 1,
  },
  {
    id: "8a8e7708-8225-4a37-bbe0-fd0d3040b003",
    name: "Constraint Removal",
    category: "transformative",
    purpose: "Reveal new opportunity shapes by temporarily removing a presumed fixed constraint.",
    whenToUse: ["the team is stuck in local optima", "legacy rules may be over-constraining"],
    whenNotToUse: ["regulatory or safety constraints are truly non-negotiable"],
    instructions: [
      "Name the limiting constraint",
      "Remove it hypothetically",
      "Explore what becomes possible and what new risks emerge",
    ],
    expectedEffect: "Open up more ambitious options while clarifying which constraints are genuinely binding.",
    status: "ACTIVE",
    version: 1,
  },
  {
    id: "8a8e7708-8225-4a37-bbe0-fd0d3040b004",
    name: "Failure Analysis",
    category: "diagnostic",
    purpose: "Surface likely failure modes before committing to an idea direction.",
    whenToUse: ["execution risk is opaque", "the concept looks attractive but fragile"],
    whenNotToUse: ["the concept is still too undefined for concrete failure analysis"],
    instructions: [
      "List the most plausible ways the concept could fail",
      "Trace likely root causes",
      "Identify mitigations or redesign options",
    ],
    expectedEffect: "Improve robustness and expose hidden assumptions before downstream investment.",
    status: "ACTIVE",
    version: 1,
  },
  {
    id: "8a8e7708-8225-4a37-bbe0-fd0d3040b005",
    name: "Assumption Mapping",
    category: "diagnostic",
    purpose: "Make implicit assumptions explicit so they can be tested, prioritized, and challenged.",
    whenToUse: [
      "the idea relies on multiple unstated beliefs",
      "teams disagree on what is assumed versus known",
    ],
    whenNotToUse: ["the work already has a validated evidence map"],
    instructions: [
      "Break the concept into major claims",
      "Write the hidden assumption behind each claim",
      "Rank assumptions by risk and uncertainty",
    ],
    expectedEffect: "Create a clearer path for validation and sharper reasoning about idea quality.",
    status: "ACTIVE",
    version: 1,
  },
];

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getConceptualToolDelegate(prisma) {
  return prisma?.conceptualTool ?? null;
}

function canRunRawSql(prisma) {
  return prisma && typeof prisma.$queryRawUnsafe === "function" && typeof prisma.$executeRawUnsafe === "function";
}

function isMissingConceptualToolStorageError(error) {
  return (
    error?.code === "P2021" &&
    typeof error?.message === "string" &&
    error.message.toLowerCase().includes("conceptual_tools")
  );
}

function normalizeStatus(value, { fallback = "ACTIVE" } = {}) {
  if (typeof value !== "string") {
    return fallback;
  }

  const candidate = value.trim().toUpperCase();
  return TOOL_STATUSES.includes(candidate) ? candidate : fallback;
}

function normalizeListField(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mapConceptualTool(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    category: record.category,
    purpose: record.purpose,
    whenToUse: normalizeListField(record.whenToUse ?? record.when_to_use),
    whenNotToUse: normalizeListField(record.whenNotToUse ?? record.when_not_to_use),
    instructions: normalizeListField(record.instructions),
    expectedEffect: record.expectedEffect ?? record.expected_effect,
    status: normalizeStatus(record.status),
    version: record.version,
    createdAt: record.createdAt ?? record.created_at,
    updatedAt: record.updatedAt ?? record.updated_at,
  };
}

function buildCreateData(payload) {
  return {
    id: payload.id ?? randomUUID(),
    name: payload.name,
    category: payload.category,
    purpose: payload.purpose,
    whenToUse: normalizeListField(payload.whenToUse),
    whenNotToUse: normalizeListField(payload.whenNotToUse),
    instructions: normalizeListField(payload.instructions),
    expectedEffect: payload.expectedEffect,
    status: normalizeStatus(payload.status),
    version: Number.isInteger(payload.version) ? payload.version : 1,
  };
}

function buildUpdateData(payload) {
  const data = {};

  if (Object.hasOwn(payload, "name")) {
    data.name = payload.name;
  }
  if (Object.hasOwn(payload, "category")) {
    data.category = payload.category;
  }
  if (Object.hasOwn(payload, "purpose")) {
    data.purpose = payload.purpose;
  }
  if (Object.hasOwn(payload, "whenToUse")) {
    data.whenToUse = normalizeListField(payload.whenToUse);
  }
  if (Object.hasOwn(payload, "whenNotToUse")) {
    data.whenNotToUse = normalizeListField(payload.whenNotToUse);
  }
  if (Object.hasOwn(payload, "instructions")) {
    data.instructions = normalizeListField(payload.instructions);
  }
  if (Object.hasOwn(payload, "expectedEffect")) {
    data.expectedEffect = payload.expectedEffect;
  }
  if (Object.hasOwn(payload, "status")) {
    data.status = normalizeStatus(payload.status);
  }
  if (Object.hasOwn(payload, "version")) {
    data.version = payload.version;
  }

  return data;
}

async function ensureConceptualToolsStorage(prisma) {
  if (!canRunRawSql(prisma)) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "ConceptualToolStatus" AS ENUM ('ACTIVE', 'INACTIVE');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS conceptual_tools (
      id UUID PRIMARY KEY,
      name VARCHAR(200) NOT NULL UNIQUE,
      category VARCHAR(100) NOT NULL,
      purpose TEXT NOT NULL,
      when_to_use JSONB NOT NULL DEFAULT '[]',
      when_not_to_use JSONB NOT NULL DEFAULT '[]',
      instructions JSONB NOT NULL DEFAULT '[]',
      expected_effect TEXT NOT NULL,
      status "ConceptualToolStatus" NOT NULL DEFAULT 'ACTIVE',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS conceptual_tools_status_updated_at_idx ON conceptual_tools (status, updated_at DESC)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS conceptual_tools_category_name_idx ON conceptual_tools (category, name)`,
  );

  for (const tool of SEEDED_CONCEPTUAL_TOOLS) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO conceptual_tools (
          id,
          name,
          category,
          purpose,
          when_to_use,
          when_not_to_use,
          instructions,
          expected_effect,
          status,
          version
        )
        VALUES (
          $1::uuid,
          $2,
          $3,
          $4,
          $5::jsonb,
          $6::jsonb,
          $7::jsonb,
          $8,
          $9::"ConceptualToolStatus",
          $10
        )
        ON CONFLICT (name) DO NOTHING
      `,
      tool.id,
      tool.name,
      tool.category,
      tool.purpose,
      JSON.stringify(tool.whenToUse),
      JSON.stringify(tool.whenNotToUse),
      JSON.stringify(tool.instructions),
      tool.expectedEffect,
      tool.status,
      tool.version,
    );
  }
}

async function listConceptualToolsFromSql(prisma, filters = {}) {
  await ensureConceptualToolsStorage(prisma);

  const params = [];
  let index = 0;
  const addParam = (value) => {
    params.push(value);
    index += 1;
    return `$${index}`;
  };

  const whereClauses = [];
  const status = normalizeStatus(filters.status, { fallback: "" });
  if (status) {
    whereClauses.push(`status = ${addParam(status)}::"ConceptualToolStatus"`);
  }

  const query = `
    SELECT
      id,
      name,
      category,
      purpose,
      when_to_use,
      when_not_to_use,
      instructions,
      expected_effect,
      status,
      version,
      created_at,
      updated_at
    FROM conceptual_tools
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
    ORDER BY status ASC, category ASC, name ASC, version DESC
  `;

  const records = await prisma.$queryRawUnsafe(query, ...params);
  return records.map(mapConceptualTool);
}

async function getConceptualToolFromSql(prisma, toolId) {
  await ensureConceptualToolsStorage(prisma);

  const records = await prisma.$queryRawUnsafe(
    `
      SELECT
        id,
        name,
        category,
        purpose,
        when_to_use,
        when_not_to_use,
        instructions,
        expected_effect,
        status,
        version,
        created_at,
        updated_at
      FROM conceptual_tools
      WHERE id = $1::uuid
      LIMIT 1
    `,
    toolId,
  );

  return mapConceptualTool(records[0] ?? null);
}

async function createConceptualToolWithSql(prisma, payload) {
  const data = buildCreateData(payload);
  await ensureConceptualToolsStorage(prisma);

  const records = await prisma.$queryRawUnsafe(
    `
      INSERT INTO conceptual_tools (
        id,
        name,
        category,
        purpose,
        when_to_use,
        when_not_to_use,
        instructions,
        expected_effect,
        status,
        version
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5::jsonb,
        $6::jsonb,
        $7::jsonb,
        $8,
        $9::"ConceptualToolStatus",
        $10
      )
      RETURNING
        id,
        name,
        category,
        purpose,
        when_to_use,
        when_not_to_use,
        instructions,
        expected_effect,
        status,
        version,
        created_at,
        updated_at
    `,
    data.id,
    data.name,
    data.category,
    data.purpose,
    JSON.stringify(data.whenToUse),
    JSON.stringify(data.whenNotToUse),
    JSON.stringify(data.instructions),
    data.expectedEffect,
    data.status,
    data.version,
  );

  return mapConceptualTool(records[0] ?? null);
}

async function updateConceptualToolWithSql(prisma, toolId, payload) {
  const existing = await getConceptualToolFromSql(prisma, toolId);
  if (!existing) {
    throw createHttpError(404, "Conceptual tool not found");
  }

  const data = buildUpdateData(payload);
  if (Object.keys(data).length === 0) {
    throw createHttpError(400, "Update payload must contain at least one field");
  }

  const params = [];
  let index = 0;
  const addParam = (value) => {
    params.push(value);
    index += 1;
    return `$${index}`;
  };
  const updates = [];

  if (Object.hasOwn(data, "name")) {
    updates.push(`name = ${addParam(data.name)}`);
  }
  if (Object.hasOwn(data, "category")) {
    updates.push(`category = ${addParam(data.category)}`);
  }
  if (Object.hasOwn(data, "purpose")) {
    updates.push(`purpose = ${addParam(data.purpose)}`);
  }
  if (Object.hasOwn(data, "whenToUse")) {
    updates.push(`when_to_use = ${addParam(JSON.stringify(data.whenToUse))}::jsonb`);
  }
  if (Object.hasOwn(data, "whenNotToUse")) {
    updates.push(`when_not_to_use = ${addParam(JSON.stringify(data.whenNotToUse))}::jsonb`);
  }
  if (Object.hasOwn(data, "instructions")) {
    updates.push(`instructions = ${addParam(JSON.stringify(data.instructions))}::jsonb`);
  }
  if (Object.hasOwn(data, "expectedEffect")) {
    updates.push(`expected_effect = ${addParam(data.expectedEffect)}`);
  }
  if (Object.hasOwn(data, "status")) {
    updates.push(`status = ${addParam(data.status)}::"ConceptualToolStatus"`);
  }
  if (Object.hasOwn(data, "version")) {
    updates.push(`version = ${addParam(data.version)}`);
  }

  updates.push(`updated_at = NOW()`);
  const toolParam = addParam(toolId);

  const records = await prisma.$queryRawUnsafe(
    `
      UPDATE conceptual_tools
      SET ${updates.join(", ")}
      WHERE id = ${toolParam}::uuid
      RETURNING
        id,
        name,
        category,
        purpose,
        when_to_use,
        when_not_to_use,
        instructions,
        expected_effect,
        status,
        version,
        created_at,
        updated_at
    `,
    ...params,
  );

  return {
    existing,
    updated: mapConceptualTool(records[0] ?? null),
  };
}

async function listConceptualTools(prisma, filters = {}) {
  const delegate = getConceptualToolDelegate(prisma);
  if (!delegate || typeof delegate.findMany !== "function") {
    return listConceptualToolsFromSql(prisma, filters);
  }

  const where = {};
  const status = normalizeStatus(filters.status, { fallback: "" });
  if (status) {
    where.status = status;
  }

  try {
    const records = await prisma.conceptualTool.findMany({
      where,
      orderBy: [{ status: "asc" }, { category: "asc" }, { name: "asc" }, { version: "desc" }],
    });

    return records.map(mapConceptualTool);
  } catch (error) {
    if (isMissingConceptualToolStorageError(error)) {
      return listConceptualToolsFromSql(prisma, filters);
    }
    throw error;
  }
}

async function getConceptualTool(prisma, toolId) {
  const delegate = getConceptualToolDelegate(prisma);
  if (!delegate || typeof delegate.findUnique !== "function") {
    return getConceptualToolFromSql(prisma, toolId);
  }

  try {
    const record = await prisma.conceptualTool.findUnique({
      where: {
        id: toolId,
      },
    });

    return mapConceptualTool(record);
  } catch (error) {
    if (isMissingConceptualToolStorageError(error)) {
      return getConceptualToolFromSql(prisma, toolId);
    }
    throw error;
  }
}

async function createConceptualTool(prisma, payload) {
  const delegate = getConceptualToolDelegate(prisma);
  let createdRecord = null;

  if (!delegate || typeof delegate.create !== "function" || typeof prisma?.$transaction !== "function") {
    createdRecord = await createConceptualToolWithSql(prisma, payload);
    await createLogEntry(prisma, {
      level: "info",
      scope: "conceptual-tools-admin",
      event: "conceptual_tool_created",
      message: `Created conceptual tool "${createdRecord.name}"`,
      context: {
        conceptualToolId: createdRecord.id,
        version: createdRecord.version,
        status: createdRecord.status,
      },
    });
    return createdRecord;
  }

  try {
    await prisma.$transaction(async (tx) => {
      createdRecord = await tx.conceptualTool.create({
        data: buildCreateData(payload),
      });

      await createLogEntry(tx, {
        level: "info",
        scope: "conceptual-tools-admin",
        event: "conceptual_tool_created",
        message: `Created conceptual tool "${createdRecord.name}"`,
        context: {
          conceptualToolId: createdRecord.id,
          version: createdRecord.version,
          status: createdRecord.status,
        },
      });
    });

    return mapConceptualTool(createdRecord);
  } catch (error) {
    if (isMissingConceptualToolStorageError(error)) {
      createdRecord = await createConceptualToolWithSql(prisma, payload);
      await createLogEntry(prisma, {
        level: "info",
        scope: "conceptual-tools-admin",
        event: "conceptual_tool_created",
        message: `Created conceptual tool "${createdRecord.name}"`,
        context: {
          conceptualToolId: createdRecord.id,
          version: createdRecord.version,
          status: createdRecord.status,
        },
      });
      return createdRecord;
    }
    throw error;
  }
}

async function updateConceptualTool(prisma, toolId, payload) {
  const delegate = getConceptualToolDelegate(prisma);

  if (
    !delegate ||
    typeof delegate.findUniqueOrThrow !== "function" ||
    typeof delegate.update !== "function" ||
    typeof prisma?.$transaction !== "function"
  ) {
    const { existing, updated } = await updateConceptualToolWithSql(prisma, toolId, payload);
    await createLogEntry(prisma, {
      level: "info",
      scope: "conceptual-tools-admin",
      event: "conceptual_tool_updated",
      message: `Updated conceptual tool "${existing.name}"`,
      context: {
        conceptualToolId: toolId,
        changedFields: Object.keys(buildUpdateData(payload)),
        status: updated?.status ?? null,
        version: updated?.version ?? null,
      },
    });
    return updated;
  }

  let updatedRecord = null;
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.conceptualTool.findUniqueOrThrow({
        where: {
          id: toolId,
        },
      });

      const data = buildUpdateData(payload);
      if (Object.keys(data).length === 0) {
        throw createHttpError(400, "Update payload must contain at least one field");
      }

      updatedRecord = await tx.conceptualTool.update({
        where: {
          id: toolId,
        },
        data,
      });

      await createLogEntry(tx, {
        level: "info",
        scope: "conceptual-tools-admin",
        event: "conceptual_tool_updated",
        message: `Updated conceptual tool "${existing.name}"`,
        context: {
          conceptualToolId: toolId,
          changedFields: Object.keys(data),
          status: updatedRecord.status,
          version: updatedRecord.version,
        },
      });
    });

    return mapConceptualTool(updatedRecord);
  } catch (error) {
    if (isMissingConceptualToolStorageError(error)) {
      const { existing, updated } = await updateConceptualToolWithSql(prisma, toolId, payload);
      await createLogEntry(prisma, {
        level: "info",
        scope: "conceptual-tools-admin",
        event: "conceptual_tool_updated",
        message: `Updated conceptual tool "${existing.name}"`,
        context: {
          conceptualToolId: toolId,
          changedFields: Object.keys(buildUpdateData(payload)),
          status: updated?.status ?? null,
          version: updated?.version ?? null,
        },
      });
      return updated;
    }
    throw error;
  }
}

module.exports = {
  TOOL_STATUSES,
  createConceptualTool,
  ensureConceptualToolsStorage,
  getConceptualTool,
  listConceptualTools,
  normalizeListField,
  normalizeStatus,
  updateConceptualTool,
};
