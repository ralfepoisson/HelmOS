import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  IdeaFoundryApiService,
  ProtoIdeaExtractionPolicy,
  ProtoIdeaExtractionRuntimeState
} from './idea-foundry-api.service';

const DEFAULT_POLICY: ProtoIdeaExtractionPolicy = {
  id: null,
  profileName: 'default',
  extractionBreadth: 'standard',
  inferenceTolerance: 'balanced',
  noveltyBias: 'balanced',
  minimumSignalThreshold: 'medium',
  maxProtoIdeasPerSource: 4
};

const DEFAULT_RUNTIME: ProtoIdeaExtractionRuntimeState = {
  latestRunStatus: 'idle',
  lastRunAt: null,
  latestRunSummary: null
};

@Component({
  selector: 'app-proto-idea-extraction',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="proto-page">
      <header class="hero-shell helmos-card">
        <div class="hero-copy">
          <span class="hero-kicker">Proto-Idea Extraction</span>
          <h1>Configure how the Proto-Idea Agent extracts early opportunity hypotheses</h1>
          <p>
            These administrator policy settings guide how the Proto-Idea stage balances grounding, inference,
            novelty, and extraction breadth when it processes the next eligible source artefact.
          </p>
        </div>

        <div class="hero-actions">
          <button type="button" class="btn btn-outline-secondary" (click)="reload()" [disabled]="isLoading || isSaving || isRunning">
            Refresh
          </button>
          <button type="button" class="btn btn-outline-secondary" (click)="runAgent()" [disabled]="isLoading || isSaving || isRunning">
            {{ isRunning ? 'Running…' : 'Run Agent' }}
          </button>
          <button type="button" class="btn btn-primary" (click)="saveChanges()" [disabled]="isLoading || isSaving || isRunning">
            {{ isSaving ? 'Saving…' : 'Save policy' }}
          </button>
        </div>

        <div *ngIf="!isLoading" class="status-strip">
          <div class="status-pill status-pill-neutral">Profile: {{ policy.profileName }}</div>
          <div class="status-pill" [class.status-pill-warning]="runtime.latestRunStatus === 'FAILED'">
            Last run status: {{ formatRunStatus(runtime.latestRunStatus) }}
          </div>
          <div class="status-pill status-pill-neutral">Last run: {{ runtime.lastRunAt ?? 'Not run yet' }}</div>
          <div class="status-pill status-pill-neutral">Max ideas/source: {{ policy.maxProtoIdeasPerSource }}</div>
        </div>

        <p *ngIf="surfaceMessage" class="hero-message" aria-live="polite">{{ surfaceMessage }}</p>
        <p *ngIf="loadError" class="hero-error" aria-live="polite">{{ loadError }}</p>
      </header>

      <section class="content-grid">
        <article class="policy-card helmos-card">
          <div class="section-heading">
            <span class="section-kicker">Administrator policy</span>
            <h2>Extraction controls</h2>
            <p>Guide the agent without editing the static identity prompt.</p>
          </div>

          <div class="field-grid two-up">
            <label class="field-block">
              <span>Extraction breadth</span>
              <select class="form-select" [(ngModel)]="policy.extractionBreadth">
                <option value="conservative">Conservative</option>
                <option value="standard">Standard</option>
                <option value="expansive">Expansive</option>
              </select>
              <small>How many plausible directions the agent should try to surface from each source.</small>
            </label>

            <label class="field-block">
              <span>Inference tolerance</span>
              <select class="form-select" [(ngModel)]="policy.inferenceTolerance">
                <option value="strict_grounding">Strict grounding</option>
                <option value="balanced">Balanced</option>
                <option value="exploratory">Exploratory</option>
              </select>
              <small>How far the agent may move beyond explicit source content.</small>
            </label>
          </div>

          <div class="field-grid two-up">
            <label class="field-block">
              <span>Novelty bias</span>
              <select class="form-select" [(ngModel)]="policy.noveltyBias">
                <option value="pragmatic">Pragmatic</option>
                <option value="balanced">Balanced</option>
                <option value="exploratory">Exploratory</option>
              </select>
              <small>Whether extraction should stay practical or explore more lateral opportunity directions.</small>
            </label>

            <label class="field-block">
              <span>Minimum signal threshold</span>
              <select class="form-select" [(ngModel)]="policy.minimumSignalThreshold">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <small>How strong the source evidence should be before emitting proto-ideas.</small>
            </label>
          </div>

          <div class="field-grid two-up">
            <label class="field-block">
              <span>Max proto-ideas per source</span>
              <input
                class="form-control"
                type="number"
                min="1"
                max="12"
                [(ngModel)]="policy.maxProtoIdeasPerSource"
              />
              <small>Hard cap applied to the stored output for each processed source.</small>
            </label>

            <div class="policy-summary">
              <span class="mini-label">Current policy summary</span>
              <strong>{{ summarizePolicy() }}</strong>
              <p>
                The runtime injects these settings as a structured extraction policy section alongside the static
                Proto-Idea Agent identity and the source artefact.
              </p>
            </div>
          </div>
        </article>

        <article class="runtime-card helmos-card">
          <div class="section-heading">
            <span class="section-kicker">Execution</span>
            <h2>Run feedback</h2>
            <p>Use this control to process the next eligible source with the saved policy.</p>
          </div>

          <div class="runtime-metrics">
            <div class="metric-tile">
              <span class="mini-label">Processed</span>
              <strong>{{ summaryValue('processedCount') }}</strong>
            </div>
            <div class="metric-tile">
              <span class="mini-label">Completed</span>
              <strong>{{ summaryValue('completedCount') }}</strong>
            </div>
            <div class="metric-tile">
              <span class="mini-label">Failed</span>
              <strong>{{ summaryValue('failedCount') }}</strong>
            </div>
            <div class="metric-tile">
              <span class="mini-label">Skipped</span>
              <strong>{{ summaryValue('skippedCount') }}</strong>
            </div>
          </div>

          <div class="run-callout">
            <strong>What Run Agent does</strong>
            <p>
              The backend claims the oldest eligible unprocessed source, injects the saved policy into the Proto-Idea
              Agent runtime context, validates the JSON response, stores the extracted proto-ideas, and records which
              policy was used for traceability.
            </p>
          </div>
        </article>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .proto-page {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .hero-shell,
      .policy-card,
      .runtime-card {
        padding: 1.35rem;
      }

      .hero-shell {
        display: grid;
        gap: 1rem;
        border: 1px solid rgba(255, 206, 0, 0.18);
        background:
          linear-gradient(135deg, rgba(255, 250, 209, 0.9), rgba(255, 255, 255, 0.98) 48%),
          rgba(255, 255, 255, 0.95);
      }

      .hero-kicker,
      .section-kicker,
      .mini-label {
        display: inline-block;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero-kicker,
      .section-kicker {
        color: var(--helmos-accent);
      }

      .hero-copy h1,
      .section-heading h2 {
        margin: 0.4rem 0 0.55rem;
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .hero-copy h1 {
        font-size: clamp(1.8rem, 2.8vw, 2.5rem);
        line-height: 1.05;
      }

      .section-heading h2 {
        font-size: 1.35rem;
      }

      .hero-copy p,
      .section-heading p,
      .field-block small,
      .policy-summary p,
      .run-callout p {
        margin: 0;
        color: var(--helmos-muted);
        line-height: 1.6;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
      }

      .status-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
      }

      .status-pill {
        padding: 0.45rem 0.8rem;
        border-radius: 999px;
        background: rgba(31, 119, 93, 0.1);
        color: #16624c;
        font-size: 0.84rem;
        font-weight: 700;
      }

      .status-pill-neutral {
        background: rgba(255, 255, 255, 0.9);
        color: var(--helmos-muted);
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      .status-pill-warning {
        background: rgba(154, 52, 18, 0.12);
        color: #9a3412;
      }

      .hero-message,
      .hero-error {
        margin: 0;
        font-size: 0.92rem;
      }

      .hero-error {
        color: #9a3412;
      }

      .content-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.8fr) minmax(18rem, 1fr);
        gap: 1rem;
      }

      .policy-card,
      .runtime-card {
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(255, 255, 255, 0.94);
      }

      .section-heading {
        margin-bottom: 1rem;
      }

      .field-grid {
        display: grid;
        gap: 0.9rem;
      }

      .field-grid.two-up {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .field-block {
        display: grid;
        gap: 0.45rem;
      }

      .field-block > span {
        font-weight: 700;
        color: #172235;
      }

      .policy-summary,
      .run-callout {
        padding: 0.95rem 1rem;
        border-radius: 1rem;
        background: rgba(248, 251, 255, 0.82);
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      .policy-summary strong,
      .run-callout strong {
        display: block;
        margin: 0.25rem 0 0.35rem;
      }

      .runtime-metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        margin-bottom: 0.95rem;
      }

      .metric-tile {
        padding: 0.9rem;
        border-radius: 1rem;
        background: rgba(248, 251, 255, 0.82);
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      .metric-tile strong {
        display: block;
        margin-top: 0.28rem;
        font-size: 1.5rem;
        letter-spacing: -0.04em;
      }

      @media (max-width: 980px) {
        .content-grid,
        .field-grid.two-up {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class ProtoIdeaExtractionComponent implements OnInit {
  private readonly ideaFoundryApi = inject(IdeaFoundryApiService);

  policy: ProtoIdeaExtractionPolicy = { ...DEFAULT_POLICY };
  runtime: ProtoIdeaExtractionRuntimeState = { ...DEFAULT_RUNTIME };
  isLoading = true;
  isSaving = false;
  isRunning = false;
  surfaceMessage = '';
  loadError = '';

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      const payload = await this.ideaFoundryApi.getProtoIdeaExtractionConfiguration();
      this.policy = { ...payload.policy };
      this.runtime = { ...payload.runtime };
      if (!this.surfaceMessage) {
        this.surfaceMessage = 'Loaded the current Proto-Idea extraction policy.';
      }
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to load the Proto-Idea policy.';
    } finally {
      this.isLoading = false;
    }
  }

  async saveChanges(): Promise<void> {
    this.isSaving = true;
    this.surfaceMessage = '';
    this.loadError = '';

    try {
      const payload = await this.ideaFoundryApi.saveProtoIdeaExtractionConfiguration({
        ...this.policy,
        maxProtoIdeasPerSource: this.normalizeMaxProtoIdeas(this.policy.maxProtoIdeasPerSource)
      });
      this.policy = { ...payload.policy };
      this.runtime = { ...payload.runtime };
      this.surfaceMessage = 'Saved the Proto-Idea extraction policy.';
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to save the Proto-Idea policy.';
    } finally {
      this.isSaving = false;
    }
  }

  async runAgent(): Promise<void> {
    this.isRunning = true;
    this.surfaceMessage = '';
    this.loadError = '';

    try {
      const payload = await this.ideaFoundryApi.runProtoIdeaAgent({ batchSize: 1 });
      this.policy = { ...payload.policy };
      this.runtime = { ...payload.runtime };
      const completed = payload.result.completedCount;
      const failed = payload.result.failedCount;
      const processed = payload.result.processedCount;
      this.surfaceMessage =
        processed === 0
          ? 'The Proto-Idea Agent started but found no eligible unprocessed sources.'
          : `Proto-Idea Agent run completed. Processed ${processed} source${processed === 1 ? '' : 's'}, completed ${completed}, failed ${failed}.`;
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to run the Proto-Idea Agent.';
    } finally {
      this.isRunning = false;
    }
  }

  summarizePolicy(): string {
    return `${this.labelForBreadth(this.policy.extractionBreadth)}, ${this.labelForInference(
      this.policy.inferenceTolerance
    )}, ${this.labelForNovelty(this.policy.noveltyBias)}, ${this.labelForThreshold(
      this.policy.minimumSignalThreshold
    )}`;
  }

  formatRunStatus(status: string): string {
    if (!status || status.trim().length === 0) {
      return 'Idle';
    }

    return status
      .toLowerCase()
      .split(/[_\s]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  summaryValue(key: string): number {
    const value = this.runtime.latestRunSummary?.[key];
    return typeof value === 'number' ? value : 0;
  }

  private normalizeMaxProtoIdeas(value: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_POLICY.maxProtoIdeasPerSource;
    }

    return Math.max(1, Math.min(12, Math.round(parsed)));
  }

  private labelForBreadth(value: ProtoIdeaExtractionPolicy['extractionBreadth']): string {
    switch (value) {
      case 'conservative':
        return 'Conservative breadth';
      case 'expansive':
        return 'Expansive breadth';
      default:
        return 'Standard breadth';
    }
  }

  private labelForInference(value: ProtoIdeaExtractionPolicy['inferenceTolerance']): string {
    switch (value) {
      case 'strict_grounding':
        return 'strict grounding';
      case 'exploratory':
        return 'exploratory inference';
      default:
        return 'balanced inference';
    }
  }

  private labelForNovelty(value: ProtoIdeaExtractionPolicy['noveltyBias']): string {
    switch (value) {
      case 'pragmatic':
        return 'pragmatic novelty';
      case 'exploratory':
        return 'exploratory novelty';
      default:
        return 'balanced novelty';
    }
  }

  private labelForThreshold(value: ProtoIdeaExtractionPolicy['minimumSignalThreshold']): string {
    switch (value) {
      case 'low':
        return 'low threshold';
      case 'high':
        return 'high threshold';
      default:
        return 'medium threshold';
    }
  }
}
