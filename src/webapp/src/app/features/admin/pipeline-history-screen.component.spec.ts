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
            getIdeaFoundryPipelineRunDetail: getPipelineRunDetail
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
});
