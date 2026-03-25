function normalizeToolList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function getAgentKeyFromPromptKey(key) {
  if (typeof key !== "string" || key.length === 0) {
    return null;
  }

  const [agentKey] = key.split(".");
  return agentKey || null;
}

function normalizeAgentKeySeed(value) {
  if (typeof value !== "string") {
    return "agent";
  }

  const withoutSuffix = value.replace(/\bagent\b\s*$/i, "").trim();
  const normalized = withoutSuffix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "agent";
}

async function generateAgentKey(tx, payload) {
  const requestedKey = payload.key?.trim();
  const baseKey = normalizeAgentKeySeed(requestedKey || payload.name);
  let candidate = baseKey;
  let suffix = 2;

  while (true) {
    const existing = await tx.agentDefinition.findUnique({
      where: {
        key: candidate,
      },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${baseKey}-${suffix}`;
    suffix += 1;
  }
}

function mapPromptConfig(promptConfig) {
  if (!promptConfig) {
    return null;
  }

  return {
    id: promptConfig.id,
    key: promptConfig.key,
    version: promptConfig.version,
    promptTemplate: promptConfig.promptTemplate,
    configJson: promptConfig.configJson ?? {},
    active: promptConfig.active,
    updatedAt: promptConfig.updatedAt,
  };
}

function mapRuntimeAgent(runtimeAgent) {
  if (!runtimeAgent) {
    return {
      registered: false,
      name: null,
      version: null,
      purpose: null,
      allowedTools: [],
    };
  }

  return {
    registered: true,
    name: runtimeAgent.name ?? null,
    version: runtimeAgent.version ?? null,
    purpose: runtimeAgent.purpose ?? null,
    allowedTools: normalizeToolList(runtimeAgent.allowed_tools ?? runtimeAgent.allowedTools),
  };
}

function mapAdminAgent(agentDefinition, promptConfig, runtimeAgent) {
  return {
    id: agentDefinition.id,
    key: agentDefinition.key,
    name: agentDefinition.name,
    version: agentDefinition.version,
    description: agentDefinition.description,
    allowedTools: normalizeToolList(agentDefinition.allowedTools),
    defaultModel: agentDefinition.defaultModel,
    active: agentDefinition.active,
    createdAt: agentDefinition.createdAt,
    updatedAt: agentDefinition.updatedAt,
    promptConfig: mapPromptConfig(promptConfig),
    runtime: mapRuntimeAgent(runtimeAgent),
  };
}

async function loadAgentAdminSnapshot(prisma, agentGatewayClient) {
  const [agentDefinitions, promptConfigs, gateway] = await Promise.all([
    prisma.agentDefinition.findMany({
      orderBy: [{ active: "desc" }, { key: "asc" }],
    }),
    prisma.promptConfig.findMany({
      where: {
        active: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    agentGatewayClient.getAdminSnapshot(),
  ]);

  const promptConfigByAgentKey = new Map();
  for (const promptConfig of promptConfigs) {
    const agentKey = getAgentKeyFromPromptKey(promptConfig.key);
    if (agentKey && !promptConfigByAgentKey.has(agentKey)) {
      promptConfigByAgentKey.set(agentKey, promptConfig);
    }
  }

  const runtimeAgentByKey = new Map(
    (gateway.agents ?? []).map((agent) => [agent.key, agent]),
  );

  return {
    gateway,
    agents: agentDefinitions.map((agentDefinition) =>
      mapAdminAgent(
        agentDefinition,
        promptConfigByAgentKey.get(agentDefinition.key) ?? null,
        runtimeAgentByKey.get(agentDefinition.key) ?? null,
      ),
    ),
  };
}

async function createAgentAdmin(prisma, payload, agentGatewayClient) {
  let createdAgentId = null;
  let createdAgentKey = null;

  await prisma.$transaction(async (tx) => {
    createdAgentKey = await generateAgentKey(tx, payload);

    const createdAgent = await tx.agentDefinition.create({
      data: {
        key: createdAgentKey,
        name: payload.name,
        version: payload.version,
        description: payload.description ?? null,
        allowedTools: payload.allowedTools ?? [],
        defaultModel: payload.defaultModel ?? null,
        active: payload.active ?? true,
      },
    });

    createdAgentId = createdAgent.id;

    if (payload.promptConfig) {
      const promptKey = payload.promptConfig.key ?? `${createdAgentKey}.default`;

      await tx.promptConfig.updateMany({
        where: {
          key: promptKey,
          active: true,
        },
        data: {
          active: false,
        },
      });

      await tx.promptConfig.create({
        data: {
          key: promptKey,
          version: payload.promptConfig.version,
          promptTemplate: payload.promptConfig.promptTemplate,
          configJson: payload.promptConfig.configJson ?? {},
          active: true,
        },
      });
    }
  });

  const snapshot = await loadAgentAdminSnapshot(prisma, agentGatewayClient);

  return snapshot.agents.find((agent) => agent.id === createdAgentId) ?? null;
}

async function updateAgentAdmin(prisma, agentId, payload, agentGatewayClient) {
  await prisma.$transaction(async (tx) => {
    const existingAgent = await tx.agentDefinition.findUniqueOrThrow({
      where: {
        id: agentId,
      },
    });

    const agentUpdate = {};

    if (Object.hasOwn(payload, "name")) {
      agentUpdate.name = payload.name;
    }

    if (Object.hasOwn(payload, "version")) {
      agentUpdate.version = payload.version;
    }

    if (Object.hasOwn(payload, "description")) {
      agentUpdate.description = payload.description;
    }

    if (Object.hasOwn(payload, "allowedTools")) {
      agentUpdate.allowedTools = payload.allowedTools;
    }

    if (Object.hasOwn(payload, "defaultModel")) {
      agentUpdate.defaultModel = payload.defaultModel;
    }

    if (Object.hasOwn(payload, "active")) {
      agentUpdate.active = payload.active;
    }

    if (Object.keys(agentUpdate).length > 0) {
      await tx.agentDefinition.update({
        where: {
          id: agentId,
        },
        data: agentUpdate,
      });
    }

    if (payload.promptConfig) {
      const promptKey = payload.promptConfig.key ?? `${existingAgent.key}.default`;

      await tx.promptConfig.updateMany({
        where: {
          key: promptKey,
          active: true,
        },
        data: {
          active: false,
        },
      });

      const existingPrompt = await tx.promptConfig.findFirst({
        where: {
          key: promptKey,
          version: payload.promptConfig.version,
        },
      });

      if (existingPrompt) {
        await tx.promptConfig.update({
          where: {
            id: existingPrompt.id,
          },
          data: {
            promptTemplate: payload.promptConfig.promptTemplate,
            configJson: payload.promptConfig.configJson ?? {},
            active: true,
          },
        });
      } else {
        await tx.promptConfig.create({
          data: {
            key: promptKey,
            version: payload.promptConfig.version,
            promptTemplate: payload.promptConfig.promptTemplate,
            configJson: payload.promptConfig.configJson ?? {},
            active: true,
          },
        });
      }
    }
  });

  const snapshot = await loadAgentAdminSnapshot(prisma, agentGatewayClient);

  return snapshot.agents.find((agent) => agent.id === agentId) ?? null;
}

module.exports = {
  createAgentAdmin,
  loadAgentAdminSnapshot,
  updateAgentAdmin,
};
