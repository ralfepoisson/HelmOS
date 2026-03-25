const test = require("node:test");
const assert = require("node:assert/strict");

const request = require("supertest");

const { createApp } = require("../app/create-app");
const { resourceConfigs } = require("../app/api/resources");

const CRUD_FIXTURES = {
  users: {
    create: {
      email: "founder@example.com",
      displayName: "Founder",
      authProvider: "google",
      authProviderUserId: "google-user-123",
    },
    update: {
      displayName: "Updated Founder",
    },
  },
  organisations: {
    create: {
      name: "HelmOS Labs",
      slug: "helmos-labs",
      createdByUserId: "11111111-1111-4111-8111-111111111111",
    },
    update: {
      name: "Updated HelmOS Labs",
    },
  },
  "organisation-members": {
    create: {
      organisationId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      role: "OWNER",
    },
    update: {
      role: "ADMIN",
    },
  },
  companies: {
    create: {
      organisationId: "11111111-1111-4111-8111-111111111111",
      name: "Orbit Forge Labs",
      businessType: "PRODUCT",
      slug: "orbit-forge-labs",
      createdByUserId: "22222222-2222-4222-8222-222222222222",
    },
    update: {
      name: "Orbit Forge Research",
    },
  },
  workspaces: {
    create: {
      companyId: "33333333-3333-4333-8333-333333333333",
      name: "Orbit Forge Workspace",
      createdByUserId: "22222222-2222-4222-8222-222222222222",
    },
    update: {
      name: "Updated Orbit Forge Workspace",
    },
  },
  "strategy-documents": {
    create: {
      workspaceId: "44444444-4444-4444-8444-444444444444",
      title: "Ideation: Orbit Forge Labs",
    },
    update: {
      title: "Updated Ideation: Orbit Forge Labs",
    },
  },
  "strategy-sections": {
    create: {
      documentId: "55555555-5555-4555-8555-555555555555",
      sectionKey: "problem_statement",
      title: "Problem Statement",
      displayOrder: 1,
    },
    update: {
      title: "Updated Problem Statement",
    },
  },
  "section-versions": {
    create: {
      sectionId: "66666666-6666-4666-8666-666666666666",
      versionNo: 1,
    },
    update: {
      changeSummary: "Updated version summary",
    },
  },
  "document-insights": {
    create: {
      documentId: "77777777-7777-4777-8777-777777777777",
      insightType: "summary",
      title: "Document summary",
      body: "A concise overview of the document state.",
    },
    update: {
      title: "Updated document summary",
    },
  },
  "stage-progress": {
    create: {
      workspaceId: "88888888-8888-4888-8888-888888888888",
      stageKey: "IDEATION",
      displayOrder: 1,
      status: "CURRENT",
    },
    update: {
      status: "COMPLETED",
    },
  },
  "chat-threads": {
    create: {
      workspaceId: "99999999-9999-4999-8999-999999999999",
      title: "Ideation thread",
    },
    update: {
      title: "Updated ideation thread",
    },
  },
  "chat-messages": {
    create: {
      threadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messageIndex: 1,
      senderType: "USER",
      messageText: "Can you help refine the problem statement?",
    },
    update: {
      messageText: "Updated message text",
    },
  },
  "agent-runs": {
    create: {
      threadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    },
    update: {
      runStatus: "RUNNING",
    },
  },
  "agent-run-effects": {
    create: {
      agentRunId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      effectType: "updated_section",
      targetEntityType: "strategy_section",
    },
    update: {
      effectType: "created_document",
    },
  },
  "agent-definitions": {
    create: {
      key: "ideation",
      name: "Ideation Agent",
      version: "1.0.0",
      description: "Helps founders structure early business ideas.",
      allowedTools: ["retrieval"],
      defaultModel: "helmos-default",
      active: true,
    },
    update: {
      name: "Updated Ideation Agent",
    },
  },
  "prompt-configs": {
    create: {
      key: "ideation.default",
      version: "1.0.0",
      promptTemplate: "Refine the founder brief from: {prompt}",
      configJson: {
        temperature: 0.1,
      },
      active: true,
    },
    update: {
      promptTemplate: "Updated prompt template",
    },
  },
  "activity-log": {
    create: {
      workspaceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      eventType: "business_idea_created",
    },
    update: {
      eventSummary: "Updated event summary",
    },
  },
};

function buildCrudPrismaForConfig(config) {
  const fixture = CRUD_FIXTURES[config.path];
  const baseRecord = {
    id: `${config.path}-record-id`,
    ...fixture.create,
  };

  const delegate = {
    findManyCalls: [],
    createCalls: [],
    findUniqueCalls: [],
    updateCalls: [],
    deleteCalls: [],
    async findMany(args) {
      delegate.findManyCalls.push(args);
      return [baseRecord];
    },
    async create({ data }) {
      delegate.createCalls.push(data);
      return {
        ...baseRecord,
        ...data,
      };
    },
    async findUniqueOrThrow(args) {
      delegate.findUniqueCalls.push(args);
      return {
        ...baseRecord,
        id: args.where.id,
      };
    },
    async update({ where, data }) {
      delegate.updateCalls.push({ where, data });
      return {
        ...baseRecord,
        id: where.id,
        ...data,
      };
    },
    async delete(args) {
      delegate.deleteCalls.push(args);
      return {
        id: args.where.id,
      };
    },
  };

  return {
    prisma: {
      [config.model]: delegate,
    },
    delegate,
    fixture,
    baseRecord,
  };
}

function buildStrategyHubWorkspaceRecord(overrides = {}) {
  return {
    id: overrides.id ?? "workspace-idea-1",
    updatedAt: overrides.updatedAt ?? new Date("2026-03-22T09:00:00Z"),
    company: {
      id: "company-idea-1",
      name: overrides.name ?? "Orbit Forge Labs",
      businessType: overrides.businessType ?? "RESEARCH_AND_DEVELOPMENT",
    },
    documents: [
      {
        id: "document-idea-1",
        completenessPercent: 0,
        sections: [
          {
            id: "section-idea-1",
            title: "Problem Statement",
            description: "Describe the pain, inefficiency, or unmet need the business should solve.",
            content: null,
            metadata: {
              emphasis: "primary",
            },
            refinementState: "EMPTY",
            completionPercent: 0,
            agentConfidence: "MEDIUM",
            lastUpdatedByType: "AGENT",
            lastUpdatedAt: new Date("2026-03-22T09:00:00Z"),
          },
        ],
      },
    ],
    chatThreads: [
      {
        id: "thread-idea-1",
        messages: [
          {
            id: "message-idea-1",
            senderType: "AGENT",
            messageText: "What problem should this business solve first?",
            createdAt: new Date("2026-03-22T09:00:00Z"),
          },
        ],
      },
    ],
  };
}

test("GET /api/health returns a healthy status", async () => {
  const app = createApp({ prisma: {} });
  const response = await request(app).get("/api/health");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    status: "ok",
  });
});

test("POST /api/users creates a user record", async () => {
  const prisma = {
    user: {
      create: async ({ data }) => ({
        id: "f0efee02-b644-44f2-a1a9-cff766e1fb23",
        ...data,
      }),
    },
  };

  const app = createApp({ prisma });
  const response = await request(app)
    .post("/api/users")
    .send({
      email: "founder@example.com",
      displayName: "Founder",
      authProvider: "google",
      authProviderUserId: "google-user-123",
    });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.email, "founder@example.com");
  assert.equal(response.body.data.displayName, "Founder");
});

test("GET /api/workspaces forwards list filters and limit", async () => {
  let capturedArgs;
  const prisma = {
    workspace: {
      findMany: async (args) => {
        capturedArgs = args;
        return [];
      },
    },
  };

  const app = createApp({ prisma });
  const response = await request(app)
    .get("/api/workspaces")
    .query({
      companyId: "a1fe4eb5-f7b3-4532-a485-c0a5efff57ae",
      status: "ACTIVE",
      limit: "2",
    });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedArgs, {
    where: {
      companyId: "a1fe4eb5-f7b3-4532-a485-c0a5efff57ae",
      status: "ACTIVE",
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 2,
  });
});

test("POST /api/chat-messages auto-assigns the next message index", async () => {
  const prisma = {
    chatMessage: {
      aggregate: async () => ({
        _max: {
          messageIndex: 4,
        },
      }),
      create: async ({ data }) => ({
        id: "12dd8af7-f8d7-4754-94d6-35fe95d064ba",
        ...data,
      }),
    },
  };

  const app = createApp({ prisma });
  const response = await request(app)
    .post("/api/chat-messages")
    .send({
      threadId: "ba88a581-9fe8-4b0e-bb2e-cf491ff7a6cb",
      senderType: "USER",
      messageText: "Can you refine the value proposition?",
    });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.messageIndex, 5);
});

test("PATCH /api/users rejects an empty update payload", async () => {
  const prisma = {
    user: {
      update: async () => {
        throw new Error("should not be called");
      },
    },
  };

  const app = createApp({ prisma });
  const response = await request(app).patch("/api/users/user-1").send({});

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "Update payload must contain at least one field");
});

test("Known Prisma-style errors are translated into API responses", async () => {
  const prisma = {
    user: {
      create: async () => {
        const error = new Error("Unique constraint failed");
        error.code = "P2002";
        error.meta = {
          target: ["email"],
        };
        throw error;
      },
    },
  };

  const app = createApp({ prisma });
  const response = await request(app)
    .post("/api/users")
    .send({
      email: "founder@example.com",
      authProvider: "google",
      authProviderUserId: "duplicate-user",
    });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "P2002");
  assert.deepEqual(response.body.details, ["email"]);
});

test("GET /api/meta exposes resources and enum metadata", async () => {
  const app = createApp({ prisma: {} });
  const response = await request(app).get("/api/meta");

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(response.body.data.resources), true);
  assert.equal(response.body.data.resources.length > 0, true);
  assert.equal(response.body.data.enums.WorkspaceStatus.ACTIVE, "ACTIVE");
});

test("GET /api/business-ideas returns workspace options", async () => {
  const prisma = {
    workspace: {
      findMany: async () => [
        {
          id: "f6869722-a2fb-451d-944b-a01f4d866f42",
          updatedAt: new Date("2026-03-22T09:00:00Z"),
          company: {
            name: "Northstar Ventures",
            businessType: "PRODUCT",
          },
        },
      ],
    },
  };

  const app = createApp({ prisma });
  const response = await request(app).get("/api/business-ideas");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data, [
    {
      id: "f6869722-a2fb-451d-944b-a01f4d866f42",
      name: "Northstar Ventures",
      businessType: "PRODUCT",
      businessTypeLabel: "Product",
      updatedAt: "2026-03-22T09:00:00.000Z",
    },
  ]);
});

test("POST /api/business-ideas validates the creation payload", async () => {
  const app = createApp({ prisma: {} });
  const response = await request(app)
    .post("/api/business-ideas")
    .send({
      name: "",
      businessType: "INVALID",
    });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "Validation failed");
});

test("POST /api/business-ideas creates a strategy hub workspace", async () => {
  const workspaceRecord = buildStrategyHubWorkspaceRecord();
  const prisma = {
    user: {
      upsert: async () => ({ id: "user-idea-1" }),
    },
    organisation: {
      upsert: async () => ({ id: "org-idea-1" }),
    },
    organisationMember: {
      upsert: async () => ({ id: "member-idea-1" }),
    },
    company: {
      findFirst: async () => null,
      create: async () => ({ id: "company-idea-1" }),
    },
    workspace: {
      create: async () => ({ id: "workspace-idea-1" }),
      findUniqueOrThrow: async () => workspaceRecord,
    },
    strategyDocument: {
      create: async () => ({ id: "document-idea-1" }),
    },
    strategySection: {
      create: async () => ({}),
    },
    stageProgress: {
      create: async () => ({}),
    },
    chatThread: {
      create: async () => ({ id: "thread-idea-1" }),
    },
    chatMessage: {
      create: async () => ({ id: "message-idea-1" }),
    },
    activityLog: {
      create: async () => ({ id: "activity-idea-1" }),
    },
    $transaction: async (callback) => callback(prisma),
  };

  const app = createApp({ prisma });
  const response = await request(app).post("/api/business-ideas").send({
    name: "Orbit Forge Labs",
    businessType: "RESEARCH_AND_DEVELOPMENT",
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.workspaceOption.id, "workspace-idea-1");
  assert.equal(response.body.data.workspace.pageTitle, "Ideation: Orbit Forge Labs");
  assert.equal(response.body.data.chat.messages.length, 1);
});

test("GET /api/business-ideas/:workspaceId returns the strategy hub payload", async () => {
  const prisma = {
    workspace: {
      findUniqueOrThrow: async () => buildStrategyHubWorkspaceRecord({
        id: "workspace-existing-1",
        name: "Northstar Ventures",
        businessType: "PRODUCT",
      }),
    },
  };

  const app = createApp({ prisma });
  const response = await request(app).get("/api/business-ideas/workspace-existing-1");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.workspaceOption.id, "workspace-existing-1");
  assert.equal(response.body.data.workspace.pageStatus, "Product business idea");
  assert.equal(response.body.data.workspace.sections[0].title, "Problem Statement");
});

for (const config of resourceConfigs) {
  test(`GET /api/${config.path} returns a list`, async () => {
    const { prisma, delegate, baseRecord } = buildCrudPrismaForConfig(config);
    const app = createApp({ prisma });
    const response = await request(app).get(`/api/${config.path}`);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, [baseRecord]);
    assert.deepEqual(delegate.findManyCalls[0], {
      where: {},
      orderBy: config.orderBy,
      take: 50,
    });
  });

  test(`POST /api/${config.path} creates a record`, async () => {
    const { prisma, delegate, fixture } = buildCrudPrismaForConfig(config);
    const app = createApp({ prisma });
    const response = await request(app).post(`/api/${config.path}`).send(fixture.create);

    assert.equal(response.statusCode, 201);
    assert.deepEqual(delegate.createCalls[0], fixture.create);
    assert.equal(response.body.data.id, `${config.path}-record-id`);
  });

  test(`GET /api/${config.path}/:id returns a record`, async () => {
    const { prisma, delegate } = buildCrudPrismaForConfig(config);
    const app = createApp({ prisma });
    const response = await request(app).get(`/api/${config.path}/test-record-id`);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(delegate.findUniqueCalls[0], {
      where: {
        id: "test-record-id",
      },
    });
    assert.equal(response.body.data.id, "test-record-id");
  });

  test(`PATCH /api/${config.path}/:id updates a record`, async () => {
    const { prisma, delegate, fixture } = buildCrudPrismaForConfig(config);
    const app = createApp({ prisma });
    const response = await request(app).patch(`/api/${config.path}/test-record-id`).send(fixture.update);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(delegate.updateCalls[0], {
      where: {
        id: "test-record-id",
      },
      data: fixture.update,
    });
    assert.equal(response.body.data.id, "test-record-id");
  });

  test(`DELETE /api/${config.path}/:id deletes a record`, async () => {
    const { prisma, delegate } = buildCrudPrismaForConfig(config);
    const app = createApp({ prisma });
    const response = await request(app).delete(`/api/${config.path}/test-record-id`);

    assert.equal(response.statusCode, 204);
    assert.deepEqual(delegate.deleteCalls[0], {
      where: {
        id: "test-record-id",
      },
    });
  });
}

test("GET /api/admin/agents returns persisted agents with gateway runtime metadata", async () => {
  const prisma = {
    agentDefinition: {
      findMany: async () => [
        {
          id: "agent-1",
          key: "ideation",
          name: "Ideation Agent",
          version: "1.0.0",
          description: "Transforms founder input into structured idea briefs.",
          allowedTools: ["retrieval"],
          defaultModel: "helmos-default",
          active: true,
          createdAt: "2026-03-22T08:00:00.000Z",
          updatedAt: "2026-03-22T08:05:00.000Z",
        },
      ],
    },
    promptConfig: {
      findMany: async () => [
        {
          id: "prompt-1",
          key: "ideation.default",
          version: "1.0.0",
          promptTemplate: "Generate a founder-oriented idea brief from: {prompt}",
          configJson: { temperature: 0.2 },
          active: true,
          updatedAt: "2026-03-22T08:06:00.000Z",
        },
      ],
    },
  };

  const agentGatewayClient = {
    getAdminSnapshot: async () => ({
      configured: true,
      status: "online",
      message: "Agent gateway responded successfully.",
      baseUrl: "http://localhost:8000/api/v1",
      service: "helmos-agent-gateway",
      checkedAt: "2026-03-22T08:10:00.000Z",
      agents: [
        {
          key: "ideation",
          name: "Ideation Agent",
          version: "1.0.0",
          purpose: "Transforms founder input into structured idea briefs.",
          allowed_tools: ["retrieval"],
        },
      ],
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await request(app).get("/api/admin/agents");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.gateway.status, "online");
  assert.equal(response.body.data.agents.length, 1);
  assert.deepEqual(response.body.data.agents[0].allowedTools, ["retrieval"]);
  assert.equal(response.body.data.agents[0].runtime.registered, true);
  assert.equal(response.body.data.agents[0].promptConfig.version, "1.0.0");
});

test("POST /api/admin/agents creates an agent definition with its first prompt config", async () => {
  const agentDefinitions = [];
  const promptConfigs = [];

  const prisma = {
    agentDefinition: {
      findMany: async () => agentDefinitions,
      create: async ({ data }) => {
        const created = {
          id: "agent-1",
          createdAt: "2026-03-22T10:00:00.000Z",
          updatedAt: "2026-03-22T10:00:00.000Z",
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
          id: "prompt-1",
          createdAt: "2026-03-22T10:00:00.000Z",
          updatedAt: "2026-03-22T10:00:00.000Z",
          ...data,
        };
        promptConfigs.push(created);
        return created;
      },
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    getAdminSnapshot: async () => ({
      configured: true,
      status: "online",
      message: "Agent gateway responded successfully.",
      baseUrl: "http://localhost:8000/api/v1",
      service: "helmos-agent-gateway",
      checkedAt: "2026-03-22T10:01:00.000Z",
      agents: [
        {
          key: "ideation",
          name: "Ideation Agent",
          version: "1.0.0",
          purpose: "Transforms founder input into structured idea briefs.",
          allowed_tools: ["retrieval"],
        },
      ],
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await request(app)
    .post("/api/admin/agents")
    .send({
      key: "ideation",
      name: "Ideation Agent",
      version: "1.0.0",
      description: "Transforms founder input into structured idea briefs.",
      allowedTools: ["retrieval"],
      defaultModel: "helmos-default",
      active: true,
      promptConfig: {
        version: "1.0.0",
        promptTemplate: "Generate a founder-oriented idea brief from: {prompt}",
        configJson: { temperature: 0.2, artifact_kind: "idea_brief" },
      },
    });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.key, "ideation");
  assert.equal(response.body.data.promptConfig.key, "ideation.default");
  assert.equal(response.body.data.promptConfig.version, "1.0.0");
  assert.equal(agentDefinitions.length, 1);
  assert.equal(promptConfigs.length, 1);
  assert.deepEqual(agentDefinitions[0].allowedTools, ["retrieval"]);
});

test("PATCH /api/admin/agents/:id updates agent registry and prompt config", async () => {
  const agentDefinitions = [
    {
      id: "agent-1",
      key: "ideation",
      name: "Ideation Agent",
      version: "1.0.0",
      description: "Transforms founder input into structured idea briefs.",
      allowedTools: ["retrieval"],
      defaultModel: "helmos-default",
      active: true,
      createdAt: "2026-03-22T08:00:00.000Z",
      updatedAt: "2026-03-22T08:05:00.000Z",
    },
  ];
  const promptConfigs = [
    {
      id: "prompt-1",
      key: "ideation.default",
      version: "1.0.0",
      promptTemplate: "Generate a founder-oriented idea brief from: {prompt}",
      configJson: { temperature: 0.2 },
      active: true,
      updatedAt: "2026-03-22T08:06:00.000Z",
    },
  ];

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
          updatedAt: "2026-03-22T09:00:00.000Z",
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
        return { count: 1 };
      },
      findFirst: async ({ where }) =>
        promptConfigs.find(
          (entry) => entry.key === where.key && entry.version === where.version,
        ) ?? null,
      update: async ({ where, data }) => {
        const index = promptConfigs.findIndex((entry) => entry.id === where.id);
        promptConfigs[index] = {
          ...promptConfigs[index],
          ...data,
          updatedAt: "2026-03-22T09:00:00.000Z",
        };
        return promptConfigs[index];
      },
      create: async ({ data }) => {
        const created = {
          id: "prompt-2",
          updatedAt: "2026-03-22T09:00:00.000Z",
          ...data,
        };
        promptConfigs.push(created);
        return created;
      },
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    getAdminSnapshot: async () => ({
      configured: true,
      status: "online",
      message: "Agent gateway responded successfully.",
      baseUrl: "http://localhost:8000/api/v1",
      service: "helmos-agent-gateway",
      checkedAt: "2026-03-22T09:00:00.000Z",
      agents: [
        {
          key: "ideation",
          name: "Ideation Agent",
          version: "1.0.0",
          purpose: "Transforms founder input into structured idea briefs.",
          allowed_tools: ["retrieval", "web_search"],
        },
      ],
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await request(app)
    .patch("/api/admin/agents/agent-1")
    .send({
      name: "Ideation Agent",
      version: "1.1.0",
      description: "Refines founder concepts into structured idea briefs.",
      allowedTools: ["retrieval", "web_search"],
      defaultModel: "helmos-default",
      active: true,
      promptConfig: {
        version: "1.1.0",
        promptTemplate: "Refine the founder brief from: {prompt}",
        configJson: { temperature: 0.1, artifact_kind: "idea_brief" },
      },
    });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.version, "1.1.0");
  assert.deepEqual(response.body.data.allowedTools, ["retrieval", "web_search"]);
  assert.equal(response.body.data.promptConfig.version, "1.1.0");
  assert.equal(response.body.data.promptConfig.promptTemplate, "Refine the founder brief from: {prompt}");
  assert.equal(promptConfigs.filter((entry) => entry.active).length, 1);
  assert.equal(promptConfigs.find((entry) => entry.id === "prompt-1").active, false);
});
