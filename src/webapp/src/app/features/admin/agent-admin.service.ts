import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { readAuthConfig } from '../../core/auth/bootstrap-auth';

export interface AgentGatewayStatus {
  configured: boolean;
  status: 'online' | 'offline' | 'not_configured';
  message: string;
  baseUrl: string | null;
  service: string | null;
  checkedAt: string;
  agents: RuntimeAgent[];
}

export interface RuntimeAgent {
  key: string;
  name: string;
  version: string;
  purpose: string;
  allowed_tools?: string[];
  allowedTools?: string[];
}

export interface AgentPromptConfig {
  id: string;
  key: string;
  version: string;
  promptTemplate: string;
  configJson: Record<string, unknown>;
  active: boolean;
  updatedAt: string;
}

export interface AgentRuntimeStatus {
  registered: boolean;
  name: string | null;
  version: string | null;
  purpose: string | null;
  allowedTools: string[];
}

export interface AgentAdminRecord {
  id: string;
  key: string;
  name: string;
  version: string;
  description: string | null;
  allowedTools: string[];
  defaultModel: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  promptConfig: AgentPromptConfig | null;
  runtime: AgentRuntimeStatus;
}

export interface AgentAdminSnapshot {
  gateway: AgentGatewayStatus;
  agents: AgentAdminRecord[];
}

export interface UpdateAgentAdminPayload {
  name?: string;
  version?: string;
  description?: string | null;
  allowedTools?: string[];
  defaultModel?: string | null;
  active?: boolean;
  promptConfig?: {
    key?: string;
    version: string;
    promptTemplate: string;
    configJson?: Record<string, unknown>;
  };
}

export interface CreateAgentAdminPayload {
  key: string;
  name: string;
  version: string;
  description?: string | null;
  allowedTools?: string[];
  defaultModel?: string | null;
  active?: boolean;
  promptConfig: {
    key?: string;
    version: string;
    promptTemplate: string;
    configJson?: Record<string, unknown>;
  };
}

interface ApiResponse<T> {
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AgentAdminService {
  private readonly http = inject(HttpClient);
  private readonly primaryApiBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api`;
  private readonly fallbackApiBaseUrl = this.buildLocalDevApiBaseUrl();
  private readonly preferredApiBaseUrl = this.fallbackApiBaseUrl ?? this.primaryApiBaseUrl;

  async listAgents(): Promise<AgentAdminSnapshot> {
    const response = await this.requestWithDevFallback('/admin/agents');

    return this.parseApiResponse<AgentAdminSnapshot>(response, 'load agent admin data');
  }

  async updateAgent(agentId: string, payload: UpdateAgentAdminPayload): Promise<AgentAdminRecord> {
    const response = await this.requestWithDevFallback(`/admin/agents/${agentId}`, payload);

    return this.parseApiResponse<AgentAdminRecord>(response, 'save agent admin changes');
  }

  async createAgent(payload: CreateAgentAdminPayload): Promise<AgentAdminRecord> {
    const response = await this.requestWithDevFallback('/admin/agents', payload, 'POST');

    return this.parseApiResponse<AgentAdminRecord>(response, 'create an agent admin record');
  }

  private async requestWithDevFallback(
    path: string,
    payload?: UpdateAgentAdminPayload | CreateAgentAdminPayload,
    method: 'GET' | 'POST' | 'PATCH' = 'GET'
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
    method: 'GET' | 'POST' | 'PATCH',
    payload?: UpdateAgentAdminPayload | CreateAgentAdminPayload
  ): Promise<HttpResponse<string>> {
    if (method === 'POST') {
      return firstValueFrom(
        this.http.post(url, payload, {
          observe: 'response',
          responseType: 'text'
        })
      );
    }

    if (method === 'PATCH') {
      return firstValueFrom(
        this.http.patch(url, payload, {
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
      const parsed = JSON.parse(body) as ApiResponse<T>;

      if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
        throw new Error('Response JSON is missing the expected data envelope.');
      }

      return parsed.data;
    } catch {
      if (contentType.includes('text/html') || body.trimStart().startsWith('<!doctype')) {
        throw new Error(
          `The admin API returned HTML instead of JSON while trying to ${action}. Check that the frontend proxy and backend API are both running.`
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
      return error instanceof Error ? error : new Error('The admin API request failed.');
    }

    if (error.status === 0) {
      return new Error(
        `The admin API is unavailable at ${url}. Start the backend server or check that the local proxy is forwarding /api requests correctly.`
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
