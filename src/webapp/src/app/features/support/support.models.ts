export interface SupportConversationMessage {
  id: string;
  messageIndex: number;
  senderType: 'USER' | 'AGENT' | 'SYSTEM';
  senderUserId: string | null;
  messageText: string;
  messageFormat: 'PLAIN_TEXT' | 'MARKDOWN';
  status: 'PENDING' | 'SENT' | 'FAILED';
  detectedIntent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SupportTicketSummary {
  id: string;
  ticketKey: string;
  status: string;
  priority: string;
  severity: string;
  category: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportConversationState {
  conversation: {
    id: string;
    userId: string;
    tenantId: string | null;
    status: string;
    source: string;
    lastRoute: string | null;
    lastMessageAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  messages: SupportConversationMessage[];
  tickets: SupportTicketSummary[];
}

export interface SupportConversationTurnResponse {
  conversation: SupportConversationState['conversation'];
  messages: SupportConversationMessage[];
  ticket: SupportTicketSummary | null;
  reply: SupportConversationMessage;
}
