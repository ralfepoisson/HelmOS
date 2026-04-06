import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { BusinessIdeaOption, BusinessType, StrategyCopilotData } from '../../features/ideation/ideation.models';
import { readAuthConfig } from '../auth/bootstrap-auth';

interface ApiEnvelope<T> {
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class BusinessIdeasApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api`;

  async listBusinessIdeas(): Promise<BusinessIdeaOption[]> {
    const response = await this.requestText(`${this.apiBaseUrl}/business-ideas`, 'GET');
    return this.parseApiResponse<BusinessIdeaOption[]>(response, 'load business ideas');
  }

  async getBusinessIdea(workspaceId: string): Promise<StrategyCopilotData> {
    const response = await this.requestText(`${this.apiBaseUrl}/business-ideas/${workspaceId}`, 'GET');
    return this.parseApiResponse<StrategyCopilotData>(response, 'load the business idea workspace');
  }

  async createBusinessIdea(payload: { name: string; businessType: BusinessType }): Promise<StrategyCopilotData> {
    const response = await this.requestText(`${this.apiBaseUrl}/business-ideas`, 'POST', payload);
    return this.parseApiResponse<StrategyCopilotData>(response, 'create the business idea');
  }

  async sendIdeationMessage(workspaceId: string, messageText: string): Promise<StrategyCopilotData> {
    const response = await this.requestText(`${this.apiBaseUrl}/business-ideas/${workspaceId}/ideation/messages`, 'POST', {
      messageText
    });
    return this.parseApiResponse<StrategyCopilotData>(response, 'send the ideation chat message');
  }

  async resendLastIdeationMessage(workspaceId: string): Promise<StrategyCopilotData> {
    const response = await this.requestText(
      `${this.apiBaseUrl}/business-ideas/${workspaceId}/ideation/messages/retry-last`,
      'POST',
      {}
    );
    return this.parseApiResponse<StrategyCopilotData>(response, 'resend the latest ideation chat message');
  }

  async getValueProposition(workspaceId: string): Promise<StrategyCopilotData> {
    const response = await this.requestText(`${this.apiBaseUrl}/business-ideas/${workspaceId}/value-proposition`, 'GET');
    return this.parseApiResponse<StrategyCopilotData>(response, 'load the value proposition workspace');
  }

  async sendValuePropositionMessage(workspaceId: string, messageText: string): Promise<StrategyCopilotData> {
    const response = await this.requestText(
      `${this.apiBaseUrl}/business-ideas/${workspaceId}/value-proposition/messages`,
      'POST',
      { messageText }
    );
    return this.parseApiResponse<StrategyCopilotData>(response, 'send the value proposition chat message');
  }

  async resendLastValuePropositionMessage(workspaceId: string): Promise<StrategyCopilotData> {
    const response = await this.requestText(
      `${this.apiBaseUrl}/business-ideas/${workspaceId}/value-proposition/messages/retry-last`,
      'POST',
      {}
    );
    return this.parseApiResponse<StrategyCopilotData>(response, 'resend the latest value proposition chat message');
  }

  private async requestText(
    url: string,
    method: 'GET' | 'POST',
    payload?: unknown
  ): Promise<HttpResponse<string>> {
    if (method === 'POST') {
      return firstValueFrom(
        this.http.post(url, payload, {
          observe: 'response',
          responseType: 'text'
        })
      );
    }

    return firstValueFrom(
      this.http.get(url, {
        observe: 'response',
        responseType: 'text'
      })
    );
  }

  private parseApiResponse<T>(response: HttpResponse<string>, action: string): T {
    const body = response.body ?? '';
    const contentType = response.headers.get('content-type') ?? '';

    if (!body.trim()) {
      throw new Error(`The backend returned an empty response while trying to ${action}.`);
    }

    try {
      const parsed = JSON.parse(body) as ApiEnvelope<T>;

      if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
        throw new Error('Response JSON is missing the expected data envelope.');
      }

      return parsed.data;
    } catch {
      if (contentType.includes('text/html') || body.trimStart().startsWith('<!doctype')) {
        throw new Error(
          `The business idea API returned HTML instead of JSON while trying to ${action}. Check that the frontend proxy and backend API are both running.`
        );
      }

      throw new Error(`The backend returned an invalid response while trying to ${action}.`);
    }
  }

  private normalizeRequestError(error: unknown, url: string): Error {
    if (!(error instanceof HttpErrorResponse)) {
      return error instanceof Error ? error : new Error('The business idea API request failed.');
    }

    if (error.status === 0) {
      return new Error(
        `The business idea API is unavailable at ${url}. Start the backend server or check that the local proxy is forwarding /api requests correctly.`
      );
    }

    return new Error(error.error?.error ?? error.message);
  }
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
