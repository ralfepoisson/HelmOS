import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  IdeaCandidateRecord,
  IdeaFoundryApiService,
  IdeaRefinementPolicy,
  IdeaRefinementRuntimeState
} from './idea-foundry-api.service';

const DEFAULT_POLICY: IdeaRefinementPolicy = {
  id: null,
  profileName: 'default',
  refinementDepth: 'standard',
  creativityLevel: 'medium',
  strictness: 'balanced',
  maxConceptualToolsPerRun: 3,
  internalQualityThreshold: 'standard'
};

const DEFAULT_RUNTIME: IdeaRefinementRuntimeState = {
  latestRunStatus: 'idle',
  lastRunAt: null,
  latestRunSummary: null
};

@Component({
  selector: 'app-idea-refinement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="refinement-page">
      <header class="hero-shell helmos-card">
        <div class="hero-copy">
          <span class="hero-kicker">Idea Refinement</span>
          <h1>Set the administrator policy that turns proto-ideas into stronger idea candidates</h1>
          <p>
            These controls shape how the Idea Refinement Agent challenges, clarifies, and strengthens proto-ideas
            using the current conceptual tools library without editing the static agent identity.
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
          <div class="status-pill status-pill-neutral">Candidates: {{ candidates.length }}</div>
        </div>

        <p *ngIf="surfaceMessage" class="hero-message" aria-live="polite">{{ surfaceMessage }}</p>
        <p *ngIf="loadError" class="hero-error" aria-live="polite">{{ loadError }}</p>
      </header>

      <section class="content-grid">
        <article class="policy-card helmos-card">
          <div class="section-heading">
            <span class="section-kicker">Administrator policy</span>
            <h2>Refinement controls</h2>
            <p>Guide how much transformation, creativity, realism, and internal quality the stage should enforce.</p>
          </div>

          <div class="field-grid two-up">
            <label class="field-block">
              <span>Refinement depth</span>
              <select class="form-select" [(ngModel)]="policy.refinementDepth">
                <option value="light">Light</option>
                <option value="standard">Standard</option>
                <option value="deep">Deep</option>
              </select>
              <small>How much structural reshaping the agent should attempt.</small>
            </label>

            <label class="field-block">
              <span>Creativity level</span>
              <select class="form-select" [(ngModel)]="policy.creativityLevel">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <small>How bold or lateral the refinement may be while staying grounded.</small>
            </label>
          </div>

          <div class="field-grid two-up">
            <label class="field-block">
              <span>Strictness / realism</span>
              <select class="form-select" [(ngModel)]="policy.strictness">
                <option value="conservative">Conservative</option>
                <option value="balanced">Balanced</option>
                <option value="exploratory">Exploratory</option>
              </select>
              <small>Whether the stage should stay pragmatic or allow more exploratory reframing.</small>
            </label>

            <label class="field-block">
              <span>Internal quality threshold</span>
              <select class="form-select" [(ngModel)]="policy.internalQualityThreshold">
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="high">High</option>
              </select>
              <small>Minimum quality bar before a candidate is accepted as a successful refinement output.</small>
            </label>
          </div>

          <div class="field-grid two-up">
            <label class="field-block">
              <span>Max conceptual tools per run</span>
              <input
                class="form-control"
                type="number"
                min="1"
                max="6"
                [(ngModel)]="policy.maxConceptualToolsPerRun"
              />
              <small>Hard cap on how many conceptual tools may be injected into one refinement pass.</small>
            </label>

            <div class="policy-summary">
              <span class="mini-label">Current policy summary</span>
              <strong>{{ summarizePolicy() }}</strong>
              <p>
                The runtime loads the saved policy, selects a small relevant subset of active conceptual tools, injects
                both into the agent context, validates the JSON output, and persists the resulting candidate with full traceability.
              </p>
            </div>
          </div>
        </article>

        <article class="runtime-card helmos-card">
          <div class="section-heading">
            <span class="section-kicker">Execution</span>
            <h2>Run feedback</h2>
            <p>Run the next eligible proto-idea through the refinement stage using the saved policy.</p>
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
              <span class="mini-label">Created</span>
              <strong>{{ summaryValue('createdCount') }}</strong>
            </div>
            <div class="metric-tile">
              <span class="mini-label">Updated</span>
              <strong>{{ summaryValue('updatedCount') }}</strong>
            </div>
          </div>

          <div class="run-callout">
            <strong>What Run Agent does</strong>
            <p>
              The backend picks the next eligible proto-idea, diagnoses weaknesses, selects the most relevant active conceptual
              tools, calls the Idea Refinement Agent, runs an internal quality check, and then creates or updates the stored
              idea candidate while recording the policy and tools used.
            </p>
          </div>
        </article>
      </section>

      <section class="candidates-card helmos-card">
        <div class="section-heading">
          <span class="section-kicker">Idea candidates</span>
          <h2>Latest refined outputs</h2>
          <p>Each candidate stays linked to its source proto-idea and preserves the tools and policy used during refinement.</p>
        </div>

        <div *ngIf="candidates.length === 0" class="empty-state">
          <strong>No idea candidates yet</strong>
          <p>Run the refinement stage after proto-ideas exist to populate this column with strengthened opportunity candidates.</p>
        </div>

        <div *ngIf="candidates.length > 0" class="candidate-list">
          <article *ngFor="let candidate of candidates" class="candidate-card">
            <div class="candidate-topline">
              <span class="pipeline-chip">{{ candidate.statusLabel || 'Refined' }}</span>
              <span class="candidate-meta">Confidence: {{ candidate.agentConfidence || 'n/a' }}</span>
              <span class="candidate-meta">Iteration {{ candidate.refinementIteration }}</span>
            </div>

            <h3>{{ candidate.protoIdeaTitle || deriveCandidateTitle(candidate) }}</h3>
            <p class="candidate-summary">{{ candidate.opportunityConcept || candidate.improvementSummary }}</p>

            <div class="candidate-grid">
              <div>
                <span class="mini-label">Target customer</span>
                <p>{{ candidate.targetCustomer }}</p>
              </div>
              <div>
                <span class="mini-label">Differentiation</span>
                <p>{{ candidate.differentiation }}</p>
              </div>
            </div>

            <div class="candidate-footer">
              <span>Proto-idea: {{ candidate.protoIdeaTitle || candidate.protoIdeaId }}</span>
              <span *ngIf="candidate.selectedConceptualToolNames?.length">Tools: {{ candidate.selectedConceptualToolNames?.join(', ') }}</span>
              <span>Updated: {{ candidate.updatedAt ? formatDate(candidate.updatedAt) : 'n/a' }}</span>
            </div>
          </article>
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .refinement-page {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .hero-shell,
      .policy-card,
      .runtime-card,
      .candidates-card {
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
      .run-callout p,
      .candidate-summary,
      .candidate-grid p,
      .empty-state p {
        margin: 0;
        color: var(--helmos-muted);
        line-height: 1.6;
      }

      .hero-actions,
      .status-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
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
      .runtime-card,
      .candidates-card {
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

      .field-grid.two-up,
      .candidate-grid {
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
      .run-callout,
      .empty-state,
      .candidate-card {
        padding: 0.95rem 1rem;
        border-radius: 1rem;
        background: rgba(248, 251, 255, 0.82);
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      .policy-summary strong,
      .run-callout strong,
      .empty-state strong {
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

      .candidate-list {
        display: grid;
        gap: 0.85rem;
      }

      .candidate-topline,
      .candidate-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem 0.85rem;
        align-items: center;
      }

      .candidate-card h3 {
        margin: 0.7rem 0 0.45rem;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .pipeline-chip {
        display: inline-flex;
        align-items: center;
        min-height: 1.7rem;
        padding: 0 0.55rem;
        border-radius: 999px;
        background: rgba(234, 242, 255, 0.9);
        color: var(--helmos-accent);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .candidate-meta,
      .candidate-footer {
        color: #445167;
        font-size: 0.82rem;
      }

      .candidate-grid {
        display: grid;
        gap: 0.85rem;
        margin-top: 0.85rem;
      }

      .candidate-footer {
        margin-top: 0.95rem;
        padding-top: 0.85rem;
        border-top: 1px solid rgba(219, 228, 238, 0.95);
      }

      @media (max-width: 980px) {
        .content-grid,
        .field-grid.two-up,
        .candidate-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class IdeaRefinementComponent implements OnInit {
  private readonly ideaFoundryApi = inject(IdeaFoundryApiService);

  policy: IdeaRefinementPolicy = { ...DEFAULT_POLICY };
  runtime: IdeaRefinementRuntimeState = { ...DEFAULT_RUNTIME };
  candidates: IdeaCandidateRecord[] = [];
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
      const [configuration, candidates] = await Promise.all([
        this.ideaFoundryApi.getIdeaRefinementConfiguration(),
        this.ideaFoundryApi.getIdeaCandidates()
      ]);
      this.policy = { ...configuration.policy };
      this.runtime = { ...configuration.runtime };
      this.candidates = Array.isArray(candidates) ? candidates : [];
      if (!this.surfaceMessage) {
        this.surfaceMessage = 'Loaded the current Idea Refinement policy and stored candidates.';
      }
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to load the Idea Refinement page.';
    } finally {
      this.isLoading = false;
    }
  }

  async saveChanges(): Promise<void> {
    this.isSaving = true;
    this.surfaceMessage = '';
    this.loadError = '';

    try {
      const payload = await this.ideaFoundryApi.saveIdeaRefinementConfiguration({
        ...this.policy,
        maxConceptualToolsPerRun: this.normalizeMaxTools(this.policy.maxConceptualToolsPerRun)
      });
      this.policy = { ...payload.policy };
      this.runtime = { ...payload.runtime };
      this.surfaceMessage = 'Saved the Idea Refinement policy.';
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to save the Idea Refinement policy.';
    } finally {
      this.isSaving = false;
    }
  }

  async runAgent(): Promise<void> {
    this.isRunning = true;
    this.surfaceMessage = '';
    this.loadError = '';

    try {
      const payload = await this.ideaFoundryApi.runIdeaRefinementAgent({ batchSize: 1 });
      this.policy = { ...payload.policy };
      this.runtime = { ...payload.runtime };
      this.candidates = await this.ideaFoundryApi.getIdeaCandidates();

      const processed = payload.result.processedCount;
      if (processed === 0) {
        this.surfaceMessage = 'The Idea Refinement Agent found no eligible proto-ideas to process.';
      } else {
        this.surfaceMessage =
          `Idea Refinement Agent run completed. Processed ${processed} proto-idea${processed === 1 ? '' : 's'}, ` +
          `created ${payload.result.createdCount}, updated ${payload.result.updatedCount}, failed ${payload.result.failedCount}.`;
      }
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to run the Idea Refinement Agent.';
    } finally {
      this.isRunning = false;
    }
  }

  summarizePolicy(): string {
    return `${this.policy.refinementDepth} depth, ${this.policy.creativityLevel} creativity, ${this.policy.strictness} realism, max ${this.policy.maxConceptualToolsPerRun} tools`;
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

  formatDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  deriveCandidateTitle(candidate: IdeaCandidateRecord): string {
    return candidate.opportunityConcept?.trim() || candidate.problemStatement?.trim() || 'Idea candidate';
  }

  summaryValue(key: string): number {
    const value = this.runtime.latestRunSummary?.[key];
    return typeof value === 'number' ? value : 0;
  }

  private normalizeMaxTools(value: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_POLICY.maxConceptualToolsPerRun;
    }

    return Math.max(1, Math.min(6, Math.round(parsed)));
  }
}
