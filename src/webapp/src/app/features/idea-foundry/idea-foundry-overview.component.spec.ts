import { TestBed } from '@angular/core/testing';

import { IdeaFoundryOverviewComponent } from './idea-foundry-overview.component';

describe('IdeaFoundryOverviewComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdeaFoundryOverviewComponent]
    }).compileComponents();
  });

  it('renders the pipeline columns for the overview board', () => {
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();

    const stageTitles = Array.from(fixture.nativeElement.querySelectorAll('.pipeline-column-header h4')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );

    expect(stageTitles).toEqual(['Sources', 'Proto-Ideas', 'Idea Candidates', 'Curated Opportunities']);
  });

  it('shows seeded opportunity cards across the pipeline', () => {
    const fixture = TestBed.createComponent(IdeaFoundryOverviewComponent);
    fixture.detectChanges();

    const cards = Array.from(fixture.nativeElement.querySelectorAll('.pipeline-card h5')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );

    expect(cards.length).toBeGreaterThanOrEqual(5);
    expect(cards).toContain('EU freelancer compliance cockpit');
    expect(cards).toContain('Managed onboarding ops for AI-heavy B2B SaaS');
  });
});
