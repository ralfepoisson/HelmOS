const test = require("node:test");
const assert = require("node:assert/strict");

const { createSupportService } = require("../app/services/support.service");

function createInMemoryPrisma() {
  const state = {
    conversations: [],
    messages: [],
    tickets: [],
    events: [],
  };

  return {
    __state: state,
    supportConversation: {
      async findFirst({ where }) {
        return state.conversations.find(
          (conversation) =>
            conversation.userId === where.userId &&
            conversation.status === where.status
        ) ?? null;
      },
      async create({ data }) {
        const record = {
          id: `conv-${state.conversations.length + 1}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...data,
        };
        state.conversations.push(record);
        return record;
      },
      async update({ where, data }) {
        const record = state.conversations.find((entry) => entry.id === where.id);
        Object.assign(record, data, { updatedAt: new Date().toISOString() });
        return record;
      },
    },
    supportMessage: {
      async count({ where }) {
        return state.messages.filter((entry) => entry.conversationId === where.conversationId).length;
      },
      async create({ data }) {
        const record = {
          id: `msg-${state.messages.length + 1}`,
          createdAt: new Date().toISOString(),
          ...data,
        };
        state.messages.push(record);
        return record;
      },
      async findMany({ where }) {
        return state.messages
          .filter((entry) => entry.conversationId === where.conversationId)
          .sort((left, right) => left.messageIndex - right.messageIndex);
      },
    },
    supportTicket: {
      async create({ data }) {
        const record = {
          id: `ticket-${state.tickets.length + 1}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...data,
        };
        state.tickets.push(record);
        return record;
      },
      async findMany({ where }) {
        return state.tickets.filter((entry) => entry.conversationId === where.conversationId);
      },
    },
    supportTicketEvent: {
      async create({ data }) {
        const record = { id: `event-${state.events.length + 1}`, ...data };
        state.events.push(record);
        return record;
      },
    },
  };
}

test("support service escalates a bug report into a ticket and returns the ticket reference", async () => {
  const prisma = createInMemoryPrisma();
  const service = createSupportService({
    prisma,
    knowledgeBaseSearch: async () => [],
    logAnalyzer: {
      analyze: async () => ({
        summary: {
          matchCount: 1,
          incidentSummary: "One related backend error matched the captured request context.",
        },
        rawExcerpts: [],
        groups: [],
      }),
    },
  });

  const result = await service.processConversationTurn({
    actorUser: {
      id: "user-1",
      life2AccountId: "tenant-1",
      email: "founder@example.com",
      displayName: "Founder",
    },
    sessionKey: "browser-session-1",
    messageText: "Report a bug: the support dashboard is broken and shows a blank screen.",
    clientContext: {
      route: "/admin/support",
      pageUrl: "https://app.helmos.test/#/admin/support",
    },
  });

  assert.equal(result.ticket?.status, "NEW");
  assert.match(result.reply.messageText, /ticket/i);
  assert.equal(prisma.__state.tickets.length, 1);
  assert.equal(prisma.__state.events.length >= 1, true);
});
