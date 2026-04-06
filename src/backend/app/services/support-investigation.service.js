function classifyIssue(ticket, logAnalysis) {
  const description = `${ticket.description ?? ""}`.toLowerCase();
  const route = `${ticket.route ?? ticket.technicalContextJson?.client?.route ?? ""}`.toLowerCase();
  const hasRepeatedErrors = (logAnalysis?.groups ?? []).some((group) => group.occurrences > 1);

  if (/\b(validation|form|blank screen|ui|frontend|browser)\b/.test(description) || route.startsWith("/strategy") || route.startsWith("/admin")) {
    return "FRONTEND_BUG";
  }
  if (/\b(data|record|missing|duplicate)\b/.test(description)) {
    return "DATA_ISSUE";
  }
  if (/\b(login|permission|access|role)\b/.test(description)) {
    return "CONFIGURATION_DEFECT";
  }
  if (/\bstripe|slack|external|dependency|third[- ]party\b/.test(description)) {
    return "EXTERNAL_DEPENDENCY_FAILURE";
  }
  if (hasRepeatedErrors) {
    return "BACKEND_BUG";
  }
  return "UNKNOWN";
}

function inferConfidence(classification, logAnalysis) {
  if ((logAnalysis?.groups ?? []).some((group) => group.occurrences >= 3)) {
    return "HIGH";
  }
  if (classification !== "UNKNOWN") {
    return "MEDIUM";
  }
  return "LOW";
}

function buildRecommendation(ticket, classification, logAnalysis) {
  if (classification === "FRONTEND_BUG") {
    return "Review the frontend route and component error handling around the reported screen, then patch the failing state transition after human review.";
  }
  if (classification === "BACKEND_BUG") {
    return "Inspect the backend handler associated with the failing route, reproduce using the captured request context, and prepare a code fix for human review before execution.";
  }
  if (classification === "DATA_ISSUE") {
    return "Inspect the affected records with a read-only query first, confirm whether the issue is data integrity rather than code, and prepare a reviewed remediation plan.";
  }
  if (classification === "EXTERNAL_DEPENDENCY_FAILURE") {
    return "Verify the dependency status and recent integration errors, then prepare fallback or retry guidance for human review.";
  }
  return "Gather one more reproduction with the captured route, request IDs, and recent console/network evidence before proposing a concrete remediation.";
}

function buildRationale(ticket, classification, logAnalysis) {
  const clauses = [];
  clauses.push(`Ticket category: ${ticket.category}.`);
  clauses.push(`Likely classification: ${classification}.`);
  if (logAnalysis?.summary?.incidentSummary) {
    clauses.push(logAnalysis.summary.incidentSummary);
  } else {
    clauses.push("No verified backend log match was found for the current investigation window.");
  }
  return clauses.join(" ");
}

function createIncidentResponseService({ prisma, logAnalyzer }) {
  return {
    async investigateTicket(ticketId, actorUser = null) {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          reporter: true,
          recommendations: {
            orderBy: { createdAt: "desc" },
          },
          investigations: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!ticket) {
        const error = new Error("Support ticket not found.");
        error.statusCode = 404;
        throw error;
      }

      const logAnalysis = logAnalyzer
        ? await logAnalyzer.analyze({
            query: ticket.description,
            userId: ticket.reporterUserId,
            tenantId: ticket.tenantId ?? null,
            route: ticket.route ?? ticket.technicalContextJson?.client?.route ?? null,
            requestId:
              ticket.technicalContextJson?.client?.correlationIds?.[0] ??
              ticket.technicalContextJson?.client?.failedRequests?.[0]?.requestId ??
              null,
          })
        : null;

      const classification = classifyIssue(ticket, logAnalysis);
      const confidence = inferConfidence(classification, logAnalysis);
      const rationale = buildRationale(ticket, classification, logAnalysis);
      const recommendationText = buildRecommendation(ticket, classification, logAnalysis);
      const issueSummary = ticket.title;
      const rootCause =
        classification === "UNKNOWN"
          ? "Evidence is insufficient to isolate a single verified root cause yet."
          : `The issue most likely maps to ${classification.toLowerCase().replace(/_/g, " ")}.`;

      const investigation = await prisma.supportInvestigation.create({
        data: {
          ticketId: ticket.id,
          investigatorAgentKey: "incident-response",
          investigatorUserId: actorUser?.id ?? null,
          status: "COMPLETED",
          issueSummary,
          evidenceReviewedJson: {
            logAnalysis,
            clientContext: ticket.technicalContextJson?.client ?? null,
          },
          likelyRootCause: rootCause,
          confidenceLabel: confidence,
          rationale,
          classification,
          recommendedRemediation: recommendationText,
          humanReviewRequired: true,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      const recommendation = await prisma.supportRecommendation.create({
        data: {
          ticketId: ticket.id,
          investigationId: investigation.id,
          status: "PENDING_REVIEW",
          recommendationText,
          rationale,
          confidenceLabel: confidence,
        },
      });

      const updatedTicket = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: "WAITING_FOR_HUMAN_REVIEW",
          investigationNotes: rationale,
          proposedFix: recommendationText,
          proposedFixConfidence: confidence,
          proposedFixRationale: rationale,
          humanReviewRequired: true,
          humanReviewStatus: "PENDING",
        },
      });

      await prisma.supportTicketEvent.create({
        data: {
          ticketId: ticket.id,
          eventType: "investigation_completed",
          fromStatus: ticket.status,
          toStatus: "WAITING_FOR_HUMAN_REVIEW",
          actorType: "AGENT",
          actorUserId: actorUser?.id ?? null,
          comment: "Incident Response Agent completed an advisory-only investigation.",
          payloadJson: {
            classification,
            confidence,
            investigationId: investigation.id,
            recommendationId: recommendation.id,
          },
        },
      });

      return {
        ticket: updatedTicket,
        investigation,
        recommendation,
        logAnalysis,
      };
    },
  };
}

module.exports = {
  createIncidentResponseService,
};
