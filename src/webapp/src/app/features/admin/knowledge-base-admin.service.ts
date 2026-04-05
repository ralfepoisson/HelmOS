import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { readAuthConfig } from '../../core/auth/bootstrap-auth';

export interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description: string | null;
  ownerType: string | null;
  ownerId: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; displayName: string | null; email: string } | null;
  updatedBy: { id: string; displayName: string | null; email: string } | null;
  fileCount: number;
  embeddingCount: number;
}

export interface KnowledgeBaseFileRecord {
  id: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string | null;
  originalFilename: string;
  storedObjectKey: string;
  storageProvider: 'LOCAL' | 'S3';
  mimeType: string;
  fileExtension: string;
  fileSizeBytes: number;
  checksumSha256: string | null;
  sourceType: string | null;
  submittedAt: string;
  submittedBy: { id: string; displayName: string | null; email: string } | null;
  processingStatus: 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DELETED';
  errorMessage: string | null;
  mediaDurationMs: number | null;
  pageCount: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  deletedAt: string | null;
  metadata: Record<string, unknown> | null;
  tags: string[];
  embeddingCount: number;
}

export interface KnowledgeBaseDetail extends KnowledgeBaseSummary {
  files: KnowledgeBaseFileRecord[];
}

export interface KnowledgeBaseFileDetail extends KnowledgeBaseFileRecord {
  chunks: Array<{
    id: string;
    chunkIndex: number;
    chunkText: string;
    chunkSummary: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  jobs: Array<{
    id: string;
    status: string;
    attemptCount: number;
    availableAt: string;
    startedAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface KnowledgeBaseSearchResult {
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  fileId: string;
  filename: string;
  mimeType: string;
  tags: string[];
  score: number;
  chunkText: string;
  chunkSummary: string | null;
  chunkIndex: number;
  metadata: Record<string, unknown> | null;
  submittedAt: string;
  submittedBy: string | null;
}

interface ApiResponse<T> {
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class KnowledgeBaseAdminService {
  private readonly http = inject(HttpClient);
  private readonly primaryApiBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api`;
  private readonly fallbackApiBaseUrl = this.buildLocalDevApiBaseUrl();
  private readonly preferredApiBaseUrl = this.fallbackApiBaseUrl ?? this.primaryApiBaseUrl;

  async listKnowledgeBases(): Promise<KnowledgeBaseSummary[]> {
    const response = await this.requestWithDevFallback('/admin/knowledge-bases');
    return this.parseApiResponse<KnowledgeBaseSummary[]>(response, 'load knowledge bases');
  }

  async getKnowledgeBase(id: string): Promise<KnowledgeBaseDetail> {
    const response = await this.requestWithDevFallback(`/admin/knowledge-bases/${id}`);
    return this.parseApiResponse<KnowledgeBaseDetail>(response, 'load knowledge base details');
  }

  async createKnowledgeBase(payload: {
    name: string;
    description?: string | null;
    ownerType?: string | null;
    ownerId?: string | null;
    status?: 'ACTIVE' | 'ARCHIVED';
  }): Promise<KnowledgeBaseSummary> {
    const response = await this.requestWithDevFallback('/admin/knowledge-bases', payload, 'POST');
    return this.parseApiResponse<KnowledgeBaseSummary>(response, 'create a knowledge base');
  }

  async updateKnowledgeBase(
    id: string,
    payload: Partial<{
      name: string;
      description: string | null;
      ownerType: string | null;
      ownerId: string | null;
      status: 'ACTIVE' | 'ARCHIVED';
    }>
  ): Promise<KnowledgeBaseSummary> {
    const response = await this.requestWithDevFallback(`/admin/knowledge-bases/${id}`, payload, 'PUT');
    return this.parseApiResponse<KnowledgeBaseSummary>(response, 'update the knowledge base');
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    await this.requestWithDevFallback(`/admin/knowledge-bases/${id}`, undefined, 'DELETE');
  }

  async uploadFile(payload: {
    knowledgeBaseId: string;
    originalFilename: string;
    mimeType: string;
    contentBase64: string;
    sourceType?: string | null;
    tags?: string[];
  }): Promise<KnowledgeBaseFileRecord> {
    const response = await this.requestWithDevFallback('/admin/knowledge-base-files/upload', payload, 'POST');
    return this.parseApiResponse<KnowledgeBaseFileRecord>(response, 'upload the file');
  }

  async getFile(id: string): Promise<KnowledgeBaseFileDetail> {
    const response = await this.requestWithDevFallback(`/admin/knowledge-base-files/${id}`);
    return this.parseApiResponse<KnowledgeBaseFileDetail>(response, 'load the file details');
  }

  async deleteFile(id: string): Promise<void> {
    await this.requestWithDevFallback(`/admin/knowledge-base-files/${id}`, undefined, 'DELETE');
  }

  async search(payload: {
    query: string;
    knowledgeBaseIds?: string[];
    tags?: string[];
    mediaTypes?: Array<'text' | 'document' | 'image' | 'audio' | 'video'>;
    limit?: number;
  }): Promise<KnowledgeBaseSearchResult[]> {
    const response = await this.requestWithDevFallback('/admin/knowledge-base-search', payload, 'POST');
    return this.parseApiResponse<KnowledgeBaseSearchResult[]>(response, 'search the knowledge base');
  }

  private async requestWithDevFallback(
    path: string,
    payload?: unknown,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'
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

    if (!this.fallbackApiBaseUrl) {
      throw new Error('The admin API is unavailable.');
    }

    try {
      return await this.requestText(`${this.fallbackApiBaseUrl}${path}`, method, payload);
    } catch (error) {
      throw this.normalizeRequestError(error, `${this.fallbackApiBaseUrl}${path}`);
    }
  }

  private async requestText(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    payload?: unknown
  ): Promise<HttpResponse<string>> {
    if (method === 'POST') {
      return firstValueFrom(this.http.post(url, payload, { observe: 'response', responseType: 'text' }));
    }

    if (method === 'PUT') {
      return firstValueFrom(this.http.put(url, payload, { observe: 'response', responseType: 'text' }));
    }

    if (method === 'DELETE') {
      return firstValueFrom(this.http.delete(url, { observe: 'response', responseType: 'text' }));
    }

    return firstValueFrom(this.http.get(url, { observe: 'response', responseType: 'text' }));
  }

  private parseApiResponse<T>(response: HttpResponse<string>, action: string): T {
    const body = response.body ?? '';
    const contentType = response.headers.get('content-type') ?? '';

    if (!body.trim()) {
      if (response.status === 204) {
        return undefined as T;
      }
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
    if (!this.fallbackApiBaseUrl || !(error instanceof HttpErrorResponse)) {
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
      return error instanceof Error ? error : new Error('The knowledge base admin API request failed.');
    }

    if (error.status === 0) {
      return new Error(
        `The knowledge base admin API is unavailable at ${url}. Start the backend server or check that the local proxy is forwarding /api requests correctly.`
      );
    }

    const message =
      typeof error.error === 'string'
        ? extractErrorMessage(error.error)
        : typeof error.error?.error === 'string'
          ? error.error.error
          : error.message;

    return new Error(message || 'The knowledge base admin API request failed.');
  }

  private buildLocalDevApiBaseUrl(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001/api';
    }

    return null;
  }
}

function normalizeBaseUrl(url: string | null | undefined): string {
  const trimmed = `${url ?? ''}`.trim();
  return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : '';
}

function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: string };
    return parsed.error ?? body;
  } catch {
    return body;
  }
}
