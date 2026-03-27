const {
  ActorType,
  AgentConfidence,
  AgentRunStatus,
  BusinessType,
  DocumentStatus,
  DocumentType,
  MemberRole,
  MessageFormat,
  MessageStatus,
  RefinementState,
  SectionStatus,
  StageStatus,
  ThreadStatus,
  UnlockState,
  WorkspaceStage,
  WorkspaceStatus,
  WorkspaceType,
} = require("@prisma/client");
const { z } = require("zod");

const stringField = (max) => {
  const base = z.string().trim().min(1);
  return typeof max === "number" ? base.max(max) : base;
};

const nullableStringField = (max) => z.union([stringField(max), z.null()]);
const uuidField = () => z.string().uuid();
const jsonField = () => z.unknown();
const stringArrayField = (max) => z.array(stringField(max)).max(25);
const decimalField = () => z.union([z.number().finite(), z.string().trim().min(1)]);
const intField = () => z.number().int();
const dateTimeField = () => z.union([z.string().trim().min(1), z.date()]);
const supportedModelAliases = ["helmos-default", "helmos-research", "helmos-supervisor"];
const supportedToolNames = ["retrieval", "web_search", "object_storage", "communications"];
const modelField = () => z.enum(supportedModelAliases);
const nullableModelField = () => z.union([modelField(), z.null()]);
const toolArrayField = () => z.array(z.enum(supportedToolNames)).max(25);

const createSchema = (shape) => z.object(shape).strict();
const updateSchema = (shape) => z.object(shape).partial().strict();

const resourceConfigs = [
  {
    path: "users",
    model: "user",
    createSchema: createSchema({
      email: stringField(320).email(),
      displayName: stringField(200).optional(),
      avatarUrl: z.string().url().optional(),
      authProvider: stringField(50),
      authProviderUserId: stringField(255),
      lastSeenAt: dateTimeField().optional(),
      isActive: z.boolean().optional(),
    }),
    updateSchema: updateSchema({
      email: stringField(320).email(),
      displayName: nullableStringField(200),
      avatarUrl: z.union([z.string().url(), z.null()]),
      authProvider: stringField(50),
      authProviderUserId: stringField(255),
      lastSeenAt: z.union([dateTimeField(), z.null()]),
      isActive: z.boolean(),
    }),
    filterFields: ["email", "authProvider", "authProviderUserId", "isActive"],
    orderBy: { createdAt: "desc" },
  },
  {
    path: "organisations",
    model: "organisation",
    createSchema: createSchema({
      name: stringField(200),
      slug: stringField(120),
      createdByUserId: uuidField(),
    }),
    updateSchema: updateSchema({
      name: stringField(200),
      slug: stringField(120),
      createdByUserId: uuidField(),
    }),
    filterFields: ["slug", "createdByUserId"],
    orderBy: { createdAt: "desc" },
  },
  {
    path: "organisation-members",
    model: "organisationMember",
    createSchema: createSchema({
      organisationId: uuidField(),
      userId: uuidField(),
      role: z.nativeEnum(MemberRole),
    }),
    updateSchema: updateSchema({
      organisationId: uuidField(),
      userId: uuidField(),
      role: z.nativeEnum(MemberRole),
    }),
    filterFields: ["organisationId", "userId", "role"],
    orderBy: { createdAt: "desc" },
  },
  {
    path: "companies",
    model: "company",
    createSchema: createSchema({
      organisationId: uuidField(),
      name: stringField(200),
      businessType: z.nativeEnum(BusinessType).optional(),
      legalName: stringField(255).optional(),
      slug: stringField(120),
      industry: stringField(100).optional(),
      websiteUrl: z.string().url().optional(),
      description: z.string().trim().min(1).optional(),
      branding: jsonField().optional(),
      createdByUserId: uuidField(),
    }),
    updateSchema: updateSchema({
      organisationId: uuidField(),
      name: stringField(200),
      businessType: z.nativeEnum(BusinessType),
      legalName: nullableStringField(255),
      slug: stringField(120),
      industry: nullableStringField(100),
      websiteUrl: z.union([z.string().url(), z.null()]),
      description: z.union([z.string().trim().min(1), z.null()]),
      branding: z.union([jsonField(), z.null()]),
      createdByUserId: uuidField(),
    }),
    filterFields: ["organisationId", "businessType", "slug", "createdByUserId"],
    orderBy: { createdAt: "desc" },
  },
  {
    path: "workspaces",
    model: "workspace",
    createSchema: createSchema({
      companyId: uuidField(),
      name: stringField(200),
      workspaceType: z.nativeEnum(WorkspaceType).optional(),
      status: z.nativeEnum(WorkspaceStatus).optional(),
      currentStage: z.nativeEnum(WorkspaceStage).optional(),
      featureUnlocks: jsonField().optional(),
      createdByUserId: uuidField(),
      archivedAt: dateTimeField().optional(),
    }),
    updateSchema: updateSchema({
      companyId: uuidField(),
      name: stringField(200),
      workspaceType: z.nativeEnum(WorkspaceType),
      status: z.nativeEnum(WorkspaceStatus),
      currentStage: z.nativeEnum(WorkspaceStage),
      featureUnlocks: z.union([jsonField(), z.null()]),
      createdByUserId: uuidField(),
      archivedAt: z.union([dateTimeField(), z.null()]),
    }),
    filterFields: ["companyId", "workspaceType", "status", "currentStage", "createdByUserId"],
    orderBy: { updatedAt: "desc" },
  },
  {
    path: "strategy-documents",
    model: "strategyDocument",
    createSchema: createSchema({
      workspaceId: uuidField(),
      documentType: z.nativeEnum(DocumentType).optional(),
      title: stringField(255),
      status: z.nativeEnum(DocumentStatus).optional(),
      completenessPercent: decimalField().optional(),
      qualityState: stringField(50).optional(),
      agentSummary: z.string().trim().min(1).optional(),
    }),
    updateSchema: updateSchema({
      workspaceId: uuidField(),
      documentType: z.nativeEnum(DocumentType),
      title: stringField(255),
      status: z.nativeEnum(DocumentStatus),
      completenessPercent: decimalField(),
      qualityState: z.union([stringField(50), z.null()]),
      agentSummary: z.union([z.string().trim().min(1), z.null()]),
    }),
    filterFields: ["workspaceId", "documentType", "status"],
    orderBy: { updatedAt: "desc" },
  },
  {
    path: "strategy-sections",
    model: "strategySection",
    createSchema: createSchema({
      documentId: uuidField(),
      sectionKey: stringField(100),
      title: stringField(200),
      description: z.string().trim().min(1).optional(),
      displayOrder: intField(),
      content: z.string().optional(),
      status: z.nativeEnum(SectionStatus).optional(),
      refinementState: z.nativeEnum(RefinementState).optional(),
      agentConfidence: z.nativeEnum(AgentConfidence).optional(),
      completionPercent: decimalField().optional(),
      lastUpdatedByType: z.nativeEnum(ActorType).optional(),
      lastUpdatedByUserId: uuidField().optional(),
      lastUpdatedAt: dateTimeField().optional(),
      versionNo: intField().optional(),
      metadata: jsonField().optional(),
    }),
    updateSchema: updateSchema({
      documentId: uuidField(),
      sectionKey: stringField(100),
      title: stringField(200),
      description: z.union([z.string().trim().min(1), z.null()]),
      displayOrder: intField(),
      content: z.union([z.string(), z.null()]),
      status: z.nativeEnum(SectionStatus),
      refinementState: z.nativeEnum(RefinementState),
      agentConfidence: z.union([z.nativeEnum(AgentConfidence), z.null()]),
      completionPercent: decimalField(),
      lastUpdatedByType: z.nativeEnum(ActorType),
      lastUpdatedByUserId: z.union([uuidField(), z.null()]),
      lastUpdatedAt: z.union([dateTimeField(), z.null()]),
      versionNo: intField(),
      metadata: z.union([jsonField(), z.null()]),
    }),
    filterFields: ["documentId", "sectionKey", "status", "refinementState", "lastUpdatedByUserId"],
    orderBy: { displayOrder: "asc" },
  },
  {
    path: "section-versions",
    model: "sectionVersion",
    createSchema: createSchema({
      sectionId: uuidField(),
      versionNo: intField().optional(),
      content: z.string().optional(),
      changeSummary: z.string().trim().min(1).optional(),
      changedByType: z.nativeEnum(ActorType).optional(),
      changedByUserId: uuidField().optional(),
      agentRunId: uuidField().optional(),
      diffJson: jsonField().optional(),
    }),
    updateSchema: updateSchema({
      sectionId: uuidField(),
      versionNo: intField(),
      content: z.union([z.string(), z.null()]),
      changeSummary: z.union([z.string().trim().min(1), z.null()]),
      changedByType: z.nativeEnum(ActorType),
      changedByUserId: z.union([uuidField(), z.null()]),
      agentRunId: z.union([uuidField(), z.null()]),
      diffJson: z.union([jsonField(), z.null()]),
    }),
    filterFields: ["sectionId", "versionNo", "changedByType", "changedByUserId", "agentRunId"],
    orderBy: { versionNo: "desc" },
    beforeCreate: async ({ prisma, data }) => {
      if (typeof data.versionNo === "number") {
        return data;
      }

      const aggregate = await prisma.sectionVersion.aggregate({
        _max: {
          versionNo: true,
        },
        where: {
          sectionId: data.sectionId,
        },
      });

      return {
        ...data,
        versionNo: (aggregate._max.versionNo ?? 0) + 1,
      };
    },
  },
  {
    path: "document-insights",
    model: "documentInsight",
    createSchema: createSchema({
      documentId: uuidField(),
      insightType: stringField(50),
      title: stringField(255),
      body: z.string().trim().min(1),
      score: decimalField().optional(),
      severity: stringField(50).optional(),
      generatedByType: z.nativeEnum(ActorType).optional(),
      agentRunId: uuidField().optional(),
      isCurrent: z.boolean().optional(),
    }),
    updateSchema: updateSchema({
      documentId: uuidField(),
      insightType: stringField(50),
      title: stringField(255),
      body: z.string().trim().min(1),
      score: z.union([decimalField(), z.null()]),
      severity: z.union([stringField(50), z.null()]),
      generatedByType: z.nativeEnum(ActorType),
      agentRunId: z.union([uuidField(), z.null()]),
      isCurrent: z.boolean(),
    }),
    filterFields: ["documentId", "insightType", "severity", "generatedByType", "agentRunId", "isCurrent"],
    orderBy: { createdAt: "desc" },
  },
  {
    path: "stage-progress",
    model: "stageProgress",
    createSchema: createSchema({
      workspaceId: uuidField(),
      stageKey: z.nativeEnum(WorkspaceStage),
      displayOrder: intField(),
      status: z.nativeEnum(StageStatus),
      unlockState: z.nativeEnum(UnlockState).optional(),
      unlockReason: z.string().trim().min(1).optional(),
      completionPercent: decimalField().optional(),
      qualityChecks: jsonField().optional(),
      enteredAt: dateTimeField().optional(),
      completedAt: dateTimeField().optional(),
    }),
    updateSchema: updateSchema({
      workspaceId: uuidField(),
      stageKey: z.nativeEnum(WorkspaceStage),
      displayOrder: intField(),
      status: z.nativeEnum(StageStatus),
      unlockState: z.nativeEnum(UnlockState),
      unlockReason: z.union([z.string().trim().min(1), z.null()]),
      completionPercent: decimalField(),
      qualityChecks: z.union([jsonField(), z.null()]),
      enteredAt: z.union([dateTimeField(), z.null()]),
      completedAt: z.union([dateTimeField(), z.null()]),
    }),
    filterFields: ["workspaceId", "stageKey", "status", "unlockState"],
    orderBy: { displayOrder: "asc" },
  },
  {
    path: "chat-threads",
    model: "chatThread",
    createSchema: createSchema({
      workspaceId: uuidField(),
      documentId: uuidField().optional(),
      title: stringField(255).optional(),
      status: z.nativeEnum(ThreadStatus).optional(),
      createdByUserId: uuidField().optional(),
    }),
    updateSchema: updateSchema({
      workspaceId: uuidField(),
      documentId: z.union([uuidField(), z.null()]),
      title: z.union([stringField(255), z.null()]),
      status: z.nativeEnum(ThreadStatus),
      createdByUserId: z.union([uuidField(), z.null()]),
    }),
    filterFields: ["workspaceId", "documentId", "status", "createdByUserId"],
    orderBy: { updatedAt: "desc" },
  },
  {
    path: "chat-messages",
    model: "chatMessage",
    createSchema: createSchema({
      threadId: uuidField(),
      messageIndex: intField().optional(),
      senderType: z.nativeEnum(ActorType),
      senderUserId: uuidField().optional(),
      messageText: z.string().trim().min(1),
      messageFormat: z.nativeEnum(MessageFormat).optional(),
      clientGeneratedId: stringField(100).optional(),
      status: z.nativeEnum(MessageStatus).optional(),
      metadata: jsonField().optional(),
    }),
    updateSchema: updateSchema({
      threadId: uuidField(),
      messageIndex: intField(),
      senderType: z.nativeEnum(ActorType),
      senderUserId: z.union([uuidField(), z.null()]),
      messageText: z.string().trim().min(1),
      messageFormat: z.nativeEnum(MessageFormat),
      clientGeneratedId: z.union([stringField(100), z.null()]),
      status: z.nativeEnum(MessageStatus),
      metadata: z.union([jsonField(), z.null()]),
    }),
    filterFields: ["threadId", "messageIndex", "senderType", "senderUserId", "status", "clientGeneratedId"],
    orderBy: { messageIndex: "asc" },
    beforeCreate: async ({ prisma, data }) => {
      if (typeof data.messageIndex === "number") {
        return data;
      }

      const aggregate = await prisma.chatMessage.aggregate({
        _max: {
          messageIndex: true,
        },
        where: {
          threadId: data.threadId,
        },
      });

      return {
        ...data,
        messageIndex: (aggregate._max.messageIndex ?? 0) + 1,
      };
    },
  },
  {
    path: "agent-runs",
    model: "agentRun",
    createSchema: createSchema({
      threadId: uuidField(),
      triggerMessageId: uuidField().optional(),
      runStatus: z.nativeEnum(AgentRunStatus).optional(),
      modelName: stringField(100).optional(),
      startedAt: dateTimeField().optional(),
      completedAt: dateTimeField().optional(),
      inputTokens: intField().optional(),
      outputTokens: intField().optional(),
      summary: z.string().trim().min(1).optional(),
      errorMessage: z.string().trim().min(1).optional(),
      resultMetadata: jsonField().optional(),
    }),
    updateSchema: updateSchema({
      threadId: uuidField(),
      triggerMessageId: z.union([uuidField(), z.null()]),
      runStatus: z.nativeEnum(AgentRunStatus),
      modelName: z.union([stringField(100), z.null()]),
      startedAt: z.union([dateTimeField(), z.null()]),
      completedAt: z.union([dateTimeField(), z.null()]),
      inputTokens: z.union([intField(), z.null()]),
      outputTokens: z.union([intField(), z.null()]),
      summary: z.union([z.string().trim().min(1), z.null()]),
      errorMessage: z.union([z.string().trim().min(1), z.null()]),
      resultMetadata: z.union([jsonField(), z.null()]),
    }),
    filterFields: ["threadId", "triggerMessageId", "runStatus", "modelName"],
    orderBy: { startedAt: "desc" },
  },
  {
    path: "agent-run-effects",
    model: "agentRunEffect",
    createSchema: createSchema({
      agentRunId: uuidField(),
      effectType: stringField(50),
      targetEntityType: stringField(50),
      targetEntityId: uuidField().optional(),
      details: jsonField().optional(),
    }),
    updateSchema: updateSchema({
      agentRunId: uuidField(),
      effectType: stringField(50),
      targetEntityType: stringField(50),
      targetEntityId: z.union([uuidField(), z.null()]),
      details: z.union([jsonField(), z.null()]),
    }),
    filterFields: ["agentRunId", "effectType", "targetEntityType", "targetEntityId"],
    orderBy: { createdAt: "desc" },
  },
  {
    path: "agent-definitions",
    model: "agentDefinition",
    createSchema: createSchema({
      key: stringField(100),
      name: stringField(255),
      version: stringField(50),
      description: z.string().trim().min(1).optional(),
      allowedTools: toolArrayField().optional(),
      defaultModel: modelField().optional(),
      active: z.boolean().optional(),
    }),
    updateSchema: updateSchema({
      key: stringField(100),
      name: stringField(255),
      version: stringField(50),
      description: z.union([z.string().trim().min(1), z.null()]),
      allowedTools: toolArrayField(),
      defaultModel: nullableModelField(),
      active: z.boolean(),
    }),
    filterFields: ["key", "version", "defaultModel", "active"],
    orderBy: { key: "asc" },
  },
  {
    path: "prompt-configs",
    model: "promptConfig",
    createSchema: createSchema({
      key: stringField(100),
      version: stringField(50),
      promptTemplate: z.string().trim().min(1),
      configJson: jsonField().optional(),
      active: z.boolean().optional(),
    }),
    updateSchema: updateSchema({
      key: stringField(100),
      version: stringField(50),
      promptTemplate: z.string().trim().min(1),
      configJson: z.union([jsonField(), z.null()]),
      active: z.boolean(),
    }),
    filterFields: ["key", "version", "active"],
    orderBy: { updatedAt: "desc" },
  },
  {
    path: "activity-log",
    model: "activityLog",
    createSchema: createSchema({
      workspaceId: uuidField(),
      actorType: z.nativeEnum(ActorType).optional(),
      actorUserId: uuidField().optional(),
      eventType: stringField(100),
      entityType: stringField(50).optional(),
      entityId: uuidField().optional(),
      eventSummary: z.string().trim().min(1).optional(),
      payload: jsonField().optional(),
    }),
    updateSchema: updateSchema({
      workspaceId: uuidField(),
      actorType: z.nativeEnum(ActorType),
      actorUserId: z.union([uuidField(), z.null()]),
      eventType: stringField(100),
      entityType: z.union([stringField(50), z.null()]),
      entityId: z.union([uuidField(), z.null()]),
      eventSummary: z.union([z.string().trim().min(1), z.null()]),
      payload: z.union([jsonField(), z.null()]),
    }),
    filterFields: ["workspaceId", "actorType", "actorUserId", "eventType", "entityType", "entityId"],
    orderBy: { createdAt: "desc" },
  },
];

const prismaEnums = {
  ActorType,
  AgentConfidence,
  AgentRunStatus,
  BusinessType,
  DocumentStatus,
  DocumentType,
  MemberRole,
  MessageFormat,
  MessageStatus,
  RefinementState,
  SectionStatus,
  StageStatus,
  ThreadStatus,
  UnlockState,
  WorkspaceStage,
  WorkspaceStatus,
  WorkspaceType,
};

module.exports = {
  resourceConfigs,
  prismaEnums,
};
