import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { IdeationAgentResponsePayload } from '../ideation.models';

interface ApiEnvelope<T> {
  data: T;
}

interface ArtifactSection {
  heading?: string;
  content?: string;
}

interface ArtifactPayload {
  title: string;
  kind: string;
  summary?: string | null;
  sections: ArtifactSection[];
  metadata?: Record<string, unknown>;
}

interface RunStatusResponse {
  id: string;
  session_id: string;
  status: 'pending' | 'running' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled';
  request_type: string;
  requested_agent?: string | null;
  input_text: string;
  error_message?: string | null;
  normalized_output: Record<string, unknown> | IdeationAgentResponsePayload;
}

export interface RunSummaryResponse extends RunStatusResponse {
  artifacts: ArtifactPayload[];
}

@Injectable({
  providedIn: 'root'
})
export class AgentGatewayApiService {
  private readonly http = inject(HttpClient);
  private readonly primaryBaseUrl = '/api/v1';
  private readonly fallbackBaseUrl = 'http://localhost:8000/api/v1';

  async startIdeationRun(inputText: string, sessionTitle?: string): Promise<RunStatusResponse> {
    return this.requestWithFallback<RunStatusResponse>('/runs', 'POST', {
      input_text: inputText,
      request_type: 'ideation_chat',
      requested_agent: 'ideation',
      session: sessionTitle ? { title: sessionTitle } : undefined,
      context: {}
    });
  }

  async getRunSummary(runId: string): Promise<RunSummaryResponse> {
    return this.requestWithFallback<RunSummaryResponse>(`/runs/${runId}/summary`);
  }

  async waitForRunCompletion(runId: string, maxAttempts = 12, delayMs = 1000): Promise<RunSummaryResponse> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const summary = await this.getRunSummary(runId);
      if (['completed', 'failed', 'cancelled', 'waiting_for_approval'].includes(summary.status)) {
        return summary;
      }
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }

    return this.getRunSummary(runId);
  }

  private async requestWithFallback<T>(
    path: string,
    method: 'GET' | 'POST' = 'GET',
    payload?: unknown
  ): Promise<T> {
    try {
      return await this.request<T>(`${this.primaryBaseUrl}${path}`, method, payload);
    } catch (error) {
      if (!this.shouldRetryAgainstFallback(error)) {
        throw error;
      }
      return this.request<T>(`${this.fallbackBaseUrl}${path}`, method, payload);
    }
  }

  private async request<T>(url: string, method: 'GET' | 'POST', payload?: unknown): Promise<T> {
    const response =
      method === 'POST'
        ? await firstValueFrom(this.http.post<ApiEnvelope<T> | T>(url, payload, { observe: 'response' }))
        : await firstValueFrom(this.http.get<ApiEnvelope<T> | T>(url, { observe: 'response' }));

    return this.unwrapResponse(response, url);
  }

  private unwrapResponse<T>(response: HttpResponse<ApiEnvelope<T> | T>, url: string): T {
    const body = response.body;

    if (!body || typeof body !== 'object') {
      throw new Error(`The agent gateway returned an invalid response for ${url}.`);
    }

    if (this.isApiEnvelope(body)) {
      return body.data;
    }

    return body as T;
  }

  private shouldRetryAgainstFallback(error: unknown): boolean {
    if (error instanceof Error && error.message.includes('invalid response')) {
      return true;
    }

    if (error instanceof HttpErrorResponse) {
      const errorBody =
        typeof error.error === 'string'
          ? error.error
          : typeof error.error?.text === 'string'
            ? error.error.text
            : '';

      return (
        error.status === 0 ||
        error.status === 404 ||
        error.status === 200 ||
        (error.status >= 500 && error.status < 600) ||
        errorBody.trimStart().startsWith('<!doctype') ||
        errorBody.includes('<html')
      );
    }

    return (
      error instanceof HttpErrorResponse &&
      (error.status === 0 || error.status === 404 || (error.status >= 500 && error.status < 600))
    );
  }

  private isApiEnvelope<T>(body: ApiEnvelope<T> | T): body is ApiEnvelope<T> {
    return typeof body === 'object' && body !== null && 'data' in body;
  }
}
