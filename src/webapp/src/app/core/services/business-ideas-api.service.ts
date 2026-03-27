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
  private readonly primaryApiBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api`;
  private readonly fallbackApiBaseUrl = this.buildLocalDevApiBaseUrl();
  private readonly preferredApiBaseUrl = this.fallbackApiBaseUrl ?? this.primaryApiBaseUrl;

  async listBusinessIdeas(): Promise<BusinessIdeaOption[]> {
    const response = await this.requestWithDevFallback('/business-ideas');
    return this.parseApiResponse<BusinessIdeaOption[]>(response, 'load business ideas');
  }

  async getBusinessIdea(workspaceId: string): Promise<StrategyCopilotData> {
    const response = await this.requestWithDevFallback(`/business-ideas/${workspaceId}`);
    return this.parseApiResponse<StrategyCopilotData>(response, 'load the business idea workspace');
  }

  async createBusinessIdea(payload: { name: string; businessType: BusinessType }): Promise<StrategyCopilotData> {
    const response = await this.requestWithDevFallback('/business-ideas', payload, 'POST');
    return this.parseApiResponse<StrategyCopilotData>(response, 'create the business idea');
  }

  async sendIdeationMessage(workspaceId: string, messageText: string): Promise<StrategyCopilotData> {
    const response = await this.requestWithDevFallback(
      `/business-ideas/${workspaceId}/ideation/messages`,
      { messageText },
      'POST'
    );
    return this.parseApiResponse<StrategyCopilotData>(response, 'send the ideation chat message');
  }

  async resendLastIdeationMessage(workspaceId: string): Promise<StrategyCopilotData> {
    const response = await this.requestWithDevFallback(
      `/business-ideas/${workspaceId}/ideation/messages/retry-last`,
      {},
      'POST'
    );
    return this.parseApiResponse<StrategyCopilotData>(response, 'resend the latest ideation chat message');
  }

  private async requestWithDevFallback(
    path: string,
    payload?: unknown,
    method: 'GET' | 'POST' = 'GET'
  ): Promise<HttpResponse<string>> {
    if (this.preferredApiBaseUrl === this.fallbackApiBaseUrl && this.fallbackApiBaseUrl) {
      try {
        return await this.requestText(`${this.fallbackApiBaseUrl}${path}`, method, payload);
      } catch (error) {
        throw this.normalizeRequestError(error, `${this.fallbackApiBaseUrl}${path}`);
      }
    }

    try {
      const primaryResponse = await this.requestText(`${this.primaryApiBaseUrl}${path}`, method, payload);

      if (!this.shouldRetryAgainstFallback(primaryResponse)) {
        return primaryResponse;
      }
    } catch (error) {
      if (!this.shouldRetryAgainstFallbackError(error)) {
        throw error;
      }
    }

    try {
      return await this.requestText(`${this.fallbackApiBaseUrl}${path}`, method, payload);
    } catch (error) {
      throw this.normalizeRequestError(error, `${this.fallbackApiBaseUrl}${path}`);
    }
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

  private shouldRetryAgainstFallback(response: HttpResponse<string>): boolean {
    if (!this.fallbackApiBaseUrl) {
      return false;
    }

    const body = response.body ?? '';
    const contentType = response.headers.get('content-type') ?? '';

    return contentType.includes('text/html') || body.trimStart().startsWith('<!doctype');
  }

  private shouldRetryAgainstFallbackError(error: unknown): boolean {
    if (!this.fallbackApiBaseUrl) {
      return false;
    }

    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    const errorBody =
      typeof error.error === 'string'
        ? error.error
        : typeof error.error?.text === 'string'
          ? error.error.text
          : '';

    return (
      error.status === 0 ||
      error.status === 404 ||
      (error.status >= 500 && error.status < 600) ||
      errorBody.trimStart().startsWith('<!doctype') ||
      errorBody.includes('<html')
    );
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

  private buildLocalDevApiBaseUrl(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (this.primaryApiBaseUrl !== `${window.location.origin}/api`) {
      return null;
    }

    const { hostname, port, protocol } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (!isLocalHost || port === '3001') {
      return null;
    }

    return `${protocol}//${hostname}:3001/api`;
  }
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
