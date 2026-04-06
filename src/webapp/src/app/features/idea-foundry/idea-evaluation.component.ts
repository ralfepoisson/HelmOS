import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';

import {
  CuratedOpportunityRecord,
  IdeaCandidateRecord,
  IdeaEvaluationRunResponse,
  IdeaFoundryApiService
} from './idea-foundry-api.service';

@Component({
  selector: 'app-idea-evaluation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="evaluation-page">
      <header class="hero-shell helmos-card">
        <div class="hero-copy">
          <span class="hero-kicker">Idea Evaluation</span>
          <h1>Apply the final quality gate before an opportunity graduates</h1>
          <p>
            This stage acts as the strict gatekeeper between refined idea candidates and Curated Opportunities. It
            rewards coherence and specificity, sends promising but incomplete work back for refinement, and preserves
            rejected outputs for later review instead of letting weak opportunities leak downstream.
          </p>
        </div>

        <div class="hero-actions">
          <button type="button" class="btn btn-outline-secondary" (click)="reload()" [disabled]="isLoading || isRunning">
            Refresh
          </button>
          <button type="button" class="btn btn-primary" (click)="runPendingBatch()" [disabled]="isLoading || isRunning">
            {{ isRunning ? 'Running…' : 'Run Pending Batch' }}
          </button>
        </div>

        <div *ngIf="!isLoading" class="status-strip">
          <div class="status-pill status-pill-neutral">Candidates: {{ candidates.length }}</div>
          <div class="status-pill status-pill-neutral">Curated: {{ curatedOpportunities.length }}</div>
          <div class="status-pill status-pill-neutral">Awaiting: {{ awaitingEvaluationCount() }}</div>
          <div class="status-pill status-pill-neutral">Needs refinement: {{ needsRefinementCount() }}</div>
        </div>

        <div class="runtime-metrics" *ngIf="latestRunResult">
          <div class="metric-tile">
            <span class="mini-label">Processed</span>
            <strong>{{ latestRunResult.result.processedCount }}</strong>
          </div>
          <div class="metric-tile">
            <span class="mini-label">Promoted</span>
            <strong>{{ latestRunResult.result.promotedCount }}</strong>
          </div>
          <div class="metric-tile">
            <span class="mini-label">Refined</span>
            <strong>{{ latestRunResult.result.refinedCount }}</strong>
          </div>
          <div class="metric-tile">
            <span class="mini-label">Rejected</span>
            <strong>{{ latestRunResult.result.rejectedCount }}</strong>
          </div>
        </div>

        <p *ngIf="surfaceMessage" class="hero-message" aria-live="polite">{{ surfaceMessage }}</p>
        <p *ngIf="loadError" class="hero-error" aria-live="polite">{{ loadError }}</p>
      </header>

      <section class="content-grid">
        <article class="candidates-card helmos-card">
          <div class="section-heading">
            <span class="section-kicker">Idea candidates</span>
            <h2>Evaluation queue and outcomes</h2>
            <p>
              Run evaluation on a single selected candidate, or batch through the pending queue. Each record keeps its
              latest decision, blocker, and next best action visible for operators.
            </p>
          </div>

          <div *ngIf="candidates.length === 0" class="empty-state">
            <strong>No idea candidates available</strong>
            <p>Run earlier Idea Foundry stages first to produce refined candidates for evaluation.</p>
          </div>

          <div *ngIf="candidates.length > 0" class="candidate-list">
            <article *ngFor="let candidate of candidates" class="candidate-card">
              <div class="candidate-topline">
                <span class="pipeline-chip">{{ workflowStateLabel(candidate) }}</span>
                <span class="candidate-meta" *ngIf="candidate.evaluationReadinessLabel">
                  Readiness: {{ candidate.evaluationReadinessLabel }}
                </span>
                <span class="candidate-meta" *ngIf="candidate.evaluationDuplicateRiskLabel">
                  Duplicate risk: {{ candidate.evaluationDuplicateRiskLabel }}
                </span>
              </div>

              <div class="candidate-header">
                <div>
                  <h3>{{ candidate.protoIdeaTitle || deriveCandidateTitle(candidate) }}</h3>
                  <p class="candidate-summary">{{ candidate.opportunityConcept || candidate.improvementSummary }}</p>
                </div>

                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  (click)="runSingleCandidate(candidate.id)"
                  [disabled]="isRunning"
                >
                  {{ isRunning && activeCandidateId === candidate.id ? 'Evaluating…' : singleActionLabel(candidate) }}
                </button>
              </div>

              <div class="candidate-grid">
                <div>
                  <span class="mini-label">Strongest aspect</span>
                  <p>{{ candidate.evaluationStrongestAspect || 'Awaiting evaluation' }}</p>
                </div>
                <div>
                  <span class="mini-label">Biggest risk</span>
                  <p>{{ candidate.evaluationBiggestRisk || candidate.qualityCheckRisks[0] || 'No evaluation yet' }}</p>
                </div>
                <div>
                  <span class="mini-label">Blocking issue</span>
                  <p>{{ candidate.evaluationBlockingIssue || 'None recorded' }}</p>
                </div>
                <div>
                  <span class="mini-label">Next best action</span>
                  <p>{{ candidate.evaluationNextBestAction || 'Run evaluation to generate a recommendation.' }}</p>
                </div>
              </div>

              <div class="candidate-footer">
                <span>Target customer: {{ candidate.targetCustomer }}</span>
                <span *ngIf="candidate.selectedConceptualToolNames?.length">
                  Tools: {{ selectedToolNames(candidate) }}
                </span>
                <span>Updated: {{ candidate.updatedAt ? formatDate(candidate.updatedAt) : 'n/a' }}</span>
              </div>
            </article>
          </div>
        </article>

        <article class="curated-card helmos-card">
          <div class="section-heading">
            <span class="section-kicker">Curated opportunities</span>
            <h2>Promoted opportunities</h2>
            <p>Promotions stay visible here with the evaluation rationale that justified downstream strategy work.</p>
          </div>

          <div *ngIf="curatedOpportunities.length === 0" class="empty-state">
            <strong>No curated opportunities yet</strong>
            <p>Promoted candidates will appear here once the evaluation stage clears them for downstream work.</p>
          </div>

          <div *ngIf="curatedOpportunities.length > 0" class="candidate-list">
            <article *ngFor="let opportunity of curatedOpportunities" class="candidate-card promoted-card">
              <div class="candidate-topline">
                <span class="pipeline-chip">Promoted</span>
                <span class="candidate-meta">Readiness: {{ opportunity.readinessLabel }}</span>
                <span class="candidate-meta">Duplicate risk: {{ opportunity.duplicateRiskLabel }}</span>
              </div>

              <h3>{{ opportunity.title }}</h3>
              <p class="candidate-summary">{{ opportunity.summary || opportunity.valueProposition }}</p>

              <div class="candidate-grid">
                <div>
                  <span class="mini-label">Strongest aspect</span>
                  <p>{{ opportunity.strongestAspect }}</p>
                </div>
                <div>
                  <span class="mini-label">Biggest risk</span>
                  <p>{{ opportunity.biggestRisk }}</p>
                </div>
                <div>
                  <span class="mini-label">Promotion reason</span>
                  <p>{{ opportunity.promotionReason }}</p>
                </div>
                <div>
                  <span class="mini-label">Next best action</span>
                  <p>{{ opportunity.nextBestAction }}</p>
                </div>
              </div>

              <div class="candidate-footer">
                <span>Target customer: {{ opportunity.targetCustomer }}</span>
                <span>Promoted: {{ opportunity.promotedAt ? formatDate(opportunity.promotedAt) : 'n/a' }}</span>
              </div>
            </article>
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

      .evaluation-page {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .hero-shell,
      .candidates-card,
      .curated-card {
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

      .hero-kicker {
        color: #7a6400;
      }

      .hero-copy h1 {
        margin: 0.4rem 0 0.5rem;
        font-size: clamp(1.9rem, 2.8vw, 2.7rem);
        line-height: 1.04;
        letter-spacing: -0.04em;
        font-weight: 800;
      }

      .hero-copy p,
      .section-heading p,
      .candidate-card p {
        margin: 0;
        color: var(--helmos-muted);
        line-height: 1.6;
      }

      .hero-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .status-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        min-height: 2rem;
        padding: 0 0.85rem;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      .status-pill-neutral {
        color: var(--helmos-text);
      }

      .runtime-metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .metric-tile {
        padding: 0.9rem 1rem;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      .metric-tile strong {
        display: block;
        margin-top: 0.2rem;
        font-size: 1.5rem;
      }

      .hero-message {
        margin: 0;
        color: #0f5132;
        font-weight: 700;
      }

      .hero-error {
        margin: 0;
        color: #9a3412;
        font-weight: 700;
      }

      .content-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr);
      }

      .section-heading h2 {
        margin: 0.35rem 0 0.3rem;
        font-size: 1.35rem;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .candidate-list {
        display: grid;
        gap: 0.9rem;
      }

      .candidate-card {
        padding: 1rem;
        border-radius: 1rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(255, 255, 255, 0.96);
      }

      .promoted-card {
        background: linear-gradient(180deg, rgba(243, 253, 243, 0.98), rgba(255, 255, 255, 0.98));
      }

      .candidate-topline {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .pipeline-chip {
        display: inline-flex;
        align-items: center;
        min-height: 1.8rem;
        padding: 0 0.65rem;
        border-radius: 999px;
        background: rgba(234, 242, 255, 0.9);
        color: var(--helmos-accent);
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .candidate-meta {
        color: var(--helmos-muted);
        font-size: 0.8rem;
        font-weight: 600;
      }

      .candidate-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
        margin-top: 0.75rem;
      }

      .candidate-header h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 800;
      }

      .candidate-summary {
        margin-top: 0.35rem;
      }

      .candidate-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.9rem;
        margin-top: 0.95rem;
      }

      .candidate-grid p {
        margin-top: 0.2rem;
      }

      .candidate-footer {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
        margin-top: 1rem;
        padding-top: 0.8rem;
        border-top: 1px solid rgba(219, 228, 238, 0.95);
        font-size: 0.82rem;
        color: #536273;
      }

      .empty-state {
        padding: 1rem;
        border-radius: 1rem;
        border: 1px dashed rgba(180, 192, 210, 0.9);
        background: rgba(248, 251, 255, 0.7);
      }

      .empty-state strong {
        display: block;
        margin-bottom: 0.3rem;
      }

      @media (max-width: 991.98px) {
        .content-grid {
          grid-template-columns: 1fr;
        }

        .runtime-metrics,
        .candidate-grid {
          grid-template-columns: 1fr;
        }

        .candidate-header {
          flex-direction: column;
        }
      }
    `
  ]
})
export class IdeaEvaluationComponent implements OnInit {
  private readonly ideaFoundryApi = inject(IdeaFoundryApiService);

  candidates: IdeaCandidateRecord[] = [];
  curatedOpportunities: CuratedOpportunityRecord[] = [];
  latestRunResult: IdeaEvaluationRunResponse | null = null;
  isLoading = true;
  isRunning = false;
  activeCandidateId: string | null = null;
  surfaceMessage: string | null = null;
  loadError: string | null = null;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;

    try {
      await this.loadData();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to load Idea Evaluation data.';
    } finally {
      this.isLoading = false;
    }
  }

  async runPendingBatch(): Promise<void> {
    await this.runEvaluation({ batchSize: 25 });
  }

  async runSingleCandidate(ideaCandidateId: string): Promise<void> {
    await this.runEvaluation({ ideaCandidateId, batchSize: 1 }, ideaCandidateId);
  }

  workflowStateLabel(candidate: IdeaCandidateRecord): string {
    switch (candidate.workflowState) {
      case 'PROMOTED':
        return 'Promoted';
      case 'NEEDS_REFINEMENT':
        return 'Needs refinement';
      case 'REJECTED':
        return 'Rejected';
      default:
        return 'Awaiting evaluation';
    }
  }

  singleActionLabel(candidate: IdeaCandidateRecord): string {
    return candidate.workflowState === 'PROMOTED' ? 'Re-evaluate' : 'Evaluate';
  }

  deriveCandidateTitle(candidate: IdeaCandidateRecord): string {
    return candidate.opportunityConcept || candidate.valueProposition || candidate.problemStatement || 'Idea candidate';
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

  awaitingEvaluationCount(): number {
    return this.candidates.filter((candidate) => candidate.workflowState === 'AWAITING_EVALUATION' || !candidate.workflowState).length;
  }

  needsRefinementCount(): number {
    return this.candidates.filter((candidate) => candidate.workflowState === 'NEEDS_REFINEMENT').length;
  }

  selectedToolNames(candidate: IdeaCandidateRecord): string {
    return candidate.selectedConceptualToolNames?.join(', ') || '';
  }

  private async runEvaluation(
    payload: { batchSize?: number; ideaCandidateId?: string; retryFailed?: boolean },
    activeCandidateId: string | null = null
  ): Promise<void> {
    this.isRunning = true;
    this.activeCandidateId = activeCandidateId;
    this.surfaceMessage = null;
    this.loadError = null;

    try {
      const result = await this.ideaFoundryApi.runIdeaEvaluation(payload);
      this.latestRunResult = result;
      this.surfaceMessage = this.buildRunMessage(result);
      await this.loadData();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to run Idea Evaluation.';
    } finally {
      this.isRunning = false;
      this.activeCandidateId = null;
    }
  }

  private async loadData(): Promise<void> {
    const [candidates, curatedOpportunities] = await Promise.all([
      this.ideaFoundryApi.getIdeaCandidates(),
      this.ideaFoundryApi.getCuratedOpportunities()
    ]);

    this.candidates = candidates;
    this.curatedOpportunities = curatedOpportunities;
  }

  private buildRunMessage(result: IdeaEvaluationRunResponse): string {
    const promoted = result.result.promotedCount;
    const refined = result.result.refinedCount;
    const rejected = result.result.rejectedCount;
    return `Promoted ${promoted} candidate${promoted === 1 ? '' : 's'}, sent ${refined} back for refinement, and rejected ${rejected}.`;
  }
}
