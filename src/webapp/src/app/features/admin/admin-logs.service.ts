import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { readAuthConfig } from '../../core/auth/bootstrap-auth';

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
  availableScopes: string[];
  filters: {
    query: string;
    timeRange: LogTimeRange;
    levels: LogLevel[];
    scope: string;
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
  private readonly apiBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api`;

  async listLogs(filters: {
    query?: string;
    timeRange?: LogTimeRange;
    levels?: LogLevel[];
    scope?: string;
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

    if (filters.scope?.trim()) {
      query.set('scope', filters.scope.trim());
    }

    const path = `/admin/logs${query.size > 0 ? `?${query.toString()}` : ''}`;
    const response = await this.requestText(`${this.apiBaseUrl}${path}`);

    return this.parseApiResponse<AdminLogsSnapshot>(response, 'load admin logs');
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
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
