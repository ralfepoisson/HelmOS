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
  private readonly apiBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api`;

  async listAgents(): Promise<AgentAdminSnapshot> {
    const response = await this.requestText(`${this.apiBaseUrl}/admin/agents`, 'GET');

    return this.parseApiResponse<AgentAdminSnapshot>(response, 'load agent admin data');
  }

  async getAgent(agentId: string): Promise<AgentAdminRecord> {
    const response = await this.requestText(`${this.apiBaseUrl}/admin/agents/${agentId}`, 'GET');

    return this.parseApiResponse<AgentAdminRecord>(response, 'load the selected agent');
  }

  async updateAgent(agentId: string, payload: UpdateAgentAdminPayload): Promise<AgentAdminRecord> {
    const response = await this.requestText(`${this.apiBaseUrl}/admin/agents/${agentId}`, 'PATCH', payload);

    return this.parseApiResponse<AgentAdminRecord>(response, 'save agent admin changes');
  }

  async createAgent(payload: CreateAgentAdminPayload): Promise<AgentAdminRecord> {
    const response = await this.requestText(`${this.apiBaseUrl}/admin/agents`, 'POST', payload);

    return this.parseApiResponse<AgentAdminRecord>(response, 'create an agent admin record');
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
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
