import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { ConceptualToolsScreenComponent } from './conceptual-tools-screen.component';
import { ConceptualToolsAdminService } from './conceptual-tools-admin.service';

describe('ConceptualToolsScreenComponent', () => {
  const listConceptualTools = vi.fn();
  const createConceptualTool = vi.fn();
  const updateConceptualTool = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    listConceptualTools.mockResolvedValue([
      {
        id: 'tool-1',
        name: 'Inversion',
        category: 'transformative',
        purpose: 'Reverse core assumptions.',
        whenToUse: ['high market saturation'],
        whenNotToUse: ['problem statement unclear'],
        instructions: ['Reverse the assumption'],
        expectedEffect: 'Increase novelty.',
        status: 'ACTIVE',
        version: 1,
        createdAt: '2026-04-06T08:00:00.000Z',
        updatedAt: '2026-04-06T08:05:00.000Z'
      }
    ]);

    createConceptualTool.mockResolvedValue({
      id: 'tool-2',
      name: 'Failure Analysis',
      category: 'diagnostic',
      purpose: 'Surface likely failure modes.',
      whenToUse: ['execution risk is opaque'],
      whenNotToUse: ['idea is undefined'],
      instructions: ['List failure modes', 'Trace causes'],
      expectedEffect: 'Reduce blind spots.',
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-04-06T09:00:00.000Z',
      updatedAt: '2026-04-06T09:00:00.000Z'
    });

    updateConceptualTool.mockImplementation(async (_id: string, payload: Record<string, unknown>) => ({
      id: 'tool-1',
      name: 'Inversion',
      category: 'transformative',
      purpose: 'Reverse core assumptions.',
      whenToUse: ['high market saturation'],
      whenNotToUse: ['problem statement unclear'],
      instructions: ['Reverse the assumption'],
      expectedEffect: 'Increase novelty.',
      status: payload['status'] === 'inactive' ? 'INACTIVE' : 'ACTIVE',
      version: 1,
      createdAt: '2026-04-06T08:00:00.000Z',
      updatedAt: '2026-04-06T10:00:00.000Z'
    }));

    await TestBed.configureTestingModule({
      imports: [ConceptualToolsScreenComponent],
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
          provide: ConceptualToolsAdminService,
          useValue: {
            listConceptualTools,
            createConceptualTool,
            updateConceptualTool
          }
        }
      ]
    }).compileComponents();
  });

  it('renders the loaded conceptual tools catalogue', async () => {
    const fixture = TestBed.createComponent(ConceptualToolsScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Conceptual Tools');
    expect(host.textContent).toContain('Inversion');
    expect(host.textContent).toContain('transformative');
  });

  it('submits newline-delimited fields when creating a conceptual tool', async () => {
    const fixture = TestBed.createComponent(ConceptualToolsScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.openCreateForm();
    fixture.detectChanges();

    component.draft.name = 'Failure Analysis';
    component.draft.category = 'diagnostic';
    component.draft.purpose = 'Surface likely failure modes.';
    component.draft.whenToUse = 'execution risk is opaque';
    component.draft.whenNotToUse = 'idea is undefined';
    component.draft.instructions = 'List failure modes\nTrace causes';
    component.draft.expectedEffect = 'Reduce blind spots.';
    component.draft.status = 'active';
    component.draft.version = 1;

    await component.submitForm();

    expect(createConceptualTool).toHaveBeenCalledTimes(1);
    expect(createConceptualTool.mock.calls[0]?.[0]).toMatchObject({
      name: 'Failure Analysis',
      instructions: 'List failure modes\nTrace causes',
      status: 'active'
    });
  });

  it('toggles the tool status through the admin service', async () => {
    const fixture = TestBed.createComponent(ConceptualToolsScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance.toggleStatus({
      id: 'tool-1',
      name: 'Inversion',
      category: 'transformative',
      purpose: 'Reverse core assumptions.',
      whenToUse: ['high market saturation'],
      whenNotToUse: ['problem statement unclear'],
      instructions: ['Reverse the assumption'],
      expectedEffect: 'Increase novelty.',
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-04-06T08:00:00.000Z',
      updatedAt: '2026-04-06T08:05:00.000Z'
    });

    expect(updateConceptualTool).toHaveBeenCalledWith('tool-1', { status: 'inactive' });
  });
});
