import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { AgentAdminRecord, AgentAdminService } from './agent-admin.service';
import {
  AgentTestAnnotation,
  AgentTestFixtureSummary,
  AgentTestRunSnapshot,
  AgentTestingService,
  AgentTestRunDetail,
  AgentTestRunSummary,
  AgentTestTranscriptTurn
} from './agent-testing.service';

interface TestingAgentRecord {
  id: string;
  key: string;
  name: string;
  version: string;
  purpose: string;
  active: boolean;
  runtimeRegistered: boolean;
  defaultModel: string | null;
}

interface TestModeOption {
  value: string;
  label: string;
  description: string;
}

const TEST_MODE_OPTIONS: TestModeOption[] = [
  {
    value: 'single_agent_benchmark',
    label: 'Single-agent benchmark',
    description: 'Configure one testable agent against one selected fixture.'
  },
  {
    value: 'regression_test',
    label: 'Regression test',
    description: 'Prepare a run intended for comparison against prior benchmark baselines.'
  },
  {
    value: 'cross_model_comparison',
    label: 'Cross-model comparison',
    description: 'Configure a run intended to compare the same agent across model variants.'
  }
];

@Component({
  selector: 'app-agent-testing-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, FaIconComponent, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      [surfaceLabel]="'Agent evaluation'"
      [saveStatus]="saveStatusLabel"
      [showWorkspaceSwitcher]="false"
    />

    <main class="testing-shell container-fluid">
      <section class="testing-hero helmos-card">
        <div class="hero-copy">
          <div class="section-kicker">Admin</div>
          <h1>Agent Testing</h1>
          <p>
            Review testable agents, configure draft runs, and execute selected tests from a single
            workspace. Completed runs include transcript evidence, score breakdowns, and immutable
            execution snapshots for review.
          </p>
        </div>

        <div class="hero-summary">
          <div class="summary-chip">
            <span class="summary-label">Testable agents</span>
            <strong>{{ agents.length }}</strong>
          </div>
          <div class="summary-chip">
            <span class="summary-label">Draft runs</span>
            <strong>{{ draftRunCount }}</strong>
          </div>
          <div class="summary-chip">
            <span class="summary-label">Fixtures</span>
            <strong>{{ filteredFixtures.length }}</strong>
          </div>
        </div>
      </section>

      <section class="testing-workspace" [class.has-runs-panel]="!!selectedAgentKey">
        <aside class="side-panel agents-panel helmos-card">
          <div class="panel-header">
            <div>
              <div class="section-kicker">Agents</div>
            </div>
          </div>

          <div *ngIf="loadingAgents" class="panel-body empty-panel">
            <div class="loading-state">
              <div class="loading-spinner" aria-hidden="true"></div>
              <div>
                <h3>Loading agents…</h3>
                <p>The testing registry is resolving the currently configured specialist agents.</p>
              </div>
            </div>
          </div>

          <div *ngIf="!loadingAgents && loadError" class="panel-body empty-panel">
            <h3>Agent list unavailable</h3>
            <p>{{ loadError }}</p>
          </div>

          <div *ngIf="!loadingAgents && !loadError && agents.length === 0" class="panel-body empty-panel">
            <h3>No agents loaded</h3>
            <p>No active agents are currently eligible for testing.</p>
          </div>

          <div *ngIf="!loadingAgents && agents.length > 0" class="panel-body agent-list">
            <button
              *ngFor="let agent of agents; trackBy: trackByAgentKey"
              type="button"
              class="agent-card"
              [class.agent-card-active]="agent.key === selectedAgentKey"
              (click)="selectAgent(agent.key)"
            >
              <div class="agent-card-top">
                <span class="agent-card-key">{{ formatAgentKey(agent.key) }}</span>
                <span class="agent-card-status" [class.agent-card-status-live]="agent.runtimeRegistered">
                  {{ agent.runtimeRegistered ? 'Runtime ready' : 'Persisted only' }}
                </span>
              </div>

              <strong>{{ agent.name }}</strong>
              <p>{{ agent.purpose }}</p>

              <div class="agent-card-meta">
                <span>{{ agent.active ? 'Active' : 'Inactive' }}</span>
                <span>v{{ agent.version }}</span>
              </div>
            </button>
          </div>
        </aside>

        <aside *ngIf="selectedAgentKey" class="side-panel runs-panel helmos-card">
          <div class="panel-header">
            <div>
              <div class="section-kicker">{{ selectedAgentName }} Test Runs</div>
            </div>
          </div>

          <button type="button" class="btn btn-primary btn-sm" style="float:right;margin-top:-25px;" (click)="openNewRunModal()">
            + Test
          </button>

          <div *ngIf="loadingRuns" class="panel-body empty-panel">
            <h3>Loading runs…</h3>
            <p>Configured test runs for {{ selectedAgentName }} are being loaded.</p>
          </div>

          <div *ngIf="!loadingRuns && runs.length === 0" class="panel-body empty-panel">
            <h3>No runs configured</h3>
            <p>Create a draft test run for {{ selectedAgentName }} to populate this rail.</p>
          </div>

          <div *ngIf="!loadingRuns && runs.length > 0" class="panel-body run-list">
            <button
              *ngFor="let run of runs; trackBy: trackByRunId"
              type="button"
              class="run-card"
              [class.run-card-active]="run.id === selectedRunKey"
              (click)="selectRun(run.id)"
            >
              <div class="run-card-top">
                <strong>{{ formatTestModeLabel(run.test_mode) }}</strong>
                <span class="run-status-pill" [class.run-status-pill-queued]="run.status === 'queued'">
                  {{ formatRunStatus(run.status) }}
                </span>
              </div>

              <p>{{ resolveFixtureTitle(run.fixture_key, run.fixture_version) }}</p>

              <div class="run-card-meta">
                <span>{{ run.created_at | date: 'mediumDate' }}</span>
                <span>{{ run.target_model_name || 'Model to resolve' }}</span>
              </div>
            </button>
          </div>
        </aside>

        <section class="detail-panel helmos-card">
          <div class="detail-header">
            <div>
              <div class="section-kicker">Details</div>
              <h2>{{ selectedRunTitle }}</h2>
            </div>

            <div *ngIf="selectedRun" class="detail-actions">
              <button
                type="button"
                class="delete-action-button"
                [disabled]="deleteActionInFlight || runActionInFlight || stopActionInFlight || resumeActionInFlight || canStopSelectedRun"
                aria-label="Delete test run configuration"
                title="Delete test run configuration"
                (click)="deleteSelectedRun()"
              >
                <fa-icon [icon]="trashIcon"></fa-icon>
              </button>

              <button
                *ngIf="canStopSelectedRun"
                type="button"
                class="btn btn-warning btn-lg run-action-button"
                [disabled]="stopActionInFlight || runActionInFlight || resumeActionInFlight || deleteActionInFlight"
                (click)="stopSelectedRun()"
              >
                {{ stopActionInFlight ? 'Stopping…' : 'Stop' }}
              </button>

              <button
                *ngIf="canExecuteSelectedRun || canResumeSelectedRun"
                type="button"
                class="btn btn-success btn-lg run-action-button"
                [disabled]="runActionInFlight || resumeActionInFlight || stopActionInFlight || deleteActionInFlight"
                (click)="canResumeSelectedRun ? resumeSelectedRun() : executeSelectedRun()"
              >
                {{ primaryActionLabel }}
              </button>
            </div>
          </div>

          <div *ngIf="loadingRunDetail" class="panel-body empty-panel">
            <h3>Loading run detail…</h3>
            <p>The selected run configuration is being loaded.</p>
          </div>

          <div *ngIf="selectedRun && !loadingRunDetail" class="detail-grid">
            <article class="detail-card detail-card-highlight">
              <h3>Run Summary</h3>
              <dl class="detail-list">
                <div>
                  <dt>Status</dt>
                  <dd>{{ formatRunStatus(selectedRun.status) }}</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>{{ formatTestModeLabel(selectedRun.test_mode) }}</dd>
                </div>
                <div>
                  <dt>Fixture</dt>
                  <dd>{{ resolveFixtureTitle(selectedRun.fixture_key, selectedRun.fixture_version) }}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{{ selectedRun.created_at | date: 'medium' }}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{{ selectedRun.updated_at | date: 'medium' }}</dd>
                </div>
                <div>
                  <dt>Verdict</dt>
                  <dd>{{ selectedRun.verdict }}</dd>
                </div>
              </dl>
              <p class="detail-summary">{{ selectedRun.summary || 'No execution summary available yet.' }}</p>
            </article>

            <article class="detail-card">
              <h3>Run Configuration</h3>
              <dl class="detail-list">
                <div>
                  <dt>Rubric</dt>
                  <dd>{{ selectedRun.rubric_version }}</dd>
                </div>
                <div>
                  <dt>Driver</dt>
                  <dd>{{ selectedRun.driver_version }}</dd>
                </div>
                <div>
                  <dt>Target model</dt>
                  <dd>{{ selectedRun.target_model_name || 'Will resolve at runtime' }}</dd>
                </div>
                <div>
                  <dt>Testing model</dt>
                  <dd>{{ selectedRun.testing_agent_model_name || 'Not set' }}</dd>
                </div>
                <div>
                  <dt>Snapshots</dt>
                  <dd>{{ selectedRun.snapshots.length }}</dd>
                </div>
                <div>
                  <dt>Minimum turns</dt>
                  <dd>{{ selectedRun.min_turns }}</dd>
                </div>
              </dl>
              <p class="detail-summary">
                {{ selectedRun.operator_notes || 'No operator notes were provided for this run.' }}
              </p>
            </article>

            <article class="detail-card">
              <h3>Execution Report</h3>
              <div *ngIf="selectedRun.report_markdown || hasReportFindings; else pendingReportCopy" class="detail-stack">
                <p *ngIf="reportSummary">{{ reportSummary }}</p>
                <div *ngIf="reportQualityFailures.length > 0" class="evidence-group">
                  <div class="evidence-label">Quality failures</div>
                  <ul class="evidence-list">
                    <li *ngFor="let failure of reportQualityFailures">{{ stringifyEvidence(failure) }}</li>
                  </ul>
                </div>
                <div *ngIf="reportMissedOpportunities.length > 0" class="evidence-group">
                  <div class="evidence-label">Missed opportunities</div>
                  <ul class="evidence-list">
                    <li *ngFor="let item of reportMissedOpportunities">{{ stringifyEvidence(item) }}</li>
                  </ul>
                </div>
                <pre *ngIf="selectedRun.report_markdown" class="code-block">{{ selectedRun.report_markdown }}</pre>
              </div>
              <ng-template #pendingReportCopy>
                <p>
                  Report output will appear here after the execution pipeline produces transcript,
                  score, and Testing Agent analysis artifacts.
                </p>
              </ng-template>
            </article>

            <article class="detail-card">
              <h3>Transcript Review</h3>
              <div *ngIf="selectedRun.turns.length > 0; else pendingTranscriptCopy" class="transcript-list">
                <div *ngFor="let turn of selectedRun.turns" class="transcript-turn">
                  <div class="transcript-turn-meta">
                    <span class="turn-badge">{{ formatActorLabel(turn.actor_type) }}</span>
                    <span>Turn {{ turn.turn_index }}</span>
                    <span>{{ turn.created_at | date: 'shortTime' }}</span>
                  </div>
                  <p class="transcript-message">{{ turn.message_text }}</p>
                  <div *ngIf="annotationsForTurn(turn).length > 0" class="annotation-list">
                    <span *ngFor="let annotation of annotationsForTurn(turn)" class="annotation-pill">
                      {{ annotation.tag }}
                    </span>
                  </div>
                </div>
              </div>
              <ng-template #pendingTranscriptCopy>
                <p>
                  Transcript review remains empty until the execution pipeline generates a message
                  history for this run.
                </p>
              </ng-template>
            </article>

            <article class="detail-card">
              <h3>Score Evidence</h3>
              <div *ngIf="selectedRun.scores.length > 0; else pendingScoresCopy" class="score-list">
                <div *ngFor="let score of selectedRun.scores" class="score-card">
                  <div class="score-card-top">
                    <strong>{{ score.dimension_key }}</strong>
                    <span>{{ score.normalized_score | number: '1.2-2' }}</span>
                  </div>
                  <p>
                    {{ score.layer_key }} layer, raw {{ score.raw_score }}, weight {{ score.weight_percent }}%.
                    Evidence turns: {{ score.evidence_turn_refs.join(', ') || 'none' }}.
                  </p>
                </div>
              </div>
              <ng-template #pendingScoresCopy>
                <p>Per-dimension score evidence will appear here when the evaluation completes.</p>
              </ng-template>
            </article>

            <article class="detail-card">
              <h3>Snapshot Artifacts</h3>
              <div *ngIf="selectedRun.snapshots.length > 0; else pendingArtifactsCopy" class="artifact-list">
                <div *ngFor="let snapshot of selectedRun.snapshots" class="artifact-card">
                  <div class="artifact-card-top">
                    <strong>{{ snapshot.snapshot_type }}</strong>
                    <span>{{ snapshot.created_at | date: 'short' }}</span>
                  </div>
                  <p>{{ snapshot.source_ref || 'Inline snapshot' }}</p>
                  <pre *ngIf="snapshot.content_text" class="code-block">{{ snapshot.content_text }}</pre>
                  <pre *ngIf="hasJsonContent(snapshot)" class="code-block">{{ snapshot.content_json | json }}</pre>
                </div>
              </div>
              <ng-template #pendingArtifactsCopy>
                <p>Immutable snapshots and generated artifacts will appear here after execution.</p>
              </ng-template>
            </article>
          </div>

          <ng-container *ngIf="!selectedRun && !loadingRunDetail">
            <div class="empty-detail">
              <div class="empty-stage">
                <div class="empty-icon">1</div>
                <div>
                  <h3>Select a test run</h3>
                  <p>
                    {{ selectedAgentKey
                      ? 'Choose a configured run from the middle rail or create a new one from the modal.'
                      : 'Choosing an agent from the left rail will reveal the related test-run panel.' }}
                  </p>
                </div>
              </div>

              <div class="detail-preview-grid">
                <article class="detail-preview-card">
                  <h4>Draft Configuration</h4>
                  <p>Fixture, test mode, driver version, rubric version, and model setup.</p>
                </article>

                <article class="detail-preview-card">
                  <h4>Run Action</h4>
                  <p>A large green Run button appears here when a draft run is selected.</p>
                </article>

                <article class="detail-preview-card">
                  <h4>Execution Output</h4>
                  <p>Scorecards, report output, and transcript evidence will render here once available.</p>
                </article>

                <article class="detail-preview-card">
                  <h4>Snapshots</h4>
                  <p>Immutable runtime snapshots will be captured at the time the run is executed.</p>
                </article>
              </div>
            </div>
          </ng-container>
        </section>
      </section>
    </main>

    <div *ngIf="newRunModalOpen" class="modal-backdrop" (click)="closeNewRunModal()"></div>

    <section
      *ngIf="newRunModalOpen"
      class="run-modal helmos-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-run-modal-title"
    >
      <div class="modal-header">
        <div>
          <div class="section-kicker">New Test Run</div>
          <h2 id="new-run-modal-title">Configure Test Run</h2>
        </div>
        <button type="button" class="close-button" aria-label="Close" (click)="closeNewRunModal()">×</button>
      </div>

      <p class="modal-copy">
        Creating a run here stores the configuration as a draft. The run is not executed until you
        select it in the detail workspace and press the green Run button.
      </p>

      <form class="modal-form" (ngSubmit)="createDraftRun()">
        <label class="field">
          <span>Target agent</span>
          <input class="form-control" disabled [value]="selectedAgentName" />
        </label>

        <label class="field">
          <span>Test mode</span>
          <select class="form-select" [(ngModel)]="newRunTestMode" name="newRunTestMode">
            <option *ngFor="let option of testModeOptions" [value]="option.value">{{ option.label }}</option>
          </select>
        </label>

        <label class="field">
          <span>Fixture</span>
          <select class="form-select" [(ngModel)]="newRunFixtureKey" name="newRunFixtureKey">
            <option *ngFor="let fixture of filteredFixtures" [value]="fixture.fixture_key">
              {{ fixture.title }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Fixture version</span>
          <input class="form-control" disabled [value]="selectedFixtureVersion" />
        </label>

        <label class="field">
          <span>Target model</span>
          <input
            class="form-control"
            [(ngModel)]="newRunTargetModelName"
            name="newRunTargetModelName"
            placeholder="Optional model override"
          />
        </label>

        <label class="field">
          <span>Testing model</span>
          <input
            class="form-control"
            [(ngModel)]="newRunTestingModelName"
            name="newRunTestingModelName"
            placeholder="Optional Testing Agent model"
          />
        </label>

        <label class="field field-wide">
          <span>Operator notes</span>
          <textarea
            class="form-control"
            rows="4"
            [(ngModel)]="newRunOperatorNotes"
            name="newRunOperatorNotes"
            placeholder="Optional launch notes, release context, or investigation reason."
          ></textarea>
        </label>

        <div *ngIf="modalError" class="modal-error" role="alert">{{ modalError }}</div>
      </form>

      <div class="modal-actions">
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="creatingRun || !canCreateDraftRun"
          (click)="createDraftRun()"
        >
          {{ creatingRun ? 'Creating…' : 'Create Draft Run' }}
        </button>
        <button type="button" class="btn btn-outline-secondary" (click)="closeNewRunModal()">Close</button>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .testing-shell {
        padding: 92px 1rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .testing-hero,
      .side-panel,
      .detail-panel,
      .run-modal {
        padding: 1.1rem 1.2rem;
      }

      .testing-hero {
        display: grid;
        grid-template-columns: minmax(0, 1.7fr) minmax(420px, 0.9fr);
        gap: 1rem;
        align-items: center;
      }

      .section-kicker,
      .summary-label {
        font-size: 0.77rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #356489;
      }

      .testing-hero h1,
      .panel-header h2,
      .detail-header h2,
      .modal-header h2 {
        margin: 0.25rem 0 0.4rem;
        font-size: clamp(1.65rem, 2vw, 2.25rem);
        letter-spacing: -0.03em;
      }

      .hero-copy p,
      .panel-body p,
      .detail-card p,
      .detail-preview-card p,
      .modal-copy,
      .empty-stage p,
      .run-card p {
        margin: 0;
        color: var(--helmos-muted);
      }

      .hero-summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .summary-chip {
        min-width: 0;
        border: 1px solid rgba(53, 100, 137, 0.14);
        border-radius: 1rem;
        padding: 0.85rem 0.95rem;
        background: linear-gradient(180deg, rgba(250, 252, 255, 0.96), rgba(243, 248, 252, 0.92));
      }

      .summary-chip strong {
        display: block;
        margin-top: 0.2rem;
        font-size: 1rem;
      }

      .testing-workspace {
        display: grid;
        grid-template-columns: 270px minmax(0, 1fr);
        gap: 1rem;
        align-items: start;
      }

      .testing-workspace.has-runs-panel {
        grid-template-columns: 270px 320px minmax(0, 1fr);
      }

      .side-panel,
      .detail-panel {
        min-height: calc(100vh - 220px);
      }

      .panel-header,
      .detail-header,
      .modal-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
      }

      .panel-body,
      .empty-detail {
        margin-top: 1rem;
      }

      .agent-list,
      .run-list {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .agent-card,
      .run-card {
        width: 100%;
        text-align: left;
        border: 1px solid rgba(53, 100, 137, 0.16);
        border-radius: 1rem;
        padding: 0.95rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 250, 255, 0.94));
        box-shadow: 0 12px 28px rgba(21, 36, 64, 0.05);
        transition:
          border-color 160ms ease,
          background 160ms ease,
          box-shadow 160ms ease,
          transform 160ms ease;
      }

      .agent-card:hover,
      .agent-card-active,
      .run-card:hover,
      .run-card-active {
        border-color: rgba(31, 111, 235, 0.3);
        background: linear-gradient(180deg, rgba(244, 249, 255, 0.98), rgba(234, 243, 255, 0.95));
        box-shadow: 0 16px 34px rgba(21, 36, 64, 0.08);
        transform: translateY(-1px);
      }

      .agent-card-top,
      .agent-card-meta,
      .run-card-top,
      .run-card-meta {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }

      .agent-card-top,
      .run-card-top {
        margin-bottom: 0.65rem;
      }

      .agent-card-key {
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.11em;
        text-transform: uppercase;
        color: #2566a3;
      }

      .agent-card-status,
      .run-status-pill {
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        color: #6a7d96;
        background: rgba(229, 236, 244, 0.92);
      }

      .agent-card-status-live {
        color: #157347;
        background: rgba(224, 244, 233, 0.95);
      }

      .run-status-pill-queued {
        color: #7a4f01;
        background: rgba(255, 238, 201, 0.95);
      }

      .agent-card strong,
      .run-card strong {
        display: block;
        margin-bottom: 0.45rem;
        font-size: 1.02rem;
        letter-spacing: -0.02em;
      }

      .agent-card p {
        display: -webkit-box;
        margin-bottom: 0.75rem;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
      }

      .run-card p {
        margin-bottom: 0.65rem;
      }

      .agent-card-meta,
      .run-card-meta {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--helmos-muted);
      }

      .empty-panel {
        border: 1px dashed rgba(53, 100, 137, 0.22);
        border-radius: 1rem;
        padding: 1rem;
        background: linear-gradient(135deg, rgba(247, 250, 255, 0.92), rgba(240, 246, 252, 0.92));
      }

      .empty-panel h3,
      .empty-stage h3,
      .detail-card h3,
      .detail-preview-card h4 {
        margin: 0 0 0.35rem;
        font-size: 1rem;
        letter-spacing: -0.02em;
      }

      .loading-state {
        display: flex;
        align-items: flex-start;
        gap: 0.9rem;
      }

      .loading-spinner {
        width: 2rem;
        height: 2rem;
        flex: 0 0 auto;
        border-radius: 999px;
        border: 3px solid rgba(31, 111, 235, 0.14);
        border-top-color: #1f6feb;
        border-right-color: rgba(31, 111, 235, 0.45);
        animation: testing-spin 0.9s linear infinite;
      }

      @keyframes testing-spin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }

      .detail-grid,
      .detail-preview-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.9rem;
      }

      .detail-card,
      .detail-preview-card {
        border: 1px solid rgba(53, 100, 137, 0.14);
        border-radius: 1rem;
        padding: 1rem;
        background: rgba(248, 251, 255, 0.9);
      }

      .detail-card-highlight {
        background: linear-gradient(180deg, rgba(248, 252, 249, 0.98), rgba(236, 248, 240, 0.94));
      }

      .detail-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .detail-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem 1rem;
        margin: 0;
      }

      .detail-list dt {
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.11em;
        text-transform: uppercase;
        color: #6b8098;
      }

      .detail-list dd {
        margin: 0.18rem 0 0;
        font-weight: 600;
      }

      .detail-summary {
        margin-top: 1rem !important;
      }

      .detail-stack,
      .transcript-list,
      .score-list,
      .artifact-list {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .evidence-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .evidence-label {
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.11em;
        text-transform: uppercase;
        color: #6b8098;
      }

      .evidence-list {
        margin: 0;
        padding-left: 1.1rem;
        color: var(--helmos-text);
      }

      .transcript-turn,
      .score-card,
      .artifact-card {
        padding: 0.9rem;
        border: 1px solid rgba(53, 100, 137, 0.12);
        border-radius: 0.9rem;
        background: rgba(255, 255, 255, 0.72);
      }

      .transcript-turn-meta,
      .score-card-top,
      .artifact-card-top {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .turn-badge,
      .annotation-pill {
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .turn-badge {
        color: #1f5e8f;
        background: rgba(222, 236, 249, 0.95);
      }

      .transcript-message {
        margin-top: 0.6rem !important;
        color: var(--helmos-text) !important;
        white-space: pre-wrap;
      }

      .annotation-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        margin-top: 0.7rem;
      }

      .annotation-pill {
        color: #7a4f01;
        background: rgba(255, 238, 201, 0.95);
      }

      .code-block {
        margin: 0;
        padding: 0.9rem;
        border-radius: 0.8rem;
        background: #f5f8fb;
        color: #213547;
        font-size: 0.82rem;
        line-height: 1.45;
        white-space: pre-wrap;
        overflow-x: auto;
      }

      .run-action-button {
        min-width: 160px;
        box-shadow: 0 18px 34px rgba(25, 135, 84, 0.18);
      }

      .delete-action-button {
        width: 3rem;
        height: 3rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 0.9rem;
        color: #fff;
        background: linear-gradient(180deg, #dc3545, #b42331);
        box-shadow: 0 16px 30px rgba(220, 53, 69, 0.2);
        transition:
          transform 160ms ease,
          box-shadow 160ms ease,
          opacity 160ms ease;
      }

      .delete-action-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 20px 34px rgba(220, 53, 69, 0.25);
      }

      .delete-action-button:disabled {
        opacity: 0.6;
      }

      .empty-detail {
        display: grid;
        gap: 1rem;
      }

      .empty-stage {
        display: grid;
        grid-template-columns: 40px minmax(0, 1fr);
        gap: 0.85rem;
        align-items: start;
        padding: 1rem;
        border-radius: 1rem;
        border: 1px solid rgba(53, 100, 137, 0.12);
        background: rgba(251, 253, 255, 0.95);
      }

      .empty-icon {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 999px;
        display: grid;
        place-items: center;
        font-weight: 700;
        color: #1f5e8f;
        background: rgba(222, 236, 249, 0.95);
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(18, 28, 45, 0.34);
        backdrop-filter: blur(4px);
        z-index: 1090;
      }

      .run-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(840px, calc(100vw - 2rem));
        max-height: calc(100vh - 2rem);
        overflow: auto;
        z-index: 1100;
        box-shadow: 0 32px 80px rgba(16, 27, 44, 0.24);
      }

      .close-button {
        width: 2.5rem;
        height: 2.5rem;
        border: 0;
        border-radius: 999px;
        background: rgba(230, 238, 247, 0.9);
        color: var(--helmos-text);
        font-size: 1.5rem;
        line-height: 1;
      }

      .modal-copy {
        margin-top: 0.75rem;
      }

      .modal-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.95rem 1rem;
        margin-top: 1rem;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .field span {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--helmos-text);
      }

      .field-wide {
        grid-column: 1 / -1;
      }

      .modal-error {
        grid-column: 1 / -1;
        padding: 0.8rem 0.9rem;
        border-radius: 0.85rem;
        color: #842029;
        background: rgba(248, 215, 218, 0.9);
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 1rem;
      }

      @media (max-width: 1399.98px) {
        .testing-hero {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      @media (max-width: 1199.98px) {
        .testing-workspace,
        .testing-workspace.has-runs-panel {
          grid-template-columns: minmax(0, 1fr);
        }

        .side-panel,
        .detail-panel {
          min-height: auto;
        }
      }

      @media (max-width: 991.98px) {
        .hero-summary,
        .detail-grid,
        .detail-preview-grid,
        .modal-form,
        .detail-list {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      @media (max-width: 767.98px) {
        .testing-shell {
          padding: 84px 0.75rem 1.5rem;
        }

        .modal-actions {
          flex-direction: column-reverse;
        }
      }
    `
  ]
})
export class AgentTestingScreenComponent implements OnInit, OnDestroy {
  protected readonly shell = inject(WorkspaceShellService);
  private readonly agentAdminService = inject(AgentAdminService);
  private readonly agentTestingService = inject(AgentTestingService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected readonly trashIcon = faTrashCan;
  protected readonly testModeOptions = TEST_MODE_OPTIONS;

  protected agents: TestingAgentRecord[] = [];
  protected fixtures: AgentTestFixtureSummary[] = [];
  protected runs: AgentTestRunSummary[] = [];
  protected selectedRun: AgentTestRunDetail | null = null;

  protected loadingAgents = false;
  protected loadingRuns = false;
  protected loadingRunDetail = false;
  protected loadError: string | null = null;
  protected modalError: string | null = null;
  protected creatingRun = false;
  protected runActionInFlight = false;
  protected stopActionInFlight = false;
  protected resumeActionInFlight = false;
  protected deleteActionInFlight = false;

  protected selectedAgentKey: string | null = null;
  protected selectedRunKey: string | null = null;
  protected newRunModalOpen = false;

  protected newRunTestMode = TEST_MODE_OPTIONS[0].value;
  protected newRunFixtureKey = '';
  protected newRunTargetModelName = '';
  protected newRunTestingModelName = '';
  protected newRunOperatorNotes = '';

  protected get saveStatusLabel(): string {
    if (this.loadingAgents || this.loadingRuns || this.loadingRunDetail) {
      return 'Loading agent testing…';
    }
    if (this.creatingRun) {
      return 'Saving draft run…';
    }
    if (this.runActionInFlight) {
      return 'Starting test run…';
    }
    if (this.stopActionInFlight) {
      return 'Stopping test run…';
    }
    if (this.resumeActionInFlight) {
      return 'Resuming test run…';
    }
    if (this.loadError) {
      return 'Agent testing unavailable';
    }
    return this.agents.length > 0 ? 'Agent testing ready' : 'Page structure ready';
  }

  protected get selectedAgentName(): string {
    return this.agents.find((agent) => agent.key === this.selectedAgentKey)?.name ?? 'Selected agent';
  }

  protected get filteredFixtures(): AgentTestFixtureSummary[] {
    if (!this.selectedAgentKey) {
      return [];
    }
    return this.fixtures.filter((fixture) => fixture.applicable_agents.includes(this.selectedAgentKey as string));
  }

  protected get selectedFixtureVersion(): string {
    return this.filteredFixtures.find((fixture) => fixture.fixture_key === this.newRunFixtureKey)?.fixture_version ?? '';
  }

  protected get selectedRunTitle(): string {
    if (this.selectedRun) {
      return `${this.selectedAgentName} Test Run`;
    }
    return this.selectedAgentKey ? `Select a ${this.selectedAgentName} Test Run` : 'Select an Agent and Test Run';
  }

  protected get draftRunCount(): number {
    return this.runs.filter((run) => run.status === 'draft').length;
  }

  protected get canCreateDraftRun(): boolean {
    return !!this.selectedAgentKey && !!this.newRunFixtureKey;
  }

  protected get canExecuteSelectedRun(): boolean {
    return !!this.selectedRun && ['draft', 'failed'].includes(this.selectedRun.status);
  }

  protected get canStopSelectedRun(): boolean {
    return !!this.selectedRun && ['queued', 'running', 'stopping'].includes(this.selectedRun.status);
  }

  protected get canResumeSelectedRun(): boolean {
    return !!this.selectedRun && ['stopped', 'failed'].includes(this.selectedRun.status);
  }

  protected get primaryActionLabel(): string {
    if (!this.selectedRun) {
      return 'Run';
    }
    if (this.canResumeSelectedRun) {
      return this.resumeActionInFlight ? 'Resuming…' : 'Resume';
    }
    return this.runActionInFlight ? 'Starting…' : 'Start';
  }

  protected get reportSummary(): string | null {
    const summary = this.selectedRun?.report_json['summary'];
    return typeof summary === 'string' && summary.trim() ? summary : null;
  }

  protected get reportQualityFailures(): unknown[] {
    return this.asArray(this.selectedRun?.report_json['quality_failures']);
  }

  protected get reportMissedOpportunities(): unknown[] {
    return this.asArray(this.selectedRun?.report_json['missed_opportunities']);
  }

  protected get hasReportFindings(): boolean {
    return this.reportQualityFailures.length > 0 || this.reportMissedOpportunities.length > 0;
  }

  private runRefreshTimer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadAgents(), this.loadFixtures()]);
    this.changeDetector.detectChanges();
  }

  ngOnDestroy(): void {
    this.clearRunRefreshTimer();
  }

  protected openNewRunModal(): void {
    this.modalError = null;
    this.newRunTestMode = TEST_MODE_OPTIONS[0].value;
    this.newRunFixtureKey = this.filteredFixtures[0]?.fixture_key ?? '';
    this.newRunTargetModelName = this.agents.find((agent) => agent.key === this.selectedAgentKey)?.defaultModel ?? '';
    this.newRunTestingModelName = '';
    this.newRunOperatorNotes = '';
    this.newRunModalOpen = true;
  }

  protected closeNewRunModal(): void {
    this.newRunModalOpen = false;
    this.modalError = null;
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.newRunModalOpen) {
      this.closeNewRunModal();
    }
  }

  protected async selectAgent(agentKey: string): Promise<void> {
    if (this.selectedAgentKey === agentKey) {
      return;
    }
    this.selectedAgentKey = agentKey;
    this.selectedRunKey = null;
    this.selectedRun = null;
    await this.loadRuns(agentKey);
  }

  protected async selectRun(runId: string): Promise<void> {
    this.selectedRunKey = runId;
    this.loadingRunDetail = true;
    this.changeDetector.detectChanges();
    try {
      this.selectedRun = await this.agentTestingService.getRun(runId);
      this.syncRunRefreshTimer();
    } finally {
      this.loadingRunDetail = false;
      this.changeDetector.detectChanges();
    }
  }

  protected async createDraftRun(): Promise<void> {
    if (!this.selectedAgentKey || !this.newRunFixtureKey || this.creatingRun) {
      return;
    }

    this.creatingRun = true;
    this.modalError = null;
    try {
      const createdRun = await this.agentTestingService.createRun({
        target_agent_key: this.selectedAgentKey,
        fixture_key: this.newRunFixtureKey,
        fixture_version: this.selectedFixtureVersion || null,
        test_mode: this.newRunTestMode,
        target_model_name: this.newRunTargetModelName || null,
        testing_agent_model_name: this.newRunTestingModelName || null,
        operator_notes: this.newRunOperatorNotes || null
      });

      this.runs = [createdRun, ...this.runs.filter((run) => run.id !== createdRun.id)];
      this.selectedRunKey = createdRun.id;
      this.selectedRun = this.buildDraftDetailFromSummary(createdRun);
      this.closeNewRunModal();
      void this.hydrateSelectedRunDetail(createdRun.id);
    } catch (error) {
      this.modalError = error instanceof Error ? error.message : 'Unable to create the test run draft.';
    } finally {
      this.creatingRun = false;
      this.changeDetector.detectChanges();
    }
  }

  protected async executeSelectedRun(): Promise<void> {
    if (!this.selectedRun || this.runActionInFlight) {
      return;
    }

    this.runActionInFlight = true;
    try {
      const updatedRun = await this.agentTestingService.executeRun(this.selectedRun.id);
      this.selectedRun = updatedRun;
      this.selectedRunKey = updatedRun.id;
      if (this.selectedAgentKey) {
        await this.loadRuns(this.selectedAgentKey, updatedRun.id);
      }
      await this.hydrateSelectedRunDetail(updatedRun.id);
    } finally {
      this.runActionInFlight = false;
      this.syncRunRefreshTimer();
      this.changeDetector.detectChanges();
    }
  }

  protected async stopSelectedRun(): Promise<void> {
    if (!this.selectedRun || this.stopActionInFlight || !this.canStopSelectedRun) {
      return;
    }

    this.stopActionInFlight = true;
    try {
      const updatedRun = await this.agentTestingService.stopRun(this.selectedRun.id);
      this.selectedRun = updatedRun;
      this.selectedRunKey = updatedRun.id;
      this.runs = this.runs.map((run) => (run.id === updatedRun.id ? { ...run, ...updatedRun } : run));
      if (this.selectedAgentKey) {
        await this.loadRuns(this.selectedAgentKey, updatedRun.id);
      }
      await this.hydrateSelectedRunDetail(updatedRun.id);
    } finally {
      this.stopActionInFlight = false;
      this.syncRunRefreshTimer();
      this.changeDetector.detectChanges();
    }
  }

  protected async resumeSelectedRun(): Promise<void> {
    if (!this.selectedRun || this.resumeActionInFlight || !this.canResumeSelectedRun) {
      return;
    }

    this.resumeActionInFlight = true;
    try {
      const updatedRun = await this.agentTestingService.resumeRun(this.selectedRun.id);
      this.selectedRun = updatedRun;
      this.selectedRunKey = updatedRun.id;
      this.runs = this.runs.map((run) => (run.id === updatedRun.id ? { ...run, ...updatedRun } : run));
      if (this.selectedAgentKey) {
        await this.loadRuns(this.selectedAgentKey, updatedRun.id);
      }
      await this.hydrateSelectedRunDetail(updatedRun.id);
    } finally {
      this.resumeActionInFlight = false;
      this.syncRunRefreshTimer();
      this.changeDetector.detectChanges();
    }
  }

  protected async deleteSelectedRun(): Promise<void> {
    if (!this.selectedRun || this.deleteActionInFlight) {
      return;
    }

    const confirmed = window.confirm('Delete this test run configuration? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    this.deleteActionInFlight = true;
    try {
      const runId = this.selectedRun.id;
      await this.agentTestingService.deleteRun(runId);
      this.runs = this.runs.filter((run) => run.id !== runId);
      this.selectedRun = null;
      this.selectedRunKey = null;
    } finally {
      this.deleteActionInFlight = false;
      this.changeDetector.detectChanges();
    }
  }

  private buildDraftDetailFromSummary(run: AgentTestRunSummary): AgentTestRunDetail {
    return {
      ...run,
      report_markdown: null,
      report_json: {},
      metadata_json: {
        operator_notes: run.operator_notes ?? ''
      },
      snapshots: [],
      turns: [],
      annotations: [],
      scores: []
    };
  }

  private async hydrateSelectedRunDetail(runId: string): Promise<void> {
    try {
      const detail = await this.agentTestingService.getRun(runId);
      if (this.selectedRunKey === runId) {
        this.selectedRun = detail;
      }
      this.runs = this.runs.map((run) => (run.id === detail.id ? { ...run, ...detail } : run));
    } catch {
      // Keep the newly created draft visible even if detail hydration is delayed.
    } finally {
      this.syncRunRefreshTimer();
      this.changeDetector.detectChanges();
    }
  }

  protected trackByAgentKey(_index: number, agent: TestingAgentRecord): string {
    return agent.key;
  }

  protected trackByRunId(_index: number, run: AgentTestRunSummary): string {
    return run.id;
  }

  protected formatAgentKey(key: string): string {
    return key.replace(/[_-]/g, ' ').toUpperCase();
  }

  protected formatRunStatus(status: string): string {
    return status.replace(/[_-]/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
  }

  protected formatTestModeLabel(testMode: string): string {
    return (
      this.testModeOptions.find((option) => option.value === testMode)?.label ??
      testMode.replace(/[_-]/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase())
    );
  }

  protected resolveFixtureTitle(fixtureKey: string, fixtureVersion: string): string {
    const fixture = this.fixtures.find(
      (candidate) => candidate.fixture_key === fixtureKey && candidate.fixture_version === fixtureVersion
    );
    return fixture ? fixture.title : fixtureKey;
  }

  protected formatActorLabel(actorType: string): string {
    if (actorType === 'target_agent') {
      return 'Target agent';
    }
    if (actorType === 'driver') {
      return 'Scenario driver';
    }
    return actorType.replace(/[_-]/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
  }

  protected annotationsForTurn(turn: AgentTestTranscriptTurn): AgentTestAnnotation[] {
    if (!this.selectedRun) {
      return [];
    }
    return this.selectedRun.annotations.filter((annotation) => annotation.turn_index === turn.turn_index);
  }

  protected hasJsonContent(snapshot: AgentTestRunSnapshot): boolean {
    return Object.keys(snapshot.content_json ?? {}).length > 0;
  }

  protected stringifyEvidence(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object' && 'message' in value && typeof value['message'] === 'string') {
      return value['message'];
    }
    return JSON.stringify(value);
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private async loadAgents(): Promise<void> {
    this.loadingAgents = true;
    this.loadError = null;
    this.changeDetector.detectChanges();
    try {
      const snapshot = await this.agentAdminService.listAgents();
      this.agents = snapshot.agents
        .filter((agent) => this.isTestableAgent(agent))
        .map((agent) => ({
          id: agent.id,
          key: agent.key,
          name: agent.name,
          version: agent.version,
          purpose: this.resolvePurpose(agent),
          active: agent.active,
          runtimeRegistered: agent.runtime.registered,
          defaultModel: agent.defaultModel
        }));

      if (this.agents.length > 0) {
        this.selectedAgentKey = this.agents[0].key;
      }
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to load testing agents.';
    } finally {
      this.loadingAgents = false;
      this.changeDetector.detectChanges();
    }

    if (this.selectedAgentKey) {
      await this.loadRuns(this.selectedAgentKey);
    }
  }

  private async loadFixtures(): Promise<void> {
    try {
      this.fixtures = await this.agentTestingService.listFixtures();
      if (!this.newRunFixtureKey) {
        this.newRunFixtureKey = this.filteredFixtures[0]?.fixture_key ?? '';
      }
    } catch {
      this.fixtures = [];
    } finally {
      this.changeDetector.detectChanges();
    }
  }

  private async loadRuns(agentKey: string, preferredRunId?: string): Promise<void> {
    this.loadingRuns = true;
    this.changeDetector.detectChanges();
    try {
      this.runs = await this.agentTestingService.listRuns(agentKey);
      const nextRunId = preferredRunId ?? this.selectedRunKey;
      if (nextRunId) {
        const match = this.runs.find((run) => run.id === nextRunId);
        if (match) {
          this.selectedRunKey = match.id;
          if (!this.selectedRun || this.selectedRun.id !== match.id) {
            void this.hydrateSelectedRunDetail(match.id);
          }
          return;
        }
      }
      this.selectedRunKey = null;
      this.selectedRun = null;
    } finally {
      this.loadingRuns = false;
      this.syncRunRefreshTimer();
      this.changeDetector.detectChanges();
    }
  }

  private syncRunRefreshTimer(): void {
    if (this.selectedRun && ['queued', 'running', 'stopping'].includes(this.selectedRun.status)) {
      if (!this.runRefreshTimer) {
        this.runRefreshTimer = setInterval(() => {
          if (this.selectedRunKey) {
            void this.hydrateSelectedRunDetail(this.selectedRunKey);
          }
        }, 2500);
      }
      return;
    }

    this.clearRunRefreshTimer();
  }

  private clearRunRefreshTimer(): void {
    if (this.runRefreshTimer) {
      clearInterval(this.runRefreshTimer);
      this.runRefreshTimer = null;
    }
  }

  private isTestableAgent(agent: AgentAdminRecord): boolean {
    return agent.active;
  }

  private resolvePurpose(agent: AgentAdminRecord): string {
    const configJson = agent.promptConfig?.configJson;
    const purposeCandidate =
      typeof configJson?.['purpose'] === 'string'
        ? configJson['purpose']
        : typeof agent.runtime.purpose === 'string'
          ? agent.runtime.purpose
          : typeof agent.description === 'string'
            ? agent.description
            : '';

    return purposeCandidate || 'Specialist agent available for structured testing.';
  }
}
