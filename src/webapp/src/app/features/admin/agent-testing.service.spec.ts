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

  it('falls back to the direct backend when the proxied API is unreachable', async () => {
    const service = TestBed.inject(AgentTestingService);
    const createPromise = service.createRun({
      target_agent_key: 'ideation',
      fixture_key: 'saas_b2b_finops_assistant',
      fixture_version: '1.0.0',
      test_mode: 'single_agent_benchmark',
      target_model_name: 'helmos-default',
      operator_notes: 'debug'
    });

    const proxiedRequest = httpTesting.expectOne('http://localhost:3000/api/v1/admin/agent-tests/runs');
    expect(proxiedRequest.request.method).toBe('POST');
    proxiedRequest.error(new ProgressEvent('error'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const fallbackRequests = httpTesting.match('http://localhost:8000/api/v1/admin/agent-tests/runs');
    expect(fallbackRequests).toHaveLength(1);
    const fallbackRequest = fallbackRequests[0]!;
    expect(fallbackRequest.request.method).toBe('POST');
    fallbackRequest.flush(
      {
        data: {
          id: 'run-1',
          suite_key: null,
          test_mode: 'single_agent_benchmark',
          target_agent_key: 'ideation',
          target_agent_version: '1.0.0',
          target_model_name: 'helmos-default',
          testing_agent_model_name: null,
          fixture_key: 'saas_b2b_finops_assistant',
          fixture_version: '1.0.0',
          rubric_version: 'ideation-core-v1',
          driver_version: 'scenario-driver-v1',
          status: 'draft',
          actual_turns: 0,
          min_turns: 20,
          overall_score: 0,
          aggregate_confidence: 0,
          verdict: 'PENDING',
          review_required: false,
          summary: 'Configured and ready to run.',
          operator_notes: 'debug',
          created_at: '2026-04-03T10:00:00.000Z',
          updated_at: '2026-04-03T10:00:00.000Z'
        }
      },
      {
        status: 201,
        statusText: 'Created',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    await expect(createPromise).resolves.toEqual(
      expect.objectContaining({
        id: 'run-1',
        status: 'draft'
      })
    );
  });
});
