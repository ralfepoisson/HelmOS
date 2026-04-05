import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { IdeaFoundryApiService } from './idea-foundry-api.service';
import { ProspectingConfigurationComponent } from './prospecting-configuration.component';
import { PROSPECTING_CONFIGURATION_MOCK } from './prospecting-configuration.mock';

describe('ProspectingConfigurationComponent', () => {
  const ideaFoundryApi = {
    getProspectingConfiguration: vi.fn(async () => ({
      snapshot: null,
      latestReview: null,
      runtime: {
        agentState: 'active',
        latestRunStatus: 'idle',
        isRunning: false,
        lastRun: null,
        nextRun: null,
        resultRecordCount: 0
      }
    })),
    runProspectingConfigurationReview: vi.fn(async (snapshot) => ({
      snapshot,
      latestReview: {
        reply_to_user: {
          content: 'The Prospecting Agent reviewed the current strategy and saved an updated configuration.'
        }
      },
      runtime: {
        agentState: 'active',
        latestRunStatus: 'COMPLETED',
        isRunning: false,
        lastRun: '2026-04-05T14:30:00.000Z',
        nextRun: '2026-04-05T18:30:00.000Z',
        resultRecordCount: 0
      }
    })),
    executeProspectingRun: vi.fn(async () => ({
      snapshot: PROSPECTING_CONFIGURATION_MOCK,
      latestReview: {
        reply_to_user: {
          content: 'Execution finished.'
        }
      },
      runtime: {
        agentState: 'active',
        latestRunStatus: 'COMPLETED',
        isRunning: false,
        lastRun: '2026-04-05T14:35:00.000Z',
        nextRun: '2026-04-05T18:35:00.000Z',
        resultRecordCount: 7
      }
    }))
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProspectingConfigurationComponent],
      providers: [
        {
          provide: IdeaFoundryApiService,
          useValue: ideaFoundryApi
        }
      ]
    }).compileComponents();
  });

  it('renders the main operator-facing sections', async () => {
    const fixture = TestBed.createComponent(ProspectingConfigurationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Control how the Prospecting Agent searches for new opportunity signals');
    expect(text).toContain('Prospecting objective');
    expect(text).toContain('Strategic logic');
    expect(text).toContain('Search themes / lenses');
    expect(text).toContain('Where the agent is looking');
    expect(text).toContain('Query families / active search directions');
    expect(text).toContain('Signal quality rules');
    expect(text).toContain('Scan cadence & run mode');
  });

  it('shows Run Agent when the prospecting agent is not actively running', async () => {
    const fixture = TestBed.createComponent(ProspectingConfigurationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Run Agent');
  });

  it('sends the live snapshot to the backend when Run Agent is clicked', async () => {
    const fixture = TestBed.createComponent(ProspectingConfigurationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance.handleAgentAction();
    fixture.detectChanges();

    expect(ideaFoundryApi.runProspectingConfigurationReview).toHaveBeenCalledTimes(1);
    expect(ideaFoundryApi.runProspectingConfigurationReview).toHaveBeenCalledWith(
      expect.objectContaining({
        objective: expect.objectContaining({
          name: expect.any(String)
        })
      })
    );
    expect(fixture.nativeElement.textContent).toContain(
      'The Prospecting Agent reviewed the current strategy and saved an updated configuration.'
    );
  });

  it('preserves the current form values when the run response snapshot is sparse', async () => {
    ideaFoundryApi.runProspectingConfigurationReview.mockResolvedValueOnce({
      snapshot: {
        ...PROSPECTING_CONFIGURATION_MOCK,
        strategyMode: 'Broad exploration',
        objective: {
          ...PROSPECTING_CONFIGURATION_MOCK.objective,
          name: '',
          description: '',
          targetDomain: '',
          includeKeywords: '',
          excludeThemes: '',
          operatorNote: ''
        },
        strategySummary: '',
        steeringHypothesis: '',
        strategyPatterns: [],
        themes: [],
        sources: [],
        queryFamilies: [],
        signalRules: []
      },
      latestReview: {
        reply_to_user: {
          content: 'The Prospecting Agent reviewed the strategy.'
        }
      },
      runtime: {
        agentState: 'active',
        latestRunStatus: 'COMPLETED',
        isRunning: false,
        lastRun: '2026-04-05T14:30:00.000Z',
        nextRun: '2026-04-05T18:30:00.000Z',
        resultRecordCount: 0
      }
    });

    const fixture = TestBed.createComponent(ProspectingConfigurationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const originalName = fixture.componentInstance.snapshot.objective.name;
    const originalSummary = fixture.componentInstance.snapshot.strategySummary;
    const originalThemeCount = fixture.componentInstance.snapshot.themes.length;
    const originalSourceCount = fixture.componentInstance.snapshot.sources.length;

    await fixture.componentInstance.handleAgentAction();
    fixture.detectChanges();

    expect(fixture.componentInstance.snapshot.objective.name).toBe(originalName);
    expect(fixture.componentInstance.snapshot.strategySummary).toBe(originalSummary);
    expect(fixture.componentInstance.snapshot.themes.length).toBe(originalThemeCount);
    expect(fixture.componentInstance.snapshot.sources.length).toBe(originalSourceCount);
    expect(fixture.componentInstance.snapshot.strategyMode).toBe('Broad exploration');
  });

  it('triggers prospecting execution when Run now is clicked', async () => {
    const fixture = TestBed.createComponent(ProspectingConfigurationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance.runNow();
    fixture.detectChanges();

    expect(ideaFoundryApi.executeProspectingRun).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.runtimeState.resultRecordCount).toBe(7);
    expect(fixture.nativeElement.textContent).toContain('stored 7 normalized source records');
  });
});
