import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import {
  IdeaFoundryApiService,
  IdeaFoundryPipelineHistoryDetail,
  IdeaFoundryPipelineHistoryEntry,
  IdeaFoundryPipelineHistoryStage
} from '../idea-foundry/idea-foundry-api.service';

@Component({
  selector: 'app-pipeline-history-screen',
  standalone: true,
  imports: [CommonModule, TopNavComponent],
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
      </section>

      <section *ngIf="loadError" class="state-band" role="alert">
        <div class="section-kicker">Connection issue</div>
        <h2>Pipeline history is temporarily unavailable</h2>
        <p>{{ loadError }}</p>
        <button class="btn btn-primary" type="button" (click)="loadHistory()">Retry</button>
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

            <section class="stage-list">
              <article *ngFor="let stage of run.stages; trackBy: trackByStageKey" class="stage-band">
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
            </section>
          </ng-container>
        </section>
      </section>
    </main>
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

      .history-hero h1,
      .detail-summary h2,
      .stage-header h3,
      .state-band h2 {
        margin: 0.25rem 0 0.35rem;
        letter-spacing: -0.03em;
      }

      .history-hero p,
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
        .history-layout {
          grid-template-columns: 1fr;
        }

        .history-rail {
          position: static;
        }

        .detail-summary,
        .stage-header {
          flex-direction: column;
        }

        .summary-pills,
        .stage-metrics {
          justify-content: flex-start;
        }
      }
    `
  ]
})
export class PipelineHistoryScreenComponent implements OnInit {
  readonly shell = inject(WorkspaceShellService);
  private readonly api = inject(IdeaFoundryApiService);

  loading = true;
  loadError: string | null = null;
  runs: IdeaFoundryPipelineHistoryEntry[] = [];
  selectedRunId: string | null = null;
  selectedRun: IdeaFoundryPipelineHistoryDetail | null = null;

  ngOnInit(): void {
    setTimeout(() => {
      void this.loadHistory();
    });
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
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to load pipeline history.';
      this.selectedRun = null;
    } finally {
      this.loading = false;
    }
  }

  async selectRun(runId: string): Promise<void> {
    if (!runId || runId === this.selectedRunId) {
      return;
    }

    this.selectedRunId = runId;
    this.selectedRun = await this.api.getIdeaFoundryPipelineRunDetail(runId);
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
}
