const { HELP_KB_NAME } = require("./support.service");

async function ensureHelpKnowledgeBase(prisma) {
  if (!prisma?.knowledgeBase?.findFirst || !prisma?.knowledgeBase?.create) {
    return null;
  }

  const existing = await prisma.knowledgeBase.findFirst({
    where: {
      OR: [{ name: HELP_KB_NAME }, { ownerType: "SUPPORT", ownerId: "platform-help" }],
    },
  });

  if (existing) {
    return existing;
  }

  const adminUser = await prisma.user.findFirst({
    where: {
      appRole: "ADMIN",
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!adminUser) {
    return null;
  }

  return prisma.knowledgeBase.create({
    data: {
      name: HELP_KB_NAME,
      description:
        "Dedicated knowledge-base partition for user-facing platform usage documentation consumed by the Help Desk Agent.",
      ownerType: "SUPPORT",
      ownerId: "platform-help",
      status: "ACTIVE",
      createdById: adminUser.id,
      updatedById: adminUser.id,
    },
  });
}

async function ensureAgentDefinition(prisma, payload) {
  if (!prisma?.agentDefinition?.findUnique || !prisma?.agentDefinition?.create || !prisma?.agentDefinition?.update) {
    return null;
  }

  const existing = await prisma.agentDefinition.findUnique({
    where: { key: payload.key },
  });

  if (existing) {
    return prisma.agentDefinition.update({
      where: { id: existing.id },
      data: {
        name: payload.name,
        version: payload.version,
        description: payload.description,
        allowedTools: payload.allowedTools,
        defaultModel: payload.defaultModel,
        active: true,
      },
    });
  }

  return prisma.agentDefinition.create({
    data: {
      key: payload.key,
      name: payload.name,
      version: payload.version,
      description: payload.description,
      allowedTools: payload.allowedTools,
      defaultModel: payload.defaultModel,
      active: true,
    },
  });
}

async function ensurePromptConfig(prisma, payload) {
  if (!prisma?.promptConfig?.findUnique || !prisma?.promptConfig?.create || !prisma?.promptConfig?.updateMany) {
    return null;
  }

  const existing = await prisma.promptConfig.findUnique({
    where: {
      key_version: {
        key: payload.key,
        version: payload.version,
      },
    },
  }).catch(() => null);

  if (existing) {
    return existing;
  }

  await prisma.promptConfig.updateMany({
    where: {
      key: payload.key,
      active: true,
    },
    data: {
      active: false,
    },
  });

  return prisma.promptConfig.create({
    data: payload,
  });
}

async function ensureSupportScaffolding(prisma) {
  try {
    await ensureHelpKnowledgeBase(prisma);
    await ensureAgentDefinition(prisma, {
      key: "help-desk",
      name: "Help Desk Agent",
      version: "0.1.0",
      description:
        "Answers platform usage questions, detects bug reports, gathers bounded technical context, and creates support tickets without executing remediation.",
      allowedTools: ["retrieval", "log_analysis"],
      defaultModel: "helmos-default",
    });
    await ensurePromptConfig(prisma, {
      key: "help-desk.default",
      version: "0.1.0",
      promptTemplate:
        "You are the HelmOS Help Desk Agent. Answer user questions from verified platform-help knowledge, ask focused clarifying questions only when necessary, and if the issue appears broken create or confirm a support ticket instead of claiming unverified operational status.",
      configJson: {
        purpose: "User-facing inline help and support escalation.",
        scopeNotes:
          "Do not claim backend or production status unless it has been verified through available tools. Never apply fixes directly.",
        promptSections: {
          rolePersona: "Friendly, concise, practical support specialist.",
          taskInstructions:
            "Prefer the Platform Help / User Documentation partition. Detect likely bugs. Summarize collected evidence and provide ticket references when escalation happens.",
          constraints:
            "No automatic remediation. State uncertainty clearly when verification is not available.",
          outputFormat:
            "Return concise user-facing support replies with any citations or ticket identifiers."
        },
        toolPermissions: [
          { key: "retrieval", label: "Knowledge Retrieval", access: "Read only", scopePreview: "Platform help partition" },
          { key: "log_analysis", label: "Log Analysis", access: "Read only", scopePreview: "Bounded structured support analysis" },
        ],
      },
      active: true,
    });
    await ensureAgentDefinition(prisma, {
      key: "incident-response",
      name: "Incident Response Agent",
      version: "0.1.0",
      description:
        "Investigates support tickets, reviews logs and safe evidence, classifies likely causes, and proposes advisory-only remediation for human review.",
      allowedTools: ["retrieval", "log_analysis"],
      defaultModel: "helmos-research",
    });
    await ensurePromptConfig(prisma, {
      key: "incident-response.default",
      version: "0.1.0",
      promptTemplate:
        "You are the HelmOS Incident Response Agent. Investigate support tickets with evidence, classify the most likely cause, summarize uncertainty honestly, and propose advisory-only remediation that requires human review before execution.",
      configJson: {
        purpose: "Structured incident investigation and remediation recommendation.",
        scopeNotes:
          "Never change production systems or data. Recommendations are advisory only and must be human-reviewed.",
        promptSections: {
          rolePersona: "Analytical, evidence-led incident investigator.",
          taskInstructions:
            "Use logs and attached technical context. Produce issue summary, evidence reviewed, likely root cause, confidence, and proposed remediation.",
          constraints:
            "No deployment, no direct data changes, no fabricated verification. If evidence is weak, say so.",
          outputFormat:
            "Structured investigation notes suitable for admin review."
        },
        toolPermissions: [
          { key: "retrieval", label: "Knowledge Retrieval", access: "Read only", scopePreview: "Product and support documentation" },
          { key: "log_analysis", label: "Log Analysis", access: "Read only", scopePreview: "Support incident log summaries" },
        ],
      },
      active: true,
    });
  } catch (error) {
    if (error?.code === "P2021") {
      return;
    }
    throw error;
  }
}

module.exports = {
  ensureSupportScaffolding,
};
