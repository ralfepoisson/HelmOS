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
    userid: "api-test-user-1",
    accountId: "api-test-account-1",
    email: "api-test-user@helmos.test",
    displayName: "API Test User",
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

test("GET /api/idea-foundry/prospecting/configuration returns the persisted prospecting configuration", async () => {
  const persistedSnapshot = {
    agentState: "active",
    strategyMode: "Focused search",
    lastRun: "2026-04-05T10:15:00.000Z",
    nextRun: "2026-04-05T14:15:00.000Z",
    objective: {
      name: "Recurring compliance pain",
      description: "Find repeated operator pain in compliance-heavy workflows.",
      targetDomain: "European SMB services",
      searchPosture: "Targeted exploration",
      includeKeywords: "compliance, reconciliation, invoicing",
      excludeThemes: "generic AI commentary",
      operatorNote: "Keep the search practical and workflow-led.",
    },
    strategySummary: "The strategy is currently focused on recurring administrative pain.",
    steeringHypothesis: "Repeated compliance pain is easiest to monetise first.",
    strategyPatterns: [],
    themes: [],
    sources: [],
    queryFamilies: [],
    signalRules: [],
    cadence: {
      runMode: "Scheduled",
      cadence: "Every 4 hours",
      maxResultsPerRun: 40,
      reviewThreshold: "Repeated evidence only",
      geographicScope: "United Kingdom, Ireland",
      languageScope: "English",
      budgetGuardrail: "Prefer lower-cost sources first.",
    },
    recentMetrics: [],
    recentChanges: [],
  };
  const storedResultRecords = [
    {
      id: "result-1",
      sourceTitle: "VAT reminders are killing your accounting firm",
      sourceUrl: "https://example.com/vat-reminders",
      snippet: "Operators describe recurring invoicing and VAT reminder pain.",
      queryFamilyTitle: "Complaint language around invoicing / VAT / reminders",
      themeLink: "fragmented compliance workflows",
      capturedAt: "2026-04-05T20:00:00.000Z",
    },
    {
      id: "result-2",
      sourceTitle: "Manual rota coordination is chaos",
      sourceUrl: "https://example.com/rota-chaos",
      snippet: "Practice managers compare manual scheduling breakdowns.",
      queryFamilyTitle: "Urgent rota / scheduling breakdowns",
      themeLink: "last-minute scheduling pressure",
      capturedAt: "2026-04-05T20:05:00.000Z",
    },
  ];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-prospecting-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    prospectingConfiguration: {
      findUnique: async () => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        agentState: "active",
        latestRunStatus: "COMPLETED",
        lastRunAt: new Date("2026-04-05T10:15:00Z"),
        nextRunAt: new Date("2026-04-05T14:15:00Z"),
        uiSnapshotJson: persistedSnapshot,
        latestReviewJson: {
          reply_to_user: {
            content: "The current strategy is usable and slightly biased toward recurring compliance pain.",
          },
        },
        lastResultRecords: storedResultRecords,
      }),
    },
  };

  const app = createApp({ prisma, agentGatewayClient: {} });
  const response = await withAuth(request(app).get("/api/idea-foundry/prospecting/configuration"));

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.snapshot.objective.name, "Recurring compliance pain");
  assert.equal(response.body.data.runtime.latestRunStatus, "COMPLETED");
  assert.equal(response.body.data.runtime.resultRecordCount, 2);
  assert.equal(Object.hasOwn(response.body.data, "resultRecords"), false);
  assert.equal(
    response.body.data.latestReview.reply_to_user.content,
    "The current strategy is usable and slightly biased toward recurring compliance pain."
  );
});

test("GET /api/idea-foundry/prospecting/contents returns the persisted pipeline contents separately from configuration", async () => {
  const storedResultRecords = [
    {
      id: "result-1",
      sourceTitle: "VAT reminders are killing your accounting firm",
      sourceUrl: "https://example.com/vat-reminders",
      snippet: "Operators describe recurring invoicing and VAT reminder pain.",
      queryFamilyTitle: "Complaint language around invoicing / VAT / reminders",
      themeLink: "fragmented compliance workflows",
      capturedAt: "2026-04-05T20:00:00.000Z",
    },
    {
      id: "result-2",
      sourceTitle: "Manual rota coordination is chaos",
      sourceUrl: "https://example.com/rota-chaos",
      snippet: "Practice managers compare manual scheduling breakdowns.",
      queryFamilyTitle: "Urgent rota / scheduling breakdowns",
      themeLink: "last-minute scheduling pressure",
      capturedAt: "2026-04-05T20:05:00.000Z",
    },
  ];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-prospecting-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    prospectingConfiguration: {
      findUnique: async () => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        agentState: "active",
        latestRunStatus: "COMPLETED",
        lastRunAt: new Date("2026-04-05T10:15:00Z"),
        nextRunAt: new Date("2026-04-05T14:15:00Z"),
        uiSnapshotJson: {
          strategyMode: "Focused search",
        },
        latestReviewJson: {
          reply_to_user: {
            content: "The current strategy is usable and slightly biased toward recurring compliance pain.",
          },
        },
        lastResultRecords: storedResultRecords,
      }),
    },
  };

  const app = createApp({ prisma, agentGatewayClient: {} });
  const response = await withAuth(request(app).get("/api/idea-foundry/prospecting/contents"));

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.runtime.latestRunStatus, "COMPLETED");
  assert.equal(response.body.data.runtime.resultRecordCount, 2);
  assert.deepEqual(response.body.data.sources, storedResultRecords);
  assert.deepEqual(response.body.data.protoIdeas, []);
  assert.deepEqual(response.body.data.ideaCandidates, []);
  assert.deepEqual(response.body.data.curatedOpportunities, []);
});

test("GET /api/idea-foundry/proto-idea/configuration returns the persisted proto-idea extraction policy", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    protoIdeaExtractionPolicy: {
      upsert: async () => ({
        id: "policy-1",
        profileName: "default",
        extractionBreadth: "standard",
        inferenceTolerance: "balanced",
        noveltyBias: "balanced",
        minimumSignalThreshold: "medium",
        maxProtoIdeasPerSource: 4,
        latestRunStatus: "COMPLETED",
        lastRunAt: new Date("2026-04-06T10:15:00Z"),
        latestRunSummaryJson: {
          completedCount: 1,
          failedCount: 0,
        },
      }),
    },
  };

  const app = createApp({ prisma, agentGatewayClient: {} });
  const response = await withAuth(
    request(app).get("/api/idea-foundry/proto-idea/configuration"),
    { isAdmin: true, email: "ralfepoisson@gmail.com" }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.policy.extractionBreadth, "standard");
  assert.equal(response.body.data.runtime.latestRunStatus, "COMPLETED");
  assert.equal(response.body.data.runtime.latestRunSummary.completedCount, 1);
});

test("POST /api/idea-foundry/proto-idea/configuration saves the proto-idea extraction policy", async () => {
  let storedPolicy = null;
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    protoIdeaExtractionPolicy: {
      async upsert({ create, update }) {
        storedPolicy = {
          id: "policy-1",
          ...(storedPolicy ?? {}),
          ...(storedPolicy ? update : create),
        };
        return storedPolicy;
      },
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
  };

  const app = createApp({ prisma, agentGatewayClient: {} });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/proto-idea/configuration")
      .send({
        profileName: "default",
        extractionBreadth: "expansive",
        inferenceTolerance: "exploratory",
        noveltyBias: "pragmatic",
        minimumSignalThreshold: "low",
        maxProtoIdeasPerSource: 6,
      }),
    { isAdmin: true, email: "ralfepoisson@gmail.com" }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.policy.extractionBreadth, "expansive");
  assert.equal(response.body.data.policy.maxProtoIdeasPerSource, 6);
  assert.equal(storedPolicy.extractionBreadth, "expansive");
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "proto_idea_policy_saved"),
    true
  );
});

test("POST /api/idea-foundry/proto-idea/run executes the proto-idea agent using the saved policy", async () => {
  let storedPolicy = {
    id: "policy-1",
    profileName: "default",
    extractionBreadth: "expansive",
    inferenceTolerance: "balanced",
    noveltyBias: "exploratory",
    minimumSignalThreshold: "medium",
    maxProtoIdeasPerSource: 3,
    latestRunStatus: null,
    lastRunAt: null,
    latestRunSummaryJson: null,
  };
  const sourceRows = new Map();
  const createdIdeas = [];
  let capturedGatewayPayload = null;

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    prospectingConfiguration: {
      findMany: async () => [
        {
          id: "prospecting-config-1",
          ownerUserId: "owner-user-1",
          lastRunAt: new Date("2026-04-05T10:15:00Z"),
          lastResultRecords: [
            {
              id: "source-1",
              sourceTitle: "Dispatch pain",
              sourceUrl: "https://example.com/source-1",
              snippet: "Schedulers keep switching tools.",
              provider: "web_search",
              capturedAt: "2026-04-05T08:00:00.000Z",
            },
          ],
          ownerUser: {
            id: "owner-user-1",
            email: "owner@example.com",
            displayName: "Owner",
            appRole: "USER",
          },
        },
      ],
    },
    protoIdeaExtractionPolicy: {
      async upsert() {
        return storedPolicy;
      },
      async update({ data }) {
        storedPolicy = {
          ...storedPolicy,
          ...data,
        };
        return storedPolicy;
      },
    },
    protoIdeaSource: {
      async findUnique({ where }) {
        return sourceRows.get(`${where.ownerUserId_sourceKey.ownerUserId}:${where.ownerUserId_sourceKey.sourceKey}`) ?? null;
      },
      async create({ data }) {
        const row = {
          id: "proto-source-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        sourceRows.set(`${data.ownerUserId}:${data.sourceKey}`, row);
        return row;
      },
      async updateMany({ where, data }) {
        const row = Array.from(sourceRows.values()).find((entry) => entry.id === where.id);
        if (!row) {
          return { count: 0 };
        }
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      },
      async update({ where, data }) {
        const row = Array.from(sourceRows.values()).find((entry) => entry.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    protoIdea: {
      async deleteMany() {
        return { count: 0 };
      },
      async create({ data }) {
        createdIdeas.push(data);
        return data;
      },
    },
    agentDefinition: {
      findMany: async () => [
        {
          key: "proto-idea",
          name: "Proto-Idea Agent",
          updatedAt: new Date("2026-04-05T20:00:00Z"),
          active: true,
        },
      ],
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };

  const agentGatewayClient = {
    async getAdminSnapshot() {
      return {
        status: "online",
        agents: [{ key: "proto-idea" }],
      };
    },
    async startRun(payload) {
      capturedGatewayPayload = payload;
      return { id: "proto-run-1" };
    },
    async waitForRunCompletion() {
      return {
        id: "proto-run-1",
        status: "completed",
        normalized_output: {
          reply_to_user: {
            content: "Extracted one grounded proto-idea.",
          },
          source_analysis: {
            source_id: "source-1",
            source_type: "web_search",
            source_title: "Dispatch pain",
            summary: "Dispatch coordination is fragmented.",
            primary_signals: ["Tool switching"],
            observed_problems_or_needs: ["Teams lack unified dispatch coordination"],
            inferred_patterns: ["Fragmentation creates missed updates"],
            overall_signal_strength: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The source contains repeated workflow friction.",
            },
          },
          proto_idea_overview: {
            extraction_readiness: {
              label: "Ready",
              reason: "The signal is concrete.",
              next_best_action: "Persist it for refinement.",
            },
            extraction_notes: "Grounded in repeated coordination pain.",
          },
          proto_ideas: [
            {
              proto_idea_id: "idea-1",
              title: "Dispatch coordination layer",
              source_grounding: {
                explicit_signals: ["Schedulers keep switching tools."],
                inferred_from_source: ["A shared coordination layer could remove update gaps."],
              },
              problem_statement: "Dispatch teams lose time coordinating work across disconnected tools.",
              target_customer: "Dispatch leads and service operations teams",
              opportunity_hypothesis: "A coordination layer could reduce update lag and duplicate work.",
              why_it_matters: "Service responsiveness depends on reliable coordination.",
              opportunity_type: "Operations workflow",
              assumptions: [],
              open_questions: [],
              status: {
                label: "Promising",
                tone: "success",
                agent_confidence: "medium",
                explanation: "The pain is clear but the wedge still needs refinement.",
              },
              ui_hints: {
                highlight: true,
                needs_attention: false,
              },
            },
          ],
          deduplication_notes: {
            potential_overlap_detected: false,
            explanation: "",
          },
        },
      };
    },
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/proto-idea/run")
      .send({ batchSize: 1 }),
    { isAdmin: true, email: "ralfepoisson@gmail.com" }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(capturedGatewayPayload.requested_agent, "proto-idea");
  assert.equal(capturedGatewayPayload.context.extraction_policy.max_proto_ideas_per_source, 3);
  assert.match(capturedGatewayPayload.input_text, /"novelty_bias": "exploratory"/);
  assert.equal(response.body.data.policy.id, "policy-1");
  assert.equal(response.body.data.result.completedCount, 1);
  assert.equal(response.body.data.runtime.latestRunStatus, "COMPLETED");
  assert.equal(createdIdeas.length, 1);
  const storedSource = Array.from(sourceRows.values())[0];
  assert.equal(storedSource.extractionPolicyId, "policy-1");
  assert.equal(storedSource.extractionPolicySnapshot.max_proto_ideas_per_source, 3);
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "proto_idea_agent_run_completed"),
    true
  );
});

test("GET /api/idea-foundry/refinement/configuration returns the persisted idea refinement policy", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    ideaRefinementPolicy: {
      upsert: async () => ({
        id: "policy-1",
        profileName: "default",
        refinementDepth: "standard",
        creativityLevel: "medium",
        strictness: "balanced",
        maxConceptualToolsPerRun: 3,
        internalQualityThreshold: "standard",
        latestRunStatus: "COMPLETED",
        lastRunAt: new Date("2026-04-06T10:30:00Z"),
        latestRunSummaryJson: {
          completedCount: 1,
          createdCount: 1,
        },
      }),
    },
  };

  const app = createApp({ prisma, agentGatewayClient: {} });
  const response = await withAuth(
    request(app).get("/api/idea-foundry/refinement/configuration"),
    { isAdmin: true, email: "ralfepoisson@gmail.com" }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.policy.refinementDepth, "standard");
  assert.equal(response.body.data.runtime.latestRunStatus, "COMPLETED");
  assert.equal(response.body.data.runtime.latestRunSummary.createdCount, 1);
});

test("GET /api/idea-foundry/refinement/candidates returns persisted idea candidates with proto-idea linkage", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    ideaCandidate: {
      findMany: async () => [
        {
          id: "candidate-1",
          ownerUserId: "admin-user-1",
          protoIdeaId: "proto-1",
          problemStatement: "Problem",
          targetCustomer: "Customer",
          valueProposition: "Value",
          opportunityConcept: "Opportunity concept",
          differentiation: "Differentiation",
          assumptions: [],
          openQuestions: [],
          improvementSummary: "Improvement summary",
          keyChanges: [],
          appliedReasoningSummary: "Reasoning summary",
          appliedConceptualToolIds: ["tool-1"],
          qualityCheckCoherence: "Aligned",
          qualityCheckGaps: [],
          qualityCheckRisks: [],
          statusLabel: "Refined",
          statusTone: "success",
          agentConfidence: "medium",
          statusExplanation: "Clearer and more actionable",
          refinementIteration: 1,
          createdAt: new Date("2026-04-06T10:30:00Z"),
          updatedAt: new Date("2026-04-06T10:40:00Z"),
          protoIdea: {
            id: "proto-1",
            title: "Compliance workflow co-pilot",
            sourceId: "source-1",
            source: {
              sourceTitle: "VAT reminder pain",
            },
          },
        },
      ],
    },
    conceptualTool: {
      findMany: async () => [
        {
          id: "tool-1",
          name: "Assumption Mapping",
          category: "diagnostic",
          purpose: "Surface assumptions",
          whenToUse: [],
          whenNotToUse: [],
          instructions: [],
          expectedEffect: "Clearer reasoning",
          status: "ACTIVE",
          version: 1,
        },
      ],
    },
  };

  const app = createApp({ prisma, agentGatewayClient: {} });
  const response = await withAuth(
    request(app).get("/api/idea-foundry/refinement/candidates"),
    { isAdmin: true, email: "ralfepoisson@gmail.com" }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].protoIdeaTitle, "Compliance workflow co-pilot");
  assert.deepEqual(response.body.data[0].selectedConceptualToolNames, ["Assumption Mapping"]);
});

test("POST /api/idea-foundry/refinement/configuration saves the idea refinement policy", async () => {
  let storedPolicy = null;
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    ideaRefinementPolicy: {
      async upsert({ create, update }) {
        storedPolicy = {
          id: "policy-1",
          ...(storedPolicy ?? {}),
          ...(storedPolicy ? update : create),
        };
        return storedPolicy;
      },
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
  };

  const app = createApp({ prisma, agentGatewayClient: {} });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/refinement/configuration")
      .send({
        profileName: "default",
        refinementDepth: "deep",
        creativityLevel: "high",
        strictness: "exploratory",
        maxConceptualToolsPerRun: 4,
        internalQualityThreshold: "high",
      }),
    { isAdmin: true, email: "ralfepoisson@gmail.com" }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.policy.refinementDepth, "deep");
  assert.equal(response.body.data.policy.maxConceptualToolsPerRun, 4);
  assert.equal(storedPolicy.creativityLevel, "high");
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "idea_refinement_policy_saved"),
    true
  );
});

test("POST /api/idea-foundry/refinement/run executes the idea refinement agent using the saved policy and selected tools", async () => {
  let storedPolicy = {
    id: "policy-1",
    profileName: "default",
    refinementDepth: "standard",
    creativityLevel: "medium",
    strictness: "balanced",
    maxConceptualToolsPerRun: 3,
    internalQualityThreshold: "standard",
    latestRunStatus: null,
    lastRunAt: null,
    latestRunSummaryJson: null,
  };
  const protoIdeas = new Map([
    [
      "proto-1",
      {
        id: "proto-1",
        ownerUserId: "admin-user-1",
        sourceId: "proto-source-1",
        title: "Compliance workflow co-pilot",
        problemStatement: "Accounting teams are stuck chasing repetitive VAT reminder work.",
        targetCustomer: "Small accounting firms",
        opportunityHypothesis: "A workflow layer could help automate reminders.",
        whyItMatters: "It wastes time and causes missed deadlines.",
        opportunityType: "Workflow SaaS",
        assumptions: [],
        openQuestions: [],
        refinementStatus: "PENDING",
        refinementAttempts: 0,
        source: {
          id: "proto-source-1",
          sourceTitle: "VAT reminder pain",
          sourceUrl: "https://example.com/vat",
          sourceCapturedAt: new Date("2026-04-06T09:00:00Z"),
        },
      },
    ],
  ]);
  const createdCandidates = [];
  let capturedGatewayPayload = null;

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    ideaRefinementPolicy: {
      async upsert() {
        return storedPolicy;
      },
      async update({ data }) {
        storedPolicy = { ...storedPolicy, ...data };
        return storedPolicy;
      },
    },
    protoIdea: {
      async findMany() {
        return Array.from(protoIdeas.values());
      },
      async updateMany({ where, data }) {
        Object.assign(protoIdeas.get(where.id), data);
        return { count: 1 };
      },
      async findUnique({ where }) {
        return protoIdeas.get(where.id);
      },
      async update({ where, data }) {
        Object.assign(protoIdeas.get(where.id), data);
        return protoIdeas.get(where.id);
      },
    },
    conceptualTool: {
      async findMany() {
        return [
          {
            id: "tool-1",
            name: "Assumption Mapping",
            category: "diagnostic",
            purpose: "Surface assumptions",
            whenToUse: ["the idea relies on multiple unstated beliefs"],
            whenNotToUse: [],
            instructions: ["Write the hidden assumptions"],
            expectedEffect: "Clearer reasoning",
            status: "ACTIVE",
            version: 1,
          },
        ];
      },
    },
    ideaCandidate: {
      async findFirst() {
        return null;
      },
      async create({ data }) {
        createdCandidates.push(data);
        return data;
      },
    },
    agentDefinition: {
      async findMany() {
        return [
          {
            key: "idea_refinement",
            name: "Idea Refinement Agent",
            active: true,
            updatedAt: new Date("2026-04-06T09:45:00Z"),
          },
        ];
      },
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };

  const agentGatewayClient = {
    async getAdminSnapshot() {
      return {
        status: "online",
        agents: [{ key: "idea_refinement" }],
      };
    },
    async startRun(payload) {
      capturedGatewayPayload = payload;
      return { id: "refine-run-1" };
    },
    async waitForRunCompletion() {
      return {
        id: "refine-run-1",
        status: "completed",
        normalized_output: {
          reply_to_user: {
            content: "Refined the proto-idea into a stronger compliance workflow candidate.",
          },
          refinement_overview: {
            improvement_summary: "Clarified the ICP, wedge, and differentiation.",
            key_changes: ["Narrowed the ICP", "Added a wedge"],
            applied_reasoning_summary: "Used assumption mapping to surface the critical adoption risk.",
          },
          problem_statement: {
            content: "Owner-led accounting firms lose time managing recurring compliance reminders across manual workflows.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The problem is clearer and more specific.",
            },
          },
          target_customer: {
            content: "Owner-led accounting firms with recurring monthly and quarterly deadlines.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The buyer is now specific enough to evaluate.",
            },
          },
          value_proposition: {
            content: "A workflow cockpit that automates compliance reminder sequencing and task handoffs.",
            status: {
              label: "Strong",
              tone: "success",
              agent_confidence: "high",
              explanation: "The value is operational and tangible.",
            },
          },
          opportunity_concept: {
            content: "A compliance operations cockpit for small firms that turns recurring deadlines into managed workflows.",
            status: {
              label: "Refined",
              tone: "success",
              agent_confidence: "medium",
              explanation: "The candidate is clearer and more actionable.",
            },
          },
          differentiation: {
            content: "Starts from recurring compliance operations instead of broad practice-management breadth.",
            status: {
              label: "Visible",
              tone: "success",
              agent_confidence: "medium",
              explanation: "The wedge is now visible.",
            },
          },
          assumptions: {
            items: ["Firms will adopt workflow support before full automation."],
          },
          open_questions: {
            items: ["Which recurring deadlines create the highest pain?"],
          },
          quality_check: {
            coherence: "Problem, customer, and wedge are aligned with no contradictions.",
            gaps: [],
            risks: [],
          },
        },
      };
    },
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/refinement/run")
      .send({ batchSize: 1 }),
    { isAdmin: true, email: "ralfepoisson@gmail.com" }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(capturedGatewayPayload.requested_agent, "idea_refinement");
  assert.equal(capturedGatewayPayload.context.refinement_policy.max_conceptual_tools_per_run, 3);
  assert.equal(response.body.data.policy.id, "policy-1");
  assert.equal(response.body.data.result.completedCount, 1);
  assert.equal(response.body.data.result.createdCount, 1);
  assert.equal(createdCandidates.length, 1);
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "idea_refinement_agent_run_completed"),
    true
  );
});

test("POST /api/idea-foundry/pipeline/run executes the pipeline executor for the authenticated admin", async () => {
  const executorCalls = [];
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
  };

  const app = createApp({
    prisma,
    agentGatewayClient: {},
    ideaFoundryPipelineExecutor: {
      async execute(receivedPrisma, receivedGatewayClient, options) {
        executorCalls.push({ receivedPrisma, receivedGatewayClient, options });
        return {
          status: "COMPLETED",
          completedStageCount: 2,
          failedStageCount: 0,
          stageResults: [
            {
              key: "proto-idea",
              status: "COMPLETED",
              stopReason: "no_work_remaining",
              attempts: 2,
              totals: {
                processedCount: 3,
                completedCount: 3,
                failedCount: 0,
              },
            },
            {
              key: "idea-refinement",
              status: "COMPLETED",
              stopReason: "no_work_remaining",
              attempts: 2,
              totals: {
                processedCount: 3,
                completedCount: 3,
                failedCount: 0,
                candidateCount: 3,
              },
            },
          ],
        };
      },
    },
  });

  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/pipeline/run")
      .send({ retryFailed: true, maxStageIterations: 5 }),
    { isAdmin: true, email: "ralfepoisson@gmail.com" }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(executorCalls.length, 1);
  assert.equal(executorCalls[0].options.ownerUserId, "admin-user-1");
  assert.equal(executorCalls[0].options.retryFailed, true);
  assert.equal(executorCalls[0].options.maxStageIterations, 5);
  assert.equal(response.body.data.status, "COMPLETED");
  assert.equal(response.body.data.stageResults[1].totals.candidateCount, 3);
});

test("POST /api/idea-foundry/prospecting/configuration/run executes a full prospecting optimization cycle and persists the refreshed result records", async () => {
  const currentSnapshot = {
    agentState: "active",
    strategyMode: "Focused search",
    lastRun: "2026-04-04T09:10:00.000Z",
    nextRun: "2026-04-04T13:10:00.000Z",
    objective: {
      name: "Recurring compliance pain",
      description: "Find repeated operator pain in compliance-heavy workflows.",
      targetDomain: "European SMB services",
      searchPosture: "Targeted exploration",
      includeKeywords: "compliance, reconciliation, invoicing",
      excludeThemes: "generic AI commentary",
      operatorNote: "Keep the search practical and workflow-led.",
    },
    strategySummary: "Current focus is recurring compliance and admin pain.",
    steeringHypothesis: "Complaint-rich sources will reveal the strongest signals.",
    strategyPatterns: [],
    themes: [],
    sources: [],
    queryFamilies: [],
    signalRules: [],
    cadence: {
      runMode: "Scheduled",
      cadence: "Every 4 hours",
      maxResultsPerRun: 40,
      reviewThreshold: "Repeated evidence only",
      geographicScope: "United Kingdom, Ireland",
      languageScope: "English",
      budgetGuardrail: "Prefer lower-cost sources first.",
    },
    recentMetrics: [],
    recentChanges: [],
  };

  const storedResultRecords = Array.from({ length: 35 }, (_, index) => ({
    id: `result-${index + 1}`,
    title: `Stored result ${index + 1}`,
  }));

  const configurationUpserts = [];
  let capturedGatewayPayload = null;
  const searchCalls = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-prospecting-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    prospectingConfiguration: {
      findUnique: async () => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        agentState: "active",
        latestRunStatus: "COMPLETED",
        lastRunAt: new Date("2026-04-04T09:10:00Z"),
        nextRunAt: new Date("2026-04-04T13:10:00Z"),
        uiSnapshotJson: currentSnapshot,
        latestReviewJson: null,
        lastResultRecords: storedResultRecords,
      }),
      upsert: async ({ create, update }) => {
        configurationUpserts.push({ create, update });
        return {
          id: "prospecting-config-1",
          ownerUserId: "user-prospecting-1",
          ...create,
          ...update,
        };
      },
    },
    agentDefinition: {
      findMany: async () => [
        {
          key: "prospecting",
          name: "Prospecting Agent",
          updatedAt: new Date("2026-04-04T08:00:00Z"),
        },
      ],
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
  };

  const agentGatewayClient = {
    startRun: async (payload) => {
      capturedGatewayPayload = payload;
      return {
        id: "gateway-prospecting-run-1",
        status: "running",
      };
    },
    waitForRunCompletion: async () => ({
      id: "gateway-prospecting-run-1",
      status: "completed",
      normalized_output: {
        reply_to_user: {
          content: "I tightened the prospecting configuration around recurring compliance pain and reduced weaker channels.",
        },
        strategy_review_overview: {
          assessment: {
            label: "Promising with refinement needed",
            reason: "Strong direction, but a few channels still invite lower-signal noise.",
            next_best_action: "Keep complaint-led search active and trim weaker proxy sources.",
          },
        },
        current_strategy_assessment: {
          summary: "The strategy is coherent and focused on recurring operator pain.",
          observed_strengths: ["Complaint-led sources are producing useful evidence."],
          observed_weaknesses: ["A few query families overlap."],
          notable_gaps: ["Cross-border friction is still under-represented."],
          status: {
            label: "Focused search",
            tone: "positive",
            agent_confidence: "High confidence",
            explanation: "The strategy is directionally strong.",
          },
        },
        recommended_strategy_update: {
          prospecting_objective: {
            objective_name: "Recurring compliance pain in fragmented service sectors",
            description: "Surface repeated workflow pain in compliance-heavy service businesses.",
            target_domain: "European SMB services",
            include_themes: ["recurring admin burden", "fragmented compliance workflows"],
            exclude_themes: ["generic AI commentary"],
          },
          search_strategy: {
            summary: "Lean harder into complaint-led sources and recurring administrative friction.",
            strategy_patterns: [
              {
                key: "complaint-mining",
                label: "Complaint mining",
                enabled: true,
                priority: "high",
                rationale: "This pattern keeps surfacing concrete operator pain.",
              },
            ],
            steering_hypothesis: "Recurring compliance pain remains the highest-confidence lane.",
          },
          search_themes: [
            {
              label: "fragmented compliance workflows",
              status: "active",
              priority: "high",
              rationale: "Compliance pain remains frequent and monetisable.",
            },
          ],
          source_mix: [
            {
              label: "Reddit / forums",
              enabled: true,
              expected_signal_type: "Complaint language and workaround discussions",
              rationale: "Forums keep producing the clearest operator pain evidence.",
              review_frequency: "Every run",
            },
          ],
          query_families: [
            {
              title: "Complaint language around invoicing / VAT / reminders",
              intent: "Detect recurring frustration around mandatory admin work.",
              representative_queries: ["hate doing VAT reminders every month"],
              theme_link: "fragmented compliance workflows",
              source_applicability: ["Reddit / forums"],
              status: "active",
              rationale: "High-evidence lane for repeated pain.",
            },
          ],
          signal_quality_criteria: [
            {
              title: "Favour repeated mentions over isolated anecdotes",
              description: "Repeated pain across sources is stronger than a single complaint.",
              enabled: true,
              strictness: "high",
              rationale: "This reduces false positives.",
            },
          ],
          scan_policy: {
            run_mode: "scheduled",
            cadence: "Every 4 hours",
            max_results_per_run: 40,
            promotion_threshold: "Only promote repeated or costly pain signals.",
            geographic_scope: ["United Kingdom", "Ireland"],
            language_scope: ["English"],
            guardrails: ["Prefer complaint-rich sources before higher-cost report pulls"],
          },
        },
        proposed_changes: [
          {
            change_type: "tighten_source_mix",
            target: "job boards",
            summary: "Keep job boards paused while stronger complaint-led sources outperform them.",
            reason: "The current objective is better served by direct operator pain.",
            expected_effect: "Cleaner queue quality with less noise.",
            risk: "May miss a few labour-intensive workflow hints.",
          },
        ],
        review_flags: [
          {
            severity: "medium",
            area: "Source mix",
            message: "Job-board style sources are currently weak contributors.",
            recommended_operator_action: "Keep them paused until the strategy broadens again.",
          },
        ],
      },
    }),
    searchWeb: async (payload) => {
      searchCalls.push(payload);
      return {
        tool_name: "web_search",
        action: "search",
        success: true,
        payload: {
          query: payload.query,
          results: [
            {
              title: "Operators hate chasing VAT reminders manually",
              url: "https://example.com/vat-reminders",
              snippet: "A founder describes recurring VAT reminder pain.",
              provider: "duckduckgo",
              rank: 1,
            },
            {
              title: "Manual invoice follow-up is still spreadsheet-based",
              url: "https://example.com/manual-invoice-follow-up",
              snippet: "Repeated complaint about admin-heavy invoice follow-up.",
              provider: "duckduckgo",
              rank: 2,
            },
          ],
        },
      };
    },
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/prospecting/configuration/run")
      .send({ snapshot: currentSnapshot })
  );

  assert.equal(response.statusCode, 200);
  assert.equal(capturedGatewayPayload.request_type, "prospecting_configuration_review");
  assert.equal(capturedGatewayPayload.requested_agent, "prospecting");
  assert.ok(
    capturedGatewayPayload.input_text.includes("Review the current prospecting strategy and the recent search results.")
  );
  assert.ok(capturedGatewayPayload.input_text.includes('"Stored result 30"'));
  assert.equal(capturedGatewayPayload.input_text.includes('"Stored result 31"'), false);
  assert.equal(response.body.data.snapshot.objective.name, "Recurring compliance pain in fragmented service sectors");
  assert.equal(response.body.data.snapshot.strategySummary, "Lean harder into complaint-led sources and recurring administrative friction.");
  assert.equal(response.body.data.snapshot.cadence.runMode, "Scheduled");
  assert.equal(response.body.data.snapshot.cadence.cadence, "Every hour");
  assert.equal(response.body.data.runtime.latestRunStatus, "COMPLETED");
  assert.equal(response.body.data.runtime.resultRecordCount, 2);
  assert.equal(
    response.body.data.latestReview.recommended_strategy_update.prospecting_objective.objective_name,
    "Recurring compliance pain in fragmented service sectors"
  );
  assert.equal(searchCalls.length, 1);
  assert.equal(searchCalls[0].query, "hate doing VAT reminders every month");
  assert.equal(configurationUpserts.length >= 3, true);
  const persistedUpdate = configurationUpserts.at(-1)?.update ?? configurationUpserts.at(-1)?.create ?? {};
  assert.equal(
    persistedUpdate.latestReviewJson?.recommended_strategy_update?.prospecting_objective?.objective_name,
    "Recurring compliance pain in fragmented service sectors"
  );
  assert.equal(
    persistedUpdate.uiSnapshotJson?.objective?.name,
    "Recurring compliance pain in fragmented service sectors"
  );
  assert.equal(Array.isArray(persistedUpdate.lastResultRecords), true);
  assert.equal(persistedUpdate.lastResultRecords.length, 2);
  assert.equal(persistedUpdate.lastResultRecords[0].sourceUrl, "https://example.com/vat-reminders");
  assert.equal(persistedUpdate.uiSnapshotJson?.cadence?.runMode, "Scheduled");
  assert.equal(persistedUpdate.uiSnapshotJson?.cadence?.cadence, "Every hour");
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_run_started"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_prompt_prepared"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_gateway_summary_received"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some(
      (entry) =>
        entry.event === "prospecting_configuration_gateway_summary_received" &&
        entry.context.parsedJsonOutput?.recommended_strategy_update?.prospecting_objective?.objective_name ===
          "Recurring compliance pain in fragmented service sectors"
    ),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_persisted"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_execution_started"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_execution_persisted"),
    true
  );
});

test("POST /api/idea-foundry/prospecting/configuration/execute runs prospecting execution and stores normalized result records", async () => {
  const storedSnapshot = {
    agentState: "active",
    strategyMode: "Focused search",
    lastRun: "2026-04-05T09:10:00.000Z",
    nextRun: "2026-04-05T13:10:00.000Z",
    objective: {
      name: "Recurring compliance pain",
      description: "Find repeated operator pain in compliance-heavy workflows.",
      targetDomain: "European SMB services",
      searchPosture: "Targeted exploration",
      includeKeywords: "compliance, reconciliation, invoicing",
      excludeThemes: "generic AI commentary",
      operatorNote: "Keep the search practical and workflow-led.",
    },
    strategySummary: "Current focus is recurring compliance and admin pain.",
    steeringHypothesis: "Complaint-rich sources will reveal the strongest signals.",
    strategyPatterns: [],
    themes: [
      {
        id: "theme-1",
        label: "fragmented compliance workflows",
        status: "active",
        priority: "High",
        rationale: "High-evidence workflow pain."
      }
    ],
    sources: [
      {
        id: "source-1",
        label: "Reddit / forums",
        description: "Operator complaint language.",
        enabled: true,
        freshness: "Fresh",
        signalType: "Complaints",
        noiseProfile: "Balanced",
        reviewFrequency: "Every run"
      }
    ],
    queryFamilies: [
      {
        id: "query-1",
        title: "Complaint language around invoicing / VAT / reminders",
        intent: "Detect recurring frustration around mandatory admin work.",
        representativeQueries: [
          "hate doing VAT reminders every month",
          "manual invoice follow up small business"
        ],
        themeLink: "fragmented compliance workflows",
        sourceApplicability: ["Reddit / forums"],
        status: "Active",
        confidence: "Promising",
        expanded: true,
        priorityRank: 1
      }
    ],
    signalRules: [],
    cadence: {
      runMode: "Scheduled",
      cadence: "Every 4 hours",
      maxResultsPerRun: 40,
      reviewThreshold: "Repeated evidence only",
      geographicScope: "United Kingdom, Ireland",
      languageScope: "English",
      budgetGuardrail: "Prefer lower-cost sources first.",
    },
    recentMetrics: [],
    recentChanges: [],
  };

  const configurationUpserts = [];
  const searchCalls = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-prospecting-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    prospectingConfiguration: {
      findUnique: async () => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        agentState: "active",
        latestRunStatus: "COMPLETED",
        lastRunAt: new Date("2026-04-05T09:10:00Z"),
        nextRunAt: new Date("2026-04-05T13:10:00Z"),
        uiSnapshotJson: storedSnapshot,
        latestReviewJson: {
          reply_to_user: {
            content: "Latest prospecting strategy is ready for execution."
          }
        },
        lastResultRecords: [],
      }),
      upsert: async ({ create, update }) => {
        configurationUpserts.push({ create, update });
        return {
          id: "prospecting-config-1",
          ownerUserId: "user-prospecting-1",
          ...create,
          ...update,
        };
      },
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
  };

  const agentGatewayClient = {
    searchWeb: async (payload) => {
      searchCalls.push(payload);
      return {
        tool_name: "web_search",
        action: "search",
        success: true,
        payload: {
          query: payload.query,
          results: [
            {
              title: "Operators hate chasing VAT reminders manually",
              url: "https://example.com/vat-reminders",
              snippet: "A founder describes recurring VAT reminder pain.",
              provider: "duckduckgo",
              rank: 1,
            },
            {
              title: "Manual invoice follow-up is still spreadsheet-based",
              url: "https://example.com/manual-invoice-follow-up",
              snippet: "Repeated complaint about admin-heavy invoice follow-up.",
              provider: "duckduckgo",
              rank: 2,
            },
          ],
        },
      };
    },
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/prospecting/configuration/execute")
      .send({})
  );

  assert.equal(response.statusCode, 200);
  assert.equal(searchCalls.length, 2);
  assert.equal(response.body.data.snapshot.cadence.runMode, "Scheduled");
  assert.equal(response.body.data.snapshot.cadence.cadence, "Every hour");
  assert.equal(response.body.data.runtime.latestRunStatus, "COMPLETED");
  assert.equal(response.body.data.runtime.resultRecordCount, 2);
  const persistedUpdate = configurationUpserts.at(-1)?.update ?? configurationUpserts.at(-1)?.create ?? {};
  assert.equal(Array.isArray(persistedUpdate.lastResultRecords), true);
  assert.equal(persistedUpdate.lastResultRecords.length, 2);
  assert.equal(persistedUpdate.lastResultRecords[0].queryFamilyTitle, "Complaint language around invoicing / VAT / reminders");
  assert.equal(persistedUpdate.lastResultRecords[0].themeLink, "fragmented compliance workflows");
  assert.equal(persistedUpdate.lastResultRecords[0].sourceUrl, "https://example.com/vat-reminders");
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_execution_started"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_execution_query_completed"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_execution_persisted"),
    true
  );
});

test("POST /api/idea-foundry/prospecting/configuration/run accepts a compliant prospecting review embedded inside the gateway agent envelope", async () => {
  const currentSnapshot = {};

  const compliantRawOutput = JSON.stringify({
    reply_to_user: {
      content: "I tightened the strategy and kept the strongest complaint-led sources active.",
    },
    strategy_review_overview: {
      assessment: {
        label: "Focused search",
        reason: "The strategy is coherent and only needs minor tuning.",
        next_best_action: "Keep the query family mix tight and complaint-led.",
      },
    },
    current_strategy_assessment: {
      summary: "The strategy is coherent and close to production-ready.",
      observed_strengths: ["Clear complaint-led posture"],
      observed_weaknesses: ["Sparse recent results"],
      notable_gaps: ["Cross-border evidence is still thin"],
      status: {
        label: "Focused search",
        tone: "positive",
        agent_confidence: "High confidence",
        explanation: "The current strategy is usable with only minor changes.",
      },
    },
    recommended_strategy_update: {
      prospecting_objective: {
        objective_name: "Recurring compliance pain",
        description: "Surface repeated workflow pain in compliance-heavy service businesses.",
        target_domain: "European SMB services",
        include_themes: ["recurring admin burden"],
        exclude_themes: ["generic AI commentary"],
      },
      search_strategy: {
        summary: "Lean into complaint-led sources and recurring operator burden.",
        strategy_patterns: [
          {
            key: "complaint-mining",
            label: "Complaint mining",
            enabled: true,
            priority: "high",
            rationale: "It continues to surface concrete operator pain.",
          },
        ],
        steering_hypothesis: "Recurring compliance pain remains the strongest lane.",
      },
      search_themes: [
        {
          label: "recurring admin burden",
          status: "active",
          priority: "high",
          rationale: "Repeated admin work remains strong evidence of durable pain.",
        },
      ],
      source_mix: [
        {
          label: "Reddit / forums",
          enabled: true,
          expected_signal_type: "Complaint language",
          rationale: "Forum complaint language remains the strongest source.",
          review_frequency: "Every run",
        },
      ],
      query_families: [
        {
          title: "Complaint language around invoicing",
          intent: "Detect recurring administrative frustration.",
          representative_queries: ["hate doing invoicing every month"],
          theme_link: "recurring admin burden",
          source_applicability: ["Reddit / forums"],
          status: "active",
          rationale: "High-evidence lane.",
        },
      ],
      signal_quality_criteria: [
        {
          title: "Favour repeated mentions over isolated anecdotes",
          description: "Repeated pain is stronger than a single complaint.",
          enabled: true,
          strictness: "high",
          rationale: "This reduces false positives.",
        },
      ],
      scan_policy: {
        run_mode: "scheduled",
        cadence: "Every 4 hours",
        max_results_per_run: 40,
        promotion_threshold: "Repeated evidence only",
        geographic_scope: ["United Kingdom"],
        language_scope: ["English"],
        guardrails: ["Prefer complaint-rich sources first"],
      },
    },
    proposed_changes: [],
    review_flags: [],
  });

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-prospecting-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    prospectingConfiguration: {
      findUnique: async () => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        agentState: "active",
        latestRunStatus: "COMPLETED",
        lastRunAt: new Date("2026-04-04T09:10:00Z"),
        nextRunAt: new Date("2026-04-04T13:10:00Z"),
        uiSnapshotJson: currentSnapshot,
        latestReviewJson: null,
        lastResultRecords: [],
      }),
      upsert: async ({ create, update }) => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        ...create,
        ...update,
      }),
    },
    agentDefinition: {
      findMany: async () => [
        {
          key: "prospecting",
          name: "Prospecting Agent",
          updatedAt: new Date("2026-04-04T08:00:00Z"),
        },
      ],
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
  };

  const agentGatewayClient = {
    startRun: async () => ({
      id: "gateway-prospecting-envelope-run-1",
      status: "running",
    }),
    waitForRunCompletion: async () => ({
      id: "gateway-prospecting-envelope-run-1",
      status: "completed",
      normalized_output: {
        agent_key: "prospecting",
        version: "1.0.0",
        artifact: {
          kind: "prospecting",
          title: "Prospecting Agent",
          summary: "Structured prospecting review.",
          sections: [
            {
              heading: "Generated Output",
              content: compliantRawOutput,
            },
          ],
        },
        debug: {
          raw_llm_output: compliantRawOutput,
        },
      },
    }),
    searchWeb: async (payload) => ({
      tool_name: "web_search",
      action: "search",
      success: true,
      payload: {
        query: payload.query,
        results: [
          {
            title: "Complaint-led source",
            url: "https://example.com/complaint-led-source",
            snippet: "Realistic complaint-led source summary.",
            provider: "duckduckgo",
            rank: 1,
          },
        ],
      },
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/prospecting/configuration/run")
      .send({ snapshot: currentSnapshot })
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.latestReview.reply_to_user.content.includes("tightened the strategy"), true);
  assert.equal(response.body.data.latestReview.meta.usedFallback ?? false, false);
  assert.equal(
    prisma.logEntry.createCalls.some(
      (entry) =>
        entry.event === "prospecting_configuration_gateway_summary_received" &&
        entry.context.rawLlmOutput === compliantRawOutput
    ),
    true
  );
});

test("POST /api/idea-foundry/prospecting/configuration/run returns a clear error when prospecting storage is unavailable", async () => {
  const missingTableError = new Error("The table `helmos.prospecting_configurations` does not exist in the current database.");
  missingTableError.code = "P2021";

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-prospecting-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    prospectingConfiguration: {
      findUnique: async () => {
        throw missingTableError;
      },
      upsert: async () => {
        throw missingTableError;
      },
    },
    agentDefinition: {
      findMany: async () => [
        {
          key: "prospecting",
          name: "Prospecting Agent",
          updatedAt: new Date("2026-04-04T08:00:00Z"),
        },
      ],
    },
  };

  const agentGatewayClient = {
    startRun: async () => {
      throw new Error("should not be called");
    },
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/prospecting/configuration/run")
      .send({
        snapshot: {
          agentState: "active",
          strategyMode: "Focused search",
        },
      })
  );

  assert.equal(response.statusCode, 503);
  assert.equal(
    response.body.error,
    "Prospecting configuration storage is not available yet. Apply the database migration for prospecting configurations and try again."
  );
});

test("POST /api/idea-foundry/prospecting/configuration/run returns a clear error when the gateway registry is missing the prospecting agent", async () => {
  const currentSnapshot = {
    agentState: "active",
    strategyMode: "Focused search",
  };

  let startRunCalled = false;
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-prospecting-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    prospectingConfiguration: {
      findUnique: async () => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        agentState: "active",
        latestRunStatus: "IDLE",
        lastRunAt: null,
        nextRunAt: null,
        uiSnapshotJson: currentSnapshot,
        latestReviewJson: null,
        lastResultRecords: [],
      }),
      upsert: async ({ create, update }) => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        ...create,
        ...update,
      }),
    },
    agentDefinition: {
      findMany: async () => [
        {
          key: "prospecting",
          name: "Prospecting Agent",
          updatedAt: new Date("2026-04-04T08:00:00Z"),
        },
      ],
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
  };

  const agentGatewayClient = {
    getAdminSnapshot: async () => ({
      configured: true,
      status: "online",
      message: "Agent gateway responded successfully.",
      baseUrl: "http://127.0.0.1:8000/api/v1",
      service: "helmos-agent-gateway",
      checkedAt: "2026-04-05T17:48:38.548Z",
      agents: [
        { key: "ideation" },
        { key: "research" },
        { key: "roadmap" },
      ],
    }),
    startRun: async () => {
      startRunCalled = true;
      return { id: "should-not-run" };
    },
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/prospecting/configuration/run")
      .send({ snapshot: currentSnapshot })
  );

  assert.equal(response.statusCode, 503);
  assert.match(response.body.error, /does not have the 'prospecting' agent registered/i);
  assert.equal(startRunCalled, false);
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_gateway_registry_mismatch"),
    true
  );
});

test("POST /api/idea-foundry/prospecting/configuration/run preserves the current configuration when the gateway returns an unstructured completed artifact", async () => {
  const currentSnapshot = {
    agentState: "active",
    strategyMode: "Focused search",
    lastRun: "2026-04-04T09:10:00.000Z",
    nextRun: "2026-04-04T13:10:00.000Z",
    objective: {
      name: "Recurring compliance pain",
      description: "Find repeated operator pain in compliance-heavy workflows.",
      targetDomain: "European SMB services",
      searchPosture: "Targeted exploration",
      includeKeywords: "compliance, reconciliation, invoicing",
      excludeThemes: "generic AI commentary",
      operatorNote: "Keep the search practical and workflow-led.",
    },
    strategySummary: "Current focus is recurring compliance and admin pain.",
    steeringHypothesis: "Complaint-rich sources will reveal the strongest signals.",
    strategyPatterns: [],
    themes: [],
    sources: [],
    queryFamilies: [],
    signalRules: [],
    cadence: {
      runMode: "Scheduled",
      cadence: "Every 4 hours",
      maxResultsPerRun: 40,
      reviewThreshold: "Repeated evidence only",
      geographicScope: "United Kingdom, Ireland",
      languageScope: "English",
      budgetGuardrail: "Prefer lower-cost sources first.",
    },
    recentMetrics: [],
    recentChanges: [],
  };

  const configurationUpserts = [];
  const gatewayStartCalls = [];
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-prospecting-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    prospectingConfiguration: {
      findUnique: async () => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        agentState: "active",
        latestRunStatus: "COMPLETED",
        lastRunAt: new Date("2026-04-04T09:10:00Z"),
        nextRunAt: new Date("2026-04-04T13:10:00Z"),
        uiSnapshotJson: currentSnapshot,
        latestReviewJson: null,
        lastResultRecords: [],
      }),
      upsert: async ({ create, update }) => {
        configurationUpserts.push({ create, update });
        return {
          id: "prospecting-config-1",
          ownerUserId: "user-prospecting-1",
          ...create,
          ...update,
        };
      },
    },
    agentDefinition: {
      findMany: async () => [
        {
          key: "prospecting",
          name: "Prospecting Agent",
          updatedAt: new Date("2026-04-04T08:00:00Z"),
        },
      ],
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
  };

  const agentGatewayClient = {
    startRun: async (payload) => {
      gatewayStartCalls.push(payload);
      return {
        id:
          gatewayStartCalls.length === 1
            ? "gateway-prospecting-run-2"
            : `gateway-prospecting-run-2-repair-${gatewayStartCalls.length - 1}`,
        status: "running",
      };
    },
    waitForRunCompletion: async (runId) => ({
      id: runId,
      status: "completed",
      normalized_output: {
        debug: {
          raw_llm_output: "raw gateway output",
        },
        version: "1.0.0",
        artifact: {
          kind: "generic",
          title: "Deterministic Summary",
          summary: "A deterministic route handled this request without specialist delegation.",
          sections: [
            {
              heading: "Prompt echo",
              content: "Review the current prospecting strategy and the recent search results.",
            },
          ],
        },
      },
    }),
    searchWeb: async () => ({
      tool_name: "web_search",
      action: "search",
      success: true,
      payload: {
        results: [],
      },
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/prospecting/configuration/run")
      .send({ snapshot: currentSnapshot })
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data.snapshot.objective, currentSnapshot.objective);
  assert.equal(response.body.data.runtime.latestRunStatus, "COMPLETED");
  assert.match(
    response.body.data.latestReview.reply_to_user.content,
    /did not return a compliant structured configuration update/i
  );
  assert.equal(gatewayStartCalls.length, 4);
  assert.equal(gatewayStartCalls[1].request_type, "prospecting_configuration_review_repair");
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_unstructured_gateway_output"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some(
      (entry) =>
        entry.event === "prospecting_configuration_gateway_summary_received" &&
        entry.context.rawLlmOutput === "raw gateway output"
    ),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_output_validation_failed"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_repair_requested"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_repair_validation_failed"),
    true
  );
  assert.equal(configurationUpserts.length >= 3, true);
});

test("POST /api/idea-foundry/prospecting/configuration/run asks the agent to repair a non-compliant response and persists the repaired output within three attempts", async () => {
  const currentSnapshot = {
    agentState: "active",
    strategyMode: "Focused search",
    lastRun: "2026-04-04T09:10:00.000Z",
    nextRun: "2026-04-04T13:10:00.000Z",
    objective: {
      name: "Recurring compliance pain",
      description: "Find repeated operator pain in compliance-heavy workflows.",
      targetDomain: "European SMB services",
      searchPosture: "Targeted exploration",
      includeKeywords: "compliance, reconciliation, invoicing",
      excludeThemes: "generic AI commentary",
      operatorNote: "Keep the search practical and workflow-led.",
    },
    strategySummary: "Current focus is recurring compliance and admin pain.",
    steeringHypothesis: "Complaint-rich sources will reveal the strongest signals.",
    strategyPatterns: [],
    themes: [],
    sources: [],
    queryFamilies: [],
    signalRules: [],
    cadence: {
      runMode: "Scheduled",
      cadence: "Every 4 hours",
      maxResultsPerRun: 40,
      reviewThreshold: "Repeated evidence only",
      geographicScope: "United Kingdom, Ireland",
      languageScope: "English",
      budgetGuardrail: "Prefer lower-cost sources first.",
    },
    recentMetrics: [],
    recentChanges: [],
  };

  const configurationUpserts = [];
  const gatewayStartCalls = [];
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-prospecting-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    prospectingConfiguration: {
      findUnique: async () => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        agentState: "active",
        latestRunStatus: "COMPLETED",
        lastRunAt: new Date("2026-04-04T09:10:00Z"),
        nextRunAt: new Date("2026-04-04T13:10:00Z"),
        uiSnapshotJson: currentSnapshot,
        latestReviewJson: null,
        lastResultRecords: [],
      }),
      upsert: async ({ create, update }) => {
        configurationUpserts.push({ create, update });
        return {
          id: "prospecting-config-1",
          ownerUserId: "user-prospecting-1",
          ...create,
          ...update,
        };
      },
    },
    agentDefinition: {
      findMany: async () => [
        {
          key: "prospecting",
          name: "Prospecting Agent",
          updatedAt: new Date("2026-04-04T08:00:00Z"),
        },
      ],
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
  };

  const agentGatewayClient = {
    startRun: async (payload) => {
      gatewayStartCalls.push(payload);
      return {
        id:
          gatewayStartCalls.length === 1
            ? "gateway-prospecting-run-3"
            : `gateway-prospecting-run-3-repair-${gatewayStartCalls.length - 1}`,
        status: "running",
      };
    },
    waitForRunCompletion: async (runId) => {
      if (runId === "gateway-prospecting-run-3" || runId === "gateway-prospecting-run-3-repair-1" || runId === "gateway-prospecting-run-3-repair-2") {
        return {
          id: runId,
          status: "completed",
          normalized_output: {
            version: "1.0.0",
            artifact: {
              kind: "generic",
              title: "Deterministic Summary",
              summary: "A deterministic route handled this request without specialist delegation.",
            },
          },
        };
      }

      return {
        id: runId,
        status: "completed",
        normalized_output: {
          reply_to_user: {
            content: "I corrected the response format and tightened the search configuration.",
          },
          strategy_review_overview: {
            assessment: {
              label: "Compliant after repair",
              reason: "The first reply missed required fields, so the schema was reissued correctly.",
              next_best_action: "Keep complaint-led discovery active and monitor cross-border pain.",
            },
          },
          current_strategy_assessment: {
            summary: "The repaired output keeps the strategy focused on recurring compliance pain.",
            observed_strengths: ["The complaint-led posture remains clear."],
            observed_weaknesses: ["The first response missed the contract."],
            notable_gaps: ["Cross-border pain still needs more signal depth."],
            status: {
              label: "Focused search",
              tone: "positive",
              agent_confidence: "Medium confidence",
              explanation: "The repaired response now complies with the expected structure.",
            },
          },
          recommended_strategy_update: {
            prospecting_objective: {
              objective_name: "Recurring compliance pain in fragmented service sectors",
              description: "Surface repeated workflow pain in compliance-heavy service businesses.",
              target_domain: "European SMB services",
              include_themes: ["recurring admin burden", "fragmented compliance workflows"],
              exclude_themes: ["generic AI commentary"],
            },
            search_strategy: {
              summary: "Lean harder into complaint-led sources and recurring administrative friction.",
              strategy_patterns: [
                {
                  key: "complaint-mining",
                  label: "Complaint mining",
                  enabled: true,
                  priority: "high",
                  rationale: "This pattern keeps surfacing concrete operator pain.",
                },
              ],
              steering_hypothesis: "Recurring compliance pain remains the highest-confidence lane.",
            },
            search_themes: [
              {
                label: "fragmented compliance workflows",
                status: "active",
                priority: "high",
                rationale: "Compliance pain remains frequent and monetisable.",
              },
            ],
            source_mix: [
              {
                label: "Reddit / forums",
                enabled: true,
                expected_signal_type: "Complaint language and workaround discussions",
                rationale: "Forums keep producing the clearest operator pain evidence.",
                review_frequency: "Every run",
              },
            ],
            query_families: [
              {
                title: "Complaint language around invoicing / VAT / reminders",
                intent: "Detect recurring frustration around mandatory admin work.",
                representative_queries: ["hate doing VAT reminders every month"],
                theme_link: "fragmented compliance workflows",
                source_applicability: ["Reddit / forums"],
                status: "active",
                rationale: "High-evidence lane for repeated pain.",
              },
            ],
            signal_quality_criteria: [
              {
                title: "Favour repeated mentions over isolated anecdotes",
                description: "Repeated pain across sources is stronger than a single complaint.",
                enabled: true,
                strictness: "high",
                rationale: "This reduces false positives.",
              },
            ],
            scan_policy: {
              run_mode: "scheduled",
              cadence: "Every 4 hours",
              max_results_per_run: 40,
              promotion_threshold: "Only promote repeated or costly pain signals.",
              geographic_scope: ["United Kingdom", "Ireland"],
              language_scope: ["English"],
              guardrails: ["Prefer complaint-rich sources before higher-cost report pulls"],
            },
          },
          proposed_changes: [],
          review_flags: [],
        },
      };
    },
    searchWeb: async (payload) => ({
      tool_name: "web_search",
      action: "search",
      success: true,
      payload: {
        query: payload.query,
        results: [
          {
            title: "Prospecting execution result",
            url: "https://example.com/prospecting-execution-result",
            snippet: "Execution completed against the repaired strategy.",
            provider: "duckduckgo",
            rank: 1,
          },
        ],
      },
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/prospecting/configuration/run")
      .send({ snapshot: currentSnapshot })
  );

  assert.equal(response.statusCode, 200);
  assert.equal(gatewayStartCalls.length, 4);
  assert.equal(gatewayStartCalls[0].request_type, "prospecting_configuration_review");
  assert.equal(gatewayStartCalls[1].request_type, "prospecting_configuration_review_repair");
  assert.equal(gatewayStartCalls[2].request_type, "prospecting_configuration_review_repair");
  assert.equal(gatewayStartCalls[3].request_type, "prospecting_configuration_review_repair");
  assert.match(gatewayStartCalls[1].input_text, /did not comply with the required prospecting configuration review json schema/i);
  assert.match(gatewayStartCalls[1].input_text, /repair attempt 1 of 3/i);
  assert.match(gatewayStartCalls[2].input_text, /repair attempt 2 of 3/i);
  assert.match(gatewayStartCalls[3].input_text, /repair attempt 3 of 3/i);
  assert.equal(response.body.data.snapshot.objective.name, "Recurring compliance pain in fragmented service sectors");
  assert.equal(response.body.data.runtime.latestRunStatus, "COMPLETED");
  assert.equal(response.body.data.latestReview.meta.repairedAfterValidationFailure, true);
  assert.equal(response.body.data.latestReview.meta.repairAttemptsUsed, 3);
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_output_validation_failed"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_repair_requested"),
    true
  );
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "prospecting_configuration_repair_summary_received"),
    true
  );
  assert.equal(configurationUpserts.length >= 3, true);
});

test("POST /api/idea-foundry/prospecting/configuration/run stops after three repair attempts and falls back safely", async () => {
  const currentSnapshot = {
    agentState: "active",
    strategyMode: "Focused search",
    lastRun: "2026-04-04T09:10:00.000Z",
    nextRun: "2026-04-04T13:10:00.000Z",
    objective: {
      name: "Recurring compliance pain",
      description: "Find repeated operator pain in compliance-heavy workflows.",
      targetDomain: "European SMB services",
      searchPosture: "Targeted exploration",
      includeKeywords: "compliance, reconciliation, invoicing",
      excludeThemes: "generic AI commentary",
      operatorNote: "Keep the search practical and workflow-led.",
    },
    strategySummary: "Current focus is recurring compliance and admin pain.",
    steeringHypothesis: "Complaint-rich sources will reveal the strongest signals.",
    strategyPatterns: [],
    themes: [],
    sources: [],
    queryFamilies: [],
    signalRules: [],
    cadence: {
      runMode: "Scheduled",
      cadence: "Every 4 hours",
      maxResultsPerRun: 40,
      reviewThreshold: "Repeated evidence only",
      geographicScope: "United Kingdom, Ireland",
      languageScope: "English",
      budgetGuardrail: "Prefer lower-cost sources first.",
    },
    recentMetrics: [],
    recentChanges: [],
  };

  const gatewayStartCalls = [];
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "user-prospecting-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "USER",
      }),
    },
    prospectingConfiguration: {
      findUnique: async () => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        agentState: "active",
        latestRunStatus: "COMPLETED",
        lastRunAt: new Date("2026-04-04T09:10:00Z"),
        nextRunAt: new Date("2026-04-04T13:10:00Z"),
        uiSnapshotJson: currentSnapshot,
        latestReviewJson: null,
        lastResultRecords: [],
      }),
      upsert: async ({ create, update }) => ({
        id: "prospecting-config-1",
        ownerUserId: "user-prospecting-1",
        ...create,
        ...update,
      }),
    },
    agentDefinition: {
      findMany: async () => [
        {
          key: "prospecting",
          name: "Prospecting Agent",
          updatedAt: new Date("2026-04-04T08:00:00Z"),
        },
      ],
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
  };

  const agentGatewayClient = {
    startRun: async (payload) => {
      gatewayStartCalls.push(payload);
      return {
        id:
          gatewayStartCalls.length === 1
            ? "gateway-prospecting-run-4"
            : `gateway-prospecting-run-4-repair-${gatewayStartCalls.length - 1}`,
        status: "running",
      };
    },
    waitForRunCompletion: async (runId) => ({
      id: runId,
      status: "completed",
      normalized_output: {
        version: "1.0.0",
        artifact: {
          kind: "generic",
          title: "Deterministic Summary",
          summary: "A deterministic route handled this request without specialist delegation.",
        },
      },
    }),
    searchWeb: async () => ({
      tool_name: "web_search",
      action: "search",
      success: true,
      payload: {
        results: [],
      },
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
      .post("/api/idea-foundry/prospecting/configuration/run")
      .send({ snapshot: currentSnapshot })
  );

  assert.equal(response.statusCode, 200);
  assert.equal(gatewayStartCalls.length, 4);
  assert.equal(response.body.data.latestReview.meta.usedFallback, true);
  assert.equal(response.body.data.latestReview.meta.repairAttemptsUsed, 3);
  assert.equal(response.body.data.latestReview.meta.fallbackReason, "non_compliant_output_after_max_repairs");
  assert.equal(
    prisma.logEntry.createCalls.filter((entry) => entry.event === "prospecting_configuration_repair_requested").length,
    3
  );
  assert.equal(
    prisma.logEntry.createCalls.filter((entry) => entry.event === "prospecting_configuration_repair_validation_failed").length,
    3
  );
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
  assert.deepEqual(response.body.data.availableScopes, ["snapshot-service"]);
  assert.equal(response.body.data.filters.scope, "");
  assert.equal(response.body.data.logs[0].event, "widget_snapshot_failed");
  assert.equal(prisma.logEntry.createCalls.length, 0);
});

test("GET /api/admin/logs filters backend log entries by scope", async () => {
  const logEntries = [
    {
      id: "log-1",
      level: "info",
      scope: "admin",
      event: "get_admin_agents_200",
      message: "GET /api/admin/agents responded with 200",
      context: {},
      createdAt: "2026-03-23T20:58:20.000Z",
    },
    {
      id: "log-2",
      level: "info",
      scope: "agent-test-execution",
      event: "agent_test_execution_started",
      message: "Agent test execution started.",
      context: {},
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
      lastFindManyArgs: null,
      async create({ data }) {
        this.createCalls.push(data);
        return { id: "request-log-1", ...data };
      },
      async findMany(args) {
        this.lastFindManyArgs = args;
        return logEntries.filter((entry) => entry.scope === args.where.scope);
      },
      async count({ where }) {
        return logEntries.filter((entry) => entry.level === where.level).length;
      },
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(request(app).get("/api/admin/logs?scope=agent-test-execution"), {
    email: "ralfepoisson@gmail.com",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(prisma.logEntry.lastFindManyArgs.where.scope, "agent-test-execution");
  assert.equal(response.body.data.filters.scope, "agent-test-execution");
  assert.equal(response.body.data.summary.matchingLogs, 1);
  assert.equal(response.body.data.logs[0].event, "agent_test_execution_started");
});

test("GET /api/admin/logs does not create a request log entry for itself", async () => {
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
        return [];
      },
      async count() {
        return 0;
      },
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(request(app).get("/api/admin/logs"), {
    email: "ralfepoisson@gmail.com",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(prisma.logEntry.createCalls.length, 0);
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
  const response = await withAuth(request(app).get("/api/admin/agents"), {
    email: "ralfepoisson@gmail.com",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.gateway.status, "online");
  assert.equal(response.body.data.agents.length, 1);
  assert.deepEqual(response.body.data.agents[0].allowedTools, ["retrieval"]);
  assert.equal(response.body.data.agents[0].runtime.registered, true);
  assert.equal(response.body.data.agents[0].promptConfig.key, "ideation.default");
  assert.equal(response.body.data.agents[0].promptConfig.version, "1.0.0");
});

test("GET /api/admin/agents ignores active prompt configs for similarly named agents", async () => {
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
          promptTemplate: "Mock prompt that must not leak into the ideation agent.",
          configJson: { temperature: 0.9 },
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
  assert.equal(response.body.data.agents.length, 1);
  assert.equal(response.body.data.agents[0].promptConfig, null);
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

test("PATCH /api/admin/agents/:id returns the exact matching prompt config after save", async () => {
  const promptConfigs = [
    {
      id: "prompt-mock",
      key: "ideation-agent.default",
      version: "9.9.9",
      promptTemplate: "Mock prompt that must not override the real ideation config.",
      configJson: { temperature: 0.9 },
      active: true,
      updatedAt: "2026-03-22T10:00:00.000Z",
    },
    {
      id: "prompt-1",
      key: "ideation.default",
      version: "1.0.0",
      promptTemplate: "Initial ideation prompt",
      configJson: { temperature: 0.2 },
      active: true,
      updatedAt: "2026-03-22T08:00:00.000Z",
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
      findMany: async () => [
        {
          id: "agent-1",
          key: "ideation",
          name: "Ideation Agent",
          version: "1.1.0",
          description: "Refines founder concepts into structured idea briefs.",
          allowedTools: ["retrieval", "web_search"],
          defaultModel: "helmos-default",
          active: true,
          createdAt: "2026-03-22T08:00:00.000Z",
          updatedAt: "2026-03-22T09:00:00.000Z",
        },
      ],
      findUniqueOrThrow: async () => ({
        id: "agent-1",
        key: "ideation",
        name: "Ideation Agent",
        version: "1.0.0",
        description: "Original description",
        allowedTools: ["retrieval"],
        defaultModel: "helmos-default",
        active: true,
        createdAt: "2026-03-22T08:00:00.000Z",
        updatedAt: "2026-03-22T08:05:00.000Z",
      }),
      update: async ({ data }) => ({
        id: "agent-1",
        key: "ideation",
        name: data.name,
        version: data.version,
        description: data.description,
        allowedTools: data.allowedTools,
        defaultModel: data.defaultModel,
        active: data.active,
        createdAt: "2026-03-22T08:00:00.000Z",
        updatedAt: "2026-03-22T09:00:00.000Z",
      }),
    },
    promptConfig: {
      findMany: async () => [...promptConfigs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      updateMany: async ({ where, data }) => {
        promptConfigs.forEach((entry) => {
          if (entry.key === where.key && entry.active === where.active) {
            entry.active = data.active;
          }
        });
        return { count: 1 };
      },
      findFirst: async ({ where }) =>
        promptConfigs.find((entry) => entry.key === where.key && entry.version === where.version) ?? null,
      update: async ({ where, data }) => {
        const index = promptConfigs.findIndex((entry) => entry.id === where.id);
        promptConfigs[index] = {
          ...promptConfigs[index],
          ...data,
          updatedAt: "2026-03-22T11:00:00.000Z",
        };
        return promptConfigs[index];
      },
      create: async ({ data }) => {
        const created = {
          id: "prompt-created",
          updatedAt: "2026-03-22T11:00:00.000Z",
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
    getAdminSnapshot: async () => ({
      configured: true,
      status: "online",
      message: "Agent gateway responded successfully.",
      baseUrl: "http://localhost:8000/api/v1",
      service: "helmos-agent-gateway",
      checkedAt: "2026-03-22T11:00:00.000Z",
      agents: [
        {
          key: "ideation",
          name: "Ideation Agent",
          version: "1.1.0",
          purpose: "Refines founder concepts into structured idea briefs.",
          allowed_tools: ["retrieval", "web_search"],
        },
      ],
    }),
  };

  const app = createApp({ prisma, agentGatewayClient });
  const response = await withAuth(
    request(app)
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
      }),
    { email: "ralfepoisson@gmail.com" },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.promptConfig.key, "ideation.default");
  assert.equal(response.body.data.promptConfig.version, "1.1.0");
  assert.equal(response.body.data.promptConfig.promptTemplate, "Refine the founder brief from: {prompt}");
  assert.deepEqual(response.body.data.promptConfig.configJson, {
    temperature: 0.1,
    artifact_kind: "idea_brief",
  });
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

test("GET /api/admin/conceptual-tools returns persisted tools with optional status filtering", async () => {
  const conceptualTools = [
    {
      id: "tool-1",
      name: "Inversion",
      category: "transformative",
      purpose: "Challenge the default model by reversing core assumptions.",
      whenToUse: ["high market saturation", "weak differentiation"],
      whenNotToUse: ["problem statement unclear"],
      instructions: ["Identify the dominant operating assumption", "Reverse it"],
      expectedEffect: "Increase novelty and differentiation while preserving grounding.",
      status: "ACTIVE",
      version: 1,
      createdAt: "2026-04-06T08:00:00.000Z",
      updatedAt: "2026-04-06T08:30:00.000Z",
    },
    {
      id: "tool-2",
      name: "Failure Analysis",
      category: "diagnostic",
      purpose: "Surface likely failure modes before committing to an idea direction.",
      whenToUse: ["execution path is uncertain"],
      whenNotToUse: [],
      instructions: ["List failure modes", "Trace likely causes"],
      expectedEffect: "Reduce avoidable blind spots.",
      status: "INACTIVE",
      version: 1,
      createdAt: "2026-04-06T09:00:00.000Z",
      updatedAt: "2026-04-06T09:10:00.000Z",
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
    conceptualTool: {
      lastFindManyArgs: null,
      async findMany(args) {
        this.lastFindManyArgs = args;
        if (args?.where?.status) {
          return conceptualTools.filter((entry) => entry.status === args.where.status);
        }

        return conceptualTools;
      },
    },
    logEntry: {
      async create({ data }) {
        return { id: "log-1", ...data };
      },
    },
  };

  const app = createApp({ prisma });

  const response = await withAuth(request(app).get("/api/admin/conceptual-tools?status=inactive"), {
    email: "ralfepoisson@gmail.com",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(prisma.conceptualTool.lastFindManyArgs.where.status, "INACTIVE");
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].name, "Failure Analysis");
});

test("GET /api/admin/conceptual-tools falls back to raw SQL when the Prisma client is stale", async () => {
  const executedSql = [];
  const queriedSql = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    async $executeRawUnsafe(sql, ...params) {
      executedSql.push({ sql, params });
      return 1;
    },
    async $queryRawUnsafe(sql, ...params) {
      queriedSql.push({ sql, params });
      return [
        {
          id: "tool-1",
          name: "Inversion",
          category: "transformative",
          purpose: "Challenge the default model by reversing core assumptions.",
          when_to_use: ["high market saturation"],
          when_not_to_use: ["problem statement unclear"],
          instructions: ["Reverse it"],
          expected_effect: "Increase novelty.",
          status: "ACTIVE",
          version: 1,
          created_at: "2026-04-06T08:00:00.000Z",
          updated_at: "2026-04-06T08:30:00.000Z",
        },
      ];
    },
    logEntry: {
      async create({ data }) {
        return { id: "log-1", ...data };
      },
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(request(app).get("/api/admin/conceptual-tools"), {
    email: "ralfepoisson@gmail.com",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].name, "Inversion");
  assert.equal(executedSql.length > 0, true);
  assert.equal(queriedSql.length > 0, true);
});

test("GET /api/admin/conceptual-tools/:id returns one conceptual tool", async () => {
  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    conceptualTool: {
      async findUnique({ where }) {
        if (where.id !== "tool-1") {
          return null;
        }

        return {
          id: "tool-1",
          name: "Inversion",
          category: "transformative",
          purpose: "Challenge the default model by reversing core assumptions.",
          whenToUse: ["high market saturation", "weak differentiation"],
          whenNotToUse: ["problem statement unclear"],
          instructions: ["Identify the dominant operating assumption", "Reverse it"],
          expectedEffect: "Increase novelty and differentiation while preserving grounding.",
          status: "ACTIVE",
          version: 1,
          createdAt: "2026-04-06T08:00:00.000Z",
          updatedAt: "2026-04-06T08:30:00.000Z",
        };
      },
    },
    logEntry: {
      async create({ data }) {
        return { id: "log-1", ...data };
      },
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(request(app).get("/api/admin/conceptual-tools/tool-1"), {
    email: "ralfepoisson@gmail.com",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.id, "tool-1");
  assert.deepEqual(response.body.data.instructions, ["Identify the dominant operating assumption", "Reverse it"]);
});

test("POST /api/admin/conceptual-tools creates a conceptual tool and normalizes newline-delimited fields", async () => {
  const createdRecords = [];

  const prisma = {
    user: {
      upsert: async ({ create, update }) => ({
        id: "admin-user-1",
        email: create.email,
        displayName: update.displayName,
        appRole: "ADMIN",
      }),
    },
    conceptualTool: {
      async create({ data }) {
        const created = {
          id: "tool-1",
          createdAt: "2026-04-06T10:00:00.000Z",
          updatedAt: "2026-04-06T10:00:00.000Z",
          ...data,
        };
        createdRecords.push(created);
        return created;
      },
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(
    request(app).post("/api/admin/conceptual-tools").send({
      name: "Inversion",
      category: "transformative",
      purpose: "Challenge the default model by reversing core assumptions.",
      whenToUse: "high market saturation\n\nweak differentiation",
      whenNotToUse: "problem statement unclear",
      instructions:
        "Identify the dominant operating assumption\nReverse it\nExplore whether the reversed model creates a viable opportunity",
      expectedEffect: "Increase novelty and differentiation while preserving grounding.",
      status: "active",
      version: 1,
    }),
    { email: "ralfepoisson@gmail.com" },
  );

  assert.equal(response.statusCode, 201);
  assert.equal(createdRecords.length, 1);
  assert.deepEqual(createdRecords[0].whenToUse, ["high market saturation", "weak differentiation"]);
  assert.deepEqual(createdRecords[0].whenNotToUse, ["problem statement unclear"]);
  assert.deepEqual(createdRecords[0].instructions, [
    "Identify the dominant operating assumption",
    "Reverse it",
    "Explore whether the reversed model creates a viable opportunity",
  ]);
  assert.equal(createdRecords[0].status, "ACTIVE");
  assert.equal(response.body.data.name, "Inversion");
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "conceptual_tool_created"),
    true
  );
});

test("PUT /api/admin/conceptual-tools/:id updates a conceptual tool including activation state", async () => {
  const conceptualTools = [
    {
      id: "tool-1",
      name: "Inversion",
      category: "transformative",
      purpose: "Challenge the default model by reversing core assumptions.",
      whenToUse: ["high market saturation"],
      whenNotToUse: ["problem statement unclear"],
      instructions: ["Identify the dominant operating assumption"],
      expectedEffect: "Increase novelty and differentiation while preserving grounding.",
      status: "ACTIVE",
      version: 1,
      createdAt: "2026-04-06T08:00:00.000Z",
      updatedAt: "2026-04-06T08:30:00.000Z",
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
    conceptualTool: {
      async findUniqueOrThrow({ where }) {
        const record = conceptualTools.find((entry) => entry.id === where.id);
        if (!record) {
          throw new Error("not found");
        }
        return record;
      },
      async update({ where, data }) {
        const index = conceptualTools.findIndex((entry) => entry.id === where.id);
        conceptualTools[index] = {
          ...conceptualTools[index],
          ...data,
          updatedAt: "2026-04-06T11:00:00.000Z",
        };
        return conceptualTools[index];
      },
    },
    logEntry: {
      createCalls: [],
      async create({ data }) {
        this.createCalls.push(data);
        return { id: `log-${this.createCalls.length}`, ...data };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };

  const app = createApp({ prisma });
  const response = await withAuth(
    request(app).put("/api/admin/conceptual-tools/tool-1").send({
      whenToUse: ["high market saturation", "weak differentiation"],
      whenNotToUse: "problem statement unclear\nidea already validated by evidence",
      instructions: "Identify the dominant operating assumption\nReverse it",
      status: "inactive",
      version: 2,
    }),
    { email: "ralfepoisson@gmail.com" },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.status, "INACTIVE");
  assert.equal(response.body.data.version, 2);
  assert.deepEqual(response.body.data.whenNotToUse, [
    "problem statement unclear",
    "idea already validated by evidence",
  ]);
  assert.equal(
    prisma.logEntry.createCalls.some((entry) => entry.event === "conceptual_tool_updated"),
    true
  );
});
