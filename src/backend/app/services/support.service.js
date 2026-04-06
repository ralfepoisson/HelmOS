const { randomUUID } = require("node:crypto");

const { sanitizeSupportClientContext } = require("./support-telemetry.service");

const HELP_KB_NAME = "Platform Help / User Documentation";
const SUPPORT_SOURCE = "INLINE_HELP_WIDGET";

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isStrongBugSignal(messageText) {
  return /\b(report a bug|report bug|bug report|broken|not working|blank screen|crash|exception|incident|outage|failed|error)\b/i.test(
    messageText
  );
}

function classifyTicketCategory(messageText) {
  const lowered = `${messageText}`.toLowerCase();
  if (/\b(question|how do i|how can i|where is|usage|help)\b/.test(lowered)) {
    return "PRODUCT_QUESTION";
  }
  if (/\b(access|permission|forbidden|unauthorized|login|sign in)\b/.test(lowered)) {
    return "ACCESS_ISSUE";
  }
  if (/\b(data|missing|duplicate|wrong value)\b/.test(lowered)) {
    return "DATA_ISSUE";
  }
  if (/\b(outage|incident|down|unavailable)\b/.test(lowered)) {
    return "INCIDENT";
  }
  if (/\b(config|setting|misconfigured)\b/.test(lowered)) {
    return "CONFIGURATION";
  }
  if (/\b(api|service|dependency|stripe|slack|external)\b/.test(lowered)) {
    return "EXTERNAL_DEPENDENCY";
  }
  return isStrongBugSignal(messageText) ? "BUG_REPORT" : "OTHER";
}

function classifyPriority(messageText) {
  const lowered = `${messageText}`.toLowerCase();
  if (/\b(outage|production down|critical|urgent|everyone|all users)\b/.test(lowered)) {
    return { priority: "URGENT", severity: "CRITICAL" };
  }
  if (/\b(payment|login|cannot|can't|unable to)\b/.test(lowered)) {
    return { priority: "HIGH", severity: "MAJOR" };
  }
  if (isStrongBugSignal(messageText)) {
    return { priority: "MEDIUM", severity: "MODERATE" };
  }
  return { priority: "LOW", severity: "MINOR" };
}

function extractTitle(messageText) {
  const compact = `${messageText}`.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}…` : compact;
}

function ticketReply(ticket, logSummary) {
  const pieces = [
    `I created support ticket ${ticket.ticketKey} with status ${ticket.status}.`,
    "A human will need to review any proposed remediation before anything is executed.",
  ];
  if (logSummary?.summary?.incidentSummary) {
    pieces.push(logSummary.summary.incidentSummary);
  }
  return pieces.join(" ");
}

async function findHelpKnowledgeBaseId(prisma) {
  if (!prisma?.knowledgeBase?.findFirst) {
    return null;
  }

  const record = await prisma.knowledgeBase.findFirst({
    where: {
      OR: [{ name: HELP_KB_NAME }, { ownerType: "SUPPORT", ownerId: "platform-help" }],
    },
  });

  return record?.id ?? null;
}

async function appendConversationMessage(prisma, conversationId, data) {
  const messageIndex = (await prisma.supportMessage.count({ where: { conversationId } })) + 1;
  return prisma.supportMessage.create({
    data: {
      conversationId,
      messageIndex,
      ...data,
    },
  });
}

async function listConversationMessages(prisma, conversationId) {
  return prisma.supportMessage.findMany({
    where: { conversationId },
    orderBy: { messageIndex: "asc" },
  });
}

async function ensureConversation(prisma, actorUser, sessionKey, clientContext) {
  let conversation = await prisma.supportConversation.findFirst({
    where: {
      userId: actorUser.id,
      status: "OPEN",
      ...(sessionKey ? { sessionKey } : {}),
    },
  });

  if (!conversation) {
    conversation = await prisma.supportConversation.create({
      data: {
        userId: actorUser.id,
        tenantId: actorUser.life2AccountId ?? null,
        status: "OPEN",
        source: SUPPORT_SOURCE,
        sessionKey: sessionKey ?? null,
        lastRoute: clientContext?.route ?? null,
        clientContextJson: clientContext ?? null,
      },
    });
  }

  return conversation;
}

async function createTicket(prisma, actorUser, conversation, messageText, clientContext, logSummary) {
  const { priority, severity } = classifyPriority(messageText);
  const category = classifyTicketCategory(messageText);
  const technicalContextJson = {
    reporter: {
      userId: actorUser.id,
      tenantId: actorUser.life2AccountId ?? null,
      email: actorUser.email,
      displayName: actorUser.displayName ?? null,
    },
    client: clientContext,
    logSummary,
  };

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketKey: `SUP-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      conversationId: conversation.id,
      reporterUserId: actorUser.id,
      tenantId: actorUser.life2AccountId ?? null,
      title: extractTitle(messageText),
      description: messageText,
      category,
      priority,
      severity,
      status: "NEW",
      source: SUPPORT_SOURCE,
      route: clientContext?.route ?? null,
      technicalContextJson,
      humanReviewRequired: true,
      humanReviewStatus: "PENDING",
    },
  });

  await prisma.supportTicketEvent.create({
    data: {
      ticketId: ticket.id,
      eventType: "ticket_created",
      toStatus: ticket.status,
      actorType: "SYSTEM",
      actorUserId: actorUser.id,
      comment: "Ticket created from inline help widget escalation.",
      payloadJson: {
        category,
        priority,
        severity,
      },
    },
  });

  await prisma.supportConversation.update({
    where: { id: conversation.id },
    data: {
      escalatedAt: new Date(),
      lastMessageAt: new Date(),
      lastRoute: clientContext?.route ?? null,
    },
  });

  return ticket;
}

function normalizeKbResult(result) {
  return {
    filename: result.filename,
    score: result.score,
    snippet: result.chunkSummary || result.chunkText,
    knowledgeBaseName: result.knowledgeBaseName,
  };
}

function buildHelpReply(messageText, knowledgeResults) {
  if (!knowledgeResults || knowledgeResults.length === 0) {
    return {
      messageText:
        "I could not verify an answer from the platform help documentation. If you think something is broken, say “report a bug” and I’ll create a support ticket with technical context.",
      knowledgeResults: [],
    };
  }

  const lead = knowledgeResults[0];
  return {
    messageText: `${lead.snippet} ${
      knowledgeResults.length > 1
        ? "I also found related help material you can review in the support references below."
        : "That answer is based on the current platform help documentation."
    }`,
    knowledgeResults: knowledgeResults.map(normalizeKbResult),
  };
}

async function defaultKnowledgeBaseSearch() {
  return [];
}

function createSupportService({ prisma, knowledgeBaseSearch = defaultKnowledgeBaseSearch, logAnalyzer }) {
  if (!prisma?.supportConversation || !prisma?.supportMessage || !prisma?.supportTicket || !prisma?.supportTicketEvent) {
    throw new Error("Support Prisma delegates are not configured. Apply the support migration first.");
  }

  return {
    async getCurrentConversation({ actorUser, sessionKey }) {
      const conversation = await prisma.supportConversation.findFirst({
        where: {
          userId: actorUser.id,
          status: "OPEN",
          ...(sessionKey ? { sessionKey } : {}),
        },
      });

      if (!conversation) {
        return null;
      }

      const [messages, tickets] = await Promise.all([
        listConversationMessages(prisma, conversation.id),
        prisma.supportTicket.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return { conversation, messages, tickets };
    },

    async processConversationTurn({ actorUser, sessionKey, messageText, clientContext }) {
      if (!messageText || !messageText.trim()) {
        throw createHttpError(400, "Message text is required.");
      }

      const safeClientContext = sanitizeSupportClientContext(clientContext);
      const conversation = await ensureConversation(prisma, actorUser, sessionKey, safeClientContext);
      await appendConversationMessage(prisma, conversation.id, {
        senderType: "USER",
        senderUserId: actorUser.id,
        messageText: messageText.trim(),
        detectedIntent: isStrongBugSignal(messageText) ? "bug_report" : "question",
        metadataJson: {
          clientContext: safeClientContext,
        },
      });

      let replyMessageText;
      let ticket = null;
      let knowledgeResults = [];

      if (isStrongBugSignal(messageText)) {
        const logSummary = logAnalyzer
          ? await logAnalyzer.analyze({
              query: messageText,
              userId: actorUser.id,
              tenantId: actorUser.life2AccountId ?? null,
              route: safeClientContext.route ?? null,
              requestId: safeClientContext.correlationIds?.[0] ?? null,
            })
          : null;
        ticket = await createTicket(prisma, actorUser, conversation, messageText.trim(), safeClientContext, logSummary);
        replyMessageText = ticketReply(ticket, logSummary);
      } else {
        const helpKbId = await findHelpKnowledgeBaseId(prisma);
        if (helpKbId) {
          knowledgeResults = await knowledgeBaseSearch({
            query: messageText.trim(),
            knowledgeBaseIds: [helpKbId],
            limit: 3,
            actorUserId: actorUser.id,
          });
        }
        const helpReply = buildHelpReply(messageText, knowledgeResults);
        replyMessageText = helpReply.messageText;
        knowledgeResults = helpReply.knowledgeResults;
      }

      const reply = await appendConversationMessage(prisma, conversation.id, {
        senderType: "AGENT",
        messageText: replyMessageText,
        detectedIntent: ticket ? "ticket_confirmation" : "answer",
        metadataJson: {
          knowledgeResults,
          ticketKey: ticket?.ticketKey ?? null,
        },
      });

      await prisma.supportConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastRoute: safeClientContext.route ?? null,
          clientContextJson: safeClientContext,
        },
      });

      return {
        conversation,
        messages: await listConversationMessages(prisma, conversation.id),
        ticket,
        reply,
      };
    },
  };
}

module.exports = {
  HELP_KB_NAME,
  createSupportService,
  isStrongBugSignal,
};
