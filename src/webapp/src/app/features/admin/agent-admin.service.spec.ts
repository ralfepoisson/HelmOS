import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AgentAdminService } from './agent-admin.service';

describe('AgentAdminService', () => {
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

  it('uses the configured production API origin outside local development', async () => {
    (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__ = {
      apiBaseUrl: 'https://api.helm-os.ai'
    };
    const service = TestBed.inject(AgentAdminService);
    const snapshotPromise = service.listAgents();
    const request = httpTesting.expectOne('https://api.helm-os.ai/api/admin/agents');
    expect(request.request.method).toBe('GET');
    request.flush(
      JSON.stringify({
        data: {
          gateway: {
            configured: false,
            status: 'not_configured',
            message: 'not configured',
            baseUrl: null,
            service: null,
            checkedAt: '2026-03-26T00:00:00.000Z',
            agents: []
          },
          agents: []
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const snapshot = await snapshotPromise;
    expect(snapshot.agents).toEqual([]);
  });

  it('uses the configured same-origin admin API in local development', async () => {
    const service = TestBed.inject(AgentAdminService);
    const snapshotPromise = service.listAgents();

    const request = httpTesting.expectOne('http://localhost:3000/api/admin/agents');
    expect(request.request.method).toBe('GET');
    request.flush(
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
    const service = TestBed.inject(AgentAdminService);
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

    const request = httpTesting.expectOne('http://localhost:3000/api/admin/agents');
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

  it('updates an existing agent through the admin API with PATCH', async () => {
    const service = TestBed.inject(AgentAdminService);
    const updatedAgentPromise = service.updateAgent('agent-1', {
      name: 'Ideation Agent',
      version: '1.0.1',
      description: 'Keeps the ideation prompt aligned with saved edits.',
      allowedTools: ['retrieval', 'web_search'],
      defaultModel: 'helmos-default',
      active: true,
      promptConfig: {
        key: 'ideation.default',
        version: '1.0.1',
        promptTemplate: 'Use the saved ideation brief from: {prompt}',
        configJson: { temperature: 0.5 }
      }
    });

    const request = httpTesting.expectOne('http://localhost:3000/api/admin/agents/agent-1');
    expect(request.request.method).toBe('PATCH');
    request.flush(
      JSON.stringify({
        data: {
          id: 'agent-1',
          key: 'ideation',
          name: 'Ideation Agent',
          version: '1.0.1',
          description: 'Keeps the ideation prompt aligned with saved edits.',
          allowedTools: ['retrieval', 'web_search'],
          defaultModel: 'helmos-default',
          active: true,
          createdAt: '2026-03-22T08:00:00.000Z',
          updatedAt: '2026-03-22T08:05:00.000Z',
          promptConfig: {
            id: 'prompt-1',
            key: 'ideation.default',
            version: '1.0.1',
            promptTemplate: 'Use the saved ideation brief from: {prompt}',
            configJson: { temperature: 0.5 },
            active: true,
            updatedAt: '2026-03-22T08:06:00.000Z'
          },
          runtime: {
            registered: true,
            name: 'Ideation Agent',
            version: '1.0.1',
            purpose: 'Keeps the ideation prompt aligned with saved edits.',
            allowedTools: ['retrieval', 'web_search']
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const updatedAgent = await updatedAgentPromise;

    expect(updatedAgent.version).toBe('1.0.1');
    expect(updatedAgent.promptConfig?.version).toBe('1.0.1');
  });

  it('loads one agent through the admin API', async () => {
    const service = TestBed.inject(AgentAdminService);
    const agentPromise = service.getAgent('agent-2');

    const request = httpTesting.expectOne('http://localhost:3000/api/admin/agents/agent-2');
    expect(request.request.method).toBe('GET');
    request.flush(
      JSON.stringify({
        data: {
          id: 'agent-2',
          key: 'prospecting',
          name: 'Prospecting Agent',
          version: '1.0.0',
          description: 'Helps the user systematically discover opportunity signals.',
          allowedTools: ['web_search'],
          defaultModel: 'helmos-default',
          active: true,
          createdAt: '2026-04-05T14:06:10.874Z',
          updatedAt: '2026-04-05T14:06:10.874Z',
          promptConfig: {
            id: 'prompt-2',
            key: 'prospecting.default',
            version: '1.0.0',
            promptTemplate: 'Generate search themes from: {prompt}',
            configJson: { temperature: 0.3 },
            active: true,
            updatedAt: '2026-04-05T14:06:10.874Z'
          },
          runtime: {
            registered: true,
            name: 'Prospecting Agent',
            version: '1.0.0',
            purpose: 'Helps the user systematically discover opportunity signals.',
            allowedTools: ['web_search']
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const agent = await agentPromise;
    expect(agent.key).toBe('prospecting');
    expect(agent.promptConfig?.key).toBe('prospecting.default');
  });
});
