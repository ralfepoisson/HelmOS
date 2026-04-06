import { Injectable } from '@angular/core';

interface FailedRequestRecord {
  method: string;
  url: string;
  route: string;
  status: number | null;
  durationMs: number | null;
  requestId: string | null;
  requestHeaders?: Record<string, string>;
  responseBodyPreview?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupportTelemetryService {
  private initialized = false;
  private readonly consoleErrors: Array<Record<string, unknown>> = [];
  private readonly uncaughtErrors: Array<Record<string, unknown>> = [];
  private readonly promiseRejections: Array<Record<string, unknown>> = [];
  private readonly failedRequests: FailedRequestRecord[] = [];
  private readonly recentEvents: Array<Record<string, unknown>> = [];

  initialize(): void {
    if (this.initialized || typeof window === 'undefined') {
      return;
    }

    this.initialized = true;
    this.patchConsole();
    this.patchFetch();
    this.patchXmlHttpRequest();
    window.addEventListener('error', (event) => {
      this.pushBounded(this.uncaughtErrors, {
        level: 'error',
        message: event.message,
        stack: event.error?.stack ?? null,
        timestamp: new Date().toISOString()
      }, 20);
    });
    window.addEventListener('unhandledrejection', (event) => {
      this.pushBounded(this.promiseRejections, {
        level: 'error',
        message: String(event.reason?.message ?? event.reason ?? 'Unhandled rejection'),
        stack: event.reason?.stack ?? null,
        timestamp: new Date().toISOString()
      }, 20);
    });
  }

  trackEvent(type: string, label: string, metadata?: Record<string, unknown>): void {
    this.pushBounded(
      this.recentEvents,
      {
        type,
        label,
        metadata: metadata ?? null,
        timestamp: new Date().toISOString()
      },
      25
    );
  }

  captureContext(route: string, freeTextDetails = ''): Record<string, unknown> {
    const config = (window as typeof window & { __HELMOS_CONFIG__?: Record<string, unknown> }).__HELMOS_CONFIG__;

    return {
      pageUrl: window.location.href,
      route,
      userAgent: window.navigator.userAgent,
      browser: {
        language: window.navigator.language
      },
      platform: {
        platform: window.navigator.platform
      },
      release: {
        appVersion: String(config?.['appVersion'] ?? ''),
        buildVersion: String(config?.['buildVersion'] ?? ''),
        gitCommit: String(config?.['gitCommit'] ?? '')
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      consoleErrors: [...this.consoleErrors],
      uncaughtErrors: [...this.uncaughtErrors],
      promiseRejections: [...this.promiseRejections],
      failedRequests: [...this.failedRequests],
      recentEvents: [...this.recentEvents],
      correlationIds: this.failedRequests
        .map((entry) => entry.requestId)
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        .slice(-10),
      freeTextDetails,
      capturedAt: new Date().toISOString()
    };
  }

  private patchConsole(): void {
    const originalError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      this.pushBounded(
        this.consoleErrors,
        {
          level: 'error',
          message: args.map((entry) => String(entry)).join(' '),
          timestamp: new Date().toISOString()
        },
        20
      );
      originalError(...args);
    };
  }

  private patchFetch(): void {
    if (typeof window.fetch !== 'function') {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const startedAt = Date.now();
      const request = new Request(input, init);
      try {
        const response = await originalFetch(input, init);
        if (!response.ok) {
          this.recordFailedRequest({
            method: request.method,
            url: request.url,
            route: window.location.hash || window.location.pathname,
            status: response.status,
            durationMs: Date.now() - startedAt,
            requestId: response.headers.get('x-request-id') || response.headers.get('x-correlation-id')
          });
        }
        return response;
      } catch (error) {
        this.recordFailedRequest({
          method: request.method,
          url: request.url,
          route: window.location.hash || window.location.pathname,
          status: null,
          durationMs: Date.now() - startedAt,
          requestId: null,
          responseBodyPreview: String(error)
        });
        throw error;
      }
    };
  }

  private patchXmlHttpRequest(): void {
    const OriginalXhr = window.XMLHttpRequest;
    const service = this;

    function PatchedXhr(this: XMLHttpRequest) {
      const xhr = new OriginalXhr();
      const state: { method?: string; url?: string; startedAt?: number } = {};

      const open = xhr.open;
      xhr.open = function (method: string, url: string | URL, ...rest: unknown[]) {
        state.method = method;
        state.url = String(url);
        return open.call(this, method, url as string, ...(rest as [boolean, string, string]));
      };

      const send = xhr.send;
      xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
        state.startedAt = Date.now();
        xhr.addEventListener('loadend', () => {
          if (xhr.status >= 400 || xhr.status === 0) {
            service.recordFailedRequest({
              method: state.method ?? 'GET',
              url: state.url ?? '',
              route: window.location.hash || window.location.pathname,
              status: xhr.status || null,
              durationMs: state.startedAt ? Date.now() - state.startedAt : null,
              requestId: xhr.getResponseHeader('x-request-id') || xhr.getResponseHeader('x-correlation-id'),
              responseBodyPreview: xhr.responseText?.slice(0, 400)
            });
          }
        });
        return send.call(this, body ?? null);
      };

      return xhr;
    }

    window.XMLHttpRequest = PatchedXhr as unknown as typeof XMLHttpRequest;
  }

  private recordFailedRequest(record: FailedRequestRecord): void {
    this.pushBounded(this.failedRequests, record, 20);
  }

  private pushBounded<T>(target: T[], value: T, maxLength: number): void {
    target.push(value);
    if (target.length > maxLength) {
      target.splice(0, target.length - maxLength);
    }
  }
}
