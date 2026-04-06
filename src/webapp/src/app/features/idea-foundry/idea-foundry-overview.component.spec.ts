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
      protoIdeas: [],
      ideaCandidates: [],
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

    expect(text).toContain('No proto-ideas yet');
    expect(text).toContain('No idea candidates yet');
    expect(text).toContain('No curated opportunities yet');
    expect(text).not.toContain('EU freelancer compliance cockpit');
    expect(text).not.toContain('Managed onboarding ops for AI-heavy B2B SaaS');
  });

  it('renders live source cards returned by the API', async () => {
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    const sourceButtons = fixture.nativeElement.querySelectorAll('.pipeline-card-toggle');

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
