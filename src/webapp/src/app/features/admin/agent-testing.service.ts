import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { readAuthConfig } from '../../core/auth/bootstrap-auth';

interface ApiEnvelope<T> {
  data: T;
}

export interface AgentTestFixtureSummary {
  fixture_key: string;
  fixture_version: string;
  fixture_class: string;
  title: string;
  applicable_agents: string[];
  min_turns: number;
  max_turns: number;
  scenario_dimensions: string[];
  path: string;
}

export interface AgentTestRunSummary {
  id: string;
  suite_key?: string | null;
  test_mode: string;
  target_agent_key: string;
  target_agent_version?: string | null;
  target_model_name?: string | null;
  testing_agent_model_name?: string | null;
  fixture_key: string;
  fixture_version: string;
  rubric_version: string;
  driver_version: string;
  status: string;
  actual_turns: number;
  min_turns: number;
  overall_score: number;
  aggregate_confidence: number;
  verdict: string;
  review_required: boolean;
  summary?: string | null;
  operator_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentTestRunDetail extends AgentTestRunSummary {
  report_markdown?: string | null;
  report_json: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  snapshots: Array<{
    id: string;
    snapshot_type: string;
    source_ref?: string | null;
    checksum?: string | null;
    created_at: string;
  }>;
}

export interface CreateAgentTestRunPayload {
  target_agent_key: string;
  fixture_key: string;
  fixture_version?: string | null;
  test_mode: string;
  suite_key?: string | null;
  target_model_name?: string | null;
  testing_agent_model_name?: string | null;
  operator_notes?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AgentTestingService {
  private readonly http = inject(HttpClient);
  private readonly primaryBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api/v1`;
  private readonly fallbackBaseUrl = this.buildLocalDevFallbackBaseUrl();

  async listFixtures(): Promise<AgentTestFixtureSummary[]> {
    const response = await this.requestWithFallback<{ fixtures: AgentTestFixtureSummary[] }>('/admin/agent-tests/fixtures');
    return response.fixtures;
  }

  async listRuns(targetAgentKey: string): Promise<AgentTestRunSummary[]> {
    const response = await this.requestWithFallback<{ runs: AgentTestRunSummary[] }>(
      `/admin/agent-tests/runs?target_agent_key=${encodeURIComponent(targetAgentKey)}`
    );
    return response.runs;
  }

  async createRun(payload: CreateAgentTestRunPayload): Promise<AgentTestRunSummary> {
    return this.requestWithFallback<AgentTestRunSummary>('/admin/agent-tests/runs', 'POST', payload);
  }

  async getRun(runId: string): Promise<AgentTestRunDetail> {
    return this.requestWithFallback<AgentTestRunDetail>(`/admin/agent-tests/runs/${runId}`);
  }

  async executeRun(runId: string): Promise<AgentTestRunDetail> {
    return this.requestWithFallback<AgentTestRunDetail>(`/admin/agent-tests/runs/${runId}/execute`, 'POST', {});
  }

  async deleteRun(runId: string): Promise<void> {
    await this.requestWithFallback<{ status: string; detail?: string }>(`/admin/agent-tests/runs/${runId}`, 'DELETE');
  }

  private async requestWithFallback<T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    payload?: unknown
  ): Promise<T> {
    try {
      return await this.request<T>(`${this.primaryBaseUrl}${path}`, method, payload);
    } catch (error) {
      if (!this.shouldRetryAgainstFallback(error) || !this.fallbackBaseUrl) {
        throw error;
      }
      return this.request<T>(`${this.fallbackBaseUrl}${path}`, method, payload);
    }
  }

  private async request<T>(url: string, method: 'GET' | 'POST' | 'DELETE', payload?: unknown): Promise<T> {
    const response =
      method === 'POST'
        ? await firstValueFrom(this.http.post<ApiEnvelope<T> | T>(url, payload, { observe: 'response' }))
        : method === 'DELETE'
          ? await firstValueFrom(this.http.delete<ApiEnvelope<T> | T>(url, { observe: 'response' }))
        : await firstValueFrom(this.http.get<ApiEnvelope<T> | T>(url, { observe: 'response' }));

    return this.unwrapResponse(response, url);
  }

  private unwrapResponse<T>(response: HttpResponse<ApiEnvelope<T> | T>, url: string): T {
    const body = response.body;

    if (!body || typeof body !== 'object') {
      throw new Error(`The agent testing API returned an invalid response for ${url}.`);
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

    return false;
  }

  private isApiEnvelope<T>(body: ApiEnvelope<T> | T): body is ApiEnvelope<T> {
    return typeof body === 'object' && body !== null && 'data' in body;
  }

  private buildLocalDevFallbackBaseUrl(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (this.primaryBaseUrl !== `${window.location.origin}/api/v1`) {
      return null;
    }

    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return null;
    }

    return 'http://localhost:8000/api/v1';
  }
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
