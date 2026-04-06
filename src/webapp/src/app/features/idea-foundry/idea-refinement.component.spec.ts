import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdeaFoundryApiService } from './idea-foundry-api.service';
import { IdeaRefinementComponent } from './idea-refinement.component';

describe('IdeaRefinementComponent', () => {
  const ideaFoundryApi = {
    getIdeaRefinementConfiguration: vi.fn(async () => ({
      policy: {
        id: 'policy-1',
        profileName: 'default',
        refinementDepth: 'standard',
        creativityLevel: 'medium',
        strictness: 'balanced',
        maxConceptualToolsPerRun: 3,
        internalQualityThreshold: 'standard'
      },
      runtime: {
        latestRunStatus: 'COMPLETED',
        lastRunAt: '2026-04-06T10:30:00.000Z',
        latestRunSummary: {
          processedCount: 1,
          completedCount: 1,
          createdCount: 1,
          updatedCount: 0
        }
      }
    })),
    saveIdeaRefinementConfiguration: vi.fn(async (policy) => ({
      policy,
      runtime: {
        latestRunStatus: 'COMPLETED',
        lastRunAt: '2026-04-06T10:30:00.000Z',
        latestRunSummary: {
          processedCount: 1,
          completedCount: 1,
          createdCount: 1,
          updatedCount: 0
        }
      }
    })),
    getIdeaCandidates: vi.fn(async () => [
      {
        id: 'candidate-1',
        protoIdeaId: 'proto-1',
        problemStatement: 'Teams still lose time coordinating compliance reminders manually.',
        targetCustomer: 'Small accounting firms with recurring filing deadlines.',
        valueProposition: 'A recurring workflow cockpit for compliance operations.',
        opportunityConcept: 'Compliance workflow cockpit for small accounting firms.',
        differentiation: 'Focused on recurring compliance handoffs instead of broad practice management.',
        assumptions: ['Firms want workflow relief before full automation.'],
        openQuestions: ['Which deadlines create the most workflow pain?'],
        improvementSummary: 'Sharper customer and wedge definition.',
        keyChanges: ['Narrowed the ICP'],
        appliedReasoningSummary: 'Used assumption mapping and analogy transfer.',
        appliedConceptualToolIds: ['tool-1'],
        selectedConceptualToolNames: ['Assumption Mapping'],
        qualityCheckCoherence: 'Problem, buyer, and wedge align.',
        qualityCheckGaps: [],
        qualityCheckRisks: [],
        statusLabel: 'Refined',
        statusTone: 'success',
        agentConfidence: 'medium',
        statusExplanation: 'The candidate is clearer and more actionable.',
        refinementIteration: 1,
        protoIdeaTitle: 'Compliance workflow co-pilot',
        updatedAt: '2026-04-06T10:35:00.000Z'
      }
    ]),
    runIdeaRefinementAgent: vi.fn(async () => ({
      policy: {
        id: 'policy-1',
        profileName: 'default',
        refinementDepth: 'standard',
        creativityLevel: 'medium',
        strictness: 'balanced',
        maxConceptualToolsPerRun: 3,
        internalQualityThreshold: 'standard'
      },
      runtime: {
        latestRunStatus: 'COMPLETED',
        lastRunAt: '2026-04-06T10:35:00.000Z',
        latestRunSummary: {
          processedCount: 1,
          completedCount: 1,
          createdCount: 1,
          updatedCount: 0
        }
      },
      result: {
        processedCount: 1,
        completedCount: 1,
        failedCount: 0,
        skippedCount: 0,
        selectedProtoIdeaIds: ['proto-1'],
        createdCount: 1,
        updatedCount: 0,
        candidateCount: 1,
        policyId: 'policy-1',
        policyProfileName: 'default'
      }
    }))
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [IdeaRefinementComponent],
      providers: [
        {
          provide: IdeaFoundryApiService,
          useValue: ideaFoundryApi
        }
      ]
    }).compileComponents();
  });

  it('renders the administrator policy controls and candidate list', async () => {
    const fixture = TestBed.createComponent(IdeaRefinementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Set the administrator policy that turns proto-ideas into stronger idea candidates');
    expect(text).toContain('Refinement depth');
    expect(text).toContain('Creativity level');
    expect(text).toContain('Strictness / realism');
    expect(text).toContain('Internal quality threshold');
    expect(text).toContain('Max conceptual tools per run');
    expect(text).toContain('Compliance workflow co-pilot');
    expect(text).toContain('Assumption Mapping');
  });

  it('loads the saved policy and candidates on init', async () => {
    const fixture = TestBed.createComponent(IdeaRefinementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(ideaFoundryApi.getIdeaRefinementConfiguration).toHaveBeenCalledTimes(1);
    expect(ideaFoundryApi.getIdeaCandidates).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.candidates.length).toBe(1);
    expect(fixture.componentInstance.runtime.latestRunStatus).toBe('COMPLETED');
  });

  it('saves the updated policy', async () => {
    const fixture = TestBed.createComponent(IdeaRefinementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.policy.refinementDepth = 'deep';
    fixture.componentInstance.policy.maxConceptualToolsPerRun = 4;

    await fixture.componentInstance.saveChanges();

    expect(ideaFoundryApi.saveIdeaRefinementConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        refinementDepth: 'deep',
        maxConceptualToolsPerRun: 4
      })
    );
    expect(fixture.componentInstance.surfaceMessage).toContain('Saved the Idea Refinement policy');
  });

  it('runs the agent and refreshes candidates', async () => {
    const fixture = TestBed.createComponent(IdeaRefinementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const promise = fixture.componentInstance.runAgent();
    expect(fixture.componentInstance.isRunning).toBe(true);
    await promise;

    expect(ideaFoundryApi.runIdeaRefinementAgent).toHaveBeenCalledWith({ batchSize: 1 });
    expect(ideaFoundryApi.getIdeaCandidates).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.isRunning).toBe(false);
    expect(fixture.componentInstance.surfaceMessage).toContain('Processed 1 proto-idea');
  });
});
