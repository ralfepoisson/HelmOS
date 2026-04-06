function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
  };
}

function serializeConversationMessage(message) {
  return {
    id: message.id,
    messageIndex: message.messageIndex,
    senderType: message.senderType,
    senderUserId: message.senderUserId ?? null,
    messageText: message.messageText,
    messageFormat: message.messageFormat,
    status: message.status,
    detectedIntent: message.detectedIntent ?? null,
    metadata: message.metadataJson ?? null,
    createdAt: message.createdAt,
  };
}

function serializeConversation(record) {
  return {
    id: record.id,
    userId: record.userId,
    user: serializeUser(record.user),
    tenantId: record.tenantId ?? null,
    title: record.title ?? null,
    status: record.status,
    source: record.source,
    escalatedAt: record.escalatedAt ?? null,
    lastMessageAt: record.lastMessageAt ?? null,
    lastRoute: record.lastRoute ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ticketCount: record._count?.tickets ?? 0,
    messageCount: record._count?.messages ?? 0,
    messages: Array.isArray(record.messages) ? record.messages.map(serializeConversationMessage) : undefined,
  };
}

function serializeEvent(event) {
  return {
    id: event.id,
    eventType: event.eventType,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    actorType: event.actorType,
    actorUserId: event.actorUserId ?? null,
    actorUser: serializeUser(event.actorUser),
    comment: event.comment ?? null,
    payload: event.payloadJson ?? null,
    createdAt: event.createdAt,
  };
}

function serializeInvestigation(investigation) {
  return {
    id: investigation.id,
    investigatorAgentKey: investigation.investigatorAgentKey,
    investigatorUser: serializeUser(investigation.investigatorUser),
    status: investigation.status,
    issueSummary: investigation.issueSummary ?? null,
    evidenceReviewed: investigation.evidenceReviewedJson ?? null,
    likelyRootCause: investigation.likelyRootCause ?? null,
    confidenceLabel: investigation.confidenceLabel ?? null,
    rationale: investigation.rationale ?? null,
    classification: investigation.classification,
    recommendedRemediation: investigation.recommendedRemediation ?? null,
    humanReviewRequired: investigation.humanReviewRequired,
    startedAt: investigation.startedAt ?? null,
    completedAt: investigation.completedAt ?? null,
    createdAt: investigation.createdAt,
    updatedAt: investigation.updatedAt,
  };
}

function serializeRecommendation(recommendation) {
  return {
    id: recommendation.id,
    status: recommendation.status,
    recommendationText: recommendation.recommendationText,
    rationale: recommendation.rationale ?? null,
    confidenceLabel: recommendation.confidenceLabel ?? null,
    humanNotes: recommendation.humanNotes ?? null,
    reviewedByUser: serializeUser(recommendation.reviewedByUser),
    reviewedAt: recommendation.reviewedAt ?? null,
    createdAt: recommendation.createdAt,
    updatedAt: recommendation.updatedAt,
  };
}

function serializeTicket(record) {
  return {
    id: record.id,
    ticketKey: record.ticketKey,
    conversationId: record.conversationId ?? null,
    reporterUserId: record.reporterUserId,
    reporter: serializeUser(record.reporter),
    assignedToUserId: record.assignedToUserId ?? null,
    assignedTo: serializeUser(record.assignedTo),
    tenantId: record.tenantId ?? null,
    title: record.title,
    description: record.description,
    status: record.status,
    priority: record.priority,
    severity: record.severity,
    category: record.category,
    source: record.source,
    route: record.route ?? null,
    technicalContext: record.technicalContextJson ?? null,
    investigationNotes: record.investigationNotes ?? null,
    proposedFix: record.proposedFix ?? null,
    proposedFixConfidence: record.proposedFixConfidence ?? null,
    proposedFixRationale: record.proposedFixRationale ?? null,
    humanReviewRequired: record.humanReviewRequired,
    humanReviewStatus: record.humanReviewStatus ?? null,
    triagedAt: record.triagedAt ?? null,
    resolvedAt: record.resolvedAt ?? null,
    closedAt: record.closedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    events: Array.isArray(record.events) ? record.events.map(serializeEvent) : undefined,
    investigations: Array.isArray(record.investigations)
      ? record.investigations.map(serializeInvestigation)
      : undefined,
    recommendations: Array.isArray(record.recommendations)
      ? record.recommendations.map(serializeRecommendation)
      : undefined,
  };
}

function createSupportAdminService({ prisma, incidentResponseService }) {
  return {
    async listConversations(filters = {}) {
      const where = {
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.escalated === true ? { escalatedAt: { not: null } } : {}),
        ...(filters.hasTicket === true
          ? {
              tickets: {
                some: {},
              },
            }
          : {}),
      };

      const records = await prisma.supportConversation.findMany({
        where,
        include: {
          user: true,
          _count: {
            select: {
              messages: true,
              tickets: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      return records.map(serializeConversation);
    },

    async getConversation(conversationId) {
      const record = await prisma.supportConversation.findUnique({
        where: { id: conversationId },
        include: {
          user: true,
          messages: {
            orderBy: { messageIndex: "asc" },
          },
          tickets: {
            include: {
              reporter: true,
              assignedTo: true,
            },
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              messages: true,
              tickets: true,
            },
          },
        },
      });

      return record
        ? {
            ...serializeConversation(record),
            tickets: record.tickets.map(serializeTicket),
          }
        : null;
    },

    async listTickets(filters = {}) {
      const records = await prisma.supportTicket.findMany({
        where: {
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.priority ? { priority: filters.priority } : {}),
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.reporterUserId ? { reporterUserId: filters.reporterUserId } : {}),
        },
        include: {
          reporter: true,
          assignedTo: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      return records.map(serializeTicket);
    },

    async getTicket(ticketId) {
      const record = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          reporter: true,
          assignedTo: true,
          events: {
            include: {
              actorUser: true,
            },
            orderBy: { createdAt: "asc" },
          },
          investigations: {
            include: {
              investigatorUser: true,
            },
            orderBy: { createdAt: "desc" },
          },
          recommendations: {
            include: {
              reviewedByUser: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      return record ? serializeTicket(record) : null;
    },

    async updateTicket(ticketId, patch, actorUser) {
      const existing = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
      });
      if (!existing) {
        return null;
      }

      const updated = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: patch,
        include: {
          reporter: true,
          assignedTo: true,
        },
      });

      await prisma.supportTicketEvent.create({
        data: {
          ticketId,
          eventType: "ticket_updated",
          fromStatus: existing.status,
          toStatus: patch.status ?? existing.status,
          actorType: "USER",
          actorUserId: actorUser.id,
          comment: "Ticket updated from admin support dashboard.",
          payloadJson: patch,
        },
      });

      return serializeTicket(updated);
    },

    async runInvestigation(ticketId, actorUser) {
      return incidentResponseService.investigateTicket(ticketId, actorUser);
    },

    async reviewRecommendation(ticketId, payload, actorUser) {
      const latestRecommendation = await prisma.supportRecommendation.findFirst({
        where: {
          ticketId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!latestRecommendation) {
        const error = new Error("No recommendation is available for this ticket.");
        error.statusCode = 404;
        throw error;
      }

      const nextRecommendationStatus =
        payload.action === "approve" ? "APPROVED" : payload.action === "reject" ? "REJECTED" : latestRecommendation.status;
      const nextTicketStatus =
        payload.action === "approve"
          ? "ACTION_APPROVED"
          : payload.action === "reject"
            ? "ACTION_REJECTED"
            : "WAITING_FOR_HUMAN_REVIEW";

      const recommendation = await prisma.supportRecommendation.update({
        where: { id: latestRecommendation.id },
        data: {
          status: nextRecommendationStatus,
          recommendationText: payload.recommendationText ?? latestRecommendation.recommendationText,
          humanNotes: payload.humanNotes ?? latestRecommendation.humanNotes,
          reviewedByUserId: actorUser.id,
          reviewedAt: new Date(),
        },
      });

      const ticket = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: nextTicketStatus,
          proposedFix: recommendation.recommendationText,
          humanReviewStatus: nextRecommendationStatus,
        },
        include: {
          reporter: true,
          assignedTo: true,
        },
      });

      await prisma.supportTicketEvent.create({
        data: {
          ticketId,
          eventType: `recommendation_${payload.action}`,
          toStatus: nextTicketStatus,
          actorType: "USER",
          actorUserId: actorUser.id,
          comment: payload.humanNotes ?? null,
          payloadJson: {
            action: payload.action,
            recommendationText: recommendation.recommendationText,
          },
        },
      });

      return {
        ticket: serializeTicket(ticket),
        recommendation: serializeRecommendation({
          ...recommendation,
          reviewedByUser: actorUser,
        }),
      };
    },
  };
}

module.exports = {
  createSupportAdminService,
};
