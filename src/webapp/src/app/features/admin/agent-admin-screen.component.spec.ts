import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { AgentAdminScreenComponent } from './agent-admin-screen.component';
import { AgentAdminService } from './agent-admin.service';

describe('AgentAdminScreenComponent', () => {
  const listAgents = vi.fn();
  const getAgent = vi.fn();
  const updateAgent = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    listAgents.mockResolvedValue({
      gateway: {
        configured: true,
        status: 'online',
        message: 'Agent gateway responded successfully.',
        baseUrl: 'http://127.0.0.1:8000/api/v1',
        service: 'helmos-agent-gateway',
        checkedAt: '2026-03-22T08:10:00.000Z',
        agents: [
          {
            key: 'prospecting',
            name: 'Prospecting Agent',
            version: '1.0.0',
            purpose: 'Helps the user systematically discover and refine high-potential opportunity signals.',
            allowedTools: ['web_search']
          },
          {
            key: 'ideation',
            name: 'Ideation Agent',
            version: '1.0.0',
            purpose: 'Transforms founder input into structured idea briefs.',
            allowedTools: ['retrieval']
          }
        ]
      },
      agents: [
        {
          id: 'agent-2',
          key: 'prospecting',
          name: 'Prospecting Agent',
          version: '1.0.0',
          description: 'Purpose: Helps the user systematically discover and refine high-potential opportunity signals.',
          allowedTools: ['web_search'],
          defaultModel: 'helmos-default',
          active: true,
          createdAt: '2026-04-05T14:06:10.874Z',
          updatedAt: '2026-04-05T14:06:10.874Z',
          promptConfig: null,
          runtime: {
            registered: true,
            name: 'Prospecting Agent',
            version: '1.0.0',
            purpose: 'Helps the user systematically discover and refine high-potential opportunity signals.',
            allowedTools: ['web_search']
          }
        },
        {
          id: 'agent-1',
          key: 'ideation',
          name: 'Ideation Agent',
          version: '1.0.0',
          description: 'Purpose: Transforms founder input into structured idea briefs.\n\nScope: Focus on early-stage idea clarification.',
          allowedTools: ['retrieval'],
          defaultModel: 'helmos-default',
          active: true,
          createdAt: '2026-03-22T08:00:00.000Z',
          updatedAt: '2026-03-22T08:05:00.000Z',
          promptConfig: {
            id: 'prompt-1',
            key: 'ideation.default',
            version: '1.0.0',
            promptTemplate:
              'Role / Persona:\nYou are the HelmOS ideation specialist.\n\nTask Instructions:\nClarify the founder idea and identify assumptions.\n\nConstraints:\nDo not invent market evidence.\n\nOutput Format:\nReturn summary, risks, and next steps.',
            configJson: {
              purpose: 'Transforms founder input into structured idea briefs.',
              scopeNotes: 'Focus on early-stage idea clarification.',
              temperature: 0.2,
              maxSteps: 8,
              timeoutSeconds: 180,
              retryPolicy: 'standard',
              reasoningMode: 'balanced',
              promptSections: {
                rolePersona: 'You are the HelmOS ideation specialist.',
                taskInstructions: 'Clarify the founder idea and identify assumptions.',
                constraints: 'Do not invent market evidence.',
                outputFormat: 'Return summary, risks, and next steps.'
              }
            },
            active: true,
            updatedAt: '2026-03-22T08:06:00.000Z'
          },
          runtime: {
            registered: true,
            name: 'Ideation Agent',
            version: '1.0.0',
            purpose: 'Transforms founder input into structured idea briefs.',
            allowedTools: ['retrieval']
          }
        }
      ]
    });

    getAgent.mockImplementation(async (agentId: string) => {
      if (agentId === 'agent-1') {
        return {
          id: 'agent-1',
          key: 'ideation',
          name: 'Ideation Agent',
          version: '1.0.0',
          description: 'Purpose: Transforms founder input into structured idea briefs.\n\nScope: Focus on early-stage idea clarification.',
          allowedTools: ['retrieval'],
          defaultModel: 'helmos-default',
          active: true,
          createdAt: '2026-03-22T08:00:00.000Z',
          updatedAt: '2026-03-22T08:05:00.000Z',
          promptConfig: {
            id: 'prompt-1',
            key: 'ideation.default',
            version: '1.0.0',
            promptTemplate:
              'Role / Persona:\nYou are the HelmOS ideation specialist.\n\nTask Instructions:\nClarify the founder idea and identify assumptions.\n\nConstraints:\nDo not invent market evidence.\n\nOutput Format:\nReturn summary, risks, and next steps.',
            configJson: {
              purpose: 'Transforms founder input into structured idea briefs.',
              scopeNotes: 'Focus on early-stage idea clarification.',
              temperature: 0.2,
              maxSteps: 8,
              timeoutSeconds: 180,
              retryPolicy: 'standard',
              reasoningMode: 'balanced',
              promptSections: {
                rolePersona: 'You are the HelmOS ideation specialist.',
                taskInstructions: 'Clarify the founder idea and identify assumptions.',
                constraints: 'Do not invent market evidence.',
                outputFormat: 'Return summary, risks, and next steps.'
              }
            },
            active: true,
            updatedAt: '2026-03-22T08:06:00.000Z'
          },
          runtime: {
            registered: true,
            name: 'Ideation Agent',
            version: '1.0.0',
            purpose: 'Transforms founder input into structured idea briefs.',
            allowedTools: ['retrieval']
          }
        };
      }

      return {
        id: 'agent-2',
        key: 'prospecting',
        name: 'Prospecting Agent',
        version: '1.0.0',
        description:
          'Purpose: Help the user systematically discover, steer, and refine high-potential opportunity signals.\n\nScope: Covers search strategy, source mix definition, signal quality framing, and cadence guidance.',
        allowedTools: ['web_search'],
        defaultModel: 'helmos-default',
        active: true,
        createdAt: '2026-04-05T14:06:10.874Z',
        updatedAt: '2026-04-05T14:06:10.874Z',
        promptConfig: {
          id: 'prompt-2',
          key: 'prospecting.default',
          version: '1.0.0',
          promptTemplate:
            'Role / Persona:\nYou are the HelmOS prospecting specialist.\n\nTask Instructions:\nGenerate search themes and high-signal source plans.\n\nConstraints:\nDo not fabricate market evidence.\n\nOutput Format:\nReturn search themes, sources, and scoring guidance.',
          configJson: {
            purpose: 'Help the user systematically discover, steer, and refine high-potential opportunity signals.',
            scopeNotes: 'Covers search strategy, source mix definition, signal quality framing, and cadence guidance.',
            temperature: 0.3,
            maxSteps: 8,
            timeoutSeconds: 180,
            retryPolicy: 'standard',
            reasoningMode: 'balanced',
            promptSections: {
              rolePersona: 'You are the HelmOS prospecting specialist.',
              taskInstructions: 'Generate search themes and high-signal source plans.',
              constraints: 'Do not fabricate market evidence.',
              outputFormat: 'Return search themes, sources, and scoring guidance.'
            }
          },
          active: true,
          updatedAt: '2026-04-05T14:06:10.874Z'
        },
        runtime: {
          registered: true,
          name: 'Prospecting Agent',
          version: '1.0.0',
          purpose: 'Helps the user systematically discover and refine high-potential opportunity signals.',
          allowedTools: ['web_search']
        }
      };
    });

    updateAgent.mockImplementation(async (_agentId: string, payload: Record<string, unknown>) => ({
      id: 'agent-1',
      key: 'ideation',
      name: 'Ideation Agent',
      version: '1.0.0',
      description: payload['description'] as string,
      allowedTools: payload['allowedTools'] as string[],
      defaultModel: payload['defaultModel'] as string,
      active: true,
      createdAt: '2026-03-22T08:00:00.000Z',
      updatedAt: '2026-03-22T09:00:00.000Z',
      promptConfig: {
        id: 'prompt-1',
        key: 'ideation.default',
        version: '1.0.0',
        promptTemplate: (payload['promptConfig'] as { promptTemplate: string }).promptTemplate,
        configJson: (payload['promptConfig'] as { configJson: Record<string, unknown> }).configJson,
        active: true,
        updatedAt: '2026-03-22T09:00:00.000Z'
      },
      runtime: {
        registered: true,
        name: 'Ideation Agent',
        version: '1.0.0',
        purpose: 'Transforms founder input into structured idea briefs.',
        allowedTools: ['retrieval']
      }
    }));

    await TestBed.configureTestingModule({
      imports: [AgentAdminScreenComponent],
      providers: [
        provideRouter([]),
        {
          provide: WorkspaceShellService,
          useValue: {
            productName: 'HelmOS'
          }
        },
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => true,
            getProfileInitials: () => 'RP',
            getProfileName: () => 'Ralfe Poisson',
            getProfileRoleLabel: () => 'Admin',
            signOut: vi.fn()
          }
        },
        {
          provide: AgentAdminService,
          useValue: {
            listAgents,
            getAgent,
            updateAgent,
            createAgent: vi.fn()
          }
        }
      ]
    }).compileComponents();
  });

  it('sends the live numeric field values when saving an agent', async () => {
    const fixture = TestBed.createComponent(AgentAdminScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const temperatureLabel = Array.from(host.querySelectorAll('label')).find((label) =>
      label.textContent?.includes('Temperature')
    );
    const temperatureInput = temperatureLabel?.querySelector('input') as HTMLInputElement | null;
    expect(temperatureInput).toBeTruthy();

    temperatureInput!.value = '0.5';

    const saveButton = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save agent'
    );
    expect(saveButton).toBeTruthy();

    saveButton!.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(updateAgent).toHaveBeenCalledTimes(1);
    expect(updateAgent.mock.calls[0]?.[1]).toHaveProperty('promptConfig.configJson.temperature', 0.5);
  });

  it('lists registry agents alphabetically and omits the descriptive copy in the first panel', async () => {
    const fixture = TestBed.createComponent(AgentAdminScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const registryPanel = host.querySelector('.agent-list-panel') as HTMLElement | null;
    expect(registryPanel).toBeTruthy();

    const agentNames = Array.from(registryPanel!.querySelectorAll('.agent-list-item strong')).map((node) =>
      node.textContent?.trim()
    );
    expect(agentNames).toEqual(['Ideation Agent', 'Prospecting Agent']);
    expect(registryPanel!.querySelector('.field-help')).toBeNull();
    expect(registryPanel!.textContent).not.toContain('Transforms founder input into structured idea briefs.');
    expect(registryPanel!.textContent).not.toContain('Helps the user systematically discover and refine');
  });

  it('fetches full agent details when a different agent is selected', async () => {
    const fixture = TestBed.createComponent(AgentAdminScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(getAgent).toHaveBeenCalledWith('agent-1');

    const prospectingButton = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Prospecting Agent')
    );
    expect(prospectingButton).toBeTruthy();

    prospectingButton!.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getAgent).toHaveBeenCalledWith('agent-2');

    const roleLabel = Array.from(host.querySelectorAll('label')).find((label) =>
      label.textContent?.includes('Role / Persona')
    );
    const roleTextarea = roleLabel?.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(roleTextarea?.value).toBe('You are the HelmOS prospecting specialist.');

    const taskLabel = Array.from(host.querySelectorAll('label')).find((label) =>
      label.textContent?.includes('Task Instructions')
    );
    const taskTextarea = taskLabel?.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(taskTextarea?.value).toBe('Generate search themes and high-signal source plans.');
  });
});
