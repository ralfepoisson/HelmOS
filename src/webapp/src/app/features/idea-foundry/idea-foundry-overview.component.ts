import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';

import {
  IdeaCandidateRecord,
  IdeaFoundryApiService,
  ProspectingResultRecord,
  ProtoIdeaSourceRecord,
  ProtoIdeaRecord
} from './idea-foundry-api.service';

interface IdeaPipelineCard {
  id: string;
  title: string;
  summary: string;
  signal: string;
  status: string;
  processingStatus?: string;
  timestamp?: string | null;
  href?: string | null;
}

interface IdeaPipelineColumn {
  id: string;
  title: string;
  helper: string;
  cards: IdeaPipelineCard[];
  unprocessedCount: number;
  totalCount: number;
}

type PipelineStageState = 'pending' | 'running' | 'completed' | 'failed';
type PipelineStageKey = 'sources' | 'proto-ideas' | 'idea-candidates' | 'curated-opportunities';

const MAX_PIPELINE_STAGE_ITERATIONS = 100;

@Component({
  selector: 'app-idea-foundry-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="overview-stack">
      <header class="overview-hero helmos-card">
        <div class="hero-content">
          <span class="hero-tag">Idea Foundry</span>
          <h2>Refine raw business signals into curated opportunities</h2>
          <p>
            Idea Foundry turns sourced signals, rough proto-ideas, and in-progress concepts into a growing set of
            higher-confidence opportunities that can later feed Strategy Copilot.
          </p>
        </div>
      </header>

      <section class="pipeline-intro">
        <div class="pipeline-intro-copy">
          <span class="section-kicker">Overview</span>
          <h3>Pipeline board</h3>
          <p>
            This view follows the opportunity flow from incoming source material through to curated opportunities ready
            for deeper strategy work.
          </p>
        </div>

        <div class="pipeline-actions">
          <label class="pipeline-toggle">
            <input type="checkbox" [checked]="showProcessedItems" (change)="toggleProcessedVisibility($event)" />
            <span>Show processed</span>
          </label>
          <button type="button" class="pipeline-run-button" [disabled]="isPipelineRunning" (click)="runPipeline()">
            {{ isPipelineRunning ? 'Running pipeline...' : 'Run Pipeline' }}
          </button>
          <p *ngIf="pipelineRunError || sourceLoadError" class="pipeline-warning">
            {{ pipelineRunError || sourceLoadError }}
          </p>
        </div>
      </section>

      <section class="pipeline-board" data-testid="idea-foundry-board" aria-label="Idea Foundry pipeline board">
        <article
          *ngFor="let column of columns"
          class="pipeline-column"
          [attr.data-stage-id]="column.id"
          data-testid="idea-stage-column"
        >
          <header class="pipeline-column-header">
            <div>
              <h4>{{ column.title }}</h4>
              <p>{{ column.helper }}</p>
            </div>

            <div class="pipeline-column-header-meta">
              <span
                class="pipeline-stage-indicator"
                [class.pipeline-stage-pending]="getStageState(column.id) === 'pending'"
                [class.pipeline-stage-running]="getStageState(column.id) === 'running'"
                [class.pipeline-stage-completed]="getStageState(column.id) === 'completed'"
                [class.pipeline-stage-failed]="getStageState(column.id) === 'failed'"
                [attr.data-stage-state]="getStageState(column.id)"
                [attr.aria-label]="column.title + ' stage status: ' + getStageState(column.id)"
                [title]="column.title + ' stage status: ' + getStageState(column.id)"
              ></span>
              <span class="pipeline-count">{{ column.unprocessedCount }}/{{ column.totalCount }}</span>
            </div>
          </header>

          <div class="pipeline-card-list">
            <article
              *ngFor="let card of column.cards"
              class="pipeline-card"
              [class.pipeline-card-collapsed]="isCollapsibleCard(column.id, card) && !isCardExpanded(card.id)"
            >
              <button
                *ngIf="isCollapsibleCard(column.id, card); else staticCard"
                type="button"
                class="pipeline-card-toggle"
                [attr.aria-expanded]="isCardExpanded(card.id)"
                (click)="toggleCard(card.id)"
              >
                <h5 class="pipeline-card-title">
                  <span class="pipeline-card-title-text">{{ card.title }}</span>
                </h5>
                <div *ngIf="card.timestamp" class="pipeline-card-timestamp">
                  {{ card.timestamp }}
                </div>
                <ng-container *ngIf="isCardExpanded(card.id)">
                  <span class="pipeline-card-status">{{ card.status }}</span>
                  <p>{{ card.summary }}</p>
                  <div class="pipeline-card-actions" *ngIf="card.href">
                    <a [href]="card.href" target="_blank" rel="noreferrer" (click)="$event.stopPropagation()">
                      Open source
                    </a>
                  </div>
                  <div class="pipeline-card-meta">{{ card.signal }}</div>
                </ng-container>
              </button>
              <ng-template #staticCard>
                <span class="pipeline-card-status">{{ card.status }}</span>
                <h5 class="pipeline-card-title">{{ card.title }}</h5>
                <p>{{ card.summary }}</p>
                <div class="pipeline-card-meta">{{ card.signal }}</div>
              </ng-template>
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

      .overview-stack {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .overview-hero {
        padding: 1.3rem;
        border: 1px solid rgba(255, 206, 0, 0.18);
        background:
          linear-gradient(135deg, rgba(255, 250, 209, 0.92), rgba(255, 255, 255, 0.98) 48%),
          rgba(255, 255, 255, 0.95);
      }

      .hero-content h2 {
        margin: 0.4rem 0 0.55rem;
        font-size: clamp(1.8rem, 2.8vw, 2.6rem);
        line-height: 1.05;
        letter-spacing: -0.04em;
        font-weight: 800;
      }

      .hero-content p,
      .pipeline-intro p,
      .pipeline-column-header p,
      .pipeline-card p {
        margin: 0;
        color: var(--helmos-muted);
        line-height: 1.6;
      }

      .hero-tag,
      .section-kicker {
        display: inline-block;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero-tag {
        padding: 0.28rem 0.55rem;
        border-radius: 999px;
        background: #ffeb3b;
        color: #172235;
      }

      .section-kicker {
        color: var(--helmos-accent);
      }

      .pipeline-intro {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
        padding: 0.1rem 0.1rem 0;
      }

      .pipeline-intro-copy {
        max-width: 52rem;
      }

      .pipeline-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .pipeline-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 0.8rem;
        border-radius: 999px;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(255, 255, 255, 0.9);
        color: var(--helmos-text);
        font-size: 0.82rem;
        font-weight: 700;
        line-height: 1;
      }

      .pipeline-toggle input {
        width: 1rem;
        height: 1rem;
        accent-color: #2563eb;
      }

      .pipeline-run-button {
        min-width: 10rem;
        padding: 0.7rem 1rem;
        border: 1px solid rgba(32, 101, 209, 0.24);
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(32, 101, 209, 0.98), rgba(48, 128, 255, 0.98));
        color: white;
        font-size: 0.88rem;
        font-weight: 800;
        letter-spacing: 0.01em;
        box-shadow: 0 16px 28px rgba(32, 101, 209, 0.2);
        transition:
          transform 160ms ease,
          box-shadow 160ms ease,
          opacity 160ms ease;
      }

      .pipeline-run-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 18px 30px rgba(32, 101, 209, 0.24);
      }

      .pipeline-run-button:disabled {
        cursor: progress;
        opacity: 0.76;
      }

      .pipeline-warning {
        margin: 0;
        color: #9a3412;
        font-size: 0.84rem;
        max-width: 18rem;
        text-align: right;
      }

      .pipeline-intro h3 {
        margin: 0.35rem 0 0.35rem;
        font-size: 1.35rem;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .pipeline-board {
        display: grid;
        grid-template-columns: repeat(4, minmax(240px, 1fr));
        gap: 1rem;
        align-items: start;
        overflow-x: auto;
        padding-bottom: 0.4rem;
      }

      .pipeline-column {
        min-width: 240px;
        padding: 0.9rem;
        border-radius: 1.2rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(248, 251, 255, 0.82);
        box-shadow: 0 16px 34px rgba(15, 23, 42, 0.05);
      }

      .pipeline-column-header {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: flex-start;
        margin-bottom: 0.85rem;
      }

      .pipeline-column-header h4 {
        margin: 0;
        font-size: 1rem;
        font-weight: 800;
      }

      .pipeline-column-header p {
        margin-top: 0.22rem;
        font-size: 0.84rem;
      }

      .pipeline-column-header-meta {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }

      .pipeline-stage-indicator {
        width: 0.95rem;
        height: 0.95rem;
        border-radius: 999px;
        border: 2px solid rgba(148, 163, 184, 0.2);
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.8);
      }

      .pipeline-stage-pending {
        background: #cbd5e1;
      }

      .pipeline-stage-running {
        background: #2563eb;
      }

      .pipeline-stage-completed {
        background: #16a34a;
      }

      .pipeline-stage-failed {
        background: #dc2626;
      }

      .pipeline-count {
        min-width: 2rem;
        height: 2rem;
        display: inline-grid;
        place-items: center;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(219, 228, 238, 0.95);
        color: var(--helmos-muted);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .pipeline-card-list {
        display: grid;
        gap: 0.75rem;
      }

      .pipeline-card {
        padding: 0.9rem;
        border-radius: 1rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(255, 255, 255, 0.95);
      }

      .pipeline-card-collapsed {
        padding: 0;
      }

      .pipeline-card-toggle {
        width: 100%;
        display: grid;
        gap: 0.3rem;
        padding: 0.75rem 0.9rem;
        border: 0;
        border-radius: inherit;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .pipeline-card-toggle:hover {
        background: rgba(248, 251, 255, 0.88);
      }

      .pipeline-card-status {
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

      .pipeline-card h5,
      .pipeline-card-title {
        margin: 0.6rem 0 0.35rem;
        font-size: 0.98rem;
        font-weight: 700;
      }

      .pipeline-card-title {
        margin: 0;
        min-width: 0;
      }

      .pipeline-card-title-text {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .pipeline-card-timestamp {
        font-size: 0.74rem;
        line-height: 1.3;
        color: #7a8699;
      }

      .pipeline-card-actions a {
        color: var(--helmos-accent);
        font-size: 0.82rem;
        font-weight: 700;
        text-decoration: none;
      }

      .pipeline-card-actions a:hover {
        text-decoration: underline;
      }

      .pipeline-card-meta {
        margin-top: 0.65rem;
        padding-top: 0.65rem;
        border-top: 1px solid rgba(219, 228, 238, 0.95);
        font-size: 0.8rem;
        color: #445167;
      }

      @media (max-width: 991.98px) {
        .pipeline-intro {
          flex-direction: column;
        }

        .pipeline-actions {
          width: 100%;
          justify-content: flex-start;
        }

        .pipeline-warning {
          max-width: none;
          text-align: left;
        }
      }
    `
  ]
})
export class IdeaFoundryOverviewComponent implements OnInit {
  private readonly ideaFoundryApi = inject(IdeaFoundryApiService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly expandedCardIds = new Set<string>();

  columns: IdeaPipelineColumn[] = buildEmptyColumns();
  sourceLoadError: string | null = null;
  pipelineRunError: string | null = null;
  isPipelineRunning = false;
  showProcessedItems = false;
  stageStates: Record<PipelineStageKey, PipelineStageState> = buildPendingStageStates();

  async ngOnInit(): Promise<void> {
    await this.loadPipelineContents();
  }

  async runPipeline(): Promise<void> {
    if (this.isPipelineRunning) {
      return;
    }

    this.isPipelineRunning = true;
    this.pipelineRunError = null;
    this.stageStates = buildPendingStageStates();
    this.changeDetector.detectChanges();

    try {
      await this.executePipelineStage('sources', async () => {
        await this.ideaFoundryApi.executeProspectingRun();
        await this.loadPipelineContents();
      });

      await this.executeLoopingPipelineStage('proto-ideas', async () => {
        const result = await this.ideaFoundryApi.runProtoIdeaAgent({ batchSize: 1 });
        await this.loadPipelineContents();
        return {
          processedCount: result.result.processedCount,
          failedCount: result.result.failedCount
        };
      });

      await this.executeLoopingPipelineStage('idea-candidates', async () => {
        const result = await this.ideaFoundryApi.runIdeaRefinementAgent({ batchSize: 1 });
        await this.loadPipelineContents();
        return {
          processedCount: result.result.processedCount,
          failedCount: result.result.failedCount
        };
      });

      await this.executePipelineStage('curated-opportunities', async () => {
        await this.loadPipelineContents();
      });
    } catch (error) {
      this.pipelineRunError = error instanceof Error ? error.message : 'Pipeline execution failed.';
    } finally {
      this.isPipelineRunning = false;
      this.changeDetector.detectChanges();
    }
  }

  toggleCard(cardId: string): void {
    if (this.expandedCardIds.has(cardId)) {
      this.expandedCardIds.delete(cardId);
      return;
    }

    this.expandedCardIds.add(cardId);
  }

  isCardExpanded(cardId: string): boolean {
    return this.expandedCardIds.has(cardId);
  }

  isCollapsibleCard(columnId: string, card: IdeaPipelineCard): boolean {
    return columnId === 'sources' || columnId === 'proto-ideas';
  }

  toggleProcessedVisibility(event: Event): void {
    const nextValue = (event.target as HTMLInputElement | null)?.checked ?? false;
    this.showProcessedItems = nextValue;
    void this.loadPipelineContents();
  }

  getStageState(columnId: string): PipelineStageState {
    return this.stageStates[toPipelineStageKey(columnId)] ?? 'pending';
  }

  private async loadPipelineContents(): Promise<void> {
    try {
      const payload = await this.ideaFoundryApi.getIdeaFoundryContents();
      this.columns = buildColumnsFromPipelinePayload(
        payload.sources,
        payload.sourceProcessing,
        payload.protoIdeas,
        payload.ideaCandidates,
        this.showProcessedItems
      );
      this.sourceLoadError = null;
    } catch (error) {
      this.columns = buildEmptyColumns();
      this.sourceLoadError = error instanceof Error ? error.message : 'Unable to load source records.';
      throw error;
    } finally {
      this.changeDetector.detectChanges();
    }
  }

  private async executePipelineStage(stage: PipelineStageKey, run: () => Promise<void>): Promise<void> {
    this.stageStates[stage] = 'running';
    this.changeDetector.detectChanges();

    try {
      await run();
      this.stageStates[stage] = 'completed';
    } catch (error) {
      this.stageStates[stage] = 'failed';
      throw error;
    } finally {
      this.changeDetector.detectChanges();
    }
  }

  private async executeLoopingPipelineStage(
    stage: PipelineStageKey,
    run: () => Promise<{ processedCount: number; failedCount: number }>
  ): Promise<void> {
    await this.executePipelineStage(stage, async () => {
      for (let iteration = 1; iteration <= MAX_PIPELINE_STAGE_ITERATIONS; iteration += 1) {
        const result = await run();
        if (result.failedCount > 0) {
          throw new Error(`The ${formatStageLabel(stage)} stage failed and the pipeline was stopped.`);
        }
        if (result.processedCount <= 0) {
          return;
        }
      }

      throw new Error(`The ${formatStageLabel(stage)} stage reached the iteration limit and the pipeline was stopped.`);
    });
  }
}

function buildColumnsFromPipelinePayload(
  resultRecords: ProspectingResultRecord[],
  sourceProcessing: ProtoIdeaSourceRecord[],
  protoIdeas: ProtoIdeaRecord[],
  ideaCandidates: IdeaCandidateRecord[],
  showProcessedItems: boolean
): IdeaPipelineColumn[] {
  const columns = buildEmptyColumns();
  const sourceColumn = columns.find((column) => column.id === 'sources');
  const protoIdeaColumn = columns.find((column) => column.id === 'proto-ideas');
  const candidateColumn = columns.find((column) => column.id === 'idea-candidates');

  if (!sourceColumn || !protoIdeaColumn || !candidateColumn) {
    return columns;
  }

  const completedSourceKeys = new Set(
    (Array.isArray(sourceProcessing) ? sourceProcessing : [])
      .filter((record) => normalizeProcessingStatus(record.processingStatus) === 'COMPLETED')
      .map((record) => normalizeSourceKey(record))
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  );

  const normalizedCards = Array.isArray(resultRecords)
    ? resultRecords
        .filter((record) => typeof record?.sourceUrl === 'string' && record.sourceUrl.trim().length > 0)
        .map((record) => mapResultRecordToSourceCard(record))
    : [];
  const unprocessedSourceCards = normalizedCards.filter(
    (record) => !completedSourceKeys.has(normalizeSourceKey(record))
  );

  sourceColumn.cards =
    (showProcessedItems ? normalizedCards : unprocessedSourceCards).length > 0
      ? (showProcessedItems ? normalizedCards : unprocessedSourceCards)
      : [
          {
            id: 'sources-empty',
            title: 'No normalized sources captured yet',
            summary: 'Run Prospecting Execution to populate this column with the latest stored source records.',
            signal: 'Awaiting the next prospecting execution cycle',
            status: 'Waiting'
          }
        ];
  sourceColumn.unprocessedCount = unprocessedSourceCards.length;
  sourceColumn.totalCount = normalizedCards.length;

  const normalizedProtoIdeaCards = Array.isArray(protoIdeas)
    ? protoIdeas
        .filter((protoIdea) => typeof protoIdea?.id === 'string' && protoIdea.id.trim().length > 0)
        .map((protoIdea) => mapProtoIdeaToCard(protoIdea))
    : [];
  const unprocessedProtoIdeaCards = normalizedProtoIdeaCards.filter(
    (protoIdea) => normalizeProcessingStatus(protoIdea.processingStatus) !== 'COMPLETED'
  );

  protoIdeaColumn.cards =
    (showProcessedItems ? normalizedProtoIdeaCards : unprocessedProtoIdeaCards).length > 0
      ? (showProcessedItems ? normalizedProtoIdeaCards : unprocessedProtoIdeaCards)
      : [
          {
            id: 'proto-ideas-empty',
            title: 'No proto-ideas yet',
            summary: 'No extracted ideas have been persisted from live source records yet.',
            signal: 'Run prospecting and extraction against real inputs to populate this stage',
            status: 'Waiting'
          }
        ];
  protoIdeaColumn.unprocessedCount = unprocessedProtoIdeaCards.length;
  protoIdeaColumn.totalCount = normalizedProtoIdeaCards.length;

  const normalizedIdeaCandidateCards = Array.isArray(ideaCandidates)
    ? ideaCandidates
        .filter((candidate) => typeof candidate?.id === 'string' && candidate.id.trim().length > 0)
        .map((candidate) => mapIdeaCandidateToCard(candidate))
    : [];

  candidateColumn.cards =
    normalizedIdeaCandidateCards.length > 0
      ? normalizedIdeaCandidateCards
      : [
          {
            id: 'idea-candidates-empty',
            title: 'No idea candidates yet',
            summary: 'No refined opportunities have been persisted from real prospecting data yet.',
            signal: 'This stage will fill as extracted ideas are reviewed and strengthened',
            status: 'Waiting'
          }
        ];
  candidateColumn.unprocessedCount = normalizedIdeaCandidateCards.length;
  candidateColumn.totalCount = normalizedIdeaCandidateCards.length;

  const curatedOpportunitiesColumn = columns.find((column) => column.id === 'curated-opportunities');
  if (curatedOpportunitiesColumn) {
    const curatedCardCount = curatedOpportunitiesColumn.cards.filter((card) => !card.id.endsWith('-empty')).length;
    curatedOpportunitiesColumn.unprocessedCount = curatedCardCount;
    curatedOpportunitiesColumn.totalCount = curatedCardCount;
  }

  return columns;
}

function mapResultRecordToSourceCard(record: ProspectingResultRecord): IdeaPipelineCard {
  return {
    id: record.id,
    title: record.sourceTitle?.trim() || record.sourceUrl?.trim() || 'Normalized source',
    summary:
      record.snippet?.trim() ||
      `Captured from ${record.queryFamilyTitle?.trim() || 'the latest prospecting query family'} using the query "${record.query?.trim() || 'n/a'}".`,
    signal: buildSourceMeta(record),
    status: 'Normalized',
    timestamp: formatCapturedAt(record.capturedAt),
    href: record.sourceUrl?.trim() || null
  };
}

function mapProtoIdeaToCard(record: ProtoIdeaRecord): IdeaPipelineCard {
  return {
    id: record.id,
    title: record.title?.trim() || 'Proto-idea',
    summary:
      record.problemStatement?.trim() ||
      record.opportunityHypothesis?.trim() ||
      'A proto-idea has been extracted from a processed source.',
    signal: buildProtoIdeaMeta(record),
    status: record.statusLabel?.trim() || 'Extracted',
    processingStatus: record.refinementStatus,
    timestamp: formatCapturedAt(record.createdAt)
  };
}

function mapIdeaCandidateToCard(record: IdeaCandidateRecord): IdeaPipelineCard {
  return {
    id: record.id,
    title: record.protoIdeaTitle?.trim() || record.opportunityConcept?.trim() || 'Idea candidate',
    summary:
      record.opportunityConcept?.trim() ||
      record.improvementSummary?.trim() ||
      record.valueProposition?.trim() ||
      'A refined idea candidate has been persisted from a proto-idea.',
    signal: buildIdeaCandidateMeta(record),
    status: record.statusLabel?.trim() || 'Refined',
    timestamp: formatCapturedAt(record.updatedAt || record.createdAt)
  };
}

function buildSourceMeta(record: ProspectingResultRecord): string {
  const parts = [
    record.queryFamilyTitle ? `Query family: ${record.queryFamilyTitle}` : null,
    record.themeLink ? `Theme: ${record.themeLink}` : null,
    record.query ? `Query: ${record.query}` : null
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return parts.join(' · ');
}

function buildProtoIdeaMeta(record: ProtoIdeaRecord): string {
  const parts = [
    record.targetCustomer ? `Customer: ${record.targetCustomer}` : null,
    record.opportunityType ? `Type: ${record.opportunityType}` : null,
    record.agentConfidence ? `Confidence: ${record.agentConfidence}` : null
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return parts.join(' · ');
}

function buildIdeaCandidateMeta(record: IdeaCandidateRecord): string {
  const parts = [
    record.targetCustomer ? `Customer: ${record.targetCustomer}` : null,
    record.agentConfidence ? `Confidence: ${record.agentConfidence}` : null,
    typeof record.refinementIteration === 'number' ? `Iteration: ${record.refinementIteration}` : null,
    record.selectedConceptualToolNames?.length ? `Tools: ${record.selectedConceptualToolNames.join(', ')}` : null
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return parts.join(' · ');
}

function normalizeProcessingStatus(status?: string): string {
  return String(status ?? '').trim().toUpperCase();
}

function normalizeSourceKey(record: { sourceKey?: string; sourceUrl?: string | null; id?: string; sourceTitle?: string | null }): string {
  const explicitSourceKey = typeof record?.sourceKey === 'string' ? record.sourceKey.trim().toLowerCase() : '';
  if (explicitSourceKey) {
    return explicitSourceKey;
  }

  const sourceUrl = typeof record?.sourceUrl === 'string' ? record.sourceUrl.trim().toLowerCase() : '';
  if (sourceUrl) {
    return sourceUrl;
  }

  const sourceId = typeof record?.id === 'string' ? record.id.trim() : '';
  if (sourceId) {
    return `source-record:${sourceId}`;
  }

  const sourceTitle = typeof record?.sourceTitle === 'string' ? record.sourceTitle.trim().toLowerCase() : '';
  return sourceTitle ? `source-title:${sourceTitle}` : '';
}

function formatCapturedAt(value?: string): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function buildEmptyColumns(): IdeaPipelineColumn[] {
  return [
    {
      id: 'sources',
      title: 'Sources',
      helper: 'Raw market signals and observed needs entering the pipeline.',
      cards: [],
      unprocessedCount: 0,
      totalCount: 0
    },
    {
      id: 'proto-ideas',
      title: 'Proto-Ideas',
      helper: 'Early opportunity fragments extracted from the strongest signals.',
      unprocessedCount: 0,
      totalCount: 0,
      cards: [
        {
          id: 'proto-ideas-empty',
          title: 'No proto-ideas yet',
          summary: 'No extracted ideas have been persisted from live source records yet.',
          signal: 'Run prospecting and extraction against real inputs to populate this stage',
          status: 'Waiting'
        }
      ]
    },
    {
      id: 'idea-candidates',
      title: 'Idea Candidates',
      helper: 'Strengthened opportunities being challenged, expanded, and differentiated.',
      unprocessedCount: 0,
      totalCount: 0,
      cards: [
        {
          id: 'idea-candidates-empty',
          title: 'No idea candidates yet',
          summary: 'No refined opportunities have been persisted from real prospecting data yet.',
          signal: 'This stage will fill as extracted ideas are reviewed and strengthened',
          status: 'Waiting'
        }
      ]
    },
    {
      id: 'curated-opportunities',
      title: 'Curated Opportunities',
      helper: 'Higher-confidence opportunities that look ready for downstream strategy work.',
      unprocessedCount: 0,
      totalCount: 0,
      cards: [
        {
          id: 'curated-opportunities-empty',
          title: 'No curated opportunities yet',
          summary: 'No production-ready opportunities have been promoted from real pipeline work yet.',
          signal: 'Curated opportunities will appear after downstream review and promotion',
          status: 'Waiting'
        }
      ]
    }
  ];
}

function buildPendingStageStates(): Record<PipelineStageKey, PipelineStageState> {
  return {
    sources: 'pending',
    'proto-ideas': 'pending',
    'idea-candidates': 'pending',
    'curated-opportunities': 'pending'
  };
}

function toPipelineStageKey(columnId: string): PipelineStageKey {
  switch (columnId) {
    case 'sources':
    case 'proto-ideas':
    case 'idea-candidates':
    case 'curated-opportunities':
      return columnId;
    default:
      return 'sources';
  }
}

function formatStageLabel(stage: PipelineStageKey): string {
  switch (stage) {
    case 'proto-ideas':
      return 'Proto-Idea Extraction';
    case 'idea-candidates':
      return 'Idea Refinement';
    case 'curated-opportunities':
      return 'Curated Opportunities';
    default:
      return 'Sources';
  }
}
