import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { IdeaFoundryApiService } from '../idea-foundry/idea-foundry-api.service';
import { PipelineHistoryScreenComponent } from './pipeline-history-screen.component';

describe('PipelineHistoryScreenComponent', () => {
  const listPipelineRuns = vi.fn();
  const getPipelineRunDetail = vi.fn();
  const runIdeaFoundryPipeline = vi.fn();
  const getPipelineStatus = vi.fn();
  const getPipelineSchedule = vi.fn();
  const savePipelineSchedule = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    listPipelineRuns.mockResolvedValue([
      {
        runId: 'run-2',
        ownerUserId: 'admin-user-1',
        status: 'FAILED',
        requestedStartStage: 'idea-candidates',
        startedAt: '2026-04-11T09:00:00.000Z',
        endedAt: '2026-04-11T09:04:00.000Z',
        completedStageCount: 2,
        failedStageCount: 1,
        errorMessage: 'Idea evaluation failed.'
      },
      {
        runId: 'run-1',
        ownerUserId: 'admin-user-1',
        status: 'COMPLETED',
        requestedStartStage: 'sources',
        startedAt: '2026-04-10T08:00:00.000Z',
        endedAt: '2026-04-10T08:03:00.000Z',
        completedStageCount: 4,
        failedStageCount: 0,
        errorMessage: null
      }
    ]);

    getPipelineRunDetail.mockImplementation(async (runId: string) => ({
      runId,
      ownerUserId: 'admin-user-1',
      status: runId === 'run-2' ? 'FAILED' : 'COMPLETED',
      requestedStartStage: runId === 'run-2' ? 'idea-candidates' : 'sources',
      startedAt: runId === 'run-2' ? '2026-04-11T09:00:00.000Z' : '2026-04-10T08:00:00.000Z',
      endedAt: runId === 'run-2' ? '2026-04-11T09:04:00.000Z' : '2026-04-10T08:03:00.000Z',
      completedStageCount: runId === 'run-2' ? 2 : 4,
      failedStageCount: runId === 'run-2' ? 1 : 0,
      errorMessage: runId === 'run-2' ? 'Idea evaluation failed.' : null,
      stageStates: {
        sources: 'completed',
        'proto-ideas': 'completed',
        'idea-candidates': 'completed',
        'curated-opportunities': runId === 'run-2' ? 'failed' : 'completed'
      },
      stages: [
        {
          stageKey: 'proto-ideas',
          status: 'COMPLETED',
          attempts: 2,
          processedCount: 2,
          producedCount: 1,
          startedAt: '2026-04-11T09:00:10.000Z',
          endedAt: '2026-04-11T09:01:10.000Z',
          history: [
            {
              kind: 'created',
              entityType: 'proto-idea',
              entityId: 'proto-1',
              title: 'Emergency shift scheduling assistant',
              summary: 'Created a new proto-idea from the strongest source signal.'
            }
          ]
        }
      ]
    }));
    getPipelineStatus.mockResolvedValue({
      runId: 'run-2',
      ownerUserId: 'admin-user-1',
      status: 'FAILED',
      startedAt: '2026-04-11T09:00:00.000Z',
      endedAt: '2026-04-11T09:04:00.000Z',
      stageStates: {
        sources: 'completed',
        'proto-ideas': 'completed',
        'idea-candidates': 'completed',
        'curated-opportunities': 'failed'
      },
      stageResults: [],
      completedStageCount: 2,
      failedStageCount: 1,
      errorMessage: 'Idea evaluation failed.'
    });
    getPipelineSchedule.mockResolvedValue({
      enabled: true,
      intervalMinutes: 240,
      lastRunAt: '2026-04-11T08:00:00.000Z',
      nextRunAt: '2026-04-11T12:00:00.000Z',
      upcomingRuns: [
        '2026-04-11T12:00:00.000Z',
        '2026-04-11T16:00:00.000Z',
        '2026-04-11T20:00:00.000Z',
        '2026-04-12T00:00:00.000Z',
        '2026-04-12T04:00:00.000Z'
      ]
    });
    savePipelineSchedule.mockImplementation(async (payload: { enabled: boolean; intervalMinutes: number }) => ({
      enabled: payload.enabled,
      intervalMinutes: payload.intervalMinutes,
      lastRunAt: '2026-04-11T08:00:00.000Z',
      nextRunAt: payload.enabled ? '2026-04-11T12:00:00.000Z' : null,
      upcomingRuns: payload.enabled
        ? [
            '2026-04-11T12:00:00.000Z',
            '2026-04-11T16:00:00.000Z',
            '2026-04-11T20:00:00.000Z',
            '2026-04-12T00:00:00.000Z',
            '2026-04-12T04:00:00.000Z'
          ]
        : []
    }));

    await TestBed.configureTestingModule({
      imports: [PipelineHistoryScreenComponent],
      providers: [
        provideRouter([]),
        {
          provide: WorkspaceShellService,
          useValue: {
            productName: 'HelmOS'
          }
        },
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => true,
            getProfileInitials: () => 'RP',
            getProfileName: () => 'Ralfe Poisson',
            getProfileRoleLabel: () => 'Admin',
            signOut: vi.fn()
          }
        },
        {
          provide: IdeaFoundryApiService,
          useValue: {
            listIdeaFoundryPipelineRuns: listPipelineRuns,
            getIdeaFoundryPipelineRunDetail: getPipelineRunDetail,
            runIdeaFoundryPipeline,
            getIdeaFoundryPipelineStatus: getPipelineStatus,
            getIdeaFoundryPipelineSchedule: getPipelineSchedule,
            saveIdeaFoundryPipelineSchedule: savePipelineSchedule
          }
        }
      ]
    }).compileComponents();
  });

  it('loads pipeline runs into the left rail and shows the latest run detail by default', async () => {
    const fixture = TestBed.createComponent(PipelineHistoryScreenComponent);
    await fixture.componentInstance.loadHistory();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Apr 11, 2026');
    expect(text).toContain('Apr 10, 2026');
    expect(text).toContain('Emergency shift scheduling assistant');
    expect(getPipelineRunDetail).toHaveBeenCalledWith('run-2');
  });

  it('loads a different pipeline execution when a run is selected from the history rail', async () => {
    const fixture = TestBed.createComponent(PipelineHistoryScreenComponent);
    await fixture.componentInstance.loadHistory();
    fixture.detectChanges();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.history-run-button')
    ) as HTMLButtonElement[];

    buttons[1]?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getPipelineRunDetail).toHaveBeenLastCalledWith('run-1');
  });

  it('renders the four stage boxes and switches the detail pane when a stage is selected', async () => {
    const fixture = TestBed.createComponent(PipelineHistoryScreenComponent);
    await fixture.componentInstance.loadHistory();
    fixture.detectChanges();

    const stageButtons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.pipeline-stage-node')
    ) as HTMLButtonElement[];

    expect(stageButtons).toHaveLength(4);
    expect(stageButtons.map((button) => button.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      expect.stringContaining('Sources'),
      expect.stringContaining('Proto-Ideas'),
      expect.stringContaining('Idea Candidates'),
      expect.stringContaining('Curated Opportunities')
    ]);

    stageButtons[2]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedStageKey).toBe('idea-candidates');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No detailed changes have been recorded yet for this stage');
  });

  it('uses the live pipeline status to color the stage graph while a run is in progress', async () => {
    const fixture = TestBed.createComponent(PipelineHistoryScreenComponent);
    fixture.componentInstance.selectedRun = {
      runId: 'run-4',
      ownerUserId: 'admin-user-1',
      status: 'RUNNING',
      requestedStartStage: 'sources',
      startedAt: '2026-04-11T09:20:00.000Z',
      endedAt: null,
      completedStageCount: 1,
      failedStageCount: 0,
      errorMessage: null,
      stageStates: {
        sources: 'completed',
        'proto-ideas': 'running',
        'idea-candidates': 'pending',
        'curated-opportunities': 'pending'
      },
      stages: [
        {
          stageKey: 'sources',
          status: 'COMPLETED',
          attempts: 1,
          processedCount: 1,
          producedCount: 30,
          startedAt: '2026-04-11T09:20:00.000Z',
          endedAt: '2026-04-11T09:20:30.000Z',
          history: []
        }
      ]
    };
    fixture.componentInstance.selectedStageKey = 'sources';
    fixture.detectChanges();

    expect(fixture.componentInstance.stageStatus('proto-ideas')).toBe('running');
    expect(fixture.componentInstance.stageStatus('curated-opportunities')).toBe('pending');
  });

  it('can trigger a new pipeline run from the history page and refresh the run list', async () => {
    runIdeaFoundryPipeline.mockResolvedValue({
      started: true,
      run: {
        runId: 'run-3',
        ownerUserId: 'admin-user-1',
        status: 'RUNNING',
        startedAt: '2026-04-11T09:10:00.000Z',
        endedAt: null,
        stageStates: {
          sources: 'running',
          'proto-ideas': 'pending',
          'idea-candidates': 'pending',
          'curated-opportunities': 'pending'
        },
        stageResults: [],
        completedStageCount: 0,
        failedStageCount: 0,
        errorMessage: null
      }
    });
    listPipelineRuns
      .mockResolvedValueOnce([
        {
          runId: 'run-2',
          ownerUserId: 'admin-user-1',
          status: 'FAILED',
          requestedStartStage: 'idea-candidates',
          startedAt: '2026-04-11T09:00:00.000Z',
          endedAt: '2026-04-11T09:04:00.000Z',
          completedStageCount: 2,
          failedStageCount: 1,
          errorMessage: 'Idea evaluation failed.'
        },
        {
          runId: 'run-1',
          ownerUserId: 'admin-user-1',
          status: 'COMPLETED',
          requestedStartStage: 'sources',
          startedAt: '2026-04-10T08:00:00.000Z',
          endedAt: '2026-04-10T08:03:00.000Z',
          completedStageCount: 4,
          failedStageCount: 0,
          errorMessage: null
        }
      ])
      .mockResolvedValueOnce([
        {
          runId: 'run-3',
          ownerUserId: 'admin-user-1',
          status: 'RUNNING',
          requestedStartStage: 'sources',
          startedAt: '2026-04-11T09:10:00.000Z',
          endedAt: null,
          completedStageCount: 0,
          failedStageCount: 0,
          errorMessage: null
        },
        {
          runId: 'run-2',
          ownerUserId: 'admin-user-1',
          status: 'FAILED',
          requestedStartStage: 'idea-candidates',
          startedAt: '2026-04-11T09:00:00.000Z',
          endedAt: '2026-04-11T09:04:00.000Z',
          completedStageCount: 2,
          failedStageCount: 1,
          errorMessage: 'Idea evaluation failed.'
        }
      ]);
    getPipelineRunDetail
      .mockResolvedValueOnce({
        runId: 'run-2',
        ownerUserId: 'admin-user-1',
        status: 'FAILED',
        requestedStartStage: 'idea-candidates',
        startedAt: '2026-04-11T09:00:00.000Z',
        endedAt: '2026-04-11T09:04:00.000Z',
        completedStageCount: 2,
        failedStageCount: 1,
        errorMessage: 'Idea evaluation failed.',
        stageStates: {
          sources: 'completed',
          'proto-ideas': 'completed',
          'idea-candidates': 'completed',
          'curated-opportunities': 'failed'
        },
        stages: []
      })
      .mockResolvedValueOnce({
        runId: 'run-3',
        ownerUserId: 'admin-user-1',
        status: 'RUNNING',
        requestedStartStage: 'sources',
        startedAt: '2026-04-11T09:10:00.000Z',
        endedAt: null,
        completedStageCount: 0,
        failedStageCount: 0,
        errorMessage: null,
        stageStates: {
          sources: 'running',
          'proto-ideas': 'pending',
          'idea-candidates': 'pending',
          'curated-opportunities': 'pending'
        },
        stages: []
      });

    const fixture = TestBed.createComponent(PipelineHistoryScreenComponent);
    await fixture.componentInstance.loadHistory();

    await fixture.componentInstance.runPipeline();

    expect(runIdeaFoundryPipeline).toHaveBeenCalledTimes(1);
    expect(listPipelineRuns.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(getPipelineRunDetail.mock.calls.some((call) => call[0] === 'run-3')).toBe(true);
    expect(fixture.componentInstance.selectedRunId).toBe('run-3');
  });

  it('can refresh the run list and the selected execution detail from the hero actions', async () => {
    listPipelineRuns
      .mockResolvedValueOnce([
        {
          runId: 'run-2',
          ownerUserId: 'admin-user-1',
          status: 'FAILED',
          requestedStartStage: 'idea-candidates',
          startedAt: '2026-04-11T09:00:00.000Z',
          endedAt: '2026-04-11T09:04:00.000Z',
          completedStageCount: 2,
          failedStageCount: 1,
          errorMessage: 'Idea evaluation failed.'
        }
      ])
      .mockResolvedValueOnce([
        {
          runId: 'run-2',
          ownerUserId: 'admin-user-1',
          status: 'FAILED',
          requestedStartStage: 'idea-candidates',
          startedAt: '2026-04-11T09:00:00.000Z',
          endedAt: '2026-04-11T09:04:00.000Z',
          completedStageCount: 2,
          failedStageCount: 1,
          errorMessage: 'Idea evaluation failed.'
        },
        {
          runId: 'run-9',
          ownerUserId: 'admin-user-1',
          status: 'COMPLETED',
          requestedStartStage: 'sources',
          startedAt: '2026-04-11T10:00:00.000Z',
          endedAt: '2026-04-11T10:05:00.000Z',
          completedStageCount: 4,
          failedStageCount: 0,
          errorMessage: null
        },
        {
          runId: 'run-2',
          ownerUserId: 'admin-user-1',
          status: 'FAILED',
          requestedStartStage: 'idea-candidates',
          startedAt: '2026-04-11T09:00:00.000Z',
          endedAt: '2026-04-11T09:04:00.000Z',
          completedStageCount: 2,
          failedStageCount: 1,
          errorMessage: 'Idea evaluation failed.'
        }
      ]);
    getPipelineRunDetail.mockResolvedValue({
      runId: 'run-2',
      ownerUserId: 'admin-user-1',
      status: 'FAILED',
      requestedStartStage: 'idea-candidates',
      startedAt: '2026-04-11T09:00:00.000Z',
      endedAt: '2026-04-11T09:04:00.000Z',
      completedStageCount: 2,
      failedStageCount: 1,
      errorMessage: 'Idea evaluation failed.',
      stageStates: {
        sources: 'completed',
        'proto-ideas': 'completed',
        'idea-candidates': 'completed',
        'curated-opportunities': 'failed'
      },
      stages: []
    });

    const fixture = TestBed.createComponent(PipelineHistoryScreenComponent);
    await fixture.componentInstance.loadHistory();

    await fixture.componentInstance.loadHistory();

    expect(listPipelineRuns.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(getPipelineRunDetail.mock.calls.some((call) => call[0] === 'run-2')).toBe(true);
    expect(fixture.componentInstance.selectedRunId).toBe('run-2');
    expect(fixture.componentInstance.runs.some((run) => run.runId === 'run-9')).toBe(true);
  });

  it('opens the schedule modal from the hero actions and shows the next five scheduled runs', async () => {
    const fixture = TestBed.createComponent(PipelineHistoryScreenComponent);
    await fixture.componentInstance.openScheduleModal();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';

    expect(getPipelineSchedule).toHaveBeenCalledTimes(1);
    expect(text).toContain('Pipeline configuration');
    expect(text).toContain('Apr 11, 2026');
    expect(host.querySelector('.history-schedule-modal')).toBeTruthy();
  });

  it('saves the updated schedule configuration from the modal', async () => {
    const fixture = TestBed.createComponent(PipelineHistoryScreenComponent);
    await fixture.componentInstance.openScheduleModal();
    fixture.componentInstance.scheduleEnabled = true;
    fixture.componentInstance.scheduleIntervalMinutes = 720;

    await fixture.componentInstance.saveSchedule();

    expect(savePipelineSchedule).toHaveBeenCalledWith({
      enabled: true,
      intervalMinutes: 720
    });
    expect(fixture.componentInstance.scheduleModalOpen).toBe(false);
    expect(fixture.componentInstance.pipelineSchedule?.intervalMinutes).toBe(720);
  });
});
