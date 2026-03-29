import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { AgentAdminScreenComponent } from './agent-admin-screen.component';
import { AgentAdminService } from './agent-admin.service';

describe('AgentAdminScreenComponent', () => {
  const listAgents = vi.fn();
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
    const temperatureLabel = Array.from(host.querySelectorAll('label')).find(
      (label) => label.textContent?.includes('Temperature')
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
});
