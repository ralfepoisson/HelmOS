import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogTimeRange = '15m' | '30m' | '1h' | '6h' | '24h';

export interface AdminLogRecord {
  id: string;
  level: LogLevel;
  scope: string;
  event: string;
  message: string;
  context: Record<string, unknown>;
  createdAt: string;
}

export interface AdminLogsSnapshot {
  availableLevels: LogLevel[];
  filters: {
    query: string;
    timeRange: LogTimeRange;
    levels: LogLevel[];
  };
  summary: {
    matchingLogs: number;
    filtered: Record<LogLevel, number>;
    stored: Record<LogLevel, number>;
  };
  logs: AdminLogRecord[];
}

interface ApiResponse<T> {
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AdminLogsService {
  private readonly http = inject(HttpClient);
  private readonly primaryApiBaseUrl = '/api';
  private readonly fallbackApiBaseUrl = this.buildLocalDevApiBaseUrl();
  private readonly preferredApiBaseUrl = this.fallbackApiBaseUrl ?? this.primaryApiBaseUrl;

  async listLogs(filters: {
    query?: string;
    timeRange?: LogTimeRange;
    levels?: LogLevel[];
  }): Promise<AdminLogsSnapshot> {
    const query = new URLSearchParams();

    if (filters.query?.trim()) {
      query.set('q', filters.query.trim());
    }

    if (filters.timeRange) {
      query.set('timeRange', filters.timeRange);
    }

    if (filters.levels && filters.levels.length > 0) {
      query.set('levels', filters.levels.join(','));
    }

    const path = `/admin/logs${query.size > 0 ? `?${query.toString()}` : ''}`;
    const response = await this.requestWithDevFallback(path);

    return this.parseApiResponse<AdminLogsSnapshot>(response, 'load admin logs');
  }

  private async requestWithDevFallback(path: string): Promise<HttpResponse<string>> {
    if (this.preferredApiBaseUrl === this.fallbackApiBaseUrl && this.fallbackApiBaseUrl) {
      try {
        return await this.requestText(`${this.fallbackApiBaseUrl}${path}`);
      } catch (error) {
        throw this.normalizeRequestError(error, `${this.fallbackApiBaseUrl}${path}`);
      }
    }

    try {
      const primaryResponse = await this.requestText(`${this.primaryApiBaseUrl}${path}`);

      if (!this.shouldRetryAgainstFallback(primaryResponse)) {
        return primaryResponse;
      }
    } catch (error) {
      if (!this.shouldRetryAgainstFallbackError(error)) {
        throw error;
      }
    }

    try {
      return await this.requestText(`${this.fallbackApiBaseUrl}${path}`);
    } catch (error) {
      throw this.normalizeRequestError(error, `${this.fallbackApiBaseUrl}${path}`);
    }
  }

  private async requestText(url: string): Promise<HttpResponse<string>> {
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

    if (typeof error.error === 'string' && error.error.trim()) {
      try {
        const parsed = JSON.parse(error.error) as { error?: string };
        if (parsed.error) {
          return new Error(parsed.error);
        }
      } catch {
        return new Error(error.error);
      }
    }

    return new Error(`The admin API request failed with status ${error.status}.`);
  }

  private buildLocalDevApiBaseUrl(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return null;
    }

    return 'http://localhost:3001/api';
  }
}
