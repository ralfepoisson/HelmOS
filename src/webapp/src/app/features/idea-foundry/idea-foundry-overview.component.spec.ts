import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IdeaFoundryApiService,
  IdeaFoundryPipelineContentsResponse,
  IdeaFoundryPipelineStatusResponse
} from './idea-foundry-api.service';
import { IdeaFoundryOverviewComponent } from './idea-foundry-overview.component';

describe('IdeaFoundryOverviewComponent', () => {
  const baseContents: IdeaFoundryPipelineContentsResponse = {
    sources: [
      {
        id: 'result-1',
        sourceTitle: 'VAT reminders are killing your accounting firm',
        sourceUrl: 'https://example.com/vat-reminders',
        snippet: 'Operators describe recurring invoicing and VAT reminder pain.',
        queryFamilyTitle: 'Complaint language around invoicing / VAT / reminders',
        themeLink: 'fragmented compliance workflows',
        query: 'hate doing VAT reminders every month',
        capturedAt: '2026-04-05T20:35:32.953Z',
        isProcessedForPipeline: true
      },
      {
        id: 'result-2',
        sourceTitle: 'Manual rota coordination is chaos',
        sourceUrl: 'https://example.com/rota-chaos',
        snippet: 'Practice managers compare manual scheduling breakdowns.',
        queryFamilyTitle: 'Urgent rota / scheduling breakdowns',
        themeLink: 'last-minute scheduling pressure',
        query: 'rota fell apart again short notice cover',
        capturedAt: '2026-04-05T20:40:32.953Z'
      }
    ],
    sourceProcessing: [
      {
        id: 'proto-source-1',
        upstreamSourceRecordId: 'historic-result-1',
        sourceKey: 'https://example.com/vat-reminders',
        processingStatus: 'PENDING',
        processingCompletedAt: '2026-04-05T20:45:32.953Z',
        processingFailedAt: null,
        updatedAt: '2026-04-05T20:45:32.953Z'
      }
    ],
    protoIdeas: [
      {
        id: 'proto-idea-1',
        sourceId: 'proto-source-1',
        title: 'Compliance workflow co-pilot for small accounting firms',
        problemStatement: 'Accounting teams are stuck chasing repetitive VAT reminder and follow-up work.',
        targetCustomer: 'Small accounting firms handling recurring compliance deadlines.',
        opportunityHypothesis: 'A lightweight workflow co-pilot could automate reminders and task handoffs.',
        whyItMatters: 'It reduces missed deadlines and frees operators for higher-value advisory work.',
        opportunityType: 'Workflow SaaS',
        explicitSignals: ['Operators describe recurring invoicing and VAT reminder pain.'],
        inferredSignals: ['There is room for workflow automation around compliance reminders.'],
        assumptions: ['Firms will trust partial automation for reminder handling.'],
        openQuestions: ['Which reminders are safest to automate first?'],
        statusLabel: 'Promising',
        statusTone: 'positive',
        agentConfidence: 'medium',
        statusExplanation: 'Repeated operational pain appears directly in the source.',
        refinementStatus: 'COMPLETED',
        createdAt: '2026-04-05T20:45:32.953Z',
        updatedAt: '2026-04-05T20:45:32.953Z'
      }
    ],
    ideaCandidates: [
      {
        id: 'candidate-1',
        protoIdeaId: 'proto-idea-1',
        problemStatement: 'Small accounting firms still lose time coordinating repetitive compliance reminders.',
        targetCustomer: 'Owner-led accounting firms with recurring monthly and quarterly compliance deadlines.',
        valueProposition: 'A compliance operations layer that turns deadline chasing into a governed recurring workflow.',
        opportunityConcept: 'A compliance workflow cockpit for small accounting firms that automates reminder sequencing and handoffs.',
        differentiation: 'Starts from recurring compliance operations instead of generic practice-management breadth.',
        assumptions: ['Firms will accept workflow automation before full bookkeeping automation.'],
        openQuestions: ['Which reminders are painful enough to justify the first workflow template?'],
        improvementSummary: 'Sharper customer definition and stronger wedge around recurring compliance operations.',
        keyChanges: ['Narrowed the ICP', 'Added clearer wedge and differentiation'],
        appliedReasoningSummary: 'Used assumption mapping and analogy transfer to tighten the concept.',
        appliedConceptualToolIds: ['tool-1', 'tool-2'],
        selectedConceptualToolNames: ['Assumption Mapping', 'Analogy Transfer'],
        qualityCheckCoherence: 'Problem, buyer, and wedge are aligned.',
        qualityCheckGaps: [],
        qualityCheckRisks: ['Still needs proof that firms will switch workflow habits.'],
        statusLabel: 'Refined',
        statusTone: 'success',
        agentConfidence: 'medium',
        statusExplanation: 'The opportunity is clearer and more actionable than the source proto-idea.',
        refinementIteration: 1,
        workflowState: 'AWAITING_EVALUATION',
        evaluationReadinessLabel: 'Medium',
        evaluationStrongestAspect: 'The workflow pain is concrete and buyer-specific.',
        evaluationBiggestRisk: 'The monetisation wedge still needs validation.',
        evaluationBlockingIssue: 'Run the evaluator to confirm whether the current monetisation idea is specific enough.',
        evaluationDuplicateRiskLabel: 'Low',
        evaluationNextBestAction: 'Run idea evaluation for a promotion decision.',
        protoIdeaTitle: 'Compliance workflow co-pilot for small accounting firms',
        createdAt: '2026-04-05T21:10:32.953Z',
        updatedAt: '2026-04-05T21:10:32.953Z'
      }
    ],
    curatedOpportunities: [],
    runtime: {
      agentState: 'active',
      latestRunStatus: 'COMPLETED',
      isRunning: false,
      lastRun: '2026-04-05T20:35:32.953Z',
      nextRun: '2026-04-05T21:35:32.953Z',
      resultRecordCount: 2
    }
  };
  const idleStatus: IdeaFoundryPipelineStatusResponse = {
    runId: null,
    status: 'IDLE',
    startedAt: null,
    endedAt: null,
    stageStates: {
      sources: 'pending',
      'proto-ideas': 'pending',
      'idea-candidates': 'pending',
      'curated-opportunities': 'pending'
    },
    stageResults: [],
    completedStageCount: 0,
    failedStageCount: 0,
    errorMessage: null
  };
  const ideaFoundryApi = {
    getIdeaFoundryContents: vi.fn(async () => baseContents),
    getIdeaFoundryPipelineStatus: vi.fn(async () => idleStatus),
    runIdeaFoundryPipeline: vi.fn(async () => ({
      started: true,
      run: {
        runId: 'run-1',
        status: 'RUNNING',
        startedAt: '2026-04-05T20:35:32.953Z',
        endedAt: null,
        stageStates: {
          sources: 'completed',
          'proto-ideas': 'running',
          'idea-candidates': 'pending',
          'curated-opportunities': 'pending'
        },
        stageResults: [],
        completedStageCount: 0,
        failedStageCount: 0,
        errorMessage: null
      }
    }))
  };

  async function createOverviewComponent(
    readyCheck: (fixture: ComponentFixture<IdeaFoundryOverviewComponent>) => void = (fixture) => {
      expect(fixture.componentInstance.columns[0]?.totalCount).toBe(2);
      expect(fixture.componentInstance.columns[2]?.totalCount).toBe(1);
    },
    options: { showProcessedItems?: boolean; expandedCardIds?: string[] } = {}
  ) {
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.componentInstance.ngOnInit = async () => {};
    fixture.componentInstance.showProcessedItems = options.showProcessedItems ?? false;
    await fixture.componentInstance['refreshOverviewFromBackend']();
    for (const cardId of options.expandedCardIds ?? []) {
      fixture.componentInstance.toggleCard(cardId);
    }
    readyCheck(fixture);
    expect(fixture.componentInstance.sourceLoadError).toBeNull();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    ideaFoundryApi.getIdeaFoundryContents.mockResolvedValue(baseContents);
    ideaFoundryApi.getIdeaFoundryPipelineStatus.mockResolvedValue(idleStatus);
    await TestBed.configureTestingModule({
      imports: [IdeaFoundryOverviewComponent],
      providers: [
        {
          provide: IdeaFoundryApiService,
          useValue: ideaFoundryApi
        }
      ]
    }).compileComponents();
  });

  it('renders the pipeline columns for the overview board', async () => {
    const fixture = await createOverviewComponent();

    const stageTitles = Array.from(fixture.nativeElement.querySelectorAll('.pipeline-column-header h4')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );

    expect(stageTitles).toEqual(['Sources', 'Proto-Ideas', 'Idea Candidates', 'Curated Opportunities']);

    const counts = Array.from(fixture.nativeElement.querySelectorAll('.pipeline-count')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );
    expect(counts).toEqual(['1/2', '0/1', '1/1', '0']);
  });

  it('hides already processed items by default', async () => {
    const fixture = await createOverviewComponent();

    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('VAT reminders are killing your accounting firm');
    expect(text).toContain('Manual rota coordination is chaos');
    expect(text).toContain('Compliance workflow co-pilot for small accounting firms');
    expect(text).toContain('No proto-ideas yet');
    expect(text).not.toContain('A compliance workflow cockpit for small accounting firms that automates reminder sequencing and handoffs.');
  });

  it('renders the run pipeline button and pending stage indicators', async () => {
    const fixture = await createOverviewComponent();

    const runButton = fixture.nativeElement.querySelector('.pipeline-run-button') as HTMLButtonElement;
    const stageIndicators = Array.from(
      fixture.nativeElement.querySelectorAll('.pipeline-stage-indicator')
    ) as HTMLElement[];

    expect(runButton.textContent?.trim()).toBe('Run Pipeline');
    expect(stageIndicators.map((node) => node.getAttribute('data-stage-state'))).toEqual([
      'pending',
      'pending',
      'pending',
      'pending'
    ]);
    expect(fixture.nativeElement.textContent).toContain('Show processed');
  });

  it('shows empty downstream stages without seeded demo opportunities', async () => {
    const fixture = await createOverviewComponent();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('No proto-ideas yet');
    expect(text).toContain('Compliance workflow co-pilot for small accounting firms');
    expect(text).toContain('Apr 5, 2026, 11:10 PM');
    expect(text).toContain('No curated opportunities yet');
    expect(text).not.toContain('EU freelancer compliance cockpit');
    expect(text).not.toContain('Managed onboarding ops for AI-heavy B2B SaaS');
  });

  it('renders persisted proto-ideas returned by the API', async () => {
    const fixture = await createOverviewComponent(undefined, {
      showProcessedItems: true,
      expandedCardIds: ['proto-idea-1']
    });

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Compliance workflow co-pilot for small accounting firms');
    expect(text).toContain('Accounting teams are stuck chasing repetitive VAT reminder and follow-up work.');
    expect(text).toContain('Customer: Small accounting firms handling recurring compliance deadlines.');
    expect(text).toContain('Type: Workflow SaaS');
    expect(text).toContain('Confidence: medium');
    expect(text).toContain('Promising');
  });

  it('renders persisted idea candidates returned by the API', async () => {
    const fixture = await createOverviewComponent(undefined, {
      expandedCardIds: ['candidate-1']
    });

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Compliance workflow co-pilot for small accounting firms');
    expect(text).toContain('Awaiting evaluation');
    expect(text).toContain('Readiness: Medium');
    expect(text).toContain('Duplicate risk: Low');
    expect(text).toContain('Confidence: medium');
    expect(text).toContain('Iteration: 1');
    expect(text).toContain('Tools: Assumption Mapping, Analogy Transfer');
    expect(text).toContain('The workflow pain is concrete and buyer-specific.');
    expect(text).toContain('Run idea evaluation for a promotion decision.');
  });

  it('starts idea candidate cards compact and expands on click', async () => {
    const fixture = await createOverviewComponent();

    const candidateButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.pipeline-column[data-stage-id="idea-candidates"] .pipeline-card-toggle')
    ) as HTMLButtonElement[];
    const firstCandidateCard = candidateButtons[0];

    expect(firstCandidateCard.textContent).toContain('Compliance workflow co-pilot for small accounting firms');
    expect(firstCandidateCard.textContent).toContain('2026');
    expect(firstCandidateCard.textContent).not.toContain('Awaiting evaluation');
    expect(firstCandidateCard.textContent).not.toContain(
      'A compliance workflow cockpit for small accounting firms that automates reminder sequencing and handoffs.'
    );
    expect(firstCandidateCard.textContent).not.toContain('Readiness: Medium');
    expect(firstCandidateCard.textContent).not.toContain('Run idea evaluation for a promotion decision.');

    const expandedFixture = await createOverviewComponent(undefined, {
      expandedCardIds: ['candidate-1']
    });
    const expandedCandidateCard = expandedFixture.nativeElement.querySelector(
      '.pipeline-column[data-stage-id="idea-candidates"] .pipeline-card-toggle'
    ) as HTMLButtonElement;

    expect(expandedCandidateCard.textContent).toContain('Awaiting evaluation');
    expect(expandedCandidateCard.textContent).toContain(
      'A compliance workflow cockpit for small accounting firms that automates reminder sequencing and handoffs.'
    );
    expect(expandedCandidateCard.textContent).toContain('Readiness: Medium');
    expect(expandedCandidateCard.textContent).toContain('Duplicate risk: Low');
    expect(expandedCandidateCard.textContent).toContain('Run idea evaluation for a promotion decision.');
  });

  it('renders promoted opportunities in the curated column and hides promoted candidates by default', async () => {
    ideaFoundryApi.getIdeaFoundryContents.mockResolvedValueOnce({
      sources: [],
      sourceProcessing: [],
      protoIdeas: [],
      ideaCandidates: [
        {
          id: 'candidate-promoted-1',
          protoIdeaId: 'proto-idea-promoted-1',
          problemStatement: 'Clinics lose time coordinating intake handoffs.',
          targetCustomer: 'Independent outpatient clinics.',
          valueProposition: 'An intake operations cockpit.',
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
          statusExplanation: 'The opportunity is clearer and more actionable.',
          refinementIteration: 1,
          workflowState: 'PROMOTED',
          evaluationReadinessLabel: 'High',
          evaluationStrongestAspect: 'The buyer and workflow pain are tightly aligned.',
          evaluationBiggestRisk: 'Clinic process change could slow rollout.',
          evaluationDuplicateRiskLabel: 'Low',
          evaluationNextBestAction: 'Promote it into Curated Opportunities.',
          protoIdeaTitle: 'Patient intake operations cockpit',
          createdAt: '2026-04-06T10:00:00.000Z',
          updatedAt: '2026-04-06T10:20:00.000Z'
        }
      ],
      curatedOpportunities: [
        {
          id: 'opportunity-1',
          ideaCandidateId: 'candidate-promoted-1',
          title: 'Patient intake operations cockpit',
          summary: 'Promoted because the workflow pain and buyer are both specific.',
          problemStatement: 'Clinics lose time coordinating intake handoffs.',
          targetCustomer: 'Independent outpatient clinics.',
          valueProposition: 'An intake operations cockpit.',
          productServiceDescription: 'A workflow layer that structures intake tasks, reminders, and handoffs.',
          differentiation: 'Focuses on intake handoffs instead of full EHR replacement.',
          earlyMonetizationIdea: 'Monthly SaaS subscription per active clinic.',
          readinessLabel: 'High',
          strongestAspect: 'The buyer and workflow pain are tightly aligned.',
          biggestRisk: 'Clinic process change could slow rollout.',
          blockingIssue: '',
          duplicateRiskLabel: 'Low',
          duplicateRiskExplanation: 'No close overlap is visible.',
          nextBestAction: 'Promote it into Curated Opportunities.',
          promotionReason: 'The candidate is specific enough for downstream strategy work.',
          promotedAt: '2026-04-06T10:30:00.000Z',
          updatedAt: '2026-04-06T10:30:00.000Z'
        }
      ],
      runtime: {
        agentState: 'active',
        latestRunStatus: 'COMPLETED',
        isRunning: false,
        lastRun: '2026-04-06T10:30:00.000Z',
        nextRun: null,
        resultRecordCount: 0
      }
    });

    const fixture = await createOverviewComponent((componentFixture) => {
      expect(componentFixture.componentInstance.columns[2]?.totalCount).toBe(1);
      expect(componentFixture.componentInstance.columns[3]?.totalCount).toBe(1);
    });

    const text = fixture.nativeElement.textContent;
    const counts = Array.from(fixture.nativeElement.querySelectorAll('.pipeline-count')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );

    expect(text).toContain('Patient intake operations cockpit');
    expect(text).toContain('Promoted');
    expect(text).toContain('The buyer and workflow pain are tightly aligned.');
    expect(text).not.toContain('No curated opportunities yet');
    expect(counts).toEqual(['0/0', '0/0', '0/1', '1']);
  });

  it('starts proto-idea cards compact and expands on click', async () => {
    const fixture = await createOverviewComponent(undefined, { showProcessedItems: true });

    const protoIdeaButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.pipeline-column[data-stage-id="proto-ideas"] .pipeline-card-toggle')
    ) as HTMLButtonElement[];
    const firstProtoIdeaCard = protoIdeaButtons[0];

    expect(firstProtoIdeaCard.textContent).toContain('Compliance workflow co-pilot for small accounting firms');
    expect(firstProtoIdeaCard.textContent).toContain('2026');
    expect(firstProtoIdeaCard.textContent).not.toContain(
      'Accounting teams are stuck chasing repetitive VAT reminder and follow-up work.'
    );
    expect(firstProtoIdeaCard.textContent).not.toContain(
      'Customer: Small accounting firms handling recurring compliance deadlines.'
    );
    expect(firstProtoIdeaCard.textContent).not.toContain('Promising');

    const expandedFixture = await createOverviewComponent(undefined, {
      showProcessedItems: true,
      expandedCardIds: ['proto-idea-1']
    });
    const expandedProtoIdeaCard = expandedFixture.nativeElement.querySelector(
      '.pipeline-column[data-stage-id="proto-ideas"] .pipeline-card-toggle'
    ) as HTMLButtonElement;

    expect(expandedProtoIdeaCard.textContent).toContain(
      'Accounting teams are stuck chasing repetitive VAT reminder and follow-up work.'
    );
    expect(expandedProtoIdeaCard.textContent).toContain(
      'Customer: Small accounting firms handling recurring compliance deadlines.'
    );
    expect(expandedProtoIdeaCard.textContent).toContain('Type: Workflow SaaS');
    expect(expandedProtoIdeaCard.textContent).toContain('Confidence: medium');
    expect(expandedProtoIdeaCard.textContent).toContain('Promising');
  });

  it('renders live source cards returned by the API', async () => {
    const fixture = await createOverviewComponent();

    const text = fixture.nativeElement.textContent;
    const sourceButtons = fixture.nativeElement.querySelectorAll(
      '.pipeline-column[data-stage-id="sources"] .pipeline-card-toggle'
    );

    expect(text).toContain('Manual rota coordination is chaos');
    expect(text).not.toContain('VAT reminders are killing your accounting firm');
    expect(sourceButtons.length).toBe(1);
  });

  it('starts source cards compact and expands on click', async () => {
    const fixture = await createOverviewComponent();

    const firstSourceCard = fixture.nativeElement.querySelector('.pipeline-card-toggle') as HTMLButtonElement;
    expect(firstSourceCard.textContent).toContain('Manual rota coordination is chaos');
    expect(firstSourceCard.textContent).toContain('2026');
    expect(firstSourceCard.textContent).not.toContain('Practice managers compare manual scheduling breakdowns.');
    expect(firstSourceCard.textContent).not.toContain('Open source');
    expect(firstSourceCard.textContent).not.toContain('Normalized');

    const expandedFixture = await createOverviewComponent(undefined, {
      expandedCardIds: ['result-2']
    });
    const expandedSourceCard = expandedFixture.nativeElement.querySelector('.pipeline-card-toggle') as HTMLButtonElement;

    expect(expandedSourceCard.textContent).toContain('2026');
    expect(expandedSourceCard.textContent).toContain('Practice managers compare manual scheduling breakdowns.');
    expect(expandedSourceCard.textContent).toContain('Query family: Urgent rota / scheduling breakdowns');
    expect(expandedSourceCard.textContent).toContain('Open source');
  });

  it('shows empty-state cards instead of seeded demo records when no live sources exist', async () => {
    ideaFoundryApi.getIdeaFoundryContents.mockResolvedValueOnce({
      sources: [],
      sourceProcessing: [],
      protoIdeas: [],
      ideaCandidates: [],
      curatedOpportunities: [],
      runtime: {
        agentState: 'active',
        latestRunStatus: 'idle',
        isRunning: false,
        lastRun: '',
        nextRun: '',
        resultRecordCount: 0
      }
    });

    const fixture = await createOverviewComponent((componentFixture) => {
      expect(componentFixture.componentInstance.columns[0]?.cards[0]?.id).toBe('sources-empty');
      expect(componentFixture.componentInstance.columns[2]?.cards[0]?.id).toBe('idea-candidates-empty');
    });

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Sources');
    expect(text).not.toContain('Freelancer tax workflow complaints');
    expect(text).not.toContain('Managed onboarding ops for AI-heavy B2B SaaS');
  });

  it('shows processed items again when the toggle is enabled', async () => {
    const fixture = await createOverviewComponent(undefined, { showProcessedItems: true });

    const text = fixture.nativeElement.textContent;
    const counts = Array.from(fixture.nativeElement.querySelectorAll('.pipeline-count')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );

    expect(text).toContain('VAT reminders are killing your accounting firm');
    expect(text).toContain('Compliance workflow co-pilot for small accounting firms');
    expect(counts).toEqual(['1/2', '0/1', '1/1', '0']);
  });

  it('treats only awaiting-evaluation candidates as unprocessed and hides refine or reject outcomes by default', async () => {
    ideaFoundryApi.getIdeaFoundryContents.mockResolvedValueOnce({
      ...baseContents,
      sources: [],
      sourceProcessing: [],
      protoIdeas: [],
      ideaCandidates: [
        {
          ...baseContents.ideaCandidates[0],
          id: 'candidate-awaiting-1',
          protoIdeaTitle: 'Awaiting evaluation candidate',
          workflowState: 'AWAITING_EVALUATION',
          evaluationStatus: 'PENDING'
        },
        {
          ...baseContents.ideaCandidates[0],
          id: 'candidate-refine-1',
          protoIdeaTitle: 'Needs refinement candidate',
          workflowState: 'NEEDS_REFINEMENT',
          evaluationStatus: 'COMPLETED',
          evaluationDecision: 'REFINE',
          evaluationBlockingIssue: 'Needs stronger differentiation.'
        },
        {
          ...baseContents.ideaCandidates[0],
          id: 'candidate-reject-1',
          protoIdeaTitle: 'Rejected candidate',
          workflowState: 'REJECTED',
          evaluationStatus: 'COMPLETED',
          evaluationDecision: 'REJECT',
          evaluationBiggestRisk: 'Too generic to justify promotion.'
        }
      ],
      curatedOpportunities: []
    });

    const fixture = await createOverviewComponent((componentFixture) => {
      expect(componentFixture.componentInstance.columns[2]?.totalCount).toBe(3);
      expect(componentFixture.componentInstance.columns[2]?.unprocessedCount).toBe(1);
    });

    const text = fixture.nativeElement.textContent;
    const counts = Array.from(fixture.nativeElement.querySelectorAll('.pipeline-count')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );

    expect(text).toContain('Awaiting evaluation candidate');
    expect(text).not.toContain('Needs refinement candidate');
    expect(text).not.toContain('Rejected candidate');
    expect(counts).toEqual(['0/0', '0/0', '1/3', '0']);
  });

  it('shows refined and rejected candidates only when processed items are enabled while keeping the awaiting count', async () => {
    ideaFoundryApi.getIdeaFoundryContents.mockResolvedValueOnce({
      ...baseContents,
      sources: [],
      sourceProcessing: [],
      protoIdeas: [],
      ideaCandidates: [
        {
          ...baseContents.ideaCandidates[0],
          id: 'candidate-awaiting-1',
          protoIdeaTitle: 'Awaiting evaluation candidate',
          workflowState: 'AWAITING_EVALUATION',
          evaluationStatus: 'PENDING'
        },
        {
          ...baseContents.ideaCandidates[0],
          id: 'candidate-refine-1',
          protoIdeaTitle: 'Needs refinement candidate',
          workflowState: 'NEEDS_REFINEMENT',
          evaluationStatus: 'COMPLETED',
          evaluationDecision: 'REFINE',
          evaluationBlockingIssue: 'Needs stronger differentiation.'
        },
        {
          ...baseContents.ideaCandidates[0],
          id: 'candidate-reject-1',
          protoIdeaTitle: 'Rejected candidate',
          workflowState: 'REJECTED',
          evaluationStatus: 'COMPLETED',
          evaluationDecision: 'REJECT',
          evaluationBiggestRisk: 'Too generic to justify promotion.'
        }
      ],
      curatedOpportunities: []
    });

    const fixture = await createOverviewComponent(
      (componentFixture) => {
        expect(componentFixture.componentInstance.columns[2]?.totalCount).toBe(3);
        expect(componentFixture.componentInstance.columns[2]?.unprocessedCount).toBe(1);
      },
      { showProcessedItems: true }
    );

    const text = fixture.nativeElement.textContent;
    const counts = Array.from(fixture.nativeElement.querySelectorAll('.pipeline-count')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );

    expect(text).toContain('Awaiting evaluation candidate');
    expect(text).toContain('Needs refinement candidate');
    expect(text).toContain('Rejected candidate');
    expect(text).toContain('Needs refinement');
    expect(text).toContain('Rejected');
    expect(counts).toEqual(['0/0', '0/0', '1/3', '0']);
  });

  it('shows an awaiting-evaluation empty state when every idea candidate has already been processed', async () => {
    ideaFoundryApi.getIdeaFoundryContents.mockResolvedValueOnce({
      ...baseContents,
      sources: [],
      sourceProcessing: [],
      protoIdeas: [],
      ideaCandidates: [
        {
          ...baseContents.ideaCandidates[0],
          id: 'candidate-refine-1',
          protoIdeaTitle: 'Needs refinement candidate',
          workflowState: 'NEEDS_REFINEMENT',
          evaluationStatus: 'COMPLETED',
          evaluationDecision: 'REFINE'
        }
      ],
      curatedOpportunities: []
    });

    const fixture = await createOverviewComponent((componentFixture) => {
      expect(componentFixture.componentInstance.columns[2]?.totalCount).toBe(1);
      expect(componentFixture.componentInstance.columns[2]?.unprocessedCount).toBe(0);
    });

    const text = fixture.nativeElement.textContent;
    const counts = Array.from(fixture.nativeElement.querySelectorAll('.pipeline-count')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );

    expect(text).toContain('No idea candidates awaiting evaluation');
    expect(text).toContain('All current candidates have already been evaluated.');
    expect(text).not.toContain('Needs refinement candidate');
    expect(counts).toEqual(['0/0', '0/0', '0/1', '0']);
  });

  it('starts the backend-owned pipeline from the overview and marks the active backend stage as running', async () => {
    const fixture = await createOverviewComponent();

    await fixture.componentInstance.runPipeline('sources');

    expect(ideaFoundryApi.runIdeaFoundryPipeline).toHaveBeenCalledTimes(1);
    expect(ideaFoundryApi.runIdeaFoundryPipeline).toHaveBeenCalledWith({
      startStage: 'sources'
    });
    expect(fixture.componentInstance.stageStates).toEqual({
      sources: 'completed',
      'proto-ideas': 'running',
      'idea-candidates': 'pending',
      'curated-opportunities': 'pending'
    });
  });

  it('can start the backend-owned pipeline from a specific stage button', async () => {
    const fixture = await createOverviewComponent();

    await fixture.componentInstance.runPipeline('idea-candidates');

    expect(ideaFoundryApi.runIdeaFoundryPipeline).toHaveBeenCalledWith({
      startStage: 'idea-candidates'
    });
  });

  it('polls backend status and shows a failed stage reported by the backend runtime', async () => {
    const failedStatus = {
      runId: 'run-2',
      status: 'FAILED' as const,
      startedAt: '2026-04-05T20:35:32.953Z',
      endedAt: '2026-04-05T20:36:02.953Z',
      stageStates: {
        sources: 'completed' as const,
        'proto-ideas': 'failed' as const,
        'idea-candidates': 'pending' as const,
        'curated-opportunities': 'pending' as const
      },
      stageResults: [],
      completedStageCount: 1,
      failedStageCount: 1,
      errorMessage: 'Proto-Idea Extraction stage failed.'
    };
    ideaFoundryApi.runIdeaFoundryPipeline.mockResolvedValueOnce({
      started: true,
      run: {
        runId: 'run-2',
        status: 'RUNNING',
        startedAt: '2026-04-05T20:35:32.953Z',
        endedAt: null,
        stageStates: {
          sources: 'completed',
          'proto-ideas': 'running',
          'idea-candidates': 'pending',
          'curated-opportunities': 'pending'
        },
        stageResults: [],
        completedStageCount: 0,
        failedStageCount: 0,
        errorMessage: null
      }
    });

    const fixture = await createOverviewComponent();

    await fixture.componentInstance.runPipeline('sources');
    ideaFoundryApi.getIdeaFoundryPipelineStatus.mockResolvedValue(failedStatus);
    await fixture.componentInstance['refreshPipelineStatus']();

    expect(fixture.componentInstance.stageStates).toEqual({
      sources: 'completed',
      'proto-ideas': 'failed',
      'idea-candidates': 'pending',
      'curated-opportunities': 'pending'
    });
    expect(fixture.componentInstance.pipelineRunError).toContain('Proto-Idea Extraction stage failed');
  });
});
