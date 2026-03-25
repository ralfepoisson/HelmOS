import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AgentAdminService } from './agent-admin.service';

describe('AgentAdminService', () => {
  let service: AgentAdminService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AgentAdminService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('falls back to the local backend when the same-origin admin request fails', async () => {
    const snapshotPromise = service.listAgents();

    const fallbackRequest = httpTesting.expectOne('http://localhost:3001/api/admin/agents');
    expect(fallbackRequest.request.method).toBe('GET');
    fallbackRequest.flush(
      JSON.stringify({
        data: {
          gateway: {
            configured: true,
            status: 'online',
            message: 'Agent gateway responded successfully.',
            baseUrl: 'http://localhost:8000/api/v1',
            service: 'helmos-agent-gateway',
            checkedAt: '2026-03-22T09:00:00.000Z',
            agents: []
          },
          agents: [
            {
              id: 'agent-1',
              key: 'ideation',
              name: 'Ideation Agent',
              version: '1.0.0',
              description: 'Transforms founder input into structured idea briefs.',
              allowedTools: ['retrieval'],
              defaultModel: 'gpt-4.1-mini',
              active: true,
              createdAt: '2026-03-22T08:00:00.000Z',
              updatedAt: '2026-03-22T08:05:00.000Z',
              promptConfig: null,
              runtime: {
                registered: true,
                name: 'Ideation Agent',
                version: '1.0.0',
                purpose: 'Transforms founder input into structured idea briefs.',
                allowedTools: ['retrieval']
              }
            }
          ]
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const snapshot = await snapshotPromise;

    expect(snapshot.agents.length).toBe(1);
    expect(snapshot.agents[0].key).toBe('ideation');
    expect(snapshot.gateway.status).toBe('online');
  });

  it('falls back to the local backend when the same-origin admin request returns a proxy 500', async () => {
    const snapshotPromise = service.listAgents();

    const fallbackRequest = httpTesting.expectOne('http://localhost:3001/api/admin/agents');
    expect(fallbackRequest.request.method).toBe('GET');
    fallbackRequest.flush(
      JSON.stringify({
        data: {
          gateway: {
            configured: true,
            status: 'online',
            message: 'Agent gateway responded successfully.',
            baseUrl: 'http://localhost:8000/api/v1',
            service: 'helmos-agent-gateway',
            checkedAt: '2026-03-22T09:00:00.000Z',
            agents: []
          },
          agents: [
            {
              id: 'agent-1',
              key: 'ideation',
              name: 'Ideation Agent',
              version: '1.0.0',
              description: 'Transforms founder input into structured idea briefs.',
              allowedTools: ['retrieval'],
              defaultModel: 'gpt-4.1-mini',
              active: true,
              createdAt: '2026-03-22T08:00:00.000Z',
              updatedAt: '2026-03-22T08:05:00.000Z',
              promptConfig: null,
              runtime: {
                registered: true,
                name: 'Ideation Agent',
                version: '1.0.0',
                purpose: 'Transforms founder input into structured idea briefs.',
                allowedTools: ['retrieval']
              }
            }
          ]
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const snapshot = await snapshotPromise;

    expect(snapshot.agents.length).toBe(1);
    expect(snapshot.agents[0].key).toBe('ideation');
    expect(snapshot.gateway.status).toBe('online');
  });

  it('creates a new agent through the admin API', async () => {
    const createdAgentPromise = service.createAgent({
      key: 'ideation',
      name: 'Ideation Agent',
      version: '1.0.0',
      description: 'Transforms founder input into structured idea briefs.',
      allowedTools: ['retrieval'],
      defaultModel: 'helmos-default',
      active: true,
      promptConfig: {
        version: '1.0.0',
        promptTemplate: 'Generate a founder-oriented idea brief from: {prompt}',
        configJson: { temperature: 0.2, artifact_kind: 'idea_brief' }
      }
    });

    const request = httpTesting.expectOne('http://localhost:3001/api/admin/agents');
    expect(request.request.method).toBe('POST');
    request.flush(
      JSON.stringify({
        data: {
          id: 'agent-1',
          key: 'ideation',
          name: 'Ideation Agent',
          version: '1.0.0',
          description: 'Transforms founder input into structured idea briefs.',
          allowedTools: ['retrieval'],
          defaultModel: 'helmos-default',
          active: true,
          createdAt: '2026-03-22T08:00:00.000Z',
          updatedAt: '2026-03-22T08:05:00.000Z',
          promptConfig: {
            id: 'prompt-1',
            key: 'ideation.default',
            version: '1.0.0',
            promptTemplate: 'Generate a founder-oriented idea brief from: {prompt}',
            configJson: { temperature: 0.2, artifact_kind: 'idea_brief' },
            active: true,
            updatedAt: '2026-03-22T08:06:00.000Z'
          },
          runtime: {
            registered: false,
            name: null,
            version: null,
            purpose: null,
            allowedTools: []
          }
        }
      }),
      {
        status: 201,
        statusText: 'Created',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const createdAgent = await createdAgentPromise;

    expect(createdAgent.key).toBe('ideation');
    expect(createdAgent.promptConfig?.key).toBe('ideation.default');
  });
});
