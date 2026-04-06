import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { readAuthConfig } from '../../core/auth/bootstrap-auth';

interface ApiResponse<T> {
  data: T;
}

export interface AdminSupportConversationSummary {
  id: string;
  userId: string;
  user: { id: string; email: string; displayName: string | null } | null;
  status: string;
  source: string;
  lastRoute: string | null;
  escalatedAt: string | null;
  updatedAt: string;
  ticketCount: number;
  messageCount: number;
}

export interface AdminSupportConversationDetail extends AdminSupportConversationSummary {
  messages: Array<{
    id: string;
    messageIndex: number;
    senderType: string;
    messageText: string;
    detectedIntent: string | null;
    createdAt: string;
  }>;
  tickets: AdminSupportTicketSummary[];
}

export interface AdminSupportTicketSummary {
  id: string;
  ticketKey: string;
  title: string;
  status: string;
  priority: string;
  severity: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  reporter: { id: string; email: string; displayName: string | null } | null;
}

export interface AdminSupportTicketDetail extends AdminSupportTicketSummary {
  description: string;
  route: string | null;
  technicalContext: Record<string, unknown> | null;
  investigationNotes: string | null;
  proposedFix: string | null;
  proposedFixConfidence: string | null;
  proposedFixRationale: string | null;
  humanReviewRequired: boolean;
  humanReviewStatus: string | null;
  events: Array<{
    id: string;
    eventType: string;
    comment: string | null;
    createdAt: string;
  }>;
  investigations: Array<{
    id: string;
    status: string;
    issueSummary: string | null;
    classification: string;
    confidenceLabel: string | null;
    likelyRootCause: string | null;
    recommendedRemediation: string | null;
    rationale: string | null;
    evidenceReviewed: Record<string, unknown> | null;
  }>;
  recommendations: Array<{
    id: string;
    status: string;
    recommendationText: string;
    rationale: string | null;
    confidenceLabel: string | null;
    humanNotes: string | null;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class SupportAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api/admin/support`;

  async listConversations(): Promise<AdminSupportConversationSummary[]> {
    return this.get<AdminSupportConversationSummary[]>(`${this.apiBaseUrl}/conversations`, 'load support conversations');
  }

  async getConversation(id: string): Promise<AdminSupportConversationDetail> {
    return this.get<AdminSupportConversationDetail>(`${this.apiBaseUrl}/conversations/${id}`, 'load support conversation');
  }

  async listTickets(): Promise<AdminSupportTicketSummary[]> {
    return this.get<AdminSupportTicketSummary[]>(`${this.apiBaseUrl}/tickets`, 'load support tickets');
  }

  async getTicket(id: string): Promise<AdminSupportTicketDetail> {
    return this.get<AdminSupportTicketDetail>(`${this.apiBaseUrl}/tickets/${id}`, 'load support ticket');
  }

  async investigateTicket(id: string): Promise<void> {
    await this.post(`${this.apiBaseUrl}/tickets/${id}/investigate`, {}, 'trigger incident investigation');
  }

  async reviewTicket(id: string, payload: { action: 'approve' | 'reject' | 'edit'; recommendationText?: string; humanNotes?: string }): Promise<void> {
    await this.post(`${this.apiBaseUrl}/tickets/${id}/review`, payload, 'review the recommendation');
  }

  private async get<T>(url: string, action: string): Promise<T> {
    const response = await firstValueFrom(this.http.get(url, { observe: 'response', responseType: 'text' }));
    return this.parseApiResponse<T>(response, action);
  }

  private async post(url: string, payload: unknown, action: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post(url, payload, { observe: 'response', responseType: 'text' })
    );
    this.parseApiResponse<unknown>(response, action);
  }

  private parseApiResponse<T>(response: HttpResponse<string>, action: string): T {
    const body = response.body ?? '';
    if (!body.trim()) {
      throw new Error(`The backend returned an empty response while trying to ${action}.`);
    }
    const parsed = JSON.parse(body) as ApiResponse<T>;
    return parsed.data;
  }
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
