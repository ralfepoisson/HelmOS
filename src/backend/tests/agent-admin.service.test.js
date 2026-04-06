const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAgentAdmin,
  updateAgentAdmin,
} = require("../app/services/agent-admin.service");

function createGatewaySnapshot(agentKey, version = "1.0.0") {
  return {
    configured: true,
    status: "online",
    message: "Agent gateway responded successfully.",
    baseUrl: "http://localhost:8000/api/v1",
    service: "helmos-agent-gateway",
    checkedAt: "2026-04-06T17:49:00.000Z",
    agents: [
      {
        key: agentKey,
        name: "Idea Evaluation Agent",
        version,
        purpose: "Evaluate refined idea candidates.",
        allowed_tools: ["retrieval", "object_storage"],
      },
    ],
  };
}

test("createAgentAdmin stores the first prompt config under the canonical persisted agent key", async () => {
  const agentDefinitions = [];
  const promptConfigs = [];

  const prisma = {
    agentDefinition: {
      findMany: async () => agentDefinitions,
      findUnique: async ({ where }) =>
        agentDefinitions.find((entry) => entry.key === where.key) ?? null,
      create: async ({ data }) => {
        const created = {
          id: "agent-eval-1",
          createdAt: "2026-04-06T17:48:37.849Z",
          updatedAt: "2026-04-06T17:48:37.849Z",
          active: true,
          ...data,
        };
        agentDefinitions.push(created);
        return created;
      },
    },
    promptConfig: {
      findMany: async () => promptConfigs.filter((entry) => entry.active),
      updateMany: async ({ where, data }) => {
        promptConfigs.forEach((entry) => {
          if (entry.key === where.key && entry.active === where.active) {
            entry.active = data.active;
          }
        });
        return { count: 0 };
      },
      create: async ({ data }) => {
        const created = {
          id: "prompt-eval-1",
          createdAt: "2026-04-06T17:48:37.872Z",
          updatedAt: "2026-04-06T17:48:37.872Z",
          ...data,
        };
        promptConfigs.push(created);
        return created;
      },
    },
    logEntry: {
      create: async () => ({}),
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    getAdminSnapshot: async () => createGatewaySnapshot("idea-evaluation"),
  };

  const created = await createAgentAdmin(
    prisma,
    {
      key: "idea-evaluation-agent",
      name: "Idea Evaluation Agent",
      version: "1.0.0",
      description: "Purpose: Evaluate refined idea candidates.",
      allowedTools: ["retrieval", "object_storage"],
      defaultModel: "helmos-default",
      active: true,
      promptConfig: {
        key: "idea-evaluation-agent.default",
        version: "1.0.0",
        promptTemplate: "Role / Persona:\nEvaluate ideas",
        configJson: {
          purpose: "Evaluate refined idea candidates.",
          promptSections: {
            rolePersona: "Evaluate ideas",
            taskInstructions: "Decide whether to promote the idea.",
            constraints: "Do not invent evidence.",
            outputFormat: "{\"decision\":\"promote\"}",
          },
        },
      },
    },
    agentGatewayClient,
  );

  assert.equal(created.key, "idea-evaluation");
  assert.equal(created.promptConfig.key, "idea-evaluation.default");
  assert.equal(promptConfigs.length, 1);
  assert.equal(promptConfigs[0].key, "idea-evaluation.default");
});

test("updateAgentAdmin rewrites mismatched prompt keys back to the agent's canonical key", async () => {
  const agentDefinitions = [
    {
      id: "agent-eval-1",
      key: "idea-evaluation",
      name: "Idea Evaluation Agent",
      version: "1.0.0",
      description: "Purpose: Evaluate refined idea candidates.",
      allowedTools: ["retrieval", "object_storage"],
      defaultModel: "helmos-default",
      active: true,
      createdAt: "2026-04-06T17:48:37.849Z",
      updatedAt: "2026-04-06T17:48:37.849Z",
    },
  ];
  const promptConfigs = [];

  const prisma = {
    agentDefinition: {
      findMany: async () => agentDefinitions,
      findUniqueOrThrow: async ({ where }) => {
        const agent = agentDefinitions.find((entry) => entry.id === where.id);
        if (!agent) {
          throw new Error("not found");
        }
        return agent;
      },
      update: async ({ where, data }) => {
        const index = agentDefinitions.findIndex((entry) => entry.id === where.id);
        agentDefinitions[index] = {
          ...agentDefinitions[index],
          ...data,
          updatedAt: "2026-04-06T18:02:00.000Z",
        };
        return agentDefinitions[index];
      },
    },
    promptConfig: {
      findMany: async () => promptConfigs.filter((entry) => entry.active),
      updateMany: async ({ where, data }) => {
        promptConfigs.forEach((entry) => {
          if (entry.key === where.key && entry.active === where.active) {
            entry.active = data.active;
          }
        });
        return { count: 0 };
      },
      findFirst: async ({ where }) =>
        promptConfigs.find((entry) => entry.key === where.key && entry.version === where.version) ?? null,
      update: async ({ where, data }) => {
        const index = promptConfigs.findIndex((entry) => entry.id === where.id);
        promptConfigs[index] = {
          ...promptConfigs[index],
          ...data,
          updatedAt: "2026-04-06T18:02:00.000Z",
        };
        return promptConfigs[index];
      },
      create: async ({ data }) => {
        const created = {
          id: "prompt-eval-2",
          createdAt: "2026-04-06T18:02:00.000Z",
          updatedAt: "2026-04-06T18:02:00.000Z",
          ...data,
        };
        promptConfigs.push(created);
        return created;
      },
    },
    logEntry: {
      create: async () => ({}),
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    getAdminSnapshot: async () => createGatewaySnapshot("idea-evaluation", "1.0.1"),
  };

  const updated = await updateAgentAdmin(
    prisma,
    "agent-eval-1",
    {
      version: "1.0.1",
      promptConfig: {
        key: "idea-evaluation-agent.default",
        version: "1.0.1",
        promptTemplate: "Role / Persona:\nEvaluate ideas",
        configJson: {
          purpose: "Evaluate refined idea candidates.",
          promptSections: {
            rolePersona: "Evaluate ideas",
            taskInstructions: "Decide whether to promote the idea.",
            constraints: "Do not invent evidence.",
            outputFormat: "{\"decision\":\"promote\"}",
          },
        },
      },
    },
    agentGatewayClient,
  );

  assert.equal(updated.promptConfig.key, "idea-evaluation.default");
  assert.equal(promptConfigs.length, 1);
  assert.equal(promptConfigs[0].key, "idea-evaluation.default");
});
