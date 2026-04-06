import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { IdeaFoundryApiService } from './idea-foundry-api.service';
import { IdeaFoundryOverviewComponent } from './idea-foundry-overview.component';

describe('IdeaFoundryOverviewComponent', () => {
  const ideaFoundryApi = {
    getIdeaFoundryContents: vi.fn(async () => ({
      sources: [
        {
          id: 'result-1',
          sourceTitle: 'VAT reminders are killing your accounting firm',
          sourceUrl: 'https://example.com/vat-reminders',
          snippet: 'Operators describe recurring invoicing and VAT reminder pain.',
          queryFamilyTitle: 'Complaint language around invoicing / VAT / reminders',
          themeLink: 'fragmented compliance workflows',
          query: 'hate doing VAT reminders every month',
          capturedAt: '2026-04-05T20:35:32.953Z'
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
      protoIdeas: [
        {
          id: 'proto-idea-1',
          sourceId: 'source-1',
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
    }))
  };

  beforeEach(async () => {
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
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const stageTitles = Array.from(fixture.nativeElement.querySelectorAll('.pipeline-column-header h4')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );

    expect(stageTitles).toEqual(['Sources', 'Proto-Ideas', 'Idea Candidates', 'Curated Opportunities']);
  });

  it('shows empty downstream stages without seeded demo opportunities', async () => {
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('No proto-ideas yet');
    expect(text).toContain('Compliance workflow co-pilot for small accounting firms');
    expect(text).toContain('Compliance workflow cockpit for small accounting firms that automates reminder sequencing and handoffs.');
    expect(text).toContain('No curated opportunities yet');
    expect(text).not.toContain('EU freelancer compliance cockpit');
    expect(text).not.toContain('Managed onboarding ops for AI-heavy B2B SaaS');
  });

  it('renders persisted proto-ideas returned by the API', async () => {
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const protoIdeaCard = fixture.nativeElement.querySelector(
      '.pipeline-column[data-stage-id="proto-ideas"] .pipeline-card-toggle'
    ) as HTMLButtonElement;
    protoIdeaCard.click();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Compliance workflow co-pilot for small accounting firms');
    expect(text).toContain('Accounting teams are stuck chasing repetitive VAT reminder and follow-up work.');
    expect(text).toContain('Customer: Small accounting firms handling recurring compliance deadlines.');
    expect(text).toContain('Type: Workflow SaaS');
    expect(text).toContain('Confidence: medium');
    expect(text).toContain('Promising');
  });

  it('renders persisted idea candidates returned by the API', async () => {
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Compliance workflow co-pilot for small accounting firms');
    expect(text).toContain('Refined');
    expect(text).toContain('Confidence: medium');
    expect(text).toContain('Iteration: 1');
    expect(text).toContain('Tools: Assumption Mapping, Analogy Transfer');
  });

  it('starts proto-idea cards compact and expands on click', async () => {
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

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

    firstProtoIdeaCard.click();
    fixture.detectChanges();

    expect(firstProtoIdeaCard.textContent).toContain(
      'Accounting teams are stuck chasing repetitive VAT reminder and follow-up work.'
    );
    expect(firstProtoIdeaCard.textContent).toContain(
      'Customer: Small accounting firms handling recurring compliance deadlines.'
    );
    expect(firstProtoIdeaCard.textContent).toContain('Type: Workflow SaaS');
    expect(firstProtoIdeaCard.textContent).toContain('Confidence: medium');
    expect(firstProtoIdeaCard.textContent).toContain('Promising');
  });

  it('renders live source cards returned by the API', async () => {
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    const sourceButtons = fixture.nativeElement.querySelectorAll(
      '.pipeline-column[data-stage-id="sources"] .pipeline-card-toggle'
    );

    expect(text).toContain('VAT reminders are killing your accounting firm');
    expect(text).toContain('Manual rota coordination is chaos');
    expect(sourceButtons.length).toBe(2);
  });

  it('starts source cards compact and expands on click', async () => {
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const firstSourceCard = fixture.nativeElement.querySelector('.pipeline-card-toggle') as HTMLButtonElement;
    expect(firstSourceCard.textContent).toContain('VAT reminders are killing your accounting firm');
    expect(firstSourceCard.textContent).toContain('2026');
    expect(firstSourceCard.textContent).not.toContain('Operators describe recurring invoicing and VAT reminder pain.');
    expect(firstSourceCard.textContent).not.toContain('Open source');
    expect(firstSourceCard.textContent).not.toContain('Normalized');

    firstSourceCard.click();
    fixture.detectChanges();

    expect(firstSourceCard.textContent).toContain('2026');
    expect(firstSourceCard.textContent).toContain('Operators describe recurring invoicing and VAT reminder pain.');
    expect(firstSourceCard.textContent).toContain('Query family: Complaint language around invoicing / VAT / reminders');
    expect(firstSourceCard.textContent).toContain('Open source');
  });

  it('shows empty-state cards instead of seeded demo records when no live sources exist', async () => {
    ideaFoundryApi.getIdeaFoundryContents.mockResolvedValueOnce({
      sources: [],
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

    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Sources');
    expect(text).not.toContain('Freelancer tax workflow complaints');
    expect(text).not.toContain('Managed onboarding ops for AI-heavy B2B SaaS');
  });
});
