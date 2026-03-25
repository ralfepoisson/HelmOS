const { ActorType, BusinessType, MessageFormat, MessageStatus, WorkspaceStage } = require("@prisma/client");

const DEFAULT_FOUNDER_EMAIL = "founder@helmos.local";
const DEFAULT_FOUNDER_AUTH_PROVIDER = "development";
const DEFAULT_FOUNDER_AUTH_PROVIDER_USER_ID = "default-founder";
const DEFAULT_ORGANISATION_SLUG = "default-organisation";
const DEFAULT_ORGANISATION_NAME = "HelmOS Workspace";

const IDEATION_SECTION_SEEDS = [
  {
    sectionKey: "problem_statement",
    title: "Problem Statement",
    description: "Describe the pain, inefficiency, or unmet need the business should solve.",
    displayOrder: 1,
    emphasis: "primary",
  },
  {
    sectionKey: "target_customer",
    title: "Target Customer",
    description: "Clarify the first users or buyers who feel this problem most acutely.",
    displayOrder: 2,
    emphasis: "primary",
  },
  {
    sectionKey: "value_proposition",
    title: "Value Proposition",
    description: "Explain why this concept is useful and what meaningful outcome it creates.",
    displayOrder: 3,
    emphasis: "primary",
  },
];

const STAGE_SEEDS = [
  { stageKey: WorkspaceStage.IDEATION, displayOrder: 1, status: "CURRENT", unlockState: "UNLOCKED" },
  { stageKey: WorkspaceStage.VALUE_PROPOSITION, displayOrder: 2, status: "LOCKED", unlockState: "LOCKED" },
  { stageKey: WorkspaceStage.CUSTOMER_SEGMENTS, displayOrder: 3, status: "LOCKED", unlockState: "LOCKED" },
  { stageKey: WorkspaceStage.BUSINESS_MODEL, displayOrder: 4, status: "LOCKED", unlockState: "LOCKED" },
  { stageKey: WorkspaceStage.MARKET_RESEARCH, displayOrder: 5, status: "LOCKED", unlockState: "LOCKED" },
];

const BUSINESS_TYPE_LABELS = {
  [BusinessType.PRODUCT]: "Product",
  [BusinessType.SERVICE]: "Service",
  [BusinessType.RESEARCH_AND_DEVELOPMENT]: "R&D",
  [BusinessType.MARKETPLACE]: "Marketplace",
  [BusinessType.PLATFORM]: "Platform",
  [BusinessType.AGENCY]: "Agency",
  [BusinessType.OTHER]: "Mixture",
};

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function buildUniqueCompanySlug(tx, name) {
  const baseSlug = slugify(name) || "business-idea";
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await tx.company.findFirst({
      select: { id: true },
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function formatTimestamp(date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function getReadinessLabel(completeness) {
  if (completeness >= 80) {
    return { readinessLabel: "Ready for next tool", readinessTone: "info" };
  }

  if (completeness >= 45) {
    return { readinessLabel: "Needs refinement", readinessTone: "warning" };
  }

  return { readinessLabel: "In progress", readinessTone: "info" };
}

function mapSectionStatus(section) {
  if (section.refinementState === "STRONG") {
    return { statusLabel: "Strong", statusTone: "success" };
  }

  if (section.refinementState === "NEEDS_REFINEMENT") {
    return { statusLabel: "Needs refinement", statusTone: "warning" };
  }

  if (section.refinementState === "EMPTY" && Number(section.completionPercent ?? 0) === 0) {
    return { statusLabel: "Too vague", statusTone: "muted" };
  }

  return { statusLabel: "Draft", statusTone: "info" };
}

function mapConfidence(section) {
  if (section.agentConfidence === "HIGH") {
    return "high";
  }

  if (section.agentConfidence === "LOW") {
    return "low";
  }

  return "medium";
}

function mapOverview(document, sections, company) {
  const completeness = Number(document?.completenessPercent ?? 0);
  const readiness = getReadinessLabel(completeness);
  const completedSections = sections.filter((section) => Number(section.completionPercent ?? 0) > 0).length;
  const totalSections = sections.length || 1;

  return {
    completeness,
    ...readiness,
    nextAction:
      completedSections === 0
        ? `Start by defining the core problem ${company.name} should solve before expanding into customer and value framing.`
        : `Refine the weakest ideation section so the problem, customer, and promise connect more clearly.`,
    completionSummary:
      completedSections === 0
        ? "No ideation sections have been developed yet. Begin with the problem statement to anchor the rest of the strategy."
        : `${completedSections} of ${totalSections} ideation sections now contain working content. Keep sharpening the weak spots before unlocking the next tool.`,
  };
}

function mapStrategyCopilot(workspaceRecord) {
  const document = workspaceRecord.documents[0] ?? null;
  const sections = (document?.sections ?? []).map((section) => {
    const sectionStatus = mapSectionStatus(section);
    const updatedAt = section.lastUpdatedAt ?? section.updatedAt ?? workspaceRecord.updatedAt;
    const updatedBy =
      section.lastUpdatedByType === ActorType.USER ? "You" : "HelmOS Agent";

    return {
      id: section.id,
      title: section.title,
      helper: section.description ?? "Continue refining this section with the agent.",
      content: section.content ?? "No draft yet. Use the agent to turn the first assumptions into a working section draft.",
      emphasis: (section.metadata?.emphasis ?? "secondary") === "primary" ? "primary" : "secondary",
      ...sectionStatus,
      confidence: mapConfidence(section),
      updatedAgo: updatedAt ? `${formatTimestamp(new Date(updatedAt))} UTC` : "Just now",
      updatedBy,
      recentlyUpdated: sectionStatus.statusTone === "warning",
    };
  });

  const messages = (workspaceRecord.chatThreads[0]?.messages ?? []).map((message, index) => ({
    id: index + 1,
    role: message.senderType === ActorType.USER ? "user" : "agent",
    author: message.senderType === ActorType.USER ? "You" : "HelmOS Agent",
    content: message.messageText,
    timestamp: formatTimestamp(new Date(message.createdAt)),
  }));

  const company = workspaceRecord.company;
  const overview = mapOverview(document, document?.sections ?? [], company);

  return {
    workspaceOption: {
      id: workspaceRecord.id,
      name: company.name,
      businessType: company.businessType,
      businessTypeLabel: BUSINESS_TYPE_LABELS[company.businessType],
    },
    workspace: {
      pageTitle: `Ideation: ${company.name}`,
      pageStatus: `${BUSINESS_TYPE_LABELS[company.businessType]} business idea`,
      completionHintTitle: "Next strategy step is waiting",
      completionHint:
        "When the concept becomes more consistent and evidence-backed, HelmOS can unlock Value Proposition design and recommend the next structured strategy tool.",
      overview,
      sections,
    },
    chat: {
      panelTitle: "HelmOS Agent",
      panelSubtitle: "Guided strategy collaboration",
      placeholder: "Ask the agent to refine, challenge, or summarise your concept...",
      messages,
    },
  };
}

async function ensureDefaultWorkspaceContext(tx) {
  const founder = await tx.user.upsert({
    where: {
      email: DEFAULT_FOUNDER_EMAIL,
    },
    update: {
      displayName: "Founder",
      isActive: true,
    },
    create: {
      email: DEFAULT_FOUNDER_EMAIL,
      displayName: "Founder",
      authProvider: DEFAULT_FOUNDER_AUTH_PROVIDER,
      authProviderUserId: DEFAULT_FOUNDER_AUTH_PROVIDER_USER_ID,
    },
  });

  const organisation = await tx.organisation.upsert({
    where: {
      slug: DEFAULT_ORGANISATION_SLUG,
    },
    update: {
      name: DEFAULT_ORGANISATION_NAME,
      createdByUserId: founder.id,
    },
    create: {
      name: DEFAULT_ORGANISATION_NAME,
      slug: DEFAULT_ORGANISATION_SLUG,
      createdByUserId: founder.id,
    },
  });

  await tx.organisationMember.upsert({
    where: {
      organisationId_userId: {
        organisationId: organisation.id,
        userId: founder.id,
      },
    },
    update: {
      role: "OWNER",
    },
    create: {
      organisationId: organisation.id,
      userId: founder.id,
      role: "OWNER",
    },
  });

  return {
    founder,
    organisation,
  };
}

async function createBusinessIdea(prisma, input) {
  return prisma.$transaction(async (tx) => {
    const { founder, organisation } = await ensureDefaultWorkspaceContext(tx);
    const slug = await buildUniqueCompanySlug(tx, input.name);

    const company = await tx.company.create({
      data: {
        organisationId: organisation.id,
        name: input.name,
        businessType: input.businessType,
        slug,
        industry: BUSINESS_TYPE_LABELS[input.businessType],
        createdByUserId: founder.id,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        companyId: company.id,
        name: input.name,
        createdByUserId: founder.id,
      },
    });

    const document = await tx.strategyDocument.create({
      data: {
        workspaceId: workspace.id,
        title: `Ideation: ${input.name}`,
        qualityState: "IN_PROGRESS",
        agentSummary: `A new ${BUSINESS_TYPE_LABELS[input.businessType].toLowerCase()} business idea has been created. Start by clarifying the problem statement.`,
      },
    });

    for (const sectionSeed of IDEATION_SECTION_SEEDS) {
      await tx.strategySection.create({
        data: {
          documentId: document.id,
          sectionKey: sectionSeed.sectionKey,
          title: sectionSeed.title,
          description: sectionSeed.description,
          displayOrder: sectionSeed.displayOrder,
          content: null,
          metadata: {
            emphasis: sectionSeed.emphasis,
          },
        },
      });
    }

    for (const stageSeed of STAGE_SEEDS) {
      await tx.stageProgress.create({
        data: {
          workspaceId: workspace.id,
          stageKey: stageSeed.stageKey,
          displayOrder: stageSeed.displayOrder,
          status: stageSeed.status,
          unlockState: stageSeed.unlockState,
          unlockReason:
            stageSeed.stageKey === WorkspaceStage.IDEATION
              ? "Ideation is the active starting stage."
              : "Unlocks once the ideation draft is mature enough for the next strategy tool.",
          enteredAt: stageSeed.stageKey === WorkspaceStage.IDEATION ? new Date() : null,
        },
      });
    }

    const thread = await tx.chatThread.create({
      data: {
        workspaceId: workspace.id,
        documentId: document.id,
        title: "Ideation thread",
        createdByUserId: founder.id,
      },
    });

    await tx.chatMessage.create({
      data: {
        threadId: thread.id,
        messageIndex: 1,
        senderType: ActorType.AGENT,
        messageText: `Let's shape ${input.name}. What problem should this ${BUSINESS_TYPE_LABELS[input.businessType].toLowerCase()} business solve first?`,
        messageFormat: MessageFormat.MARKDOWN,
        status: MessageStatus.SENT,
      },
    });

    await tx.activityLog.create({
      data: {
        workspaceId: workspace.id,
        actorType: ActorType.USER,
        actorUserId: founder.id,
        eventType: "business_idea_created",
        entityType: "workspace",
        entityId: workspace.id,
        eventSummary: `Created business idea "${input.name}"`,
        payload: {
          companyId: company.id,
          businessType: input.businessType,
        },
      },
    });

    const workspaceRecord = await tx.workspace.findUniqueOrThrow({
      where: { id: workspace.id },
      include: {
        company: true,
        documents: {
          include: {
            sections: {
              include: {
                lastUpdatedBy: true,
              },
              orderBy: {
                displayOrder: "asc",
              },
            },
          },
        },
        chatThreads: {
          where: { status: "ACTIVE" },
          include: {
            messages: {
              orderBy: {
                messageIndex: "asc",
              },
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
      },
    });

    return mapStrategyCopilot(workspaceRecord);
  });
}

async function listBusinessIdeas(prisma) {
  const workspaces = await prisma.workspace.findMany({
    include: {
      company: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.company.name,
    businessType: workspace.company.businessType,
    businessTypeLabel: BUSINESS_TYPE_LABELS[workspace.company.businessType],
    updatedAt: workspace.updatedAt,
  }));
}

async function getBusinessIdea(prisma, workspaceId) {
  const workspaceRecord = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: {
      company: true,
      documents: {
        include: {
          sections: {
            include: {
              lastUpdatedBy: true,
            },
            orderBy: {
              displayOrder: "asc",
            },
          },
        },
      },
      chatThreads: {
        where: { status: "ACTIVE" },
        include: {
          messages: {
            orderBy: {
              messageIndex: "asc",
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 1,
      },
    },
  });

  return mapStrategyCopilot(workspaceRecord);
}

module.exports = {
  BUSINESS_TYPE_LABELS,
  createBusinessIdea,
  getBusinessIdea,
  listBusinessIdeas,
};
