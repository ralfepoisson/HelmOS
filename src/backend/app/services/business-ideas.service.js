const {
  ActorType,
  AgentConfidence,
  AgentRunStatus,
  BusinessType,
  MessageFormat,
  MessageStatus,
  RefinementState,
  SectionStatus,
  StageStatus,
  UnlockState,
  WorkspaceStage,
} = require("@prisma/client");
const { createHttpError } = require("../api/auth");
const { createLogEntry } = require("./log-entry.service");

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

const IDEATION_SECTION_BLUEPRINTS = [
  ...IDEATION_SECTION_SEEDS,
  {
    sectionKey: "product_service_description",
    title: "Product / Service Description",
    description: "Summarise what the product does today and what the user experiences on the platform.",
    displayOrder: 4,
    emphasis: "secondary",
  },
  {
    sectionKey: "differentiation",
    title: "Differentiation",
    description: "Note what makes this offer distinct from consultants, canvases, or generic AI tools.",
    displayOrder: 5,
    emphasis: "secondary",
  },
  {
    sectionKey: "early_monetisation_idea",
    title: "Early Monetisation Idea",
    description: "Capture the first revenue model assumptions, even if they are tentative.",
    displayOrder: 6,
    emphasis: "secondary",
  },
];

const IDEATION_SECTION_BLUEPRINT_BY_KEY = new Map(
  IDEATION_SECTION_BLUEPRINTS.map((section) => [section.sectionKey, section])
);

const IDEATION_PAYLOAD_FIELD_TO_SECTION_KEY = {
  problem_statement: "problem_statement",
  target_customer: "target_customer",
  value_proposition: "value_proposition",
  "Value Proposition": "value_proposition",
  product_service_description: "product_service_description",
  differentiation: "differentiation",
  early_monitization_idea: "early_monetisation_idea",
  early_monetization_idea: "early_monetisation_idea",
};

const VALUE_PROPOSITION_SECTION_SEEDS = [
  {
    sectionKey: "customer_segments",
    title: "Customer Segments",
    description: "Identify the most specific customer groups this canvas is designed around.",
    displayOrder: 1,
    emphasis: "primary",
  },
  {
    sectionKey: "customer_jobs",
    title: "Customer Jobs",
    description: "Capture the functional, emotional, and social jobs the customer is trying to get done.",
    displayOrder: 2,
    emphasis: "primary",
  },
  {
    sectionKey: "customer_pains",
    title: "Customer Pains",
    description: "List the frictions, risks, blockers, and frustrations that slow the customer down.",
    displayOrder: 3,
    emphasis: "primary",
  },
  {
    sectionKey: "customer_gains",
    title: "Customer Gains",
    description: "Describe the outcomes, benefits, and aspirations the customer values most.",
    displayOrder: 4,
    emphasis: "primary",
  },
];

const VALUE_PROPOSITION_SECTION_BLUEPRINTS = [
  ...VALUE_PROPOSITION_SECTION_SEEDS,
  {
    sectionKey: "products_services",
    title: "Products & Services",
    description: "Outline the products or services that create value for this customer.",
    displayOrder: 5,
    emphasis: "secondary",
  },
  {
    sectionKey: "pain_relievers",
    title: "Pain Relievers",
    description: "Explain how the offer reduces or removes the most meaningful customer pains.",
    displayOrder: 6,
    emphasis: "secondary",
  },
  {
    sectionKey: "gain_creators",
    title: "Gain Creators",
    description: "Show how the offer creates the gains the customer actually cares about.",
    displayOrder: 7,
    emphasis: "secondary",
  },
  {
    sectionKey: "fit_assessment",
    title: "Fit Assessment",
    description: "Summarise the strength of customer clarity, value definition, and fit consistency.",
    displayOrder: 8,
    emphasis: "secondary",
  },
  {
    sectionKey: "analysis",
    title: "Analysis",
    description: "Call out the weakest area, issues, inconsistencies, and the highest-value recommendations.",
    displayOrder: 9,
    emphasis: "secondary",
  },
];

const VALUE_PROPOSITION_SECTION_BLUEPRINT_BY_KEY = new Map(
  VALUE_PROPOSITION_SECTION_BLUEPRINTS.map((section) => [section.sectionKey, section])
);

const VALUE_PROPOSITION_PAYLOAD_FIELD_TO_SECTION_KEY = {
  customer_segments: "customer_segments",
  customer_jobs: "customer_jobs",
  customer_pains: "customer_pains",
  customer_gains: "customer_gains",
  products_services: "products_services",
  pain_relievers: "pain_relievers",
  gain_creators: "gain_creators",
  fit_assessment: "fit_assessment",
  analysis: "analysis",
};

const DOCUMENT_TYPES = {
  IDEATION: "IDEATION",
  VALUE_PROPOSITION: "VALUE_PROPOSITION",
};

const SECTION_UI_IDS = {
  problem_statement: "problem-statement",
  target_customer: "target-customer",
  value_proposition: "value-proposition",
  product_service_description: "product-service-description",
  differentiation: "differentiation",
  early_monetisation_idea: "early-monetisation-idea",
  customer_segments: "customer-segments",
  customer_jobs: "customer-jobs",
  customer_pains: "customer-pains",
  customer_gains: "customer-gains",
  products_services: "products-services",
  pain_relievers: "pain-relievers",
  gain_creators: "gain-creators",
  fit_assessment: "fit-assessment",
  analysis: "analysis",
};

const STRATEGY_TOOL_DEFINITIONS = {
  ideation: {
    toolId: "ideation",
    agentKey: "ideation",
    requestType: "ideation_chat",
    documentType: DOCUMENT_TYPES.IDEATION,
    stageKey: WorkspaceStage.IDEATION,
    threadTitle: "Ideation thread",
    pageTitlePrefix: "Ideation",
    pageDescription:
      "Shape the business concept in conversation with the agent. Each section is editable and evolves as the discussion becomes more concrete.",
    panelTitle: "HelmOS Agent",
    panelSubtitle: "Guided strategy collaboration",
    placeholder: "Ask the agent to refine, challenge, or summarise your concept...",
    completionMetricLabel: "Ideation completeness",
    sectionSeeds: IDEATION_SECTION_SEEDS,
    sectionBlueprints: IDEATION_SECTION_BLUEPRINTS,
    sectionBlueprintByKey: IDEATION_SECTION_BLUEPRINT_BY_KEY,
    stageLockedHint:
      "When the concept becomes more consistent and evidence-backed, HelmOS can unlock Value Proposition design and recommend the next structured strategy tool.",
    stageUnlockedHint:
      "HelmOS has unlocked the next structured strategy tools for this business idea. You can continue from ideation into Value Proposition and the other downstream strategy views.",
  },
  "value-proposition": {
    toolId: "value-proposition",
    agentKey: "value_proposition",
    requestType: "value_proposition_chat",
    documentType: DOCUMENT_TYPES.VALUE_PROPOSITION,
    stageKey: WorkspaceStage.VALUE_PROPOSITION,
    threadTitle: "Value Proposition thread",
    pageTitlePrefix: "Value Proposition",
    pageDescription:
      "Build a rigorous Value Proposition Canvas by clarifying customer jobs, pains, gains, and how the offer creates measurable fit.",
    panelTitle: "Value Proposition Agent",
    panelSubtitle: "Canvas design collaboration",
    placeholder: "Ask the agent to tighten the canvas, challenge weak fit, or sharpen customer-value alignment...",
    completionMetricLabel: "Canvas quality",
    sectionSeeds: VALUE_PROPOSITION_SECTION_SEEDS,
    sectionBlueprints: VALUE_PROPOSITION_SECTION_BLUEPRINTS,
    sectionBlueprintByKey: VALUE_PROPOSITION_SECTION_BLUEPRINT_BY_KEY,
    stageLockedHint:
      "This tool opens once the ideation draft is strong enough. Use ideation to tighten the problem, customer, and value proposition first.",
    stageUnlockedHint:
      "Use this canvas to test whether the value you plan to create really matches customer jobs, pains, and gains.",
  },
};

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

const TERMINAL_GATEWAY_STATUSES = new Set(["completed", "failed", "cancelled", "waiting_for_approval"]);
const STRATEGY_DOCUMENT_QUALITY_STATE_MAX_LENGTH = 50;
const STRATEGY_TOOLS_UNLOCK_REASON =
  "Unlocked after the ideation agent marked the idea ready for the next strategy tool.";
const UNLOCKABLE_STAGE_KEYS = [
  WorkspaceStage.VALUE_PROPOSITION,
  WorkspaceStage.CUSTOMER_SEGMENTS,
  WorkspaceStage.BUSINESS_MODEL,
  WorkspaceStage.MARKET_RESEARCH,
];
const STAGE_KEY_TO_TOOL_ID = new Map([
  [WorkspaceStage.IDEATION, "ideation"],
  [WorkspaceStage.VALUE_PROPOSITION, "value-proposition"],
  [WorkspaceStage.CUSTOMER_SEGMENTS, "customer-segments"],
  [WorkspaceStage.BUSINESS_MODEL, "business-model"],
  [WorkspaceStage.MARKET_RESEARCH, "market-research"],
]);

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function normalizeGatewayStatus(status) {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

function clampString(value, maxLength) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!Number.isInteger(maxLength) || maxLength <= 0 || trimmed.length <= maxLength) {
    return trimmed;
  }

  if (maxLength <= 3) {
    return trimmed.slice(0, maxLength);
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function normalizeReadinessToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isStrategyToolsUnlocked(workspaceRecord) {
  if (workspaceRecord?.featureUnlocks?.strategyTools?.enabled === true) {
    return true;
  }

  return (workspaceRecord?.stageProgress ?? []).some(
    (stage) => stage.stageKey !== WorkspaceStage.IDEATION && stage.unlockState === UnlockState.UNLOCKED
  );
}

function buildFeatureUnlocks(existingFeatureUnlocks, { unlockStrategyTools = false } = {}) {
  const base =
    existingFeatureUnlocks && typeof existingFeatureUnlocks === "object" && !Array.isArray(existingFeatureUnlocks)
      ? existingFeatureUnlocks
      : {};
  const existingStrategyTools =
    base.strategyTools && typeof base.strategyTools === "object" && !Array.isArray(base.strategyTools)
      ? base.strategyTools
      : {};

  if (unlockStrategyTools || existingStrategyTools.enabled === true) {
    return {
      ...base,
      strategyTools: {
        ...existingStrategyTools,
        enabled: true,
        unlockedAt: existingStrategyTools.unlockedAt ?? new Date().toISOString(),
        source: existingStrategyTools.source ?? "ideation_agent",
      },
    };
  }

  return {
    ...base,
    strategyTools: {
      ...existingStrategyTools,
      enabled: false,
      unlockedAt: existingStrategyTools.unlockedAt ?? null,
      source: existingStrategyTools.source ?? null,
    },
  };
}

function getAvailableToolIds(workspaceRecord) {
  const availableToolIds = ["ideation"];

  if (isStrategyToolsUnlocked(workspaceRecord)) {
    for (const stageKey of UNLOCKABLE_STAGE_KEYS) {
      const toolId = STAGE_KEY_TO_TOOL_ID.get(stageKey);
      if (toolId) {
        availableToolIds.push(toolId);
      }
    }
  }

  return availableToolIds;
}

function getToolDefinition(toolId) {
  return STRATEGY_TOOL_DEFINITIONS[toolId] ?? STRATEGY_TOOL_DEFINITIONS.ideation;
}

function findDocumentByType(workspaceRecord, documentType) {
  return (workspaceRecord?.documents ?? []).find((document) => document.documentType === documentType) ?? null;
}

function findThreadForDocument(workspaceRecord, documentId) {
  return (workspaceRecord?.chatThreads ?? []).find((thread) => thread.documentId === documentId) ?? null;
}

function formatMarkdownList(items, { empty = "No draft yet." } = {}) {
  const normalizedItems = Array.isArray(items)
    ? items.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

  if (normalizedItems.length === 0) {
    return empty;
  }

  return normalizedItems.map((item) => `- ${item}`).join("\n");
}

function buildDefaultOrganisationSlug(currentUser) {
  return `workspace-${slugify(currentUser.email || currentUser.id)}-${currentUser.id}`.slice(0, 120);
}

function buildDefaultOrganisationName(currentUser) {
  const ownerLabel = currentUser.displayName?.trim() || currentUser.email || "Workspace";
  return `${ownerLabel} Workspace`.slice(0, 200);
}

function assertWorkspaceAccess(workspaceRecord, currentUser) {
  if (!currentUser || workspaceRecord.createdByUserId !== currentUser.id) {
    throw createHttpError(403, "You do not have access to this workspace");
  }
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

function getReadinessLabel({ completeness, qualityState, strategyToolsUnlocked }) {
  if (strategyToolsUnlocked) {
    return { readinessLabel: "Ready for next tool", readinessTone: "success" };
  }

  const normalizedQualityState = normalizeReadinessToken(qualityState);
  if (normalizedQualityState === "ready for next tool") {
    return { readinessLabel: "Ready for next tool", readinessTone: "success" };
  }

  if (normalizedQualityState === "needs refinement") {
    return { readinessLabel: "Needs refinement", readinessTone: "warning" };
  }

  if (normalizedQualityState === "in progress") {
    return { readinessLabel: "In progress", readinessTone: "info" };
  }

  if (completeness >= 80) {
    return { readinessLabel: "Ready for next tool", readinessTone: "success" };
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

function mapOverview(document, sections, company, workspaceRecord, toolId) {
  const completeness = Number(document?.completenessPercent ?? 0);
  const strategyToolsUnlocked = isStrategyToolsUnlocked(workspaceRecord);
  const readiness = getReadinessLabel({
    completeness,
    qualityState: document?.qualityState,
    strategyToolsUnlocked,
  });
  const completedSections = sections.filter((section) => Number(section.completionPercent ?? 0) > 0).length;
  const totalSections = sections.length || 1;

  return {
    completeness,
    ...readiness,
    nextAction:
      toolId === "value-proposition"
        ? completedSections === 0
          ? `Start by defining the most important customer segment for ${company.name}, then map the jobs, pains, and gains that matter most.`
          : `Strengthen the weakest part of the canvas so the customer profile and value map fit more tightly together.`
        : strategyToolsUnlocked
          ? "Open the Value Proposition tool to turn this ideation draft into a sharper strategic narrative."
          : completedSections === 0
            ? `Start by defining the core problem ${company.name} should solve before expanding into customer and value framing.`
            : `Refine the weakest ideation section so the problem, customer, and promise connect more clearly.`,
    completionSummary:
      toolId === "value-proposition"
        ? completedSections === 0
          ? "This value proposition canvas is still empty. Start with the customer profile before drafting the value map."
          : `${completedSections} of ${totalSections} value proposition sections contain working content. Keep refining the weak fit areas.`
        : strategyToolsUnlocked
          ? "The ideation agent marked this business idea ready, so the next structured strategy tools are now unlocked."
          : completedSections === 0
            ? "No ideation sections have been developed yet. Begin with the problem statement to anchor the rest of the strategy."
            : `${completedSections} of ${totalSections} ideation sections now contain working content. Keep sharpening the weak spots before unlocking the next tool.`,
  };
}

function mapSectionUiId(sectionKey) {
  return SECTION_UI_IDS[sectionKey] ?? sectionKey.replace(/_/g, "-");
}

function normalizeIdeationPayload(rawPayload) {
  if (typeof rawPayload === "string") {
    try {
      return normalizeIdeationPayload(JSON.parse(rawPayload));
    } catch {
      return {};
    }
  }

  if (!rawPayload || typeof rawPayload !== "object") {
    return {};
  }

  return rawPayload;
}

function normalizeValuePropositionPayload(rawPayload) {
  if (typeof rawPayload === "string") {
    try {
      return normalizeValuePropositionPayload(JSON.parse(rawPayload));
    } catch {
      return {};
    }
  }

  if (!rawPayload || typeof rawPayload !== "object") {
    return {};
  }

  const payload = rawPayload;
  const jobs = payload.customer_profile?.jobs ?? {};
  const scoring = payload.scoring ?? {};

  return {
    customer_segments: deriveSectionPayload({
      content: formatMarkdownList(payload.customer_profile?.segments, {
        empty: "No customer segments have been captured yet.",
      }),
      priority: "primary",
      label: "Draft",
      tone: "info",
      confidence: "medium",
      score: scoring.customer_clarity === "High" ? 0.85 : scoring.customer_clarity === "Medium" ? 0.6 : 0.35,
      explanation: "Customer segment clarity inferred from the current canvas draft.",
    }),
    customer_jobs: deriveSectionPayload({
      content: [
        "Functional jobs:",
        formatMarkdownList(jobs.functional, { empty: "No functional jobs yet." }),
        "",
        "Emotional jobs:",
        formatMarkdownList(jobs.emotional, { empty: "No emotional jobs yet." }),
        "",
        "Social jobs:",
        formatMarkdownList(jobs.social, { empty: "No social jobs yet." }),
      ].join("\n"),
      priority: "primary",
      label: "Draft",
      tone: "info",
      confidence: "medium",
      score: scoring.problem_depth === "High" ? 0.82 : scoring.problem_depth === "Medium" ? 0.58 : 0.34,
      explanation: "Customer jobs captured from the current value proposition canvas.",
    }),
    customer_pains: deriveSectionPayload({
      content: formatMarkdownList(payload.customer_profile?.pains, { empty: "No pains captured yet." }),
      priority: "primary",
      label: "Draft",
      tone: "info",
      confidence: "medium",
      score: scoring.problem_depth === "High" ? 0.8 : scoring.problem_depth === "Medium" ? 0.56 : 0.32,
      explanation: "Customer pains captured from the current value proposition canvas.",
    }),
    customer_gains: deriveSectionPayload({
      content: formatMarkdownList(payload.customer_profile?.gains, { empty: "No gains captured yet." }),
      priority: "primary",
      label: "Draft",
      tone: "info",
      confidence: "medium",
      score: scoring.pain_gain_relevance === "High" ? 0.84 : scoring.pain_gain_relevance === "Medium" ? 0.6 : 0.36,
      explanation: "Customer gains captured from the current value proposition canvas.",
    }),
    products_services: deriveSectionPayload({
      content: formatMarkdownList(payload.value_map?.products_services, {
        empty: "No products or services mapped yet.",
      }),
      priority: "secondary",
      label: "Draft",
      tone: "info",
      confidence: "medium",
      score: scoring.value_definition === "High" ? 0.84 : scoring.value_definition === "Medium" ? 0.62 : 0.38,
      explanation: "Products and services mapped from the current value proposition canvas.",
    }),
    pain_relievers: deriveSectionPayload({
      content: formatMarkdownList(payload.value_map?.pain_relievers, { empty: "No pain relievers mapped yet." }),
      priority: "secondary",
      label: "Draft",
      tone: "info",
      confidence: "medium",
      score: scoring.fit_consistency === "High" ? 0.84 : scoring.fit_consistency === "Medium" ? 0.6 : 0.34,
      explanation: "Pain relievers mapped from the current value proposition canvas.",
    }),
    gain_creators: deriveSectionPayload({
      content: formatMarkdownList(payload.value_map?.gain_creators, { empty: "No gain creators mapped yet." }),
      priority: "secondary",
      label: "Draft",
      tone: "info",
      confidence: "medium",
      score: scoring.fit_consistency === "High" ? 0.84 : scoring.fit_consistency === "Medium" ? 0.6 : 0.34,
      explanation: "Gain creators mapped from the current value proposition canvas.",
    }),
    fit_assessment: deriveSectionPayload({
      content: [
        `- Customer clarity: ${scoring.customer_clarity ?? "Low"}`,
        `- Problem depth: ${scoring.problem_depth ?? "Low"}`,
        `- Value definition: ${scoring.value_definition ?? "Low"}`,
        `- Pain/gain relevance: ${scoring.pain_gain_relevance ?? "Low"}`,
        `- Fit consistency: ${scoring.fit_consistency ?? "Low"}`,
        `- Overall: ${scoring.overall ?? "Weak"}`,
      ].join("\n"),
      priority: "secondary",
      label:
        scoring.overall === "Strong" ? "Strong" : scoring.overall === "Emerging" ? "Needs refinement" : "Too vague",
      tone:
        scoring.overall === "Strong" ? "success" : scoring.overall === "Emerging" ? "warning" : "muted",
      confidence: "medium",
      score: scoring.overall === "Strong" ? 0.86 : scoring.overall === "Emerging" ? 0.58 : 0.22,
      explanation: "Overall fit assessment across the current value proposition canvas.",
    }),
    analysis: deriveSectionPayload({
      content: [
        `Weakest area: ${String(payload.analysis?.weakest_area ?? "Not identified").trim() || "Not identified"}`,
        "",
        "Issues:",
        formatMarkdownList(payload.analysis?.issues, { empty: "No issues called out yet." }),
        "",
        "Inconsistencies:",
        formatMarkdownList(payload.analysis?.inconsistencies, { empty: "No inconsistencies called out yet." }),
        "",
        "Recommendations:",
        formatMarkdownList(payload.analysis?.recommendations, { empty: "No recommendations yet." }),
      ].join("\n"),
      priority: "secondary",
      label: payload.analysis?.weakest_area ? "Needs refinement" : "Draft",
      tone: payload.analysis?.weakest_area ? "warning" : "info",
      confidence: "medium",
      score: scoring.overall === "Strong" ? 0.78 : scoring.overall === "Emerging" ? 0.56 : 0.32,
      explanation: "Diagnostic analysis generated from the current canvas.",
    }),
    next_question: String(payload.next_question ?? "").trim(),
    value_proposition_overview: {
      completeness_percent:
        scoring.overall === "Strong" ? 85 : scoring.overall === "Emerging" ? 60 : payload.next_question ? 30 : 0,
      readiness: {
        label: scoring.overall === "Strong" ? "Ready for next tool" : scoring.overall === "Emerging" ? "Needs refinement" : "In progress",
        reason:
          scoring.overall === "Strong"
            ? "The value proposition canvas is coherent and the fit between customer needs and value delivery looks strong."
            : scoring.overall === "Emerging"
              ? "The canvas is taking shape, but some areas still need refinement before the fit is convincing."
              : "The canvas still needs clearer customer detail and tighter value mapping before the fit is credible.",
        next_best_action: String(payload.next_question ?? "").trim() || "Strengthen the weakest area and tighten the fit between customer needs and the value map.",
      },
    },
  };
}

function mapStatusLabelToRefinementState(label, hasContent) {
  const normalized = String(label ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "strong") {
    return RefinementState.STRONG;
  }

  if (normalized === "needs refinement") {
    return RefinementState.NEEDS_REFINEMENT;
  }

  if (normalized === "draft") {
    return RefinementState.DRAFT;
  }

  if (normalized === "too vague") {
    return hasContent ? RefinementState.NEEDS_REFINEMENT : RefinementState.EMPTY;
  }

  return hasContent ? RefinementState.DRAFT : RefinementState.EMPTY;
}

function mapConfidenceToken(token) {
  const normalized = String(token ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "high") {
    return AgentConfidence.HIGH;
  }

  if (normalized === "low") {
    return AgentConfidence.LOW;
  }

  return AgentConfidence.MEDIUM;
}

function labelToCompletionPercent(label, hasContent) {
  const normalized = String(label ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "strong") {
    return 86;
  }

  if (normalized === "needs refinement") {
    return 61;
  }

  if (normalized === "draft") {
    return 45;
  }

  if (normalized === "too vague") {
    return hasContent ? 20 : 0;
  }

  return hasContent ? 40 : 0;
}

function scoreToCompletionPercent(score, fallbackLabel, hasContent) {
  if (typeof score === "number" && Number.isFinite(score)) {
    if (score <= 1) {
      return Math.max(0, Math.min(100, Math.round(score * 100)));
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  return labelToCompletionPercent(fallbackLabel, hasContent);
}

function calculateIdeationCompleteness(existingSections, nextSectionCompletionByKey = new Map()) {
  const persistedCompletionByKey = new Map(
    (existingSections ?? []).map((section) => [section.sectionKey, Math.max(0, Math.min(100, Number(section.completionPercent ?? 0)))])
  );

  const totalCompletion = IDEATION_SECTION_BLUEPRINTS.reduce((sum, section) => {
    const computedCompletion = nextSectionCompletionByKey.has(section.sectionKey)
      ? nextSectionCompletionByKey.get(section.sectionKey)
      : persistedCompletionByKey.get(section.sectionKey) ?? 0;
    return sum + Math.max(0, Math.min(100, Number(computedCompletion ?? 0)));
  }, 0);

  return Math.round(totalCompletion / IDEATION_SECTION_BLUEPRINTS.length);
}

function mapCompletionToSectionStatus(completionPercent, hasContent) {
  if (!hasContent || completionPercent <= 0) {
    return SectionStatus.NOT_STARTED;
  }

  if (completionPercent >= 85) {
    return SectionStatus.COMPLETE;
  }

  return SectionStatus.IN_PROGRESS;
}

function extractSectionUpdates(normalizedOutput) {
  const updates = [];

  for (const [payloadKey, sectionKey] of Object.entries(IDEATION_PAYLOAD_FIELD_TO_SECTION_KEY)) {
    const payload = normalizedOutput[payloadKey];
    if (!payload || typeof payload !== "object") {
      continue;
    }

    const blueprint = IDEATION_SECTION_BLUEPRINT_BY_KEY.get(sectionKey);
    if (!blueprint) {
      continue;
    }

    updates.push({
      sectionKey,
      blueprint,
      payload,
    });
  }

  return updates;
}

function extractValuePropositionSectionUpdates(normalizedOutput) {
  const updates = [];

  for (const [payloadKey, sectionKey] of Object.entries(VALUE_PROPOSITION_PAYLOAD_FIELD_TO_SECTION_KEY)) {
    const payload = normalizedOutput[payloadKey];
    if (!payload || typeof payload !== "object") {
      continue;
    }

    const blueprint = VALUE_PROPOSITION_SECTION_BLUEPRINT_BY_KEY.get(sectionKey);
    if (!blueprint) {
      continue;
    }

    updates.push({
      sectionKey,
      blueprint,
      payload,
    });
  }

  return updates;
}

function extractArtifactSectionContent(normalizedOutput, heading) {
  const artifactSections = Array.isArray(normalizedOutput?.artifact?.sections)
    ? normalizedOutput.artifact.sections
    : [];

  return String(
    artifactSections.find(
      (section) => String(section?.heading ?? "").trim().toLowerCase() === heading.toLowerCase()
    )?.content ?? ""
  ).trim();
}

function extractLabeledBriefField(briefContent, labels) {
  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\*\\*${escapedLabel}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\n\\*\\*[^*]+:\\*\\*|$)`, "i");
    const match = briefContent.match(pattern);
    const value = String(match?.[1] ?? "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function deriveSectionPayload({ content, priority, label, tone, confidence, score, explanation }) {
  return {
    content,
    priority,
    status: {
      label,
      tone,
      agent_confidence: confidence,
      score,
      explanation,
    },
    ui_hints: {
      highlight: true,
      needs_attention: tone !== "success",
    },
  };
}

function extractSectionUpdatesFromArtifact(normalizedOutput) {
  const briefContent = extractArtifactSectionContent(normalizedOutput, "Brief");
  const opportunityContent = extractArtifactSectionContent(normalizedOutput, "Opportunity");
  const overview = extractLabeledBriefField(briefContent, ["Overview"]);
  const problem = extractLabeledBriefField(briefContent, ["Problem"]);
  const solution = extractLabeledBriefField(briefContent, ["Solution"]);
  const valueProposition = extractLabeledBriefField(briefContent, ["Value Proposition", "Key Value Propositions"]);
  const targetUsers = extractLabeledBriefField(briefContent, ["Target Users"]);
  const differentiation = extractLabeledBriefField(briefContent, ["Competitive Edge", "Strategic Opportunity"]);
  const monetisation = extractLabeledBriefField(briefContent, ["Business Model", "Monetisation", "Monetization"]);

  const candidatePayloads = [
    {
      sectionKey: "problem_statement",
      payload: problem
        ? deriveSectionPayload({
            content: problem,
            priority: "primary",
            label: "Needs refinement",
            tone: "warning",
            confidence: "medium",
            score: 0.58,
            explanation: "Initial problem framing was inferred from the idea brief and may still need sharpening."
          })
        : null,
    },
    {
      sectionKey: "target_customer",
      payload: targetUsers
        ? deriveSectionPayload({
            content: targetUsers,
            priority: "primary",
            label: "Draft",
            tone: "info",
            confidence: "medium",
            score: 0.48,
            explanation: "Target users were extracted from the idea brief and likely need validation."
          })
        : null,
    },
    {
      sectionKey: "value_proposition",
      payload: valueProposition
        ? deriveSectionPayload({
            content: valueProposition,
            priority: "primary",
            label: "Draft",
            tone: "info",
            confidence: "medium",
            score: 0.46,
            explanation: "Value proposition was drafted from the artifact and should be refined with the founder."
          })
        : null,
    },
    {
      sectionKey: "product_service_description",
      payload: (solution || overview || opportunityContent)
        ? deriveSectionPayload({
            content: solution || overview || opportunityContent,
            priority: "secondary",
            label: "Draft",
            tone: "info",
            confidence: "medium",
            score: 0.44,
            explanation: "Product or service description was inferred from the generated brief."
          })
        : null,
    },
    {
      sectionKey: "differentiation",
      payload: differentiation
        ? deriveSectionPayload({
            content: differentiation,
            priority: "secondary",
            label: "Draft",
            tone: "info",
            confidence: "medium",
            score: 0.42,
            explanation: "Differentiation was inferred from the generated brief."
          })
        : null,
    },
    {
      sectionKey: "early_monetisation_idea",
      payload: monetisation
        ? deriveSectionPayload({
            content: monetisation,
            priority: "secondary",
            label: "Draft",
            tone: "info",
            confidence: "low",
            score: 0.34,
            explanation: "Monetisation is still tentative and needs explicit founder input."
          })
        : null,
    },
  ];

  return candidatePayloads
    .filter((candidate) => candidate.payload)
    .map((candidate) => ({
      sectionKey: candidate.sectionKey,
      blueprint: IDEATION_SECTION_BLUEPRINT_BY_KEY.get(candidate.sectionKey),
      payload: candidate.payload,
    }))
    .filter((candidate) => candidate.blueprint);
}

function buildAgentReplyFromArtifact(normalizedOutput, companyName) {
  const artifact = normalizedOutput?.artifact;
  if (!artifact || typeof artifact !== "object") {
    return "";
  }

  const sections = Array.isArray(artifact.sections) ? artifact.sections : [];
  const briefSection = sections.find(
    (section) => String(section?.heading ?? "").trim().toLowerCase() === "brief"
  );
  const opportunitySection = sections.find(
    (section) => String(section?.heading ?? "").trim().toLowerCase() === "opportunity"
  );

  const briefContent = String(briefSection?.content ?? "").trim();
  const opportunityContent = String(opportunitySection?.content ?? "").trim();
  const summary = String(artifact.summary ?? "").trim();

  if (briefContent) {
    return `I drafted an initial idea brief for ${companyName}. ${summary || "I captured the concept in a structured form so we can refine it together."}`;
  }

  if (opportunityContent) {
    return `I captured the core opportunity for ${companyName}: ${opportunityContent}`;
  }

  if (summary) {
    return `I completed a first structured pass on ${companyName}. ${summary}`;
  }

  return "";
}

function buildValuePropositionReply(normalizedOutput, companyName) {
  const scoring = normalizedOutput?.scoring ?? {};
  const overall = String(scoring.overall ?? "").trim();
  const weakestArea = String(normalizedOutput?.analysis?.weakest_area ?? "").trim();
  const nextQuestion = String(normalizedOutput?.next_question ?? "").trim();

  const summaryParts = [`I updated the value proposition canvas for ${companyName}.`];
  if (overall) {
    summaryParts.push(`Overall fit is currently ${overall.toLowerCase()}.`);
  }
  if (weakestArea) {
    summaryParts.push(`The weakest area is ${weakestArea.toLowerCase()}.`);
  }
  if (nextQuestion) {
    summaryParts.push(nextQuestion);
  }

  return summaryParts.join(" ");
}

function mapStrategyCopilot(workspaceRecord, toolId = "ideation") {
  const toolDefinition = getToolDefinition(toolId);
  const document = findDocumentByType(workspaceRecord, toolDefinition.documentType);
  const latestThread = document ? findThreadForDocument(workspaceRecord, document.id) : null;
  const sections = (document?.sections ?? []).map((section) => {
    const sectionStatus = mapSectionStatus(section);
    const updatedAt = section.lastUpdatedAt ?? section.updatedAt ?? workspaceRecord.updatedAt;
    const updatedBy =
      section.lastUpdatedByType === ActorType.USER ? "You" : "HelmOS Agent";

    return {
      id: mapSectionUiId(section.sectionKey ?? section.id),
      title: section.title,
      helper: section.description ?? "Continue refining this section with the agent.",
      content: section.content ?? "",
      emphasis: (section.metadata?.emphasis ?? "secondary") === "primary" ? "primary" : "secondary",
      ...sectionStatus,
      confidence: mapConfidence(section),
      updatedAgo: updatedAt ? `${formatTimestamp(new Date(updatedAt))} UTC` : "Just now",
      updatedBy,
      recentlyUpdated: sectionStatus.statusTone === "warning",
    };
  });

  const messages = (latestThread?.messages ?? []).map((message, index) => ({
    id: index + 1,
    role: message.senderType === ActorType.USER ? "user" : "agent",
    author: message.senderType === ActorType.USER ? "You" : "HelmOS Agent",
    content: message.messageText,
    timestamp: formatTimestamp(new Date(message.createdAt)),
  }));

  const company = workspaceRecord.company;
  const overview = mapOverview(document, document?.sections ?? [], company, workspaceRecord, toolId);
  const availableToolIds = getAvailableToolIds(workspaceRecord);
  const strategyToolsUnlocked = isStrategyToolsUnlocked(workspaceRecord);

  return {
    workspaceOption: {
      id: workspaceRecord.id,
      name: company.name,
      businessType: company.businessType,
      businessTypeLabel: BUSINESS_TYPE_LABELS[company.businessType],
    },
    workspace: {
      pageTitle: `${toolDefinition.pageTitlePrefix}: ${company.name}`,
      pageStatus: `${BUSINESS_TYPE_LABELS[company.businessType]} business idea`,
      completionHintTitle: strategyToolsUnlocked ? "Next strategy tools unlocked" : "Next strategy step is waiting",
      completionHint: strategyToolsUnlocked
        ? toolDefinition.stageUnlockedHint
        : toolDefinition.stageLockedHint,
      overview,
      availableToolIds,
      sections,
    },
    chat: {
      panelTitle: toolDefinition.panelTitle,
      panelSubtitle: toolDefinition.panelSubtitle,
      placeholder: toolDefinition.placeholder,
      messages,
      resendAvailable: isRetryableLatestUserMessage(latestThread),
    },
  };
}

const STRATEGY_COPILOT_WORKSPACE_INCLUDE = {
  company: true,
  stageProgress: {
    orderBy: {
      displayOrder: "asc",
    },
  },
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
      agentRuns: {
        orderBy: {
          startedAt: "desc",
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  },
};

const STALE_RUN_WINDOW_MS = 2 * 60 * 1000;

function findLatestRunForMessage(thread, messageId) {
  return (thread?.agentRuns ?? []).find((run) => run.triggerMessageId === messageId) ?? null;
}

function hasAgentMessageAfter(thread, messageIndex) {
  return (thread?.messages ?? []).some(
    (message) => message.senderType === ActorType.AGENT && Number(message.messageIndex ?? 0) > Number(messageIndex ?? 0)
  );
}

function isRetryableLatestUserMessage(thread) {
  const latestMessage = thread?.messages?.at(-1) ?? null;
  if (!latestMessage || latestMessage.senderType !== ActorType.USER) {
    return false;
  }

  if (latestMessage.status === MessageStatus.FAILED) {
    return true;
  }

  const latestRun = findLatestRunForMessage(thread, latestMessage.id);
  if (!latestRun) {
    return true;
  }

  if (latestRun.runStatus === AgentRunStatus.FAILED) {
    return true;
  }

  if (latestRun.runStatus === AgentRunStatus.COMPLETED) {
    return !hasAgentMessageAfter(thread, latestMessage.messageIndex);
  }

  if (latestRun.runStatus === AgentRunStatus.RUNNING) {
    const startedAt = latestRun.startedAt ? new Date(latestRun.startedAt).getTime() : 0;
    return Date.now() - startedAt >= STALE_RUN_WINDOW_MS;
  }

  return false;
}

async function loadStrategyCopilotWorkspaceRecord(prisma, workspaceId) {
  return prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: STRATEGY_COPILOT_WORKSPACE_INCLUDE,
  });
}

async function loadWorkspaceWithChatContext(prisma, workspaceId) {
  return prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: {
      company: true,
      stageProgress: {
        orderBy: {
          displayOrder: "asc",
        },
      },
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
          agentRuns: {
            orderBy: {
              startedAt: "desc",
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  });
}

async function runIdeationWorkflow(prisma, agentGatewayClient, workspaceId, input, currentUser) {
  if (!agentGatewayClient || typeof agentGatewayClient.runIdeationWorkflow !== "function") {
    const error = new Error("The agent gateway client is not configured for ideation workflows.");
    error.statusCode = 503;
    throw error;
  }

  const initialWorkspace = await loadWorkspaceWithChatContext(prisma, workspaceId);
  assertWorkspaceAccess(initialWorkspace, currentUser);

  const initialDocument = findDocumentByType(initialWorkspace, DOCUMENT_TYPES.IDEATION);
  if (!initialDocument) {
    const error = new Error("The ideation workspace is missing its primary document.");
    error.statusCode = 409;
    throw error;
  }

  const initialThread = findThreadForDocument(initialWorkspace, initialDocument.id);
  if (!initialThread) {
    const error = new Error("The ideation workspace is missing its active chat thread.");
    error.statusCode = 409;
    throw error;
  }

  const userMessageText = input.messageText.trim();
  let persistedRun = null;
  let persistedUserMessageId = input.existingMessageId ?? null;

  await prisma.$transaction(async (tx) => {
    const latestWorkspace = await tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: {
        documents: {
          include: {
            sections: {
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
        },
      },
    });

    const document = findDocumentByType(latestWorkspace, DOCUMENT_TYPES.IDEATION);
    const thread = document ? findThreadForDocument(latestWorkspace, document.id) : null;

    if (!document || !thread) {
      const error = new Error("The ideation workspace is missing its active document thread.");
      error.statusCode = 409;
      throw error;
    }
    let triggerMessageId = input.existingMessageId ?? null;

    if (input.existingMessageId) {
      await tx.chatMessage.update({
        where: { id: input.existingMessageId },
        data: {
          status: MessageStatus.PENDING,
        },
      });
    } else {
      const lastMessageIndex = thread?.messages?.at(-1)?.messageIndex ?? 0;
      const userMessage = await tx.chatMessage.create({
        data: {
          threadId: thread.id,
          messageIndex: lastMessageIndex + 1,
          senderType: ActorType.USER,
          senderUserId: latestWorkspace.createdByUserId ?? null,
          messageText: userMessageText,
          messageFormat: MessageFormat.MARKDOWN,
          status: MessageStatus.PENDING,
        },
      });
      persistedUserMessageId = userMessage.id;
      triggerMessageId = userMessage.id;
    }

    persistedRun = await tx.agentRun.create({
      data: {
        threadId: thread.id,
        triggerMessageId,
        runStatus: AgentRunStatus.RUNNING,
        summary: null,
        resultMetadata: {
          source: "ideation_chat",
          retry: Boolean(input.existingMessageId),
        },
      },
    });

    if (typeof tx.activityLog?.create === "function") {
      await tx.activityLog.create({
        data: {
          workspaceId,
          actorType: ActorType.USER,
          actorUserId: latestWorkspace.createdByUserId ?? null,
          eventType: input.existingMessageId ? "ideation_message_retried" : "ideation_message_sent",
          entityType: "chat_message",
          entityId: triggerMessageId,
          eventSummary: input.existingMessageId
            ? "Founder retried the latest message to the ideation agent."
            : "Founder sent a message to the ideation agent.",
          payload: {
            documentId: document.id,
            threadId: thread.id,
          },
        },
      });
    }
  });

  let gatewaySummary;
  try {
    const chatHistory = (initialThread.messages ?? []).slice(-8).map((message) => ({
      sender: message.senderType,
      content: message.messageText,
    }));
    const ideationPageState = {
      workspace_id: workspaceId,
      workspace_name: initialWorkspace.company.name,
      business_type: initialWorkspace.company.businessType,
      sections: Object.fromEntries(
        (initialDocument.sections ?? []).map((section) => [section.sectionKey, section.content ?? ""])
      ),
    };

    gatewaySummary = await agentGatewayClient.runIdeationWorkflow({
      inputText: userMessageText,
      sessionTitle: initialDocument.title,
      metadata: {
        workspace_id: workspaceId,
        document_id: initialDocument.id,
        thread_id: initialThread.id,
      },
      context: {
        latest_user_message: userMessageText,
        chat_history: chatHistory,
        ideation_page_state: ideationPageState,
        workspace_id: workspaceId,
        workspace_name: initialWorkspace.company.name,
        business_type: initialWorkspace.company.businessType,
        sections: ideationPageState.sections,
        recent_messages: chatHistory,
      },
    });
    await createLogEntry(prisma, {
      level: "info",
      scope: "business-ideas",
      event: "ideation_gateway_summary_received",
      message: "Received ideation gateway summary.",
      context: {
        workspaceId,
        gatewayRunId: gatewaySummary?.id ?? null,
        gatewayStatus: gatewaySummary?.status ?? null,
        gatewaySummary,
      },
    });

    if (!TERMINAL_GATEWAY_STATUSES.has(normalizeGatewayStatus(gatewaySummary?.status))) {
      const error = new Error(
        `Agent gateway run did not complete in time (last status: ${gatewaySummary?.status ?? "unknown"}).`
      );
      error.statusCode = 504;
      throw error;
    }
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      if (persistedRun?.id && typeof tx.agentRun?.update === "function") {
        await tx.agentRun.update({
          where: { id: persistedRun.id },
          data: {
            runStatus: AgentRunStatus.FAILED,
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : "Ideation workflow delivery failed.",
          },
        });
      }

      if (persistedUserMessageId && typeof tx.chatMessage?.update === "function") {
        await tx.chatMessage.update({
          where: { id: persistedUserMessageId },
          data: {
            status: MessageStatus.FAILED,
          },
        });
      }
    });

    if (error instanceof Error && typeof error.statusCode !== "number") {
      error.statusCode = 503;
    }

    throw error;
  }

  const normalizedOutput = normalizeIdeationPayload(gatewaySummary.normalized_output);
  const ideationOverview = normalizedOutput.ideation_overview ?? {};
  const ideationReadiness = ideationOverview.readiness ?? {};
  const explicitSectionUpdates = extractSectionUpdates(normalizedOutput);
  const sectionUpdates = explicitSectionUpdates;
  const explicitAgentReply = String(normalizedOutput.reply_to_user?.content ?? "").trim();
  const derivedArtifactReply = buildAgentReplyFromArtifact(normalizedOutput, initialWorkspace.company.name);
  const agentReply =
    explicitAgentReply ||
    derivedArtifactReply ||
    (String(gatewaySummary.status ?? "").toLowerCase() === "completed"
      ? "I completed the request, but no reply text was returned by the agent workflow. Please retry or refine your prompt."
      : "");

  try {
    await prisma.$transaction(async (tx) => {
      const workspaceRecord = await tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        include: {
          documents: {
            include: {
              sections: {
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
          },
        },
      });

      const document = findDocumentByType(workspaceRecord, DOCUMENT_TYPES.IDEATION);
      const thread = document ? findThreadForDocument(workspaceRecord, document.id) : null;
      if (!document || !thread) {
        const error = new Error("The ideation workspace is missing its active document thread.");
        error.statusCode = 409;
        throw error;
      }
      const sectionsByKey = new Map((document.sections ?? []).map((section) => [section.sectionKey, section]));
      const nextSectionCompletionByKey = new Map();

      for (const update of sectionUpdates) {
        const sectionPayload = update.payload;
        const nextContent = String(sectionPayload.content ?? "").trim();
        const hasContent = nextContent.length > 0;
        const statusLabel = sectionPayload.status?.label ?? null;
        const completionPercent = labelToCompletionPercent(statusLabel, hasContent);
        const refinementState = mapStatusLabelToRefinementState(statusLabel, hasContent);
        const strategySectionStatus = mapCompletionToSectionStatus(completionPercent, hasContent);
        const existingSection = sectionsByKey.get(update.sectionKey);
        const helper =
          typeof sectionPayload.helper === "string" && sectionPayload.helper.trim().length > 0
            ? sectionPayload.helper.trim()
            : update.blueprint.description;
        const emphasis = sectionPayload.priority === "primary" ? "primary" : update.blueprint.emphasis;

        let sectionRecord = existingSection;
        if (!sectionRecord) {
          sectionRecord = await tx.strategySection.create({
            data: {
              documentId: document.id,
              sectionKey: update.sectionKey,
              title: update.blueprint.title,
              description: helper,
              displayOrder: update.blueprint.displayOrder,
              content: nextContent || null,
              status: strategySectionStatus,
              refinementState,
              agentConfidence: mapConfidenceToken(sectionPayload.status?.agent_confidence),
              completionPercent,
              lastUpdatedByType: ActorType.AGENT,
              lastUpdatedAt: new Date(),
              versionNo: 1,
              metadata: {
                emphasis,
              },
            },
          });
        } else {
          sectionRecord = await tx.strategySection.update({
            where: { id: sectionRecord.id },
            data: {
              title: update.blueprint.title,
              description: helper,
              content: nextContent || null,
              status: strategySectionStatus,
              refinementState,
              agentConfidence: mapConfidenceToken(sectionPayload.status?.agent_confidence),
              completionPercent,
              lastUpdatedByType: ActorType.AGENT,
              lastUpdatedAt: new Date(),
              versionNo: (sectionRecord.versionNo ?? 0) + 1,
              metadata: {
                ...(sectionRecord.metadata ?? {}),
                emphasis,
              },
            },
          });
        }

        if (typeof tx.sectionVersion?.create === "function") {
          await tx.sectionVersion.create({
            data: {
              sectionId: sectionRecord.id,
              versionNo: sectionRecord.versionNo,
              content: nextContent || null,
              changeSummary:
                String(sectionPayload.status?.explanation ?? "").trim() || "Updated by HelmOS Agent.",
              changedByType: ActorType.AGENT,
              agentRunId: persistedRun?.id ?? null,
              diffJson: {
                source: "ideation_agent",
                highlight: Boolean(sectionPayload.ui_hints?.highlight),
                needsAttention: Boolean(sectionPayload.ui_hints?.needs_attention),
              },
            },
          });
        }

        if (typeof tx.agentRunEffect?.create === "function" && persistedRun?.id) {
          await tx.agentRunEffect.create({
            data: {
              agentRunId: persistedRun.id,
              effectType: "updated_section",
              targetEntityType: "strategy_section",
              targetEntityId: sectionRecord.id,
              details: {
                sectionKey: update.sectionKey,
                completionPercent,
              },
            },
          });
        }

        nextSectionCompletionByKey.set(update.sectionKey, completionPercent);
      }

      const computedCompleteness = calculateIdeationCompleteness(document.sections, nextSectionCompletionByKey);
      const shouldUnlockStrategyTools =
        computedCompleteness >= 80 || isStrategyToolsUnlocked(workspaceRecord);
      const computedReadiness = getReadinessLabel({
        completeness: computedCompleteness,
        qualityState: null,
        strategyToolsUnlocked: shouldUnlockStrategyTools,
      });

      await tx.strategyDocument.update({
        where: { id: document.id },
        data: {
          completenessPercent: computedCompleteness,
          qualityState: computedReadiness.readinessLabel,
          agentSummary: agentReply || String(ideationReadiness.reason ?? document.agentSummary ?? ""),
        },
      });

      if (shouldUnlockStrategyTools && typeof tx.workspace?.update === "function") {
        await tx.workspace.update({
          where: { id: workspaceId },
          data: {
            featureUnlocks: buildFeatureUnlocks(workspaceRecord.featureUnlocks, {
              unlockStrategyTools: true,
            }),
          },
        });
      }

      if (shouldUnlockStrategyTools && typeof tx.stageProgress?.updateMany === "function") {
        await tx.stageProgress.updateMany({
          where: {
            workspaceId,
            stageKey: {
              in: UNLOCKABLE_STAGE_KEYS,
            },
          },
          data: {
            status: StageStatus.AVAILABLE,
            unlockState: UnlockState.UNLOCKED,
            unlockReason: STRATEGY_TOOLS_UNLOCK_REASON,
            enteredAt: null,
          },
        });
      }

      if (agentReply) {
        const lastMessageIndex = thread?.messages?.at(-1)?.messageIndex ?? 0;
        await tx.chatMessage.create({
          data: {
            threadId: thread.id,
            messageIndex: lastMessageIndex + 1,
            senderType: ActorType.AGENT,
            messageText: agentReply,
            messageFormat: MessageFormat.MARKDOWN,
            status: MessageStatus.SENT,
            metadata: {
              gatewayRunId: gatewaySummary.id,
            },
          },
        });
      }

      if (persistedUserMessageId && typeof tx.chatMessage?.update === "function") {
        await tx.chatMessage.update({
          where: { id: persistedUserMessageId },
          data: {
            status: MessageStatus.SENT,
          },
        });
      }

      if (typeof tx.agentRun?.update === "function" && persistedRun?.id) {
        await tx.agentRun.update({
          where: { id: persistedRun.id },
          data: {
            runStatus:
              String(gatewaySummary.status ?? "").toLowerCase() === "completed"
                ? AgentRunStatus.COMPLETED
                : AgentRunStatus.FAILED,
            completedAt: new Date(),
            summary: agentReply || null,
            resultMetadata: {
              gatewayRunId: gatewaySummary.id,
              gatewayStatus: gatewaySummary.status,
              normalizedOutput,
            },
          },
        });
      }

      if (typeof tx.activityLog?.create === "function") {
        await tx.activityLog.create({
          data: {
            workspaceId,
            actorType: ActorType.AGENT,
            eventType: "ideation_agent_completed",
            entityType: "agent_run",
            entityId: persistedRun?.id ?? null,
            eventSummary: "HelmOS Agent updated the ideation workspace.",
            payload: {
              gatewayRunId: gatewaySummary.id,
              updatedSections: sectionUpdates.map((section) => section.sectionKey),
            },
          },
        });
      }
    });
  } catch (error) {
    if (persistedUserMessageId && typeof prisma.chatMessage?.update === "function") {
      await prisma.chatMessage.update({
        where: { id: persistedUserMessageId },
        data: {
          status: MessageStatus.FAILED,
        },
      });
    }

    if (typeof prisma.agentRun?.update === "function" && persistedRun?.id) {
      await prisma.agentRun.update({
        where: { id: persistedRun.id },
        data: {
          runStatus: AgentRunStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Ideation workflow persistence failed.",
          resultMetadata: {
            gatewayRunId: gatewaySummary.id,
            gatewayStatus: gatewaySummary.status,
            normalizedOutput,
          },
        },
      });
    }

    throw error;
  }

  const uiPayload = await getBusinessIdea(prisma, workspaceId, currentUser);
  await createLogEntry(prisma, {
    level: "info",
    scope: "business-ideas",
    event: "ideation_ui_payload_returned",
    message: "Returned refreshed ideation payload to the UI.",
    context: {
      workspaceId,
      localRunId: persistedRun?.id ?? null,
      gatewayRunId: gatewaySummary?.id ?? null,
      uiPayload,
    },
  });

  return uiPayload;
}

async function sendIdeationMessage(prisma, agentGatewayClient, workspaceId, input, currentUser) {
  return runIdeationWorkflow(prisma, agentGatewayClient, workspaceId, {
    messageText: input.messageText,
    existingMessageId: null,
  }, currentUser);
}

async function resendLastIdeationMessage(prisma, agentGatewayClient, workspaceId, currentUser) {
  const workspace = await loadWorkspaceWithChatContext(prisma, workspaceId);
  assertWorkspaceAccess(workspace, currentUser);
  const document = findDocumentByType(workspace, DOCUMENT_TYPES.IDEATION);
  const thread = document ? findThreadForDocument(workspace, document.id) : null;
  const lastMessage = thread?.messages?.at(-1) ?? null;

  if (!thread || !lastMessage || lastMessage.senderType !== ActorType.USER) {
    const error = new Error("There is no recent user message available to resend.");
    error.statusCode = 409;
    throw error;
  }

  if (!isRetryableLatestUserMessage(thread)) {
    const error = new Error("The latest user message does not need to be resent.");
    error.statusCode = 409;
    throw error;
  }

  const latestRun = findLatestRunForMessage(thread, lastMessage.id);
  if (
    latestRun &&
    latestRun.runStatus === AgentRunStatus.RUNNING &&
    Date.now() - new Date(latestRun.startedAt).getTime() >= STALE_RUN_WINDOW_MS &&
    typeof prisma.agentRun?.update === "function"
  ) {
    await prisma.agentRun.update({
      where: { id: latestRun.id },
      data: {
        runStatus: AgentRunStatus.FAILED,
        completedAt: new Date(),
        errorMessage: latestRun.errorMessage ?? "The previous ideation run appears to have stalled.",
      },
    });
  }

  return runIdeationWorkflow(prisma, agentGatewayClient, workspaceId, {
    messageText: lastMessage.messageText,
    existingMessageId: lastMessage.id,
  }, currentUser);
}

async function runValuePropositionWorkflow(prisma, agentGatewayClient, workspaceId, input, currentUser) {
  if (!agentGatewayClient || typeof agentGatewayClient.runValuePropositionWorkflow !== "function") {
    const error = new Error("The agent gateway client is not configured for value proposition workflows.");
    error.statusCode = 503;
    throw error;
  }

  const initialWorkspace = await loadWorkspaceWithChatContext(prisma, workspaceId);
  assertWorkspaceAccess(initialWorkspace, currentUser);

  const initialDocument = findDocumentByType(initialWorkspace, DOCUMENT_TYPES.VALUE_PROPOSITION);
  if (!initialDocument) {
    const error = new Error("The value proposition workspace is missing its primary document.");
    error.statusCode = 409;
    throw error;
  }

  const initialThread = findThreadForDocument(initialWorkspace, initialDocument.id);
  if (!initialThread) {
    const error = new Error("The value proposition workspace is missing its active chat thread.");
    error.statusCode = 409;
    throw error;
  }

  const userMessageText = input.messageText.trim();
  let persistedRun = null;
  let persistedUserMessageId = input.existingMessageId ?? null;

  await prisma.$transaction(async (tx) => {
    const latestWorkspace = await tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: {
        documents: {
          include: {
            sections: {
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
        },
      },
    });

    const document = findDocumentByType(latestWorkspace, DOCUMENT_TYPES.VALUE_PROPOSITION);
    const thread = document ? findThreadForDocument(latestWorkspace, document.id) : null;
    if (!document || !thread) {
      const error = new Error("The value proposition workspace is missing its active document thread.");
      error.statusCode = 409;
      throw error;
    }

    let triggerMessageId = input.existingMessageId ?? null;

    if (input.existingMessageId) {
      await tx.chatMessage.update({
        where: { id: input.existingMessageId },
        data: {
          status: MessageStatus.PENDING,
        },
      });
    } else {
      const lastMessageIndex = thread?.messages?.at(-1)?.messageIndex ?? 0;
      const userMessage = await tx.chatMessage.create({
        data: {
          threadId: thread.id,
          messageIndex: lastMessageIndex + 1,
          senderType: ActorType.USER,
          senderUserId: latestWorkspace.createdByUserId ?? null,
          messageText: userMessageText,
          messageFormat: MessageFormat.MARKDOWN,
          status: MessageStatus.PENDING,
        },
      });
      persistedUserMessageId = userMessage.id;
      triggerMessageId = userMessage.id;
    }

    persistedRun = await tx.agentRun.create({
      data: {
        threadId: thread.id,
        triggerMessageId,
        runStatus: AgentRunStatus.RUNNING,
        summary: null,
        resultMetadata: {
          source: "value_proposition_chat",
          retry: Boolean(input.existingMessageId),
        },
      },
    });
  });

  let gatewaySummary;
  try {
    const chatHistory = (initialThread.messages ?? []).slice(-8).map((message) => ({
      sender: message.senderType,
      content: message.messageText,
    }));
    const canvasState = {
      workspace_id: workspaceId,
      workspace_name: initialWorkspace.company.name,
      business_type: initialWorkspace.company.businessType,
      sections: Object.fromEntries(
        (initialDocument.sections ?? []).map((section) => [section.sectionKey, section.content ?? ""])
      ),
    };

    gatewaySummary = await agentGatewayClient.runValuePropositionWorkflow({
      inputText: userMessageText,
      sessionTitle: initialDocument.title,
      metadata: {
        workspace_id: workspaceId,
        document_id: initialDocument.id,
        thread_id: initialThread.id,
      },
      context: {
        latest_user_message: userMessageText,
        chat_history: chatHistory,
        value_proposition_page_state: canvasState,
        workspace_id: workspaceId,
        workspace_name: initialWorkspace.company.name,
        business_type: initialWorkspace.company.businessType,
        sections: canvasState.sections,
        recent_messages: chatHistory,
      },
    });

    if (!TERMINAL_GATEWAY_STATUSES.has(normalizeGatewayStatus(gatewaySummary?.status))) {
      const error = new Error(
        `Agent gateway run did not complete in time (last status: ${gatewaySummary?.status ?? "unknown"}).`
      );
      error.statusCode = 504;
      throw error;
    }
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      if (persistedRun?.id && typeof tx.agentRun?.update === "function") {
        await tx.agentRun.update({
          where: { id: persistedRun.id },
          data: {
            runStatus: AgentRunStatus.FAILED,
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : "Value proposition workflow delivery failed.",
          },
        });
      }

      if (persistedUserMessageId && typeof tx.chatMessage?.update === "function") {
        await tx.chatMessage.update({
          where: { id: persistedUserMessageId },
          data: {
            status: MessageStatus.FAILED,
          },
        });
      }
    });

    if (error instanceof Error && typeof error.statusCode !== "number") {
      error.statusCode = 503;
    }

    throw error;
  }

  const normalizedOutput = normalizeValuePropositionPayload(gatewaySummary.normalized_output);
  const overview = normalizedOutput.value_proposition_overview ?? {};
  const readiness = overview.readiness ?? {};
  const sectionUpdates = extractValuePropositionSectionUpdates(normalizedOutput);
  const agentReply =
    buildValuePropositionReply(gatewaySummary.normalized_output, initialWorkspace.company.name) ||
    (String(gatewaySummary.status ?? "").toLowerCase() === "completed"
      ? "I updated the value proposition canvas."
      : "");

  try {
    await prisma.$transaction(async (tx) => {
      const workspaceRecord = await tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        include: {
          documents: {
            include: {
              sections: {
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
          },
        },
      });

      const document = findDocumentByType(workspaceRecord, DOCUMENT_TYPES.VALUE_PROPOSITION);
      const thread = document ? findThreadForDocument(workspaceRecord, document.id) : null;
      if (!document || !thread) {
        const error = new Error("The value proposition workspace is missing its active document thread.");
        error.statusCode = 409;
        throw error;
      }

      const sectionsByKey = new Map((document.sections ?? []).map((section) => [section.sectionKey, section]));

      for (const update of sectionUpdates) {
        const sectionPayload = update.payload;
        const nextContent = String(sectionPayload.content ?? "").trim();
        const hasContent = nextContent.length > 0;
        const statusLabel = sectionPayload.status?.label ?? null;
        const completionPercent = scoreToCompletionPercent(sectionPayload.status?.score, statusLabel, hasContent);
        const refinementState = mapStatusLabelToRefinementState(statusLabel, hasContent);
        const strategySectionStatus = mapCompletionToSectionStatus(completionPercent, hasContent);
        const existingSection = sectionsByKey.get(update.sectionKey);
        const helper =
          typeof sectionPayload.helper === "string" && sectionPayload.helper.trim().length > 0
            ? sectionPayload.helper.trim()
            : update.blueprint.description;
        const emphasis = sectionPayload.priority === "primary" ? "primary" : update.blueprint.emphasis;

        let sectionRecord = existingSection;
        if (!sectionRecord) {
          sectionRecord = await tx.strategySection.create({
            data: {
              documentId: document.id,
              sectionKey: update.sectionKey,
              title: update.blueprint.title,
              description: helper,
              displayOrder: update.blueprint.displayOrder,
              content: nextContent || null,
              status: strategySectionStatus,
              refinementState,
              agentConfidence: mapConfidenceToken(sectionPayload.status?.agent_confidence),
              completionPercent,
              lastUpdatedByType: ActorType.AGENT,
              lastUpdatedAt: new Date(),
              versionNo: 1,
              metadata: { emphasis },
            },
          });
        } else {
          sectionRecord = await tx.strategySection.update({
            where: { id: sectionRecord.id },
            data: {
              title: update.blueprint.title,
              description: helper,
              content: nextContent || null,
              status: strategySectionStatus,
              refinementState,
              agentConfidence: mapConfidenceToken(sectionPayload.status?.agent_confidence),
              completionPercent,
              lastUpdatedByType: ActorType.AGENT,
              lastUpdatedAt: new Date(),
              versionNo: (sectionRecord.versionNo ?? 0) + 1,
              metadata: {
                ...(sectionRecord.metadata ?? {}),
                emphasis,
              },
            },
          });
        }
      }

      await tx.strategyDocument.update({
        where: { id: document.id },
        data: {
          completenessPercent:
            typeof overview.completeness_percent === "number"
              ? Math.max(0, Math.min(100, Math.round(overview.completeness_percent)))
              : document.completenessPercent,
          qualityState:
            clampString(String(readiness.label ?? document.qualityState ?? "In progress"), STRATEGY_DOCUMENT_QUALITY_STATE_MAX_LENGTH) ??
            "In progress",
          agentSummary: agentReply || String(readiness.reason ?? document.agentSummary ?? ""),
        },
      });

      if (agentReply) {
        const lastMessageIndex = thread?.messages?.at(-1)?.messageIndex ?? 0;
        await tx.chatMessage.create({
          data: {
            threadId: thread.id,
            messageIndex: lastMessageIndex + 1,
            senderType: ActorType.AGENT,
            messageText: agentReply,
            messageFormat: MessageFormat.MARKDOWN,
            status: MessageStatus.SENT,
            metadata: {
              gatewayRunId: gatewaySummary.id,
            },
          },
        });
      }

      if (persistedUserMessageId && typeof tx.chatMessage?.update === "function") {
        await tx.chatMessage.update({
          where: { id: persistedUserMessageId },
          data: {
            status: MessageStatus.SENT,
          },
        });
      }

      if (typeof tx.agentRun?.update === "function" && persistedRun?.id) {
        await tx.agentRun.update({
          where: { id: persistedRun.id },
          data: {
            runStatus:
              String(gatewaySummary.status ?? "").toLowerCase() === "completed"
                ? AgentRunStatus.COMPLETED
                : AgentRunStatus.FAILED,
            completedAt: new Date(),
            summary: agentReply || null,
            resultMetadata: {
              gatewayRunId: gatewaySummary.id,
              gatewayStatus: gatewaySummary.status,
              normalizedOutput,
            },
          },
        });
      }
    });
  } catch (error) {
    if (persistedUserMessageId && typeof prisma.chatMessage?.update === "function") {
      await prisma.chatMessage.update({
        where: { id: persistedUserMessageId },
        data: {
          status: MessageStatus.FAILED,
        },
      });
    }

    if (typeof prisma.agentRun?.update === "function" && persistedRun?.id) {
      await prisma.agentRun.update({
        where: { id: persistedRun.id },
        data: {
          runStatus: AgentRunStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Value proposition workflow persistence failed.",
          resultMetadata: {
            gatewayRunId: gatewaySummary.id,
            gatewayStatus: gatewaySummary.status,
            normalizedOutput,
          },
        },
      });
    }

    throw error;
  }

  return getBusinessIdeaForTool(prisma, workspaceId, "value-proposition", currentUser);
}

async function sendValuePropositionMessage(prisma, agentGatewayClient, workspaceId, input, currentUser) {
  return runValuePropositionWorkflow(prisma, agentGatewayClient, workspaceId, {
    messageText: input.messageText,
    existingMessageId: null,
  }, currentUser);
}

async function resendLastValuePropositionMessage(prisma, agentGatewayClient, workspaceId, currentUser) {
  const workspace = await loadWorkspaceWithChatContext(prisma, workspaceId);
  assertWorkspaceAccess(workspace, currentUser);
  const document = findDocumentByType(workspace, DOCUMENT_TYPES.VALUE_PROPOSITION);
  const thread = document ? findThreadForDocument(workspace, document.id) : null;
  const lastMessage = thread?.messages?.at(-1) ?? null;

  if (!thread || !lastMessage || lastMessage.senderType !== ActorType.USER) {
    const error = new Error("There is no recent user message available to resend.");
    error.statusCode = 409;
    throw error;
  }

  if (!isRetryableLatestUserMessage(thread)) {
    const error = new Error("The latest user message does not need to be resent.");
    error.statusCode = 409;
    throw error;
  }

  return runValuePropositionWorkflow(prisma, agentGatewayClient, workspaceId, {
    messageText: lastMessage.messageText,
    existingMessageId: lastMessage.id,
  }, currentUser);
}

async function ensureUserWorkspaceContext(tx, currentUser) {
  const organisation = await tx.organisation.upsert({
    where: {
      slug: buildDefaultOrganisationSlug(currentUser),
    },
    update: {
      name: buildDefaultOrganisationName(currentUser),
      createdByUserId: currentUser.id,
    },
    create: {
      name: buildDefaultOrganisationName(currentUser),
      slug: buildDefaultOrganisationSlug(currentUser),
      createdByUserId: currentUser.id,
    },
  });

  await tx.organisationMember.upsert({
    where: {
      organisationId_userId: {
        organisationId: organisation.id,
        userId: currentUser.id,
      },
    },
    update: {
      role: "OWNER",
    },
    create: {
      organisationId: organisation.id,
      userId: currentUser.id,
      role: "OWNER",
    },
  });

  return {
    organisation,
  };
}

async function createBusinessIdea(prisma, input, currentUser) {
  return prisma.$transaction(async (tx) => {
    const { organisation } = await ensureUserWorkspaceContext(tx, currentUser);
    const slug = await buildUniqueCompanySlug(tx, input.name);

    const company = await tx.company.create({
      data: {
        organisationId: organisation.id,
        name: input.name,
        businessType: input.businessType,
        slug,
        industry: BUSINESS_TYPE_LABELS[input.businessType],
        createdByUserId: currentUser.id,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        companyId: company.id,
        name: input.name,
        featureUnlocks: buildFeatureUnlocks(null),
        createdByUserId: currentUser.id,
      },
    });

    const ideationDocument = await tx.strategyDocument.create({
      data: {
        workspaceId: workspace.id,
        documentType: DOCUMENT_TYPES.IDEATION,
        title: `Ideation: ${input.name}`,
        qualityState: "IN_PROGRESS",
        agentSummary: `A new ${BUSINESS_TYPE_LABELS[input.businessType].toLowerCase()} business idea has been created. Start by clarifying the problem statement.`,
      },
    });

    for (const sectionSeed of IDEATION_SECTION_SEEDS) {
      await tx.strategySection.create({
        data: {
          documentId: ideationDocument.id,
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

    const valuePropositionDocument = await tx.strategyDocument.create({
      data: {
        workspaceId: workspace.id,
        documentType: DOCUMENT_TYPES.VALUE_PROPOSITION,
        title: `Value Proposition: ${input.name}`,
        qualityState: "IN_PROGRESS",
        agentSummary: "Start with the customer profile before shaping the value map.",
      },
    });

    for (const sectionSeed of VALUE_PROPOSITION_SECTION_SEEDS) {
      await tx.strategySection.create({
        data: {
          documentId: valuePropositionDocument.id,
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

    const ideationThread = await tx.chatThread.create({
      data: {
        workspaceId: workspace.id,
        documentId: ideationDocument.id,
        title: "Ideation thread",
        createdByUserId: currentUser.id,
      },
    });

    await tx.chatMessage.create({
      data: {
        threadId: ideationThread.id,
        messageIndex: 1,
        senderType: ActorType.AGENT,
        messageText: "Hi there. Please tell me about your business idea.",
        messageFormat: MessageFormat.MARKDOWN,
        status: MessageStatus.SENT,
      },
    });

    const valuePropositionThread = await tx.chatThread.create({
      data: {
        workspaceId: workspace.id,
        documentId: valuePropositionDocument.id,
        title: "Value Proposition thread",
        createdByUserId: currentUser.id,
      },
    });

    await tx.chatMessage.create({
      data: {
        threadId: valuePropositionThread.id,
        messageIndex: 1,
        senderType: ActorType.AGENT,
        messageText: "Let's build the Value Proposition Canvas by starting with the customer segments you want to serve.",
        messageFormat: MessageFormat.MARKDOWN,
        status: MessageStatus.SENT,
      },
    });

    await tx.activityLog.create({
      data: {
        workspaceId: workspace.id,
        actorType: ActorType.USER,
        actorUserId: currentUser.id,
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
        stageProgress: {
          orderBy: {
            displayOrder: "asc",
          },
        },
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
        },
      },
    });

    return mapStrategyCopilot(workspaceRecord, "ideation");
  });
}

async function listBusinessIdeas(prisma, currentUser) {
  const workspaces = await prisma.workspace.findMany({
    where: {
      createdByUserId: currentUser.id,
    },
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

async function getBusinessIdea(prisma, workspaceId, currentUser) {
  return getBusinessIdeaForTool(prisma, workspaceId, "ideation", currentUser);
}

async function getBusinessIdeaForTool(prisma, workspaceId, toolId, currentUser) {
  const workspaceRecord = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: STRATEGY_COPILOT_WORKSPACE_INCLUDE,
  });

  assertWorkspaceAccess(workspaceRecord, currentUser);

  return mapStrategyCopilot(workspaceRecord, toolId);
}

module.exports = {
  BUSINESS_TYPE_LABELS,
  createBusinessIdea,
  getBusinessIdea,
  getBusinessIdeaForTool,
  listBusinessIdeas,
  resendLastIdeationMessage,
  resendLastValuePropositionMessage,
  sendIdeationMessage,
  sendValuePropositionMessage,
};
