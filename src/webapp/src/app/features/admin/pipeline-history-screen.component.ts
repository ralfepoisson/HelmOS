import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faGear } from '@fortawesome/free-solid-svg-icons';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import {
  IdeaFoundryApiService,
  IdeaFoundryPipelineHistoryDetail,
  IdeaFoundryPipelineHistoryEntry,
  IdeaFoundryPipelineScheduleResponse,
  IdeaFoundryPipelineHistoryStage,
  IdeaFoundryPipelineStageKey,
  IdeaFoundryPipelineStageStates
} from '../idea-foundry/idea-foundry-api.service';

@Component({
  selector: 'app-pipeline-history-screen',
  standalone: true,
  imports: [CommonModule, FaIconComponent, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      surfaceLabel="Pipeline administration"
      saveStatus="Pipeline history"
      [showWorkspaceSwitcher]="false"
    />

    <main class="history-shell container-fluid">
      <section class="history-hero">
        <div>
          <div class="section-kicker">Admin</div>
          <h1>Pipeline History</h1>
          <p>Review completed Idea Foundry runs stage by stage, including what each execution created and changed.</p>
        </div>
        <div class="hero-actions">
          <button
            type="button"
            class="btn btn-outline-secondary history-refresh-button"
            [disabled]="loading || runningPipeline"
            (click)="loadHistory()"
          >
            {{ loading ? 'Refreshing…' : 'Refresh' }}
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary history-schedule-button"
            aria-label="Pipeline configuration"
            [disabled]="scheduleLoading || scheduleSaving"
            (click)="openScheduleModal()"
          >
            <fa-icon [icon]="gearIcon"></fa-icon>
          </button>
          <button
            type="button"
            class="btn btn-primary history-run-pipeline-button"
            [disabled]="runningPipeline || loading"
            (click)="runPipeline()"
          >
            {{ runningPipeline ? 'Starting…' : 'Run Pipeline' }}
          </button>
        </div>
      </section>

      <section *ngIf="loadError" class="state-band" role="alert">
        <div class="section-kicker">Connection issue</div>
        <h2>Pipeline history is temporarily unavailable</h2>
        <p>{{ loadError }}</p>
        <button class="btn btn-primary" type="button" (click)="loadHistory()">Retry</button>
      </section>

      <section *ngIf="runError && !loadError" class="state-band" role="alert">
        <div class="section-kicker">Pipeline launch issue</div>
        <h2>Unable to start the pipeline</h2>
        <p>{{ runError }}</p>
      </section>

      <section *ngIf="!loadError" class="history-layout">
        <aside class="history-rail">
          <div class="rail-header">
            <div class="section-kicker">Executions</div>
            <strong>{{ runs.length }}</strong>
          </div>

          <div *ngIf="!loading && runs.length === 0" class="empty-rail">
            No pipeline executions have been recorded yet.
          </div>

          <button
            *ngFor="let run of runs; trackBy: trackByRunId"
            type="button"
            class="history-run-button"
            [class.history-run-button-active]="run.runId === selectedRunId"
            (click)="selectRun(run.runId)"
          >
            <span class="run-timestamp">{{ formatTimestamp(run.startedAt) }}</span>
            <span class="run-meta">
              <span class="run-status" [attr.data-status]="run.status">{{ formatStatus(run.status) }}</span>
              <span>{{ run.completedStageCount }} complete</span>
            </span>
          </button>
        </aside>

        <section class="history-detail">
          <div *ngIf="loading && !selectedRun" class="detail-state">Loading pipeline history…</div>

          <div *ngIf="!loading && !selectedRun" class="detail-state">Select a pipeline execution to inspect the detail.</div>

          <ng-container *ngIf="selectedRun as run">
            <section class="detail-summary">
              <div>
                <div class="section-kicker">Execution</div>
                <h2>{{ formatTimestamp(run.startedAt) }}</h2>
                <p>
                  Started from {{ stageLabel(run.requestedStartStage) }}.
                  <span *ngIf="run.endedAt">Finished {{ formatTimestamp(run.endedAt) }}.</span>
                </p>
              </div>
              <div class="summary-pills">
                <span class="summary-pill" [attr.data-status]="run.status">{{ formatStatus(run.status) }}</span>
                <span class="summary-pill">{{ run.completedStageCount }} stages completed</span>
                <span class="summary-pill" *ngIf="run.failedStageCount > 0">{{ run.failedStageCount }} failed</span>
              </div>
            </section>

            <p *ngIf="run.errorMessage" class="error-copy">{{ run.errorMessage }}</p>

            <section class="pipeline-graph" aria-label="Pipeline stages">
              <button
                *ngFor="let stageKey of stageOrder; let last = last"
                type="button"
                class="pipeline-stage-node"
                [class.pipeline-stage-node-active]="stageKey === selectedStageKey"
                [attr.data-stage-status]="stageStatus(stageKey)"
                (click)="selectStage(stageKey)"
              >
                <span class="pipeline-stage-dot"></span>
                <span class="pipeline-stage-name">{{ stageLabel(stageKey) }}</span>
                <span class="pipeline-stage-state">{{ stageStateLabel(stageStatus(stageKey)) }}</span>
                <span *ngIf="!last" class="pipeline-stage-connector" aria-hidden="true"></span>
              </button>
            </section>

            <section class="stage-list">
              <article *ngIf="selectedStageDetail as stage; else emptySelectedStage" class="stage-band">
                <div class="stage-header">
                  <div>
                    <div class="section-kicker">{{ stageLabel(stage.stageKey) }}</div>
                    <h3>{{ formatStatus(stage.status) }}</h3>
                  </div>
                  <div class="stage-metrics">
                    <span>Processed {{ stage.processedCount }}</span>
                    <span>Produced {{ stage.producedCount }}</span>
                    <span *ngIf="stage.attempts > 0">{{ stage.attempts }} attempt{{ stage.attempts === 1 ? '' : 's' }}</span>
                  </div>
                </div>

                <div class="stage-meta" *ngIf="stage.startedAt || stage.endedAt">
                  <span *ngIf="stage.startedAt">Started {{ formatTimestamp(stage.startedAt) }}</span>
                  <span *ngIf="stage.endedAt">Finished {{ formatTimestamp(stage.endedAt) }}</span>
                </div>

                <div *ngIf="stage.history.length === 0" class="empty-stage-history">
                  No item-level changes were recorded for this stage in the selected execution.
                </div>

                <ul *ngIf="stage.history.length > 0" class="stage-history-list">
                  <li *ngFor="let item of stage.history" class="stage-history-item">
                    <div class="history-item-header">
                      <strong>{{ item.title }}</strong>
                      <span class="history-kind">{{ historyKindLabel(item.kind) }}</span>
                    </div>
                    <p>{{ item.summary }}</p>
                    <small *ngIf="item.fromState && item.toState">{{ item.fromState }} -> {{ item.toState }}</small>
                  </li>
                </ul>
              </article>
              <ng-template #emptySelectedStage>
                <article class="stage-band">
                  <div class="stage-header">
                    <div>
                      <div class="section-kicker">{{ stageLabel(selectedStageKey || 'sources') }}</div>
                      <h3>{{ stageStateLabel(stageStatus(selectedStageKey || 'sources')) }}</h3>
                    </div>
                  </div>
                  <div class="empty-stage-history">
                    No detailed changes have been recorded yet for this stage in the selected execution.
                  </div>
                </article>
              </ng-template>
            </section>
          </ng-container>
        </section>
      </section>
    </main>

    <div *ngIf="scheduleModalOpen" class="modal-shell" role="presentation" (click)="closeScheduleModal()">
      <section
        class="history-schedule-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pipeline-schedule-title"
        (click)="$event.stopPropagation()"
      >
        <header class="modal-header">
          <div>
            <div class="section-kicker">Pipeline</div>
            <h2 id="pipeline-schedule-title">Pipeline configuration</h2>
            <p>Choose how often the pipeline should run automatically, then review the next five scheduled runs.</p>
          </div>
          <button
            type="button"
            class="btn-close"
            aria-label="Close pipeline configuration"
            [disabled]="scheduleSaving"
            (click)="closeScheduleModal()"
          ></button>
        </header>

        <div class="modal-body">
          <label class="schedule-toggle">
            <input
              type="checkbox"
              [checked]="scheduleEnabled"
              [disabled]="scheduleLoading || scheduleSaving"
              (change)="setScheduleEnabled($any($event.target).checked)"
            />
            <span>Enable scheduled runs</span>
          </label>

          <label class="schedule-field">
            <span>Cadence</span>
            <select
              class="form-select"
              [value]="scheduleIntervalMinutes"
              [disabled]="!scheduleEnabled || scheduleLoading || scheduleSaving"
              (change)="setScheduleIntervalMinutes(+$any($event.target).value)"
            >
              <option *ngFor="let option of scheduleIntervalOptions" [value]="option.minutes">
                {{ option.label }}
              </option>
            </select>
          </label>

          <div class="schedule-meta">
            <span *ngIf="pipelineSchedule?.lastRunAt">Last run {{ formatTimestamp(pipelineSchedule?.lastRunAt ?? null) }}</span>
            <span *ngIf="scheduleEnabled && schedulePreviewRuns[0]">Next run {{ formatTimestamp(schedulePreviewRuns[0]) }}</span>
            <span *ngIf="!scheduleEnabled">Automatic scheduling is off.</span>
          </div>

          <div *ngIf="scheduleError" class="state-band schedule-error" role="alert">
            <div class="section-kicker">Configuration issue</div>
            <p>{{ scheduleError }}</p>
          </div>

          <div class="schedule-preview">
            <div class="section-kicker">Next five runs</div>
            <ul *ngIf="schedulePreviewRuns.length > 0; else noSchedulePreview" class="schedule-preview-list">
              <li *ngFor="let runAt of schedulePreviewRuns">{{ formatTimestamp(runAt) }}</li>
            </ul>
            <ng-template #noSchedulePreview>
              <p class="empty-stage-history">Enable the schedule to preview the next planned pipeline runs.</p>
            </ng-template>
          </div>
        </div>

        <footer class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            [disabled]="scheduleSaving"
            (click)="closeScheduleModal()"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="scheduleLoading || scheduleSaving"
            (click)="saveSchedule()"
          >
            {{ scheduleSaving ? 'Saving…' : 'Save configuration' }}
          </button>
        </footer>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .history-shell {
        padding: 92px 1rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .history-hero,
      .state-band,
      .history-rail,
      .history-detail,
      .stage-band {
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(219, 228, 238, 0.95);
        border-radius: 8px;
      }

      .history-hero,
      .state-band {
        padding: 1rem 1.1rem;
      }

      .modal-shell {
        position: fixed;
        inset: 0;
        z-index: 1080;
        background: rgba(11, 18, 32, 0.48);
        display: grid;
        place-items: center;
        padding: 1rem;
      }

      .history-schedule-modal {
        width: min(560px, 100%);
        border-radius: 8px;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 24px 60px rgba(11, 18, 32, 0.2);
      }

      .modal-header,
      .modal-body,
      .modal-footer {
        padding-inline: 1.1rem;
      }

      .modal-header {
        padding-top: 1rem;
        display: flex;
        justify-content: space-between;
        gap: 1rem;
      }

      .modal-body {
        padding-top: 0.75rem;
        padding-bottom: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .modal-footer {
        padding-bottom: 1rem;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      .history-hero {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }

      .history-hero h1,
      .detail-summary h2,
      .stage-header h3,
      .state-band h2 {
        margin: 0.25rem 0 0.35rem;
        letter-spacing: -0.03em;
      }

      .history-hero p,
      .modal-header p,
      .state-band p,
      .detail-summary p,
      .error-copy,
      .empty-stage-history,
      .detail-state {
        margin: 0;
        color: var(--helmos-muted);
      }

      .history-layout {
        display: grid;
        grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
        gap: 1rem;
        align-items: start;
      }

      .history-rail {
        padding: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        position: sticky;
        top: 84px;
      }

      .rail-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }

      .hero-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      .history-schedule-button {
        min-width: 2.75rem;
        min-height: 2.75rem;
        display: inline-grid;
        place-items: center;
      }

      .schedule-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        font-weight: 600;
      }

      .schedule-field {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .schedule-field span {
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .schedule-meta {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        color: var(--helmos-muted);
        font-size: 0.92rem;
      }

      .schedule-error {
        padding: 0.85rem 0.95rem;
      }

      .schedule-preview {
        padding: 0.95rem 1rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        border-radius: 8px;
        background: rgba(247, 251, 255, 0.92);
      }

      .schedule-preview-list {
        margin: 0.75rem 0 0;
        padding-left: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .history-run-button {
        border: 1px solid rgba(219, 228, 238, 0.95);
        border-radius: 8px;
        background: #fff;
        text-align: left;
        padding: 0.85rem 0.9rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .history-run-button-active {
        border-color: rgba(31, 111, 235, 0.3);
        background: rgba(234, 242, 255, 0.7);
      }

      .run-timestamp {
        font-weight: 700;
        color: var(--helmos-text);
      }

      .run-meta,
      .stage-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        color: var(--helmos-muted);
        font-size: 0.85rem;
      }

      .history-detail {
        padding: 1rem 1.1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .detail-summary,
      .stage-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }

      .summary-pills,
      .stage-metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: flex-end;
      }

      .summary-pill,
      .run-status,
      .history-kind {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.55rem;
        border-radius: 999px;
        border: 1px solid rgba(219, 228, 238, 0.95);
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--helmos-text);
        background: rgba(247, 251, 255, 0.92);
      }

      [data-status='FAILED'] {
        color: #9f1239;
        border-color: rgba(225, 29, 72, 0.2);
        background: rgba(255, 241, 242, 0.95);
      }

      [data-status='COMPLETED'] {
        color: #166534;
        border-color: rgba(34, 197, 94, 0.22);
        background: rgba(240, 253, 244, 0.95);
      }

      [data-status='RUNNING'] {
        color: #1d4ed8;
        border-color: rgba(59, 130, 246, 0.22);
        background: rgba(239, 246, 255, 0.95);
      }

      .stage-list {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .pipeline-graph {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .pipeline-stage-node {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.3rem;
        padding: 0.85rem 0.9rem;
        border-radius: 8px;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: #fff;
        text-align: left;
      }

      .pipeline-stage-node-active {
        box-shadow: inset 0 0 0 1px rgba(31, 111, 235, 0.45);
      }

      .pipeline-stage-name {
        font-weight: 700;
        color: var(--helmos-text);
      }

      .pipeline-stage-state {
        font-size: 0.8rem;
        color: var(--helmos-muted);
      }

      .pipeline-stage-dot {
        width: 0.8rem;
        height: 0.8rem;
        border-radius: 999px;
        background: #94a3b8;
      }

      .pipeline-stage-node[data-stage-status='completed'] .pipeline-stage-dot {
        background: #16a34a;
      }

      .pipeline-stage-node[data-stage-status='running'] .pipeline-stage-dot {
        background: #f59e0b;
      }

      .pipeline-stage-node[data-stage-status='failed'] .pipeline-stage-dot {
        background: #e11d48;
      }

      .pipeline-stage-connector {
        position: absolute;
        top: 1.2rem;
        left: calc(100% + 0.3rem);
        width: calc(0.75rem - 0.1rem);
        height: 2px;
        background: rgba(148, 163, 184, 0.65);
      }

      .stage-band {
        padding: 0.9rem 1rem;
      }

      .stage-history-list {
        list-style: none;
        padding: 0;
        margin: 0.85rem 0 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .stage-history-item {
        padding-top: 0.75rem;
        border-top: 1px solid rgba(219, 228, 238, 0.95);
      }

      .stage-history-item:first-child {
        border-top: 0;
        padding-top: 0;
      }

      .history-item-header {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }

      .stage-history-item p {
        margin: 0.3rem 0 0;
      }

      .section-kicker {
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #7a6400;
      }

      @media (max-width: 991.98px) {
        .history-hero,
        .history-layout {
          grid-template-columns: 1fr;
        }

        .history-hero {
          flex-direction: column;
        }

        .history-rail {
          position: static;
        }

        .detail-summary,
        .stage-header {
          flex-direction: column;
        }

        .pipeline-graph {
          grid-template-columns: 1fr 1fr;
        }

        .pipeline-stage-connector {
          display: none;
        }

        .summary-pills,
        .stage-metrics {
          justify-content: flex-start;
        }
      }
    `
  ]
})
export class PipelineHistoryScreenComponent implements OnInit, OnDestroy {
  readonly shell = inject(WorkspaceShellService);
  private readonly api = inject(IdeaFoundryApiService);
  readonly gearIcon = faGear;
  readonly stageOrder: IdeaFoundryPipelineStageKey[] = [
    'sources',
    'proto-ideas',
    'idea-candidates',
    'curated-opportunities'
  ];
  readonly scheduleIntervalOptions = [
    { minutes: 60, label: 'Every hour' },
    { minutes: 240, label: 'Every 4 hours' },
    { minutes: 720, label: 'Every 12 hours' },
    { minutes: 1440, label: 'Every 24 hours' }
  ];

  loading = true;
  runningPipeline = false;
  loadError: string | null = null;
  runError: string | null = null;
  runs: IdeaFoundryPipelineHistoryEntry[] = [];
  selectedRunId: string | null = null;
  selectedRun: IdeaFoundryPipelineHistoryDetail | null = null;
  selectedStageKey: IdeaFoundryPipelineStageKey | null = null;
  scheduleModalOpen = false;
  scheduleLoading = false;
  scheduleSaving = false;
  scheduleError: string | null = null;
  pipelineSchedule: IdeaFoundryPipelineScheduleResponse | null = null;
  scheduleEnabled = false;
  scheduleIntervalMinutes = 60;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    setTimeout(() => {
      void this.loadHistory();
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async loadHistory(): Promise<void> {
    this.loading = true;
    this.loadError = null;

    try {
      this.runs = await this.api.listIdeaFoundryPipelineRuns();
      const nextRunId = this.selectedRunId && this.runs.some((run) => run.runId === this.selectedRunId)
        ? this.selectedRunId
        : (this.runs[0]?.runId ?? null);
      this.selectedRunId = nextRunId;
      this.selectedRun = nextRunId ? await this.api.getIdeaFoundryPipelineRunDetail(nextRunId) : null;
      this.ensureSelectedStage();
      this.syncPolling();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to load pipeline history.';
      this.selectedRun = null;
      this.stopPolling();
    } finally {
      this.loading = false;
    }
  }

  async runPipeline(): Promise<void> {
    if (this.runningPipeline) {
      return;
    }

    this.runningPipeline = true;
    this.runError = null;

    try {
      const response = await this.api.runIdeaFoundryPipeline();
      await this.loadHistory();
      if (response.run?.runId) {
        this.selectedRunId = response.run.runId;
        this.selectedRun = await this.api.getIdeaFoundryPipelineRunDetail(response.run.runId);
        this.ensureSelectedStage();
        this.syncPolling();
      }
    } catch (error) {
      this.runError = error instanceof Error ? error.message : 'Unable to start the pipeline.';
    } finally {
      this.runningPipeline = false;
    }
  }

  async openScheduleModal(): Promise<void> {
    this.scheduleModalOpen = true;
    this.scheduleLoading = true;
    this.scheduleError = null;

    try {
      const schedule = await this.api.getIdeaFoundryPipelineSchedule();
      this.pipelineSchedule = schedule;
      this.scheduleEnabled = schedule.enabled;
      this.scheduleIntervalMinutes = schedule.intervalMinutes;
    } catch (error) {
      this.scheduleError = error instanceof Error ? error.message : 'Unable to load the pipeline schedule.';
    } finally {
      this.scheduleLoading = false;
    }
  }

  closeScheduleModal(): void {
    if (this.scheduleSaving) {
      return;
    }

    this.scheduleModalOpen = false;
  }

  setScheduleEnabled(value: boolean): void {
    this.scheduleEnabled = value;
  }

  setScheduleIntervalMinutes(value: number): void {
    this.scheduleIntervalMinutes = value;
  }

  get schedulePreviewRuns(): string[] {
    if (!this.scheduleEnabled) {
      return [];
    }

    if (
      this.pipelineSchedule &&
      this.pipelineSchedule.enabled === this.scheduleEnabled &&
      this.pipelineSchedule.intervalMinutes === this.scheduleIntervalMinutes
    ) {
      return this.pipelineSchedule.upcomingRuns;
    }

    const startAt = new Date(Date.now() + this.scheduleIntervalMinutes * 60 * 1000);
    return Array.from({ length: 5 }, (_value, index) => {
      const nextRun = new Date(startAt.getTime() + index * this.scheduleIntervalMinutes * 60 * 1000);
      return nextRun.toISOString();
    });
  }

  async saveSchedule(): Promise<void> {
    if (this.scheduleSaving) {
      return;
    }

    this.scheduleSaving = true;
    this.scheduleError = null;

    try {
      this.pipelineSchedule = await this.api.saveIdeaFoundryPipelineSchedule({
        enabled: this.scheduleEnabled,
        intervalMinutes: this.scheduleIntervalMinutes
      });
      this.scheduleEnabled = this.pipelineSchedule.enabled;
      this.scheduleIntervalMinutes = this.pipelineSchedule.intervalMinutes;
      this.scheduleModalOpen = false;
    } catch (error) {
      this.scheduleError = error instanceof Error ? error.message : 'Unable to save the pipeline schedule.';
    } finally {
      this.scheduleSaving = false;
    }
  }

  async selectRun(runId: string): Promise<void> {
    if (!runId || runId === this.selectedRunId) {
      return;
    }

    this.selectedRunId = runId;
    this.selectedRun = await this.api.getIdeaFoundryPipelineRunDetail(runId);
    this.ensureSelectedStage();
    this.syncPolling();
  }

  selectStage(stageKey: IdeaFoundryPipelineStageKey): void {
    this.selectedStageKey = stageKey;
  }

  get selectedStageDetail(): IdeaFoundryPipelineHistoryStage | null {
    if (!this.selectedRun || !this.selectedStageKey) {
      return null;
    }

    return this.selectedRun.stages.find((stage) => stage.stageKey === this.selectedStageKey) ?? null;
  }

  stageStatus(stageKey: IdeaFoundryPipelineStageKey): 'pending' | 'running' | 'completed' | 'failed' {
    const status = this.selectedRun?.stageStates?.[stageKey];
    if (status === 'running' || status === 'completed' || status === 'failed') {
      return status;
    }
    return 'pending';
  }

  stageStateLabel(value: 'pending' | 'running' | 'completed' | 'failed'): string {
    switch (value) {
      case 'running':
        return 'In progress';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  }

  formatTimestamp(value: string | null): string {
    if (!value) {
      return 'Unknown time';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Unknown time';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(parsed);
  }

  formatStatus(value: string): string {
    switch ((value ?? '').toUpperCase()) {
      case 'FAILED':
        return 'Failed';
      case 'RUNNING':
        return 'Running';
      case 'HALTED':
        return 'Halted';
      default:
        return 'Completed';
    }
  }

  stageLabel(stageKey: string): string {
    switch (stageKey) {
      case 'proto-ideas':
        return 'Proto-Ideas';
      case 'idea-candidates':
        return 'Idea Candidates';
      case 'curated-opportunities':
        return 'Curated Opportunities';
      default:
        return 'Sources';
    }
  }

  historyKindLabel(kind: string): string {
    return kind === 'state_changed' ? 'State changed' : 'Created';
  }

  trackByRunId(_index: number, run: IdeaFoundryPipelineHistoryEntry): string {
    return run.runId;
  }

  trackByStageKey(_index: number, stage: IdeaFoundryPipelineHistoryStage): string {
    return stage.stageKey;
  }

  private ensureSelectedStage(): void {
    if (this.selectedStageKey && this.stageOrder.includes(this.selectedStageKey)) {
      return;
    }

    const firstWithDetail = this.selectedRun?.stages?.[0]?.stageKey;
    this.selectedStageKey = firstWithDetail ?? 'sources';
  }

  private syncPolling(): void {
    this.stopPolling();

    if (this.selectedRun?.status !== 'RUNNING' || !this.selectedRun.runId) {
      return;
    }

    this.pollTimer = setTimeout(() => {
      void this.pollSelectedRun();
    }, 2000);
  }

  private stopPolling(): void {
    if (!this.pollTimer) {
      return;
    }

    clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  private async pollSelectedRun(): Promise<void> {
    if (!this.selectedRun?.runId) {
      return;
    }

    try {
      const liveStatus = await this.api.getIdeaFoundryPipelineStatus();
      if (liveStatus.runId !== this.selectedRun.runId) {
        this.stopPolling();
        return;
      }

      const normalizedStatus = liveStatus.status === 'IDLE' ? 'RUNNING' : liveStatus.status;

      this.selectedRun = {
        ...this.selectedRun,
        status: normalizedStatus,
        startedAt: liveStatus.startedAt,
        endedAt: liveStatus.endedAt,
        completedStageCount: liveStatus.completedStageCount,
        failedStageCount: liveStatus.failedStageCount,
        errorMessage: liveStatus.errorMessage,
        stageStates: liveStatus.stageStates as IdeaFoundryPipelineStageStates
      };

      if (normalizedStatus === 'RUNNING') {
        this.syncPolling();
        return;
      }

      await this.loadHistory();
    } catch {
      this.syncPolling();
    }
  }
}
