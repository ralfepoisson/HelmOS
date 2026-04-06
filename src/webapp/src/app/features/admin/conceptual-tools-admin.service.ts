import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { readAuthConfig } from '../../core/auth/bootstrap-auth';

export type ConceptualToolStatus = 'ACTIVE' | 'INACTIVE';

export interface ConceptualToolRecord {
  id: string;
  name: string;
  category: string;
  purpose: string;
  whenToUse: string[];
  whenNotToUse: string[];
  instructions: string[];
  expectedEffect: string;
  status: ConceptualToolStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptualToolUpsertPayload {
  name?: string;
  category?: string;
  purpose?: string;
  whenToUse?: string | string[];
  whenNotToUse?: string | string[];
  instructions?: string | string[];
  expectedEffect?: string;
  status?: 'active' | 'inactive' | ConceptualToolStatus;
  version?: number;
}

interface ApiResponse<T> {
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class ConceptualToolsAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api`;

  async listConceptualTools(status?: 'active' | 'inactive' | 'all'): Promise<ConceptualToolRecord[]> {
    const suffix = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    const response = await this.requestText(`${this.apiBaseUrl}/admin/conceptual-tools${suffix}`, 'GET');
    return this.parseApiResponse<ConceptualToolRecord[]>(response, 'load conceptual tools');
  }

  async getConceptualTool(id: string): Promise<ConceptualToolRecord> {
    const response = await this.requestText(`${this.apiBaseUrl}/admin/conceptual-tools/${id}`, 'GET');
    return this.parseApiResponse<ConceptualToolRecord>(response, 'load the conceptual tool');
  }

  async createConceptualTool(payload: ConceptualToolUpsertPayload): Promise<ConceptualToolRecord> {
    const response = await this.requestText(`${this.apiBaseUrl}/admin/conceptual-tools`, 'POST', payload);
    return this.parseApiResponse<ConceptualToolRecord>(response, 'create the conceptual tool');
  }

  async updateConceptualTool(id: string, payload: ConceptualToolUpsertPayload): Promise<ConceptualToolRecord> {
    const response = await this.requestText(`${this.apiBaseUrl}/admin/conceptual-tools/${id}`, 'PUT', payload);
    return this.parseApiResponse<ConceptualToolRecord>(response, 'update the conceptual tool');
  }

  private async requestText(
    url: string,
    method: 'GET' | 'POST' | 'PUT',
    payload?: unknown
  ): Promise<HttpResponse<string>> {
    if (method === 'POST') {
      return firstValueFrom(this.http.post(url, payload, { observe: 'response', responseType: 'text' }));
    }

    if (method === 'PUT') {
      return firstValueFrom(this.http.put(url, payload, { observe: 'response', responseType: 'text' }));
    }

    return firstValueFrom(this.http.get(url, { observe: 'response', responseType: 'text' }));
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
}

function normalizeBaseUrl(value: string | null | undefined): string {
  return `${value ?? ''}`.trim().replace(/\/+$/, '');
}
