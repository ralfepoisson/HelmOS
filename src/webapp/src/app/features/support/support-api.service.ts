import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { readAuthConfig } from '../../core/auth/bootstrap-auth';
import { SupportConversationState, SupportConversationTurnResponse } from './support.models';

interface ApiResponse<T> {
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class SupportApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api`;

  async getCurrentConversation(sessionKey: string): Promise<SupportConversationState | null> {
    const response = await firstValueFrom(
      this.http.get(`${this.apiBaseUrl}/support/conversations/current`, {
        observe: 'response',
        responseType: 'text',
        params: {
          sessionKey
        }
      })
    );

    return this.parseApiResponse<SupportConversationState | null>(response, 'load the support conversation');
  }

  async sendMessage(payload: {
    sessionKey: string;
    messageText: string;
    clientContext: Record<string, unknown>;
  }): Promise<SupportConversationTurnResponse> {
    const response = await firstValueFrom(
      this.http.post(`${this.apiBaseUrl}/support/conversations/current/messages`, payload, {
        observe: 'response',
        responseType: 'text'
      })
    );

    return this.parseApiResponse<SupportConversationTurnResponse>(response, 'send the support message');
  }

  private parseApiResponse<T>(response: HttpResponse<string>, action: string): T {
    const body = response.body ?? '';
    const contentType = response.headers.get('content-type') ?? '';

    if (!body.trim()) {
      throw new Error(`The backend returned an empty response while trying to ${action}.`);
    }

    try {
      const parsed = JSON.parse(body) as ApiResponse<T>;
      if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
        throw new Error('Response JSON is missing the expected data envelope.');
      }
      return parsed.data;
    } catch {
      if (contentType.includes('text/html') || body.trimStart().startsWith('<!doctype')) {
        throw new Error(
          `The support API returned HTML instead of JSON while trying to ${action}. Check that the backend API is running.`
        );
      }
      throw new Error(`The backend returned an invalid response while trying to ${action}.`);
    }
  }
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
