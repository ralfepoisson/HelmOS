import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { expect } from 'vitest';

import { AgentTestingService } from './agent-testing.service';

describe('AgentTestingService', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__ = undefined;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    delete (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__;
    TestBed.resetTestingModule();
  });

  it('does not retry draft creation against the direct backend when the proxied API returns a JSON 500', async () => {
    const service = TestBed.inject(AgentTestingService);
    const createPromise = service.createRun({
      target_agent_key: 'ideation',
      fixture_key: 'saas_b2b_finops_assistant',
      fixture_version: '1.0.0',
      test_mode: 'single_agent_benchmark',
      target_model_name: 'helmos-default',
      min_turns: 20,
      max_turns: 30,
      operator_notes: 'debug'
    });

    const request = httpTesting.expectOne('http://localhost:3000/api/v1/admin/agent-tests/runs');
    expect(request.request.method).toBe('POST');
    request.flush(
      { detail: 'draft creation failed' },
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    await expect(createPromise).rejects.toBeTruthy();
  });

  it('surfaces a failure when the configured agent testing API is unreachable', async () => {
    const service = TestBed.inject(AgentTestingService);
    const createPromise = service.createRun({
      target_agent_key: 'ideation',
      fixture_key: 'saas_b2b_finops_assistant',
      fixture_version: '1.0.0',
      test_mode: 'single_agent_benchmark',
      target_model_name: 'helmos-default',
      min_turns: 20,
      max_turns: 30,
      operator_notes: 'debug'
    });

    const proxiedRequest = httpTesting.expectOne('http://localhost:3000/api/v1/admin/agent-tests/runs');
    expect(proxiedRequest.request.method).toBe('POST');
    proxiedRequest.error(new ProgressEvent('error'));

    await expect(createPromise).rejects.toBeTruthy();
  });
});
