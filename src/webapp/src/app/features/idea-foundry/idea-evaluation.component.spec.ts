import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdeaEvaluationComponent } from './idea-evaluation.component';
import { IdeaFoundryApiService } from './idea-foundry-api.service';

describe('IdeaEvaluationComponent', () => {
  const baseCandidates = [
    {
      id: 'candidate-1',
      protoIdeaId: 'proto-1',
      problemStatement: 'Small accounting firms still lose time coordinating repetitive compliance reminders.',
      targetCustomer: 'Owner-led accounting firms with recurring compliance deadlines.',
      valueProposition: 'A workflow cockpit for recurring compliance operations.',
      opportunityConcept: 'Compliance workflow cockpit for small accounting firms.',
      differentiation: 'Starts from recurring compliance operations instead of broad practice management.',
      assumptions: ['Firms want workflow relief before broader automation.'],
      openQuestions: ['Which deadlines create the most recurring pain?'],
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
      workflowState: 'AWAITING_EVALUATION',
      evaluationStatus: 'PENDING',
      evaluationReadinessLabel: null,
      evaluationStrongestAspect: null,
      evaluationBiggestRisk: null,
      evaluationBlockingIssue: null,
      evaluationDuplicateRiskLabel: null,
      evaluationNextBestAction: null,
      updatedAt: '2026-04-06T10:35:00.000Z'
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
      keyChanges: [],
      appliedReasoningSummary: 'Used failure analysis.',
      appliedConceptualToolIds: [],
      selectedConceptualToolNames: [],
      qualityCheckCoherence: 'Buyer and workflow pain align.',
      qualityCheckGaps: [],
      qualityCheckRisks: [],
      statusLabel: 'Refined',
      statusTone: 'success',
      agentConfidence: 'medium',
      statusExplanation: 'The candidate is clearer and more actionable.',
      refinementIteration: 1,
      protoIdeaTitle: 'Patient intake operations cockpit',
      workflowState: 'NEEDS_REFINEMENT',
      evaluationStatus: 'COMPLETED',
      evaluationDecision: 'REFINE',
      evaluationReadinessLabel: 'Medium',
      evaluationStrongestAspect: 'The operator pain is concrete.',
      evaluationBiggestRisk: 'The pricing path is underspecified.',
      evaluationBlockingIssue: 'It is not yet clear who pays first and what they pay for.',
      evaluationDuplicateRiskLabel: 'Low',
      evaluationNextBestAction: 'Clarify the first payer and pricing trigger.',
      updatedAt: '2026-04-06T10:40:00.000Z'
    }
  ];
  const baseCuratedOpportunities = [
    {
      id: 'opportunity-1',
      ideaCandidateId: 'candidate-3',
      title: 'Compliance workflow co-pilot',
      summary: 'Promoted because the candidate is coherent and specific.',
      problemStatement: 'Owner-led accounting firms lose time coordinating recurring compliance reminders.',
      targetCustomer: 'Owner-led accounting firms with recurring compliance deadlines.',
      valueProposition: 'A workflow cockpit for recurring compliance operations.',
      productServiceDescription: 'A SaaS workflow layer with recurring templates, reminders, and task handoffs.',
      differentiation: 'Starts with recurring compliance operations instead of broad practice management.',
      earlyMonetizationIdea: 'Monthly SaaS subscription by active workflow templates.',
      readinessLabel: 'High',
      strongestAspect: 'The problem-customer-value triangle is coherent.',
      biggestRisk: 'Adoption still depends on workflow-change willingness.',
      blockingIssue: '',
      duplicateRiskLabel: 'Low',
      duplicateRiskExplanation: 'No close overlap is visible.',
      nextBestAction: 'Promote it into Curated Opportunities.',
      promotionReason: 'The candidate is ready for downstream strategy work.',
      promotedAt: '2026-04-06T11:00:00.000Z',
      updatedAt: '2026-04-06T11:00:00.000Z'
    }
  ];
  const ideaFoundryApi = {
    getIdeaCandidates: vi.fn(),
    getCuratedOpportunities: vi.fn(),
    runIdeaEvaluation: vi.fn(async () => ({
      result: {
        processedCount: 1,
        completedCount: 1,
        failedCount: 0,
        skippedCount: 0,
        selectedIdeaCandidateIds: ['candidate-1'],
        promotedCount: 1,
        refinedCount: 0,
        rejectedCount: 0,
        opportunityCount: 1
      },
      opportunities: [
        {
          id: 'opportunity-1',
          ideaCandidateId: 'candidate-1',
          title: 'Compliance workflow co-pilot',
          summary: 'Promoted because the candidate is coherent and specific.',
          problemStatement: 'Owner-led accounting firms lose time coordinating recurring compliance reminders.',
          targetCustomer: 'Owner-led accounting firms with recurring compliance deadlines.',
          valueProposition: 'A workflow cockpit for recurring compliance operations.',
          productServiceDescription: 'A SaaS workflow layer with recurring templates, reminders, and task handoffs.',
          differentiation: 'Starts with recurring compliance operations instead of broad practice management.',
          earlyMonetizationIdea: 'Monthly SaaS subscription by active workflow templates.',
          readinessLabel: 'High',
          strongestAspect: 'The problem-customer-value triangle is coherent.',
          biggestRisk: 'Adoption still depends on workflow-change willingness.',
          blockingIssue: '',
          duplicateRiskLabel: 'Low',
          duplicateRiskExplanation: 'No close overlap is visible.',
          nextBestAction: 'Promote it into Curated Opportunities.',
          promotionReason: 'The candidate is ready for downstream strategy work.',
          promotedAt: '2026-04-06T11:00:00.000Z',
          updatedAt: '2026-04-06T11:00:00.000Z'
        }
      ]
    }))
  };

  async function createLoadedComponent() {
    const fixture = TestBed.createComponent(IdeaEvaluationComponent);
    fixture.componentInstance.ngOnInit = async () => {};
    await fixture.componentInstance.reload();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    ideaFoundryApi.getIdeaCandidates.mockResolvedValue(baseCandidates);
    ideaFoundryApi.getCuratedOpportunities.mockResolvedValue(baseCuratedOpportunities);
    await TestBed.configureTestingModule({
      imports: [IdeaEvaluationComponent],
      providers: [
        {
          provide: IdeaFoundryApiService,
          useValue: ideaFoundryApi
        }
      ]
    }).compileComponents();
  });

  it('renders candidate evaluation details and promoted opportunities', async () => {
    const fixture = await createLoadedComponent();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Apply the final quality gate before an opportunity graduates');
    expect(text).toContain('Awaiting evaluation');
    expect(text).toContain('Needs refinement');
    expect(text).toContain('The operator pain is concrete.');
    expect(text).toContain('It is not yet clear who pays first and what they pay for.');
    expect(text).toContain('Compliance workflow co-pilot');
    expect(text).toContain('Promoted');
  });

  it('loads idea candidates and curated opportunities on init', async () => {
    const fixture = await createLoadedComponent();

    expect(ideaFoundryApi.getIdeaCandidates).toHaveBeenCalledTimes(2);
    expect(ideaFoundryApi.getCuratedOpportunities).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.candidates.length).toBe(2);
    expect(fixture.componentInstance.curatedOpportunities.length).toBe(1);
  });

  it('runs a pending batch evaluation and refreshes the lists', async () => {
    const fixture = await createLoadedComponent();

    const promise = fixture.componentInstance.runPendingBatch();
    expect(fixture.componentInstance.isRunning).toBe(true);
    await promise;

    expect(ideaFoundryApi.runIdeaEvaluation).toHaveBeenCalledWith({ batchSize: 25 });
    expect(ideaFoundryApi.getIdeaCandidates).toHaveBeenCalledTimes(3);
    expect(ideaFoundryApi.getCuratedOpportunities).toHaveBeenCalledTimes(3);
    expect(fixture.componentInstance.surfaceMessage).toContain('Promoted 1 candidate');
  });

  it('runs evaluation for a single selected candidate', async () => {
    const fixture = await createLoadedComponent();

    await fixture.componentInstance.runSingleCandidate('candidate-1');

    expect(ideaFoundryApi.runIdeaEvaluation).toHaveBeenCalledWith({ ideaCandidateId: 'candidate-1', batchSize: 1 });
  });
});
