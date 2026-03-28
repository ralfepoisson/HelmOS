const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const request = require("supertest");

const { createApp, getAllowedOrigins, isAllowedOrigin } = require("../app/create-app");
const { resourceConfigs } = require("../app/api/resources");
const { createAgentGatewayClient } = require("../app/services/agent-gateway-client");

function encodeJwtPayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function createTestJwt(overrides = {}) {
  return createSignedTestJwt(overrides);
}

function createSignedTestJwt(overrides = {}, { secret = null } = {}) {
  const header = encodeJwtPayload({ alg: secret ? "HS256" : "none", typ: "JWT" });
  const payload = encodeJwtPayload({
    userid: "life2-user-1",
    accountId: "life2-account-1",
    email: "founder@example.com",
    displayName: "Founder Example",
    timezone: "Europe/Paris",
    locale: "en-GB",
    isAdmin: false,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  });
  const unsigned = `${header}.${payload}`;
  const signature = secret
    ? crypto.createHmac("sha256", secret).update(unsigned).digest("base64url")
    : "signature";

  return `${unsigned}.${signature}`;
}

function withAuth(requestBuilder, overrides) {
  return requestBuilder.set("Authorization", `Bearer ${createTestJwt(overrides)}`);
}

test("node API allows explicitly configured production browser origins", async () => {
  const originalOrigins = process.env.CORS_ALLOWED_ORIGINS;
  process.env.CORS_ALLOWED_ORIGINS = "https://helm-os.ai,https://app.helm-os.ai";

  try {
    const allowedOrigins = getAllowedOrigins();

    assert.equal(isAllowedOrigin("https://helm-os.ai", allowedOrigins), true);
    assert.equal(isAllowedOrigin("https://app.helm-os.ai", allowedOrigins), true);
    assert.equal(isAllowedOrigin("https://example.com", allowedOrigins), false);

    const app = createApp({ prisma: {} });
    const response = await request(app)
      .options("/api/health")
      .set("Origin", "https://helm-os.ai");

    assert.equal(response.status, 204);
    assert.equal(response.headers["access-control-allow-origin"], "https://helm-os.ai");
  } finally {
    if (originalOrigins == null) {
      delete process.env.CORS_ALLOWED_ORIGINS;
    } else {
      process.env.CORS_ALLOWED_ORIGINS = originalOrigins;
    }
  }
});

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
      logEntry: {
        createCalls: [],
        async create({ data }) {
          this.createCalls.push(data);
          return {
            id: `log-${this.createCalls.length}`,
            ...data,
          };
        },
      },
    },
    delegate,
    fixture,
    baseRecord,
  };
}

function buildStrategyHubWorkspaceRecord(overrides = {}) {
  const strategyToolsUnlocked = overrides.strategyToolsUnlocked ?? false;
  return {
    id: overrides.id ?? "workspace-idea-1",
    createdByUserId: overrides.createdByUserId ?? "user-idea-1",
    updatedAt: overrides.updatedAt ?? new Date("2026-03-22T09:00:00Z"),
    featureUnlocks: strategyToolsUnlocked
      ? {
          strategyTools: {
            enabled: true,
            unlockedAt: "2026-03-22T10:15:00.000Z",
            source: "ideation_agent",
          },
        }
      : null,
    company: {
      id: "company-idea-1",
      name: overrides.name ?? "Orbit Forge Labs",
      businessType: overrides.businessType ?? "RESEARCH_AND_DEVELOPMENT",
    },
    documents: [
      {
        id: "document-idea-1",
        documentType: "IDEATION",
        completenessPercent: 0,
        qualityState: "In progress",
        agentSummary: "Start by clarifying the problem statement.",
        sections: [
          {
            id: "section-idea-1",
            sectionKey: "problem_statement",
            title: "Problem Statement",
            description: "Describe the pain, inefficiency, or unmet need the business should solve.",
            content: null,
            versionNo: 1,
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
      {
        id: "document-value-1",
        documentType: "VALUE_PROPOSITION",
        completenessPercent: 0,
        qualityState: "In progress",
        agentSummary: "Start with the customer profile before shaping the value map.",
        sections: [
          {
            id: "section-value-1",
            sectionKey: "customer_segments",
            title: "Customer Segments",
            description: "Identify the most specific customer groups this canvas is designed around.",
            content: null,
            versionNo: 1,
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
        documentId: "document-idea-1",
        messages: [
          {
            id: "message-idea-1",
            messageIndex: 1,
            senderType: "AGENT",
            messageText: "Hi there. Please tell me about your business idea.",
            createdAt: new Date("2026-03-22T09:00:00Z"),
          },
        ],
      },
      {
        id: "thread-value-1",
        documentId: "document-value-1",
        messages: [
          {
            id: "message-value-1",
            messageIndex: 1,
            senderType: "AGENT",
            messageText: "Let's build the Value Proposition Canvas by starting with the customer segments you want to serve.",
            createdAt: new Date("2026-03-22T09:00:00Z"),
          },
        ],
      },
    ],
    stageProgress: [
      {
        id: "stage-ideation-1",
        stageKey: "IDEATION",
        displayOrder: 1,
        status: "CURRENT",
        unlockState: "UNLOCKED",
        unlockReason: "Ideation is the active starting stage.",
      },
      {
        id: "stage-value-proposition-1",
        stageKey: "VALUE_PROPOSITION",
        displayOrder: 2,
        status: strategyToolsUnlocked ? "AVAILABLE" : "LOCKED",
        unlockState: strategyToolsUnlocked ? "UNLOCKED" : "LOCKED",
        unlockReason: strategyToolsUnlocked
          ? "Unlocked after the ideation agent marked the idea ready for the next strategy tool."
          : "Unlocks once the ideation draft is mature enough for the next strategy tool.",
      },
      {
        id: "stage-customer-segments-1",
        stageKey: "CUSTOMER_SEGMENTS",
        displayOrder: 3,
        status: strategyToolsUnlocked ? "AVAILABLE" : "LOCKED",
        unlockState: strategyToolsUnlocked ? "UNLOCKED" : "LOCKED",
        unlockReason: strategyToolsUnlocked
          ? "Unlocked after the ideation agent marked the idea ready for the next strategy tool."
          : "Unlocks once the ideation draft is mature enough for the next strategy tool.",
      },
      {
        id: "stage-business-model-1",
        stageKey: "BUSINESS_MODEL",
        displayOrder: 4,
        status: strategyToolsUnlocked ? "AVAILABLE" : "LOCKED",
        unlockState: strategyToolsUnlocked ? "UNLOCKED" : "LOCKED",
        unlockReason: strategyToolsUnlocked
          ? "Unlocked after the ideation agent marked the idea ready for the next strategy tool."
          : "Unlocks once the ideation draft is mature enough for the next strategy tool.",
      },
      {
        id: "stage-market-research-1",
        stageKey: "MARKET_RESEARCH",
        displayOrder: 5,
        status: strategyToolsUnlocked ? "AVAILABLE" : "LOCKED",
        unlockState: strategyToolsUnlocked ? "UNLOCKED" : "LOCKED",
        unlockReason: strategyToolsUnlocked
          ? "Unlocked after the ideation agent marked the idea ready for the next strategy tool."
          : "Unlocks once the ideation draft is mature enough for the next strategy tool.",
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

test("GET /api/auth/sign-in redirects to the auth service with applicationId and redirect", async () => {
  const originalApplicationId = process.env.AUTH_SERVICE_APPLICATION_ID;
  const originalFrontendApplicationId = process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID;
  const originalSignInUrl = process.env.AUTH_SERVICE_SIGN_IN_URL;

  process.env.AUTH_SERVICE_APPLICATION_ID = "public-app-id";
  process.env.AUTH_SERVICE_SIGN_IN_URL = "https://auth.life-sqrd.com/";

  try {
    const app = createApp({ prisma: {} });
    const response = await request(app)
      .get("/api/auth/sign-in")
      .query({ redirect: "http://localhost:4200/#/auth/callback" });

    assert.equal(response.statusCode, 302);
    assert.equal(
      response.headers.location,
      "https://auth.life-sqrd.com/?applicationId=public-app-id&redirect=http%3A%2F%2Flocalhost%3A4200%2F%23%2Fauth%2Fcallback",
    );
  } finally {
    if (originalApplicationId == null) {
      delete process.env.AUTH_SERVICE_APPLICATION_ID;
    } else {
      process.env.AUTH_SERVICE_APPLICATION_ID = originalApplicationId;
    }

    if (originalFrontendApplicationId == null) {
      delete process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID;
    } else {
      process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID = originalFrontendApplicationId;
    }

    if (originalSignInUrl == null) {
      delete process.env.AUTH_SERVICE_SIGN_IN_URL;
    } else {
      process.env.AUTH_SERVICE_SIGN_IN_URL = originalSignInUrl;
    }
  }
});

test("GET /api/auth/sign-in falls back to the dev application id when none is configured", async () => {
  const originalApplicationId = process.env.AUTH_SERVICE_APPLICATION_ID;
  const originalFrontendApplicationId = process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID;
  const originalSignInUrl = process.env.AUTH_SERVICE_SIGN_IN_URL;

  delete process.env.AUTH_SERVICE_APPLICATION_ID;
  delete process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID;
  process.env.AUTH_SERVICE_SIGN_IN_URL = "https://auth.life-sqrd.com/";

  try {
    const app = createApp({ prisma: {} });
    const response = await request(app)
      .get("/api/auth/sign-in")
      .query({ redirect: "http://localhost:4200/#/auth/callback" });

    assert.equal(response.statusCode, 302);
    assert.equal(
      response.headers.location,
      "https://auth.life-sqrd.com/?applicationId=04adc1d7-7475-4b28-67b2-63e24308a786&redirect=http%3A%2F%2Flocalhost%3A4200%2F%23%2Fauth%2Fcallback",
    );
  } finally {
    if (originalApplicationId == null) {
      delete process.env.AUTH_SERVICE_APPLICATION_ID;
    } else {
      process.env.AUTH_SERVICE_APPLICATION_ID = originalApplicationId;
    }

    if (originalFrontendApplicationId == null) {
      delete process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID;
    } else {
      process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID = originalFrontendApplicationId;
    }

    if (originalSignInUrl == null) {
      delete process.env.AUTH_SERVICE_SIGN_IN_URL;
    } else {
      process.env.AUTH_SERVICE_SIGN_IN_URL = originalSignInUrl;
    }
  }
});

test("GET /api/auth/sign-in falls back to the local auth-service host when no sign-in url is configured", async () => {
  const originalApplicationId = process.env.AUTH_SERVICE_APPLICATION_ID;
  const originalFrontendApplicationId = process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID;
  const originalSignInUrl = process.env.AUTH_SERVICE_SIGN_IN_URL;
  const originalFrontendSignInUrl = process.env.FRONTEND_AUTH_SERVICE_SIGN_IN_URL;

  process.env.AUTH_SERVICE_APPLICATION_ID = "public-app-id";
  delete process.env.AUTH_SERVICE_SIGN_IN_URL;
  delete process.env.FRONTEND_AUTH_SERVICE_SIGN_IN_URL;

  try {
    const app = createApp({ prisma: {} });
    const response = await request(app)
      .get("/api/auth/sign-in")
      .query({ redirect: "http://localhost:4200/#/auth/callback" });

    assert.equal(response.statusCode, 302);
    assert.equal(
      response.headers.location,
      "http://auth-service.localhost:46138/?applicationId=public-app-id&redirect=http%3A%2F%2Flocalhost%3A4200%2F%23%2Fauth%2Fcallback",
    );
  } finally {
    if (originalApplicationId == null) {
      delete process.env.AUTH_SERVICE_APPLICATION_ID;
    } else {
      process.env.AUTH_SERVICE_APPLICATION_ID = originalApplicationId;
    }

    if (originalFrontendApplicationId == null) {
      delete process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID;
    } else {
      process.env.FRONTEND_AUTH_SERVICE_APPLICATION_ID = originalFrontendApplicationId;
    }

    if (originalSignInUrl == null) {
      delete process.env.AUTH_SERVICE_SIGN_IN_URL;
    } else {
      process.env.AUTH_SERVICE_SIGN_IN_URL = originalSignInUrl;
    }

    if (originalFrontendSignInUrl == null) {
      delete process.env.FRONTEND_AUTH_SERVICE_SIGN_IN_URL;
    } else {
      process.env.FRONTEND_AUTH_SERVICE_SIGN_IN_URL = originalFrontendSignInUrl;
    }
  }
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
  const response = await withAuth(request(app)
    .post("/api/users")
    .send({
      email: "founder@example.com",
      displayName: "Founder",
      authProvider: "google",
      authProviderUserId: "google-user-123",
    }));

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
  const response = await withAuth(request(app)
    .get("/api/workspaces")
    .query({
      companyId: "a1fe4eb5-f7b3-4532-a485-c0a5efff57ae",
      status: "ACTIVE",
      limit: "2",
    }));

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
  const response = await withAuth(request(app)
    .post("/api/chat-messages")
    .send({
      threadId: "ba88a581-9fe8-4b0e-bb2e-cf491ff7a6cb",
      senderType: "USER",
      messageText: "Can you refine the value proposition?",
    }));

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
  const response = await withAuth(request(app).patch("/api/users/user-1").send({}));

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
  const response = await withAuth(request(app)
    .post("/api/users")
    .send({
      email: "founder@example.com",
      authProvider: "google",
      authProviderUserId: "duplicate-user",
    }));

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
  let capturedArgs;
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findMany: async (args) => {
        capturedArgs = args;
        return [
        {
          id: "f6869722-a2fb-451d-944b-a01f4d866f42",
          updatedAt: new Date("2026-03-22T09:00:00Z"),
          company: {
            name: "Northstar Ventures",
            businessType: "PRODUCT",
          },
        },
        ];
      },
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(request(app).get("/api/business-ideas"));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedArgs, {
    where: {
      createdByUserId: "user-idea-1",
    },
    include: {
      company: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
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
  const app = createApp({
    prisma: {
      user: {
        upsert: async ({ create, update }) => ({
          id: "user-idea-1",
          email: create.email,
          displayName: update.displayName,
          appRole: "USER",
        }),
      },
    },
  });
  const response = await withAuth(request(app)
    .post("/api/business-ideas")
    .send({
      name: "",
      businessType: "INVALID",
    }));

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "Validation failed");
});

test("POST /api/business-ideas creates a strategy hub workspace", async () => {
  const workspaceRecord = buildStrategyHubWorkspaceRecord();
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
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
  const response = await withAuth(request(app).post("/api/business-ideas").send({
    name: "Orbit Forge Labs",
    businessType: "RESEARCH_AND_DEVELOPMENT",
  }));

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.workspaceOption.id, "workspace-idea-1");
  assert.equal(response.body.data.workspace.pageTitle, "Ideation: Orbit Forge Labs");
  assert.equal(response.body.data.chat.messages.length, 1);
});

test("GET /api/business-ideas/:workspaceId returns the strategy hub payload", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () => buildStrategyHubWorkspaceRecord({
        id: "workspace-existing-1",
        name: "Northstar Ventures",
        businessType: "PRODUCT",
      }),
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(request(app).get("/api/business-ideas/workspace-existing-1"));

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.workspaceOption.id, "workspace-existing-1");
  assert.equal(response.body.data.workspace.pageStatus, "Product business idea");
  assert.equal(response.body.data.workspace.sections[0].title, "Problem Statement");
  assert.equal(response.body.data.workspace.sections[0].content, "");
  assert.deepEqual(response.body.data.workspace.availableToolIds, ["ideation"]);
});

test("GET /api/business-ideas/:workspaceId returns unlocked strategy tools from persisted business idea feature flags", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () =>
        buildStrategyHubWorkspaceRecord({
          id: "workspace-existing-1",
          name: "Northstar Ventures",
          businessType: "PRODUCT",
          strategyToolsUnlocked: true,
        }),
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(request(app).get("/api/business-ideas/workspace-existing-1"));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data.workspace.availableToolIds, [
    "ideation",
    "value-proposition",
    "customer-segments",
    "business-model",
    "market-research",
  ]);
  assert.equal(response.body.data.workspace.overview.readinessLabel, "Ready for next tool");
});

test("GET /api/business-ideas/:workspaceId/value-proposition returns the value proposition workspace payload", async () => {
  const workspaceRecord = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "Northstar Ventures",
    businessType: "PRODUCT",
    strategyToolsUnlocked: true,
  });
  workspaceRecord.documents[1].completenessPercent = 60;
  workspaceRecord.documents[1].sections = [
    {
      ...workspaceRecord.documents[1].sections[0],
      content: "Boutique consultancies\nFounder-led service firms",
      refinementState: "DRAFT",
      completionPercent: 60,
    },
  ];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () => workspaceRecord,
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(request(app).get("/api/business-ideas/workspace-existing-1/value-proposition"));

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.workspace.pageTitle, "Value Proposition: Northstar Ventures");
  assert.equal(response.body.data.workspace.sections[0].title, "Customer Segments");
  assert.equal(response.body.data.chat.panelTitle, "Value Proposition Agent");
});

test("POST /api/business-ideas/:workspaceId/value-proposition/messages runs the value proposition workflow", async () => {
  const initialWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "Northstar Ventures",
    businessType: "PRODUCT",
    strategyToolsUnlocked: true,
  });
  const refreshedWorkspace = structuredClone(initialWorkspace);
  refreshedWorkspace.documents[1].completenessPercent = 60;
  refreshedWorkspace.documents[1].qualityState = "Needs refinement";
  refreshedWorkspace.documents[1].agentSummary = "I updated the canvas and the weakest area is pain relievers.";
  refreshedWorkspace.documents[1].sections = [
    {
      ...refreshedWorkspace.documents[1].sections[0],
      content: "- Boutique consultancies\n- Founder-led service firms",
      refinementState: "DRAFT",
      completionPercent: 60,
      agentConfidence: "MEDIUM",
    },
  ];
  refreshedWorkspace.chatThreads[1].messages = [
    ...initialWorkspace.chatThreads[1].messages,
    {
      id: "message-value-2",
      messageIndex: 2,
      senderType: "USER",
      messageText: "Sharpen the customer profile and fit.",
      createdAt: new Date("2026-03-22T10:14:00Z"),
    },
    {
      id: "message-value-3",
      messageIndex: 3,
      senderType: "AGENT",
      messageText: "I updated the canvas and the weakest area is pain relievers.",
      createdAt: new Date("2026-03-22T10:15:00Z"),
    },
  ];

  let workspaceFindCount = 0;
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () => {
        workspaceFindCount += 1;
        return workspaceFindCount === 1 ? initialWorkspace : refreshedWorkspace;
      },
    },
    chatMessage: {
      create: async ({ data }) => ({ id: "message-value-created", ...data }),
      update: async () => ({}),
    },
    agentRun: {
      create: async ({ data }) => ({ id: "run-value-1", ...data }),
      update: async () => ({}),
    },
    strategySection: {
      create: async ({ data }) => ({ id: "section-created", versionNo: 1, metadata: data.metadata ?? {}, ...data }),
      update: async ({ data, where }) => ({ id: where.id, versionNo: data.versionNo, metadata: data.metadata ?? {}, ...data }),
    },
    strategyDocument: {
      update: async () => ({}),
    },
    activityLog: {
      create: async () => ({}),
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    runValuePropositionWorkflow: async () => ({
      id: "gateway-run-value-1",
      status: "completed",
      normalized_output: {
        customer_profile: {
          segments: ["Boutique consultancies", "Founder-led service firms"],
          jobs: { functional: ["Deliver strategy outcomes"], emotional: [], social: [] },
          pains: ["Momentum disappears after workshops"],
          gains: ["A clearer path from strategy to execution"],
        },
        value_map: {
          products_services: ["AI-guided strategic operating workspace"],
          pain_relievers: ["Turns workshop output into coordinated execution"],
          gain_creators: ["Keeps teams aligned on next decisions"],
        },
        analysis: {
          weakest_area: "Pain Relievers",
          issues: ["Relief mechanisms are still broad"],
          inconsistencies: [],
          recommendations: ["Make each reliever directly address a named pain"],
        },
        scoring: {
          customer_clarity: "Medium",
          problem_depth: "Medium",
          value_definition: "Medium",
          pain_gain_relevance: "Medium",
          fit_consistency: "Medium",
          overall: "Emerging",
        },
        next_question: "Which pain is costly enough that the customer would act now?",
      },
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app).post("/api/business-ideas/workspace-existing-1/value-proposition/messages").send({
      messageText: "Sharpen the customer profile and fit.",
    })
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.workspace.pageTitle, "Value Proposition: Northstar Ventures");
  assert.equal(response.body.data.chat.panelTitle, "Value Proposition Agent");
});

test("POST /api/business-ideas/:workspaceId/ideation/messages runs the ideation workflow and returns refreshed workspace data", async () => {
  const initialWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "Northstar Ventures",
    businessType: "PRODUCT",
  });
  const refreshedWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "Northstar Ventures",
    businessType: "PRODUCT",
    strategyToolsUnlocked: true,
  });
  refreshedWorkspace.documents[0].completenessPercent = 82;
  refreshedWorkspace.documents[0].qualityState = "Ready for next tool";
  refreshedWorkspace.documents[0].agentSummary =
    "I tightened the value proposition and product description. The main gap now is making the target customer more specific.";
  refreshedWorkspace.documents[0].sections = [
    {
      ...refreshedWorkspace.documents[0].sections[0],
      content:
        "Independent consultants and small service firms lose momentum after strategy workshops because ideas and decisions are scattered across documents.",
      refinementState: "STRONG",
      completionPercent: 86,
      agentConfidence: "HIGH",
      lastUpdatedAt: new Date("2026-03-22T10:15:00Z"),
    },
    {
      id: "section-idea-2",
      sectionKey: "target_customer",
      title: "Target Customer",
      description: "Clarify the first users or buyers who feel this problem most acutely.",
      content: "Boutique consultancies and founder-led services teams with 5 to 50 people.",
      versionNo: 1,
      metadata: {
        emphasis: "primary",
      },
      refinementState: "NEEDS_REFINEMENT",
      completionPercent: 61,
      agentConfidence: "MEDIUM",
      lastUpdatedByType: "AGENT",
      lastUpdatedAt: new Date("2026-03-22T10:15:00Z"),
    },
  ];
  refreshedWorkspace.chatThreads[0].messages = [
    ...initialWorkspace.chatThreads[0].messages,
    {
      id: "message-idea-2",
      messageIndex: 2,
      senderType: "USER",
      messageText: "Please sharpen the target customer definition.",
      createdAt: new Date("2026-03-22T10:14:00Z"),
    },
    {
      id: "message-idea-3",
      messageIndex: 3,
      senderType: "AGENT",
      messageText:
        "I tightened the value proposition and product description. The main gap now is making the target customer more specific.",
      createdAt: new Date("2026-03-22T10:15:00Z"),
    },
  ];

  let workspaceFindCount = 0;
  const chatMessageCreates = [];
  const strategySectionUpdates = [];
  const strategySectionCreates = [];
  const strategyDocumentUpdates = [];
  const agentRunUpdates = [];
  const workspaceUpdates = [];
  const stageProgressUpdates = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () => {
        workspaceFindCount += 1;
        return workspaceFindCount >= 3 ? refreshedWorkspace : initialWorkspace;
      },
      update: async ({ data }) => {
        workspaceUpdates.push(data);
        return {
          id: "workspace-existing-1",
          ...data,
        };
      },
    },
    chatMessage: {
      create: async ({ data }) => {
        chatMessageCreates.push(data);
        return {
          id: `message-created-${chatMessageCreates.length}`,
          ...data,
        };
      },
    },
    agentRun: {
      create: async ({ data }) => ({
        id: "agent-run-local-1",
        ...data,
      }),
      update: async ({ data }) => {
        agentRunUpdates.push(data);
        return {
          id: "agent-run-local-1",
          ...data,
        };
      },
    },
    strategyDocument: {
      update: async ({ data }) => {
        strategyDocumentUpdates.push(data);
        return {
          id: "document-idea-1",
          ...data,
        };
      },
    },
    stageProgress: {
      updateMany: async ({ where, data }) => {
        stageProgressUpdates.push({ where, data });
        return { count: 4 };
      },
    },
    strategySection: {
      create: async ({ data }) => {
        strategySectionCreates.push(data);
        return {
          id: "section-created-1",
          versionNo: 1,
          ...data,
        };
      },
      update: async ({ where, data }) => {
        strategySectionUpdates.push({ where, data });
        return {
          id: where.id,
          versionNo: data.versionNo,
          ...data,
        };
      },
    },
    sectionVersion: {
      create: async () => ({}),
    },
    agentRunEffect: {
      create: async () => ({}),
    },
    activityLog: {
      create: async () => ({}),
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    runIdeationWorkflow: async () => ({
      id: "gateway-run-1",
      status: "completed",
      normalized_output: {
        reply_to_user: {
          content:
            "I tightened the value proposition and product description. The main gap now is making the target customer more specific.",
        },
        ideation_overview: {
          readiness: {
            label: "Needs refinement",
            reason:
              "The concept is coherent enough to move into the next structured strategy tools.",
            next_best_action: "Start shaping the value proposition in the next workspace.",
          },
        },
        problem_statement: {
          content:
            "Independent consultants and small service firms lose momentum after strategy workshops because ideas and decisions are scattered across documents.",
          priority: "primary",
          status: {
            label: "Strong",
            tone: "success",
            agent_confidence: "high",
            explanation: "The problem is concrete and easy to understand.",
          },
          ui_hints: {
            highlight: false,
            needs_attention: false,
          },
        },
        target_customer: {
          content: "Boutique consultancies and founder-led services teams with 5 to 50 people.",
          priority: "primary",
          status: {
            label: "Needs refinement",
            tone: "warning",
            agent_confidence: "medium",
            explanation: "The segment is plausible but still broad.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: true,
          },
        },
        "Value Proposition": {
          content: "A strategy operating system that unifies planning, execution, and governance.",
          priority: "primary",
          status: {
            label: "Strong",
            tone: "success",
            agent_confidence: "high",
            explanation: "The value proposition is specific and compelling.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: false,
          },
        },
        product_service_description: {
          content: "A shared workspace that structures strategy and coordinates intelligent agents.",
          priority: "secondary",
          status: {
            label: "Strong",
            tone: "success",
            agent_confidence: "high",
            explanation: "The product description is clear.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: false,
          },
        },
        differentiation: {
          content: "HelmOS connects strategic thinking to execution instead of acting like another isolated planning tool.",
          priority: "secondary",
          status: {
            label: "Strong",
            tone: "success",
            agent_confidence: "high",
            explanation: "Differentiation is concrete.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: false,
          },
        },
        early_monitization_idea: {
          content: "Tiered founder subscriptions with premium execution orchestration.",
          priority: "secondary",
          status: {
            label: "Strong",
            tone: "success",
            agent_confidence: "medium",
            explanation: "The initial monetization path is clear enough to proceed.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: false,
          },
        },
      },
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(request(app)
    .post("/api/business-ideas/workspace-existing-1/ideation/messages")
    .send({
      messageText: "Please sharpen the target customer definition.",
    }));

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.workspaceOption.id, "workspace-existing-1");
  assert.equal(response.body.data.workspace.overview.completeness, 82);
  assert.deepEqual(response.body.data.workspace.availableToolIds, [
    "ideation",
    "value-proposition",
    "customer-segments",
    "business-model",
    "market-research",
  ]);
  assert.equal(
    response.body.data.chat.messages.at(-1).content,
    "I tightened the value proposition and product description. The main gap now is making the target customer more specific."
  );
  assert.equal(response.body.data.chat.resendAvailable, false);
  assert.equal(chatMessageCreates.length, 2);
  assert.equal(strategyDocumentUpdates[0].completenessPercent, 82);
  assert.equal(strategyDocumentUpdates[0].qualityState, "Ready for next tool");
  assert.equal(workspaceUpdates.length, 1);
  assert.equal(workspaceUpdates[0].featureUnlocks.strategyTools.enabled, true);
  assert.equal(stageProgressUpdates.length, 1);
  assert.deepEqual(stageProgressUpdates[0], {
    where: {
      workspaceId: "workspace-existing-1",
      stageKey: {
        in: ["VALUE_PROPOSITION", "CUSTOMER_SEGMENTS", "BUSINESS_MODEL", "MARKET_RESEARCH"],
      },
    },
    data: {
      status: "AVAILABLE",
      unlockState: "UNLOCKED",
      unlockReason: "Unlocked after the ideation agent marked the idea ready for the next strategy tool.",
      enteredAt: null,
    },
  });
  assert.equal(strategySectionUpdates.length + strategySectionCreates.length, 6);
  assert.equal(agentRunUpdates.at(-1).runStatus, "COMPLETED");
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "ideation_gateway_summary_received"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "ideation_ui_payload_returned"),
    true
  );
});

test("POST /api/business-ideas/:workspaceId/ideation/messages sends the exact agent runtime payload for the ideation UI flow", async () => {
  const initialWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "HelmOS",
    businessType: "PRODUCT",
  });
  initialWorkspace.documents[0].title = "Ideation: HelmOS";
  initialWorkspace.documents[0].sections = [
    {
      ...initialWorkspace.documents[0].sections[0],
      content:
        "Founders often struggle with translating ideas into actionable plans, managing complex strategy formulation, and executing operational tasks efficiently.",
    },
    {
      id: "section-idea-2",
      sectionKey: "target_customer",
      title: "Target Customer",
      description: "Clarify the first users or buyers who feel this problem most acutely.",
      content: "Early-stage founders, solo entrepreneurs, and startup teams seeking strategic clarity.",
      versionNo: 1,
      metadata: { emphasis: "primary" },
      refinementState: "DRAFT",
      completionPercent: 48,
      agentConfidence: "MEDIUM",
      lastUpdatedByType: "AGENT",
      lastUpdatedAt: new Date("2026-03-22T09:10:00Z"),
    },
    {
      id: "section-idea-3",
      sectionKey: "value_proposition",
      title: "Value Proposition",
      description: "Explain why this concept is useful and what meaningful outcome it creates.",
      content:
        "- Reduce time and friction from concept to launch.\n- Augment founder capabilities with intelligent automation.",
      versionNo: 1,
      metadata: { emphasis: "primary" },
      refinementState: "DRAFT",
      completionPercent: 46,
      agentConfidence: "MEDIUM",
      lastUpdatedByType: "AGENT",
      lastUpdatedAt: new Date("2026-03-22T09:10:00Z"),
    },
  ];
  initialWorkspace.chatThreads[0].messages = [
    ...initialWorkspace.chatThreads[0].messages,
    {
      id: "message-idea-2",
      messageIndex: 2,
      senderType: "USER",
      messageText:
        "HelmOS is an AI-powered founder platform that helps you go from idea to execution.",
      createdAt: new Date("2026-03-22T09:05:00Z"),
    },
    {
      id: "message-idea-3",
      messageIndex: 3,
      senderType: "AGENT",
      messageText: "I drafted an initial idea brief for HelmOS.",
      createdAt: new Date("2026-03-22T09:06:00Z"),
    },
  ];

  const refreshedWorkspace = structuredClone(initialWorkspace);
  refreshedWorkspace.chatThreads[0].messages = [
    ...initialWorkspace.chatThreads[0].messages,
    {
      id: "message-idea-4",
      messageIndex: 4,
      senderType: "USER",
      messageText: "What should I do next?",
      createdAt: new Date("2026-03-22T09:07:00Z"),
    },
    {
      id: "message-idea-5",
      messageIndex: 5,
      senderType: "AGENT",
      messageText: "You should clarify the target customer next.",
      createdAt: new Date("2026-03-22T09:08:00Z"),
    },
  ];

  let workspaceFindCount = 0;
  let capturedGatewayPayload = null;

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () => {
        workspaceFindCount += 1;
        return workspaceFindCount >= 3 ? refreshedWorkspace : initialWorkspace;
      },
    },
    chatMessage: {
      create: async ({ data }) => ({
        id: "message-created-1",
        ...data,
      }),
    },
    agentRun: {
      create: async ({ data }) => ({
        id: "agent-run-local-1",
        ...data,
      }),
      update: async ({ data }) => ({
        id: "agent-run-local-1",
        ...data,
      }),
    },
    strategyDocument: {
      update: async () => ({ id: "document-idea-1" }),
    },
    strategySection: {
      create: async ({ data }) => ({ id: "section-created-1", versionNo: 1, ...data }),
      update: async ({ where, data }) => ({ id: where.id, versionNo: data.versionNo, ...data }),
    },
    sectionVersion: {
      create: async () => ({}),
    },
    agentRunEffect: {
      create: async () => ({}),
    },
    activityLog: {
      create: async () => ({}),
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    runIdeationWorkflow: async (payload) => {
      capturedGatewayPayload = payload;
      return {
        id: "gateway-run-ideation-payload",
        status: "completed",
        normalized_output: {
          reply_to_user: {
            content: "You should clarify the target customer next.",
          },
        ideation_overview: {
          readiness: {
            label: "Needs refinement",
            reason: "The concept is forming but key sections are still broad.",
              next_best_action: "Clarify the target customer.",
            },
          },
        },
      };
    },
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(request(app)
    .post("/api/business-ideas/workspace-existing-1/ideation/messages")
    .send({
      messageText: "What should I do next?",
    }));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedGatewayPayload, {
    inputText: "What should I do next?",
    sessionTitle: "Ideation: HelmOS",
    metadata: {
      workspace_id: "workspace-existing-1",
      document_id: "document-idea-1",
      thread_id: "thread-idea-1",
    },
    context: {
      latest_user_message: "What should I do next?",
      chat_history: [
        {
          sender: "AGENT",
          content: "Hi there. Please tell me about your business idea.",
        },
        {
          sender: "USER",
          content: "HelmOS is an AI-powered founder platform that helps you go from idea to execution.",
        },
        {
          sender: "AGENT",
          content: "I drafted an initial idea brief for HelmOS.",
        },
        {
          sender: "USER",
          content: "What should I do next?",
        },
      ],
      ideation_page_state: {
        workspace_id: "workspace-existing-1",
        workspace_name: "HelmOS",
        business_type: "PRODUCT",
        sections: {
          problem_statement:
            "Founders often struggle with translating ideas into actionable plans, managing complex strategy formulation, and executing operational tasks efficiently.",
          target_customer: "Early-stage founders, solo entrepreneurs, and startup teams seeking strategic clarity.",
          value_proposition:
            "- Reduce time and friction from concept to launch.\n- Augment founder capabilities with intelligent automation.",
        },
      },
      workspace_id: "workspace-existing-1",
      workspace_name: "HelmOS",
      business_type: "PRODUCT",
      sections: {
        problem_statement:
          "Founders often struggle with translating ideas into actionable plans, managing complex strategy formulation, and executing operational tasks efficiently.",
        target_customer: "Early-stage founders, solo entrepreneurs, and startup teams seeking strategic clarity.",
        value_proposition:
          "- Reduce time and friction from concept to launch.\n- Augment founder capabilities with intelligent automation.",
      },
      recent_messages: [
        {
          sender: "AGENT",
          content: "Hi there. Please tell me about your business idea.",
        },
        {
          sender: "USER",
          content: "HelmOS is an AI-powered founder platform that helps you go from idea to execution.",
        },
        {
          sender: "AGENT",
          content: "I drafted an initial idea brief for HelmOS.",
        },
        {
          sender: "USER",
          content: "What should I do next?",
        },
      ],
    },
  });
});

test("POST /api/business-ideas/:workspaceId/ideation/messages clamps an overlong readiness label for persistence", async () => {
  const initialWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "HelmOS",
    businessType: "PRODUCT",
  });
  const refreshedWorkspace = structuredClone(initialWorkspace);
  refreshedWorkspace.documents[0].qualityState = "Problem articulation strong, value proposition...";
  refreshedWorkspace.documents[0].agentSummary = "Structured problem statement ready for review.";
  refreshedWorkspace.chatThreads[0].messages = [
    ...initialWorkspace.chatThreads[0].messages,
    {
      id: "message-idea-2",
      messageIndex: 2,
      senderType: "USER",
      messageText: "Expand the problem statement with concrete pain points.",
      createdAt: new Date("2026-03-22T10:14:00Z"),
    },
    {
      id: "message-idea-3",
      messageIndex: 3,
      senderType: "AGENT",
      messageText: "Structured problem statement ready for review.",
      createdAt: new Date("2026-03-22T10:15:00Z"),
    },
  ];

  let workspaceFindCount = 0;
  const strategyDocumentUpdates = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () => {
        workspaceFindCount += 1;
        return workspaceFindCount >= 3 ? refreshedWorkspace : initialWorkspace;
      },
    },
    chatMessage: {
      create: async ({ data }) => ({ id: `message-created-${data.messageIndex}`, ...data }),
      update: async ({ where, data }) => ({ id: where.id, ...data }),
    },
    agentRun: {
      create: async ({ data }) => ({ id: "agent-run-local-1", ...data }),
      update: async ({ where, data }) => ({ id: where.id, ...data }),
    },
    strategyDocument: {
      update: async ({ data }) => {
        strategyDocumentUpdates.push(data);
        return { id: "document-idea-1", ...data };
      },
    },
    strategySection: {
      update: async ({ where, data }) => ({ id: where.id, versionNo: data.versionNo, ...data }),
      create: async ({ data }) => ({ id: `section-${data.sectionKey}`, versionNo: 1, ...data }),
    },
    sectionVersion: {
      create: async () => ({}),
    },
    agentRunEffect: {
      create: async () => ({}),
    },
    activityLog: {
      create: async () => ({}),
    },
    logEntry: {
      create: async () => ({}),
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    runIdeationWorkflow: async () => ({
      id: "gateway-run-1",
      status: "completed",
      normalized_output: {
        reply_to_user: {
          content: "Structured problem statement ready for review.",
        },
        ideation_overview: {
          readiness: {
            label: "Problem articulation strong, value proposition next",
            reason:
              "The problem articulation is now strong and the next focus should be tightening the value proposition.",
            next_best_action: "Refine the value proposition to connect directly to these pain points.",
          },
        },
        problem_statement: {
          content:
            "Founders face persistent coordination and execution challenges that intensify as the business matures.",
          priority: "primary",
          status: {
            label: "Draft",
            tone: "info",
            agent_confidence: "high",
            explanation: "The draft is strong enough to review and refine.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: true,
          },
        },
        target_customer: {
          content: "Early-stage founders and experienced operators managing multiple ventures.",
          priority: "primary",
          status: {
            label: "Needs refinement",
            tone: "warning",
            agent_confidence: "medium",
            explanation: "Segments are useful but could be sharper.",
          },
          ui_hints: {
            highlight: false,
            needs_attention: true,
          },
        },
        "Value Proposition": {
          content: "HelmOS creates strategic clarity and coordinated execution in one AI-native workspace.",
          helper: "Sharpen the promise against the strongest founder pain points.",
          priority: "primary",
          status: {
            label: "Needs refinement",
            tone: "warning",
            agent_confidence: "medium",
            explanation: "The value is promising but still broad.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: true,
          },
        },
        product_service_description: {
          content: "An AI-powered founder operating system for strategy and execution.",
          priority: "secondary",
          status: {
            label: "Draft",
            tone: "info",
            agent_confidence: "medium",
            explanation: "Basic platform description is present.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: true,
          },
        },
        differentiation: {
          content: "HelmOS unifies founder thinking, execution, and governance rather than acting like a standalone tool.",
          priority: "secondary",
          status: {
            label: "Draft",
            tone: "info",
            agent_confidence: "medium",
            explanation: "Differentiation is directionally clear.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: true,
          },
        },
        early_monitization_idea: {
          content: "Founder SaaS tiers with premium orchestration and governance features.",
          priority: "secondary",
          status: {
            label: "Draft",
            tone: "info",
            agent_confidence: "medium",
            explanation: "Monetization direction is plausible.",
          },
          ui_hints: {
            highlight: true,
            needs_attention: true,
          },
        },
      },
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(request(app)
    .post("/api/business-ideas/workspace-existing-1/ideation/messages")
    .send({
      messageText: "Expand the problem statement with concrete pain points.",
    }));

  assert.equal(response.statusCode, 200);
  assert.equal(strategyDocumentUpdates[0].completenessPercent, 50);
  assert.equal(strategyDocumentUpdates[0].qualityState, "Needs refinement");
});

test("POST /api/business-ideas/:workspaceId/ideation/messages/retry-last resends the latest failed user message without duplicating it", async () => {
  const failedWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "Northstar Ventures",
    businessType: "PRODUCT",
  });
  failedWorkspace.chatThreads[0].messages = [
    ...failedWorkspace.chatThreads[0].messages,
    {
      id: "message-idea-2",
      messageIndex: 2,
      senderType: "USER",
      messageText: "Please sharpen the target customer definition.",
      status: "FAILED",
      createdAt: new Date("2026-03-22T10:14:00Z"),
    },
  ];

  const refreshedWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "Northstar Ventures",
    businessType: "PRODUCT",
  });
  refreshedWorkspace.chatThreads[0].messages = [
    ...failedWorkspace.chatThreads[0].messages.map((message) =>
      message.id === "message-idea-2" ? { ...message, status: "SENT" } : message
    ),
    {
      id: "message-idea-3",
      messageIndex: 3,
      senderType: "AGENT",
      messageText: "I have refined the founder brief and updated the workspace draft.",
      status: "SENT",
      createdAt: new Date("2026-03-22T10:15:00Z"),
    },
  ];

  let workspaceFindCount = 0;
  const chatMessageCreates = [];
  const chatMessageUpdates = [];
  const agentRunCreates = [];
  const agentRunUpdates = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () => {
        workspaceFindCount += 1;
        return workspaceFindCount >= 3 ? refreshedWorkspace : failedWorkspace;
      },
    },
    chatMessage: {
      create: async ({ data }) => {
        chatMessageCreates.push(data);
        return {
          id: `message-created-${chatMessageCreates.length}`,
          ...data,
        };
      },
      update: async ({ where, data }) => {
        chatMessageUpdates.push({ where, data });
        return {
          id: where.id,
          ...data,
        };
      },
    },
    agentRun: {
      create: async ({ data }) => {
        agentRunCreates.push(data);
        return {
          id: "agent-run-local-1",
          ...data,
        };
      },
      update: async ({ data }) => {
        agentRunUpdates.push(data);
        return {
          id: "agent-run-local-1",
          ...data,
        };
      },
    },
    strategyDocument: {
      update: async () => ({ id: "document-idea-1" }),
    },
    strategySection: {
      create: async ({ data }) => ({ id: "section-created-1", versionNo: 1, ...data }),
      update: async ({ where, data }) => ({ id: where.id, versionNo: data.versionNo, ...data }),
    },
    sectionVersion: {
      create: async () => ({}),
    },
    agentRunEffect: {
      create: async () => ({}),
    },
    activityLog: {
      create: async () => ({}),
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    runIdeationWorkflow: async ({ inputText }) => ({
      id: "gateway-run-2",
      status: "completed",
      normalized_output: {
        reply_to_user: {
          content: `Agent reply for: ${inputText}`,
        },
        ideation_overview: {
          completeness_percent: 30,
          readiness: {
            label: "In progress",
            reason: "Still early.",
            next_best_action: "Clarify the customer.",
          },
        },
      },
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app).post("/api/business-ideas/workspace-existing-1/ideation/messages/retry-last"),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.chat.resendAvailable, false);
  assert.equal(chatMessageCreates.length, 1);
  assert.equal(chatMessageCreates[0].senderType, "AGENT");
  assert.equal(agentRunCreates.length, 1);
  assert.equal(agentRunCreates[0].triggerMessageId, "message-idea-2");
  assert.deepEqual(chatMessageUpdates.map((entry) => entry.data.status), ["PENDING", "SENT"]);
  assert.equal(agentRunUpdates.at(-1).runStatus, "COMPLETED");
});

test("POST /api/business-ideas/:workspaceId/ideation/messages derives an agent reply from a generic artifact when reply_to_user is missing", async () => {
  const initialWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "HelmOS",
    businessType: "PRODUCT",
  });
  const refreshedWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "HelmOS",
    businessType: "PRODUCT",
  });
  refreshedWorkspace.chatThreads[0].messages = [
    ...initialWorkspace.chatThreads[0].messages,
    {
      id: "message-idea-2",
      messageIndex: 2,
      senderType: "USER",
      messageText: "HelmOS is an AI-powered founder platform.",
      status: "SENT",
      createdAt: new Date("2026-03-22T10:14:00Z"),
    },
    {
      id: "message-idea-3",
      messageIndex: 3,
      senderType: "AGENT",
      messageText: "I drafted an initial idea brief for HelmOS. Structured synthesis of a founder's concept and early positioning.",
      status: "SENT",
      createdAt: new Date("2026-03-22T10:15:00Z"),
    },
  ];

  let workspaceFindCount = 0;
  const chatMessageCreates = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () => {
        workspaceFindCount += 1;
        return workspaceFindCount >= 3 ? refreshedWorkspace : initialWorkspace;
      },
    },
    chatMessage: {
      create: async ({ data }) => {
        chatMessageCreates.push(data);
        return {
          id: `message-created-${chatMessageCreates.length}`,
          ...data,
        };
      },
      update: async ({ where, data }) => ({ id: where.id, ...data }),
    },
    agentRun: {
      create: async ({ data }) => ({ id: "agent-run-local-2", ...data }),
      update: async ({ data }) => ({ id: "agent-run-local-2", ...data }),
    },
    strategyDocument: {
      update: async ({ data }) => ({ id: "document-idea-1", ...data }),
    },
    strategySection: {
      create: async ({ data }) => ({ id: "section-created-1", versionNo: 1, ...data }),
      update: async ({ where, data }) => ({ id: where.id, versionNo: data.versionNo, ...data }),
    },
    sectionVersion: {
      create: async () => ({}),
    },
    agentRunEffect: {
      create: async () => ({}),
    },
    activityLog: {
      create: async () => ({}),
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    runIdeationWorkflow: async () => ({
      id: "gateway-run-3",
      status: "completed",
      normalized_output: {
        version: "1.0.0",
        artifact: {
          kind: "idea_brief",
          title: "Idea Brief",
          summary: "Structured synthesis of a founder's concept and early positioning.",
          sections: [
            {
              heading: "Opportunity",
              content: "HelmOS is an AI-powered founder platform.",
            },
            {
              heading: "Brief",
              content: "A structured founder-facing idea brief.",
            },
          ],
        },
      },
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(request(app)
    .post("/api/business-ideas/workspace-existing-1/ideation/messages")
    .send({
      messageText: "HelmOS is an AI-powered founder platform.",
    }));

  assert.equal(response.statusCode, 200);
  assert.equal(
    response.body.data.chat.messages.at(-1).content,
    "I drafted an initial idea brief for HelmOS. Structured synthesis of a founder's concept and early positioning."
  );
  assert.equal(chatMessageCreates.at(-1).messageText, response.body.data.chat.messages.at(-1).content);
});

test("POST /api/business-ideas/:workspaceId/ideation/messages does not derive ideation sections from a generic idea brief artifact", async () => {
  const initialWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "HelmOS",
    businessType: "PRODUCT",
  });
  const refreshedWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "HelmOS",
    businessType: "PRODUCT",
  });

  let workspaceFindCount = 0;
  const strategySectionUpdates = [];
  const strategySectionCreates = [];
  const strategyDocumentUpdates = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () => {
        workspaceFindCount += 1;
        return workspaceFindCount >= 3 ? refreshedWorkspace : initialWorkspace;
      },
    },
    chatMessage: {
      create: async ({ data }) => ({ id: `message-created-${data.messageIndex}`, ...data }),
      update: async ({ where, data }) => ({ id: where.id, ...data }),
    },
    agentRun: {
      create: async ({ data }) => ({ id: "agent-run-local-3", ...data }),
      update: async ({ data }) => ({ id: "agent-run-local-3", ...data }),
    },
    strategyDocument: {
      update: async ({ data }) => {
        strategyDocumentUpdates.push(data);
        return { id: "document-idea-1", ...data };
      },
    },
    strategySection: {
      create: async ({ data }) => {
        strategySectionCreates.push(data);
        return { id: `section-created-${strategySectionCreates.length}`, versionNo: 1, ...data };
      },
      update: async ({ where, data }) => {
        strategySectionUpdates.push({ where, data });
        return { id: where.id, versionNo: data.versionNo, ...data };
      },
    },
    sectionVersion: {
      create: async () => ({}),
    },
    agentRunEffect: {
      create: async () => ({}),
    },
    activityLog: {
      create: async () => ({}),
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    runIdeationWorkflow: async () => ({
      id: "gateway-run-4",
      status: "completed",
      normalized_output: {
        version: "1.0.0",
        artifact: {
          kind: "idea_brief",
          title: "Idea Brief",
          summary: "Structured synthesis of a founder's concept and early positioning.",
          sections: [
            {
              heading: "Opportunity",
              content: "HelmOS is an AI-powered founder platform.",
            },
            {
              heading: "Brief",
              content:
                "**Problem:** Founders struggle to turn early ideas into coordinated execution.\n\n**Solution:** HelmOS leverages AI to democratize access to high-level business design and operational capabilities.\n\n**Value Proposition:** Accelerate startup formation and growth by combining strategic guidance, company design, and autonomous execution in one integrated platform.\n\n**Target Users:** Early-stage founders, solo entrepreneurs, and small startup teams.",
            },
          ],
        },
      },
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(request(app)
    .post("/api/business-ideas/workspace-existing-1/ideation/messages")
    .send({
      messageText: "HelmOS is an AI-powered founder platform.",
    }));

  assert.equal(response.statusCode, 200);
  assert.equal(strategySectionUpdates.length, 0);
  assert.equal(strategySectionCreates.length, 0);
  assert.equal(strategyDocumentUpdates[0].completenessPercent, 0);
  assert.equal(response.body.data.workspace.overview.completeness, 0);
  assert.equal(response.body.data.workspace.sections[0].content, "");
});

test("POST /api/business-ideas/:workspaceId/ideation/messages rejects a pending gateway summary", async () => {
  const initialWorkspace = buildStrategyHubWorkspaceRecord({
    id: "workspace-existing-1",
    name: "HelmOS",
    businessType: "PRODUCT",
  });

  let workspaceFindCount = 0;
  const agentRunUpdates = [];
  const chatMessageUpdates = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-idea-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    workspace: {
      findUniqueOrThrow: async () => {
        workspaceFindCount += 1;
        return initialWorkspace;
      },
    },
    chatMessage: {
      create: async ({ data }) => ({ id: `message-created-${data.messageIndex}`, ...data }),
      update: async ({ where, data }) => {
        chatMessageUpdates.push({ where, data });
        return { id: where.id, ...data };
      },
    },
    agentRun: {
      create: async ({ data }) => ({ id: "agent-run-local-pending", ...data }),
      update: async ({ where, data }) => {
        agentRunUpdates.push({ where, data });
        return { id: where.id, ...data };
      },
    },
    activityLog: {
      create: async () => ({}),
    },
    logEntry: {
      create: async () => ({}),
    },
    $transaction: async (callback) => callback(prisma),
  };

  const agentGatewayClient = {
    runIdeationWorkflow: async () => ({
      id: "gateway-run-pending",
      status: "pending",
      normalized_output: {},
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(request(app)
    .post("/api/business-ideas/workspace-existing-1/ideation/messages")
    .send({
      messageText: "Please refine the idea.",
    }));

  assert.equal(response.statusCode, 504);
  assert.match(response.body.error, /did not complete in time/i);
  assert.equal(agentRunUpdates.at(-1).data.runStatus, "FAILED");
  assert.equal(chatMessageUpdates.at(-1).data.status, "FAILED");
});

for (const config of resourceConfigs) {
  test(`GET /api/${config.path} returns a list`, async () => {
    const { prisma, delegate, baseRecord } = buildCrudPrismaForConfig(config);
    const app = createApp({ prisma });
    const response = await withAuth(request(app).get(`/api/${config.path}`));

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, [baseRecord]);
    assert.deepEqual(delegate.findManyCalls[0], {
      where: {},
      orderBy: config.orderBy,
      take: 50,
    });
    assert.equal(prisma.logEntry.createCalls.length, 1);
  });

  test(`POST /api/${config.path} creates a record`, async () => {
    const { prisma, delegate, fixture } = buildCrudPrismaForConfig(config);
    const app = createApp({ prisma });
    const response = await withAuth(request(app).post(`/api/${config.path}`).send(fixture.create));

    assert.equal(response.statusCode, 201);
    assert.deepEqual(delegate.createCalls[0], fixture.create);
    assert.equal(response.body.data.id, `${config.path}-record-id`);
    assert.equal(prisma.logEntry.createCalls.length, 1);
  });

  test(`GET /api/${config.path}/:id returns a record`, async () => {
    const { prisma, delegate } = buildCrudPrismaForConfig(config);
    const app = createApp({ prisma });
    const response = await withAuth(request(app).get(`/api/${config.path}/test-record-id`));

    assert.equal(response.statusCode, 200);
    assert.deepEqual(delegate.findUniqueCalls[0], {
      where: {
        id: "test-record-id",
      },
    });
    assert.equal(response.body.data.id, "test-record-id");
    assert.equal(prisma.logEntry.createCalls.length, 1);
  });

  test(`PATCH /api/${config.path}/:id updates a record`, async () => {
    const { prisma, delegate, fixture } = buildCrudPrismaForConfig(config);
    const app = createApp({ prisma });
    const response = await withAuth(
      request(app).patch(`/api/${config.path}/test-record-id`).send(fixture.update),
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(delegate.updateCalls[0], {
      where: {
        id: "test-record-id",
      },
      data: fixture.update,
    });
    assert.equal(response.body.data.id, "test-record-id");
    assert.equal(prisma.logEntry.createCalls.length, 1);
  });

  test(`DELETE /api/${config.path}/:id deletes a record`, async () => {
    const { prisma, delegate } = buildCrudPrismaForConfig(config);
    const app = createApp({ prisma });
    const response = await withAuth(request(app).delete(`/api/${config.path}/test-record-id`));

    assert.equal(response.statusCode, 204);
    assert.deepEqual(delegate.deleteCalls[0], {
      where: {
        id: "test-record-id",
      },
    });
    assert.equal(prisma.logEntry.createCalls.length, 1);
  });
}

test("GET /api/admin/logs returns filtered backend log entries", async () => {
  const logEntries = [
    {
      id: "log-1",
      level: "info",
      scope: "snapshot-service",
      event: "dashboard_snapshot_persisted",
      message: "Dashboard snapshot stored.",
      context: {
        workspaceId: "workspace-1",
      },
      createdAt: "2026-03-23T20:58:20.000Z",
    },
    {
      id: "log-2",
      level: "warn",
      scope: "snapshot-service",
      event: "widget_snapshot_failed",
      message: "Weather widget is missing a configured city.",
      context: {
        widgetId: "weather-1",
      },
      createdAt: "2026-03-23T20:57:20.000Z",
    },
  ];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: "request-log-1", ...data };
      },
      async findMany() {
        return logEntries;
      },
      async count({ where }) {
        return logEntries.filter((entry) => entry.level === where.level).length;
      },
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(
    request(app).get("/api/admin/logs?q=widget&timeRange=30m&levels=warn,error"),
    { email: "ralfepoisson@gmail.com" },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.summary.matchingLogs, 1);
  assert.equal(response.body.data.summary.filtered.warn, 1);
  assert.equal(response.body.data.summary.stored.info, 1);
  assert.equal(response.body.data.logs[0].event, "widget_snapshot_failed");
  assert.equal(prisma.logEntry.createCalls.length, 1);
});

test("agent gateway client persists outbound agentic-layer API logs", async () => {
  const fetchCalls = [];
  const prisma = {
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: data.id, ...data };
      },
    },
  };
  const client = createAgentGatewayClient({
    baseUrl: "http://127.0.0.1:8000/api/v1",
    prisma,
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        async json() {
          return { id: "run-1", status: "queued" };
        },
      };
    },
  });

  const result = await client.startRun({
    input_text: "Refine this business idea",
    request_type: "ideation_chat",
  });

  assert.equal(result.id, "run-1");
  assert.equal(fetchCalls.length, 1);
  assert.equal(prisma.logEntry.createCalls.length, 2);
  assert.equal(prisma.logEntry.createCalls[0].scope, "agentic-layer");
  assert.equal(prisma.logEntry.createCalls[0].event, "agent_gateway_request_started");
  assert.equal(prisma.logEntry.createCalls[1].event, "agent_gateway_request_succeeded");
});

test("request logging middleware records error responses too", async () => {
  const prisma = {
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: "request-log-1", ...data };
      },
    },
  };

  const app = createApp({ prisma });
  const response = await request(app).get("/api/does-not-exist");

  assert.equal(response.statusCode, 404);
  assert.equal(prisma.logEntry.createCalls.length, 1);
  assert.equal(prisma.logEntry.createCalls[0].level, "warn");
  assert.match(prisma.logEntry.createCalls[0].message, /GET \/api\/does-not-exist responded with 404/);
});

test("GET /api/admin/agents returns persisted agents with gateway runtime metadata", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
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
          key: "ideation-agent.default",
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
  const response = await withAuth(request(app).get("/api/admin/agents"), {
    email: "ralfepoisson@gmail.com",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.gateway.status, "online");
  assert.equal(response.body.data.agents.length, 1);
  assert.deepEqual(response.body.data.agents[0].allowedTools, ["retrieval"]);
  assert.equal(response.body.data.agents[0].runtime.registered, true);
  assert.equal(response.body.data.agents[0].promptConfig.version, "1.0.0");
});

test("GET /api/admin/agents/:id returns one persisted agent without mutating state", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    agentDefinition: {
      findUnique: async ({ where }) =>
        where.id === "agent-1"
          ? {
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
            }
          : null,
      update: async () => {
        throw new Error("GET /api/admin/agents/:id must not update agent state");
      },
      create: async () => {
        throw new Error("GET /api/admin/agents/:id must not create agent state");
      },
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
      updateMany: async () => {
        throw new Error("GET /api/admin/agents/:id must not update prompt state");
      },
      create: async () => {
        throw new Error("GET /api/admin/agents/:id must not create prompt state");
      },
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
  const response = await withAuth(request(app).get("/api/admin/agents/agent-1"), {
    email: "ralfepoisson@gmail.com",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.id, "agent-1");
  assert.equal(response.body.data.promptConfig.key, "ideation.default");
  assert.equal(response.body.data.runtime.registered, true);
});

test("GET /api/admin/agents/:id returns 404 when the persisted agent is missing", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    agentDefinition: {
      findUnique: async () => null,
    },
    promptConfig: {
      findMany: async () => [],
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
      agents: [],
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(request(app).get("/api/admin/agents/missing-agent"), {
    email: "ralfepoisson@gmail.com",
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error, "Agent not found");
});

test("POST /api/admin/agents creates an agent definition with its first prompt config", async () => {
  const agentDefinitions = [];
  const promptConfigs = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    agentDefinition: {
      findMany: async () => agentDefinitions,
      findUnique: async () => null,
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
  const response = await withAuth(request(app)
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
    }), { email: "ralfepoisson@gmail.com" });

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
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
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
  const response = await withAuth(request(app)
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
    }), { email: "ralfepoisson@gmail.com" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.version, "1.1.0");
  assert.deepEqual(response.body.data.allowedTools, ["retrieval", "web_search"]);
  assert.equal(response.body.data.promptConfig.version, "1.1.0");
  assert.equal(response.body.data.promptConfig.promptTemplate, "Refine the founder brief from: {prompt}");
  assert.equal(promptConfigs.filter((entry) => entry.active).length, 1);
  assert.equal(promptConfigs.find((entry) => entry.id === "prompt-1").active, false);
});

test("business idea routes reject requests without a valid bearer token", async () => {
  const app = createApp({ prisma: {} });
  const response = await request(app).get("/api/business-ideas");

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, "Authentication is required");
});

test("admin routes reject authenticated non-admin users", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(request(app).get("/api/admin/agents"), {
    email: "member@example.com",
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "Admin access is required");
});

test("protected routes accept a valid HS256-signed Life2 JWT when LIFE2_JWT_SECRET is configured", async () => {
  const originalSecret = process.env.LIFE2_JWT_SECRET;
  process.env.LIFE2_JWT_SECRET = "test-secret";

  try {
    const prisma = {
      user: {
        upsert: async ({ create, update }) => ({
          id: "user-1",
          email: create.email,
          displayName: update.displayName,
          appRole: "USER",
          life2AccountId: "life2-account-1",
        }),
      },
      workspace: {
        findMany: async () => [],
      },
    };

    const app = createApp({ prisma });
    const response = await request(app)
      .get("/api/business-ideas")
      .set(
        "Authorization",
        `Bearer ${createSignedTestJwt({}, { secret: "test-secret" })}`,
      );

    assert.equal(response.statusCode, 200);
  } finally {
    if (originalSecret == null) {
      delete process.env.LIFE2_JWT_SECRET;
    } else {
      process.env.LIFE2_JWT_SECRET = originalSecret;
    }
  }
});

test("protected routes reject a JWT with an invalid HS256 signature when LIFE2_JWT_SECRET is configured", async () => {
  const originalSecret = process.env.LIFE2_JWT_SECRET;
  process.env.LIFE2_JWT_SECRET = "expected-secret";

  try {
    const prisma = {
      workspace: {
        findMany: async () => [],
      },
    };

    const app = createApp({ prisma });
    const response = await request(app)
      .get("/api/business-ideas")
      .set(
        "Authorization",
        `Bearer ${createSignedTestJwt({}, { secret: "wrong-secret" })}`,
      );

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.error, "Authentication is required");
  } finally {
    if (originalSecret == null) {
      delete process.env.LIFE2_JWT_SECRET;
    } else {
      process.env.LIFE2_JWT_SECRET = originalSecret;
    }
  }
});

test("the first admin-capable user in a tenant is bootstrapped as an admin", async () => {
  let capturedCreate = null;
  const prisma = {
    user: {
      count: async ({ where }) => {
        assert.deepEqual(where, {
          life2AccountId: "tenant-1",
          appRole: "ADMIN",
        });
        return 0;
      },
      upsert: async ({ create }) => {
        capturedCreate = create;
        return {
          id: "admin-user-1",
          ...create,
        };
      },
    },
    agentDefinition: {
      findMany: async () => [],
    },
    promptConfig: {
      findMany: async () => [],
    },
  };

  const agentGatewayClient = {
    getAdminSnapshot: async () => ({
      configured: true,
      status: "online",
      message: "ok",
      baseUrl: "http://localhost:8000/api/v1",
      service: "gateway",
      checkedAt: "2026-03-25T15:00:00.000Z",
      agents: [],
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await request(app)
    .get("/api/admin/agents")
    .set(
      "Authorization",
      `Bearer ${createTestJwt({
        email: "first-admin@example.com",
        accountId: "tenant-1",
        isAdmin: true,
      })}`,
    );

  assert.equal(response.statusCode, 200);
  assert.equal(capturedCreate.appRole, "ADMIN");
  assert.equal(capturedCreate.life2AccountId, "tenant-1");
});
