import { convertToParamMap, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdeaFoundryApiService, IdeaFoundryPipelineContentsResponse } from './idea-foundry-api.service';
import { IdeaFoundryProfileComponent } from './idea-foundry-profile.component';

describe('IdeaFoundryProfileComponent', () => {
  const baseContents: IdeaFoundryPipelineContentsResponse = {
    sources: [],
    sourceProcessing: [
      {
        id: 'source-2',
        upstreamSourceRecordId: 'upstream-source-2',
        sourceKey: 'source:title:clinic-intake',
        processingStatus: 'COMPLETED',
        processingCompletedAt: '2026-04-06T10:15:00.000Z',
        sourceTitle: 'Clinic intake complaints and handoff delays',
        sourceUrl: 'https://example.com/clinic-intake',
        updatedAt: '2026-04-06T10:15:00.000Z'
      }
    ],
    protoIdeas: [
      {
        id: 'proto-2',
        sourceId: 'source-2',
        title: 'Patient intake operations cockpit',
        problemStatement: 'Clinic staff still lose time juggling fragmented intake handoffs.',
        targetCustomer: 'Independent outpatient clinics.',
        opportunityHypothesis: 'A focused intake cockpit could coordinate tasks, reminders, and follow-ups.',
        whyItMatters: 'Broken intake flows create missed follow-up work and poor patient experiences.',
        opportunityType: 'Workflow SaaS',
        explicitSignals: ['Clinic operators describe manual intake handoff delays.'],
        inferredSignals: ['There is demand for workflow coordination in intake-heavy environments.'],
        assumptions: ['Clinics will pay for a narrow operations wedge before replacing larger systems.'],
        openQuestions: ['Who owns intake operations budget in smaller clinics?'],
        statusLabel: 'Promising',
        statusTone: 'positive',
        agentConfidence: 'medium',
        statusExplanation: 'The workflow breakdown is repeatedly visible in the source.',
        refinementStatus: 'COMPLETED',
        createdAt: '2026-04-06T10:20:00.000Z',
        updatedAt: '2026-04-06T10:20:00.000Z'
      }
    ],
    ideaCandidates: [
      {
        id: 'candidate-2',
        protoIdeaId: 'proto-2',
        problemStatement: 'Clinic operators still juggle fragmented patient intake handoffs.',
        targetCustomer: 'Independent outpatient clinics.',
        valueProposition: 'A guided intake operations cockpit.',
        opportunityConcept: 'Patient intake operations cockpit for independent clinics.',
        differentiation: 'Focuses on intake handoffs instead of full EHR replacement.',
        assumptions: [],
        openQuestions: [],
        improvementSummary: 'Sharper intake wedge.',
        keyChanges: ['Focused the workflow wedge'],
        appliedReasoningSummary: 'Used failure analysis to narrow the concept.',
        appliedConceptualToolIds: ['tool-2'],
        selectedConceptualToolNames: ['Failure Analysis'],
        qualityCheckCoherence: 'Buyer and workflow pain align.',
        qualityCheckGaps: [],
        qualityCheckRisks: [],
        statusLabel: 'Refined',
        statusTone: 'success',
        agentConfidence: 'medium',
        statusExplanation: 'The candidate is clearer and more actionable.',
        refinementIteration: 1,
        workflowState: 'PROMOTED',
        evaluationStatus: 'COMPLETED',
        evaluationReadinessLabel: 'High',
        evaluationStrongestAspect: 'The buyer and workflow pain are tightly aligned.',
        evaluationBiggestRisk: 'Clinic process change could slow adoption.',
        evaluationDuplicateRiskLabel: 'Low',
        evaluationPayloadJson: {
          tags: {
            industry: ['healthcare_ops'],
            capability: ['workflow_automation'],
            customer_type: ['independent_clinics'],
            problem_type: ['handoff_breakdowns']
          }
        },
        protoIdeaTitle: 'Patient intake operations cockpit',
        sourceTitle: 'Clinic intake complaints and handoff delays',
        createdAt: '2026-04-06T10:40:00.000Z',
        updatedAt: '2026-04-06T10:40:00.000Z'
      }
    ],
    curatedOpportunities: [
      {
        id: 'opportunity-1',
        ideaCandidateId: 'candidate-2',
        title: 'Clinic intake operations cockpit',
        summary: 'Promoted because the intake workflow pain and buyer are both specific.',
        problemStatement: 'Independent clinics lose time coordinating intake handoffs.',
        targetCustomer: 'Independent outpatient clinics.',
        valueProposition: 'A focused cockpit for intake operations.',
        productServiceDescription: 'A workflow layer that structures intake tasks, reminders, and handoffs.',
        differentiation: 'Focuses on intake operations instead of replacing the clinic EHR.',
        earlyMonetizationIdea: 'Monthly SaaS subscription per active clinic.',
        readinessLabel: 'High',
        strongestAspect: 'The buyer and workflow pain are tightly aligned.',
        biggestRisk: 'Clinic process change could slow adoption.',
        blockingIssue: '',
        duplicateRiskLabel: 'Low',
        duplicateRiskExplanation: 'No close overlap is visible.',
        nextBestAction: 'Promote it into Curated Opportunities.',
        promotionReason: 'The candidate is specific enough for downstream strategy work.',
        tagsJson: {
          industry: ['healthcare_ops'],
          capability: ['workflow_automation'],
          customer_type: ['independent_clinics'],
          problem_type: ['handoff_breakdowns']
        },
        promotedAt: '2026-04-06T11:00:00.000Z',
        createdAt: '2026-04-06T11:00:00.000Z',
        updatedAt: '2026-04-06T11:00:00.000Z'
      }
    ],
    runtime: {
      agentState: 'active',
      latestRunStatus: 'COMPLETED',
      isRunning: false,
      lastRun: '2026-04-06T11:00:00.000Z',
      nextRun: '2026-04-06T12:00:00.000Z',
      resultRecordCount: 1
    }
  };
  const ideaFoundryApi = {
    getIdeaFoundryContents: vi.fn(async () => baseContents)
  };

  async function createLoadedComponent() {
    const fixture = TestBed.createComponent(IdeaFoundryProfileComponent);
    await fixture.componentInstance.reload();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    ideaFoundryApi.getIdeaFoundryContents.mockResolvedValue(baseContents);
    await TestBed.configureTestingModule({
      imports: [IdeaFoundryProfileComponent],
      providers: [
        provideRouter([]),
        {
          provide: IdeaFoundryApiService,
          useValue: ideaFoundryApi
        },
        {
          provide: 'ActivatedRoute',
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                stage: 'curated-opportunity',
                id: 'opportunity-1'
              })
            }
          }
        }
      ]
    })
      .overrideComponent(IdeaFoundryProfileComponent, {
        remove: {
          providers: []
        }
      })
      .compileComponents();
  });

  it('renders lineage and metadata for the selected idea profile', async () => {
    const fixture = await createLoadedComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Clinic intake operations cockpit');
    expect(text).toContain('Curated Opportunity');
    expect(text).toContain('Lineage');
    expect(text).toContain('Clinic intake complaints and handoff delays');
    expect(text).toContain('Patient intake operations cockpit');
    expect(text).toContain('Healthcare Ops');
    expect(text).toContain('Workflow Automation');
    expect(text).toContain('Monthly SaaS subscription per active clinic.');
  });

  it('uses a wide two-column profile layout with a full-width details panel', async () => {
    const fixture = await createLoadedComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.profile-layout')).toBeTruthy();
    expect(compiled.querySelector('.profile-main-column')).toBeTruthy();
    expect(compiled.querySelector('.profile-side-column')).toBeTruthy();
    expect(compiled.querySelector('.detail-card-wide')).toBeTruthy();
  });
});
