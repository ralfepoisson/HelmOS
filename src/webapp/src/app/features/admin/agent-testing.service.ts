import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
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
  max_turns: number;
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
  snapshots: AgentTestRunSnapshot[];
  turns: AgentTestTranscriptTurn[];
  annotations: AgentTestAnnotation[];
  scores: AgentTestScore[];
}

export interface AgentTestRunSnapshot {
  id: string;
  snapshot_type: string;
  source_ref?: string | null;
  checksum?: string | null;
  created_at: string;
  content_text?: string | null;
  content_json: Record<string, unknown>;
}

export interface AgentTestTranscriptTurn {
  id: string;
  turn_index: number;
  actor_type: string;
  message_role: string;
  message_text: string;
  structured_payload: Record<string, unknown>;
  token_usage_json: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface AgentTestAnnotation {
  id: string;
  turn_index: number;
  actor_type: string;
  tag: string;
  severity: string;
  confidence: number;
  evidence_text?: string | null;
  evidence_span: Record<string, unknown>;
  linked_scoring_dimensions: string[];
  source_type: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface AgentTestScore {
  id: string;
  layer_key: string;
  dimension_key: string;
  raw_score: number;
  normalized_score: number;
  weight_percent: number;
  blocking: boolean;
  blocking_threshold?: number | null;
  confidence: number;
  evidence_turn_refs: number[];
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface CreateAgentTestRunPayload {
  target_agent_key: string;
  fixture_key: string;
  fixture_version?: string | null;
  test_mode: string;
  suite_key?: string | null;
  target_model_name?: string | null;
  testing_agent_model_name?: string | null;
  min_turns: number;
  max_turns: number;
  operator_notes?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AgentTestingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api/v1`;

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

  async stopRun(runId: string): Promise<AgentTestRunDetail> {
    return this.requestWithFallback<AgentTestRunDetail>(`/admin/agent-tests/runs/${runId}/stop`, 'POST', {});
  }

  async resumeRun(runId: string): Promise<AgentTestRunDetail> {
    return this.requestWithFallback<AgentTestRunDetail>(`/admin/agent-tests/runs/${runId}/resume`, 'POST', {});
  }

  async deleteRun(runId: string): Promise<void> {
    await this.requestWithFallback<{ status: string; detail?: string }>(`/admin/agent-tests/runs/${runId}`, 'DELETE');
  }

  private async requestWithFallback<T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    payload?: unknown
  ): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, method, payload);
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

  private isApiEnvelope<T>(body: ApiEnvelope<T> | T): body is ApiEnvelope<T> {
    return typeof body === 'object' && body !== null && 'data' in body;
  }
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
