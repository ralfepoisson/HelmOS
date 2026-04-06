import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AdminLogsService } from './admin-logs.service';

describe('AdminLogsService', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__ = undefined;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    delete (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__;
  });

  it('includes the selected scope in the admin logs query', async () => {
    const service = TestBed.inject(AdminLogsService);
    const snapshotPromise = service.listLogs({
      query: 'agent',
      timeRange: '30m',
      levels: ['info'],
      scope: 'admin'
    });

    const request = httpTesting.expectOne('http://localhost:3000/api/admin/logs?q=agent&timeRange=30m&levels=info&scope=admin');
    expect(request.request.method).toBe('GET');
    request.flush(
      JSON.stringify({
        data: {
          availableLevels: ['info', 'warn', 'error'],
          availableScopes: ['admin'],
          filters: {
            query: 'agent',
            timeRange: '30m',
            levels: ['info'],
            scope: 'admin'
          },
          summary: {
            matchingLogs: 0,
            filtered: { info: 0, warn: 0, error: 0 },
            stored: { info: 0, warn: 0, error: 0 }
          },
          logs: []
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const snapshot = await snapshotPromise;
    expect(snapshot.filters.scope).toBe('admin');
    expect(snapshot.availableScopes).toEqual(['admin']);
  });
});
