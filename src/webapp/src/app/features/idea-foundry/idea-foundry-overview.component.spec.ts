import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { IdeaFoundryApiService } from './idea-foundry-api.service';
import { IdeaFoundryOverviewComponent } from './idea-foundry-overview.component';

describe('IdeaFoundryOverviewComponent', () => {
  const ideaFoundryApi = {
    getProspectingConfiguration: vi.fn(async () => ({
      snapshot: null,
      latestReview: null,
      resultRecords: [
        {
          id: 'result-1',
          sourceTitle: 'VAT reminders are killing your accounting firm',
          sourceUrl: 'https://example.com/vat-reminders',
          snippet: 'Operators describe recurring invoicing and VAT reminder pain.',
          queryFamilyTitle: 'Complaint language around invoicing / VAT / reminders',
          themeLink: 'fragmented compliance workflows',
          query: 'hate doing VAT reminders every month'
        },
        {
          id: 'result-2',
          sourceTitle: 'Manual rota coordination is chaos',
          sourceUrl: 'https://example.com/rota-chaos',
          snippet: 'Practice managers compare manual scheduling breakdowns.',
          queryFamilyTitle: 'Urgent rota / scheduling breakdowns',
          themeLink: 'last-minute scheduling pressure',
          query: 'rota fell apart again short notice cover'
        }
      ],
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

  it('shows empty-state cards instead of seeded demo records when no live sources exist', async () => {
    ideaFoundryApi.getProspectingConfiguration.mockResolvedValueOnce({
      snapshot: null,
      latestReview: null,
      resultRecords: [],
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
