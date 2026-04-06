import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLinkWithHref } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdeaFoundryApiService, IdeaFoundryPipelineContentsResponse } from './idea-foundry-api.service';
import { IdeaFoundrySearchComponent } from './idea-foundry-search.component';

describe('IdeaFoundrySearchComponent', () => {
  const baseContents: IdeaFoundryPipelineContentsResponse = {
    sources: [],
    sourceProcessing: [
      {
        id: 'source-1',
        upstreamSourceRecordId: 'upstream-source-1',
        sourceKey: 'source:title:vat-reminders',
        processingStatus: 'COMPLETED',
        processingCompletedAt: '2026-04-06T09:15:00.000Z',
        sourceTitle: 'VAT reminder complaints from owner-led firms',
        sourceUrl: 'https://example.com/vat-reminders',
        updatedAt: '2026-04-06T09:15:00.000Z'
      },
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
        id: 'proto-1',
        sourceId: 'source-1',
        title: 'Compliance workflow co-pilot',
        problemStatement: 'Owner-led accounting firms lose time coordinating repetitive VAT reminder work.',
        targetCustomer: 'Owner-led accounting firms.',
        opportunityHypothesis: 'A workflow co-pilot could automate recurring compliance reminder sequences.',
        whyItMatters: 'It reduces deadline misses and repetitive admin work.',
        opportunityType: 'Workflow SaaS',
        explicitSignals: ['Operators complain about recurring VAT reminder work.'],
        inferredSignals: ['There is room for compliance workflow automation.'],
        assumptions: ['Firms will accept guided workflow automation.'],
        openQuestions: ['Which reminder sequence is the best starting wedge?'],
        statusLabel: 'Promising',
        statusTone: 'positive',
        agentConfidence: 'medium',
        statusExplanation: 'The source pain is concrete and recurring.',
        refinementStatus: 'COMPLETED',
        createdAt: '2026-04-06T09:20:00.000Z',
        updatedAt: '2026-04-06T09:20:00.000Z'
      },
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
        id: 'candidate-1',
        protoIdeaId: 'proto-1',
        problemStatement: 'Accounting firms still lose time coordinating repetitive compliance reminders.',
        targetCustomer: 'Owner-led accounting firms.',
        valueProposition: 'A workflow cockpit for recurring compliance operations.',
        opportunityConcept: 'Compliance workflow cockpit for small accounting firms.',
        differentiation: 'Starts from recurring compliance work instead of broad practice management.',
        assumptions: ['Firms will adopt workflow tooling before broader automation.'],
        openQuestions: ['What is the first template buyers will pay for?'],
        improvementSummary: 'Sharper customer definition and clearer monetisation wedge.',
        keyChanges: ['Narrowed the ICP', 'Clarified the recurring workflow wedge'],
        appliedReasoningSummary: 'Used assumption mapping to tighten the concept.',
        appliedConceptualToolIds: ['tool-1'],
        selectedConceptualToolNames: ['Assumption Mapping'],
        qualityCheckCoherence: 'Problem, buyer, and wedge align.',
        qualityCheckGaps: [],
        qualityCheckRisks: ['Still needs stronger pricing evidence.'],
        statusLabel: 'Refined',
        statusTone: 'success',
        agentConfidence: 'medium',
        statusExplanation: 'The candidate is clearer and more actionable.',
        refinementIteration: 1,
        workflowState: 'AWAITING_EVALUATION',
        evaluationStatus: 'COMPLETED',
        evaluationPayloadJson: {
          tags: {
            industry: ['accounting_software'],
            capability: ['workflow_automation'],
            customer_type: ['small_accounting_firms'],
            problem_type: ['deadline_coordination']
          }
        },
        protoIdeaTitle: 'Compliance workflow co-pilot',
        sourceTitle: 'VAT reminder complaints from owner-led firms',
        createdAt: '2026-04-06T09:45:00.000Z',
        updatedAt: '2026-04-06T09:45:00.000Z'
      },
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
      resultRecordCount: 2
    }
  };
  const ideaFoundryApi = {
    getIdeaFoundryContents: vi.fn(async () => baseContents)
  };

  async function createLoadedComponent() {
    const fixture = TestBed.createComponent(IdeaFoundrySearchComponent);
    await fixture.componentInstance.reload();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    ideaFoundryApi.getIdeaFoundryContents.mockResolvedValue(baseContents);
    await TestBed.configureTestingModule({
      imports: [IdeaFoundrySearchComponent],
      providers: [
        provideRouter([]),
        {
          provide: IdeaFoundryApiService,
          useValue: ideaFoundryApi
        }
      ]
    }).compileComponents();
  });

  it('renders a search hero, filter toggle, and card links to idea profiles', async () => {
    const fixture = await createLoadedComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Search');
    expect(compiled.textContent).toContain('Search across proto-ideas, refined candidates, and curated opportunities');
    expect(compiled.textContent).toContain('Filters');
    expect(compiled.querySelectorAll('[data-testid="idea-search-card"]').length).toBe(5);

    const links = fixture.debugElement
      .queryAll((node) => node.providerTokens.includes(RouterLinkWithHref))
      .map((node) => node.injector.get(RouterLinkWithHref).href);

    expect(links).toEqual(
      expect.arrayContaining([
        '/idea-foundry/idea-profile/proto-idea/proto-1',
        '/idea-foundry/idea-profile/idea-candidate/candidate-1',
        '/idea-foundry/idea-profile/curated-opportunity/opportunity-1'
      ])
    );
  });

  it('filters results by query, stage, and tags', async () => {
    const fixture = TestBed.createComponent(IdeaFoundrySearchComponent);
    await fixture.componentInstance.reload();
    fixture.componentInstance.queryDraft = 'clinic';
    fixture.componentInstance.applySearch();
    fixture.componentInstance.toggleStage('curated-opportunity');
    fixture.componentInstance.toggleTag('industry', 'healthcare_ops');
    fixture.detectChanges();

    expect(fixture.componentInstance.results.map((record) => record.id)).toEqual(['opportunity-1']);
    expect(fixture.nativeElement.textContent).toContain('Clinic intake operations cockpit');
    expect(fixture.nativeElement.textContent).not.toContain('Compliance workflow co-pilot');
  });
});
