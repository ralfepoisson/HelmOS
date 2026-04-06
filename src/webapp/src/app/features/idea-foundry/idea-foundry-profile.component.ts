import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CuratedOpportunityRecord,
  IdeaCandidateRecord,
  IdeaFoundryApiService,
  IdeaFoundryPipelineContentsResponse,
  ProtoIdeaRecord,
  ProtoIdeaSourceRecord
} from './idea-foundry-api.service';

type ProfileStage = 'proto-idea' | 'idea-candidate' | 'curated-opportunity';

interface IdeaFoundryProfileViewModel {
  record: {
    id: string;
    title: string;
    stage: ProfileStage;
    stageLabel: string;
    summary: string;
    earlyMonetizationIdea?: string | null;
  };
  lineage: Array<{ label: string; title: string; url?: string | null }>;
  tags: string[];
  metadata: Array<{ label: string; value: string }>;
  details: string[];
}

interface RouteSnapshotLike {
  paramMap?: {
    get(name: string): string | null;
  };
}

@Component({
  selector: 'app-idea-foundry-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="profile-page">
      <header class="profile-hero helmos-card" *ngIf="profile">
        <span class="hero-kicker">Idea Profile</span>
        <h1>{{ profile.record.title }}</h1>
        <div class="status-strip">
          <span class="status-pill">{{ profile.record.stageLabel }}</span>
        </div>
        <p>{{ profile.record.summary }}</p>
      </header>

      <section *ngIf="profile" class="profile-layout">
        <div class="profile-main-column">
          <article class="profile-card helmos-card">
            <span class="section-kicker">Lineage</span>
            <h2>Lineage</h2>
            <div class="lineage-list">
              <div *ngFor="let item of profile.lineage" class="lineage-item">
                <strong>{{ item.label }}</strong>
                <span>{{ item.title }}</span>
                <a *ngIf="item.url" [href]="item.url" target="_blank" rel="noreferrer">Open source</a>
              </div>
            </div>
          </article>

          <article class="profile-card detail-card-wide helmos-card" *ngIf="profile.details.length > 0">
            <span class="section-kicker">Details</span>
            <h2>Record Details</h2>
            <ul class="detail-list">
              <li *ngFor="let detail of profile.details">{{ detail }}</li>
            </ul>
          </article>
        </div>

        <aside class="profile-side-column">
          <article class="profile-card helmos-card">
            <span class="section-kicker">Signals</span>
            <h2>Classification</h2>
            <div class="chip-row" *ngIf="profile.tags.length > 0; else noTags">
              <span *ngFor="let tag of profile.tags" class="tag-chip">{{ tag }}</span>
            </div>
            <ng-template #noTags>
              <p>No persisted evaluation tags are available for this record yet.</p>
            </ng-template>
          </article>

          <article class="profile-card helmos-card" *ngIf="profile.metadata.length > 0">
            <span class="section-kicker">Metadata</span>
            <h2>Available Metadata</h2>
            <div class="metadata-list">
              <div *ngFor="let item of profile.metadata" class="metadata-item">
                <strong>{{ item.label }}</strong>
                <span>{{ item.value }}</span>
              </div>
            </div>
          </article>

          <article class="profile-card helmos-card" *ngIf="profile.record.earlyMonetizationIdea">
            <span class="section-kicker">Monetization</span>
            <h2>Early Monetization</h2>
            <p>{{ profile.record.earlyMonetizationIdea }}</p>
          </article>
        </aside>
      </section>

      <article *ngIf="loadError" class="profile-card helmos-card">
        <span class="section-kicker">Error</span>
        <h2>Profile unavailable</h2>
        <p>{{ loadError }}</p>
      </article>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .profile-page {
        display: grid;
        gap: 1rem;
      }

      .profile-hero,
      .profile-card {
        padding: 1.25rem;
      }

      .profile-hero {
        border: 1px solid rgba(255, 206, 0, 0.18);
        background:
          linear-gradient(135deg, rgba(255, 250, 209, 0.92), rgba(255, 255, 255, 0.98) 48%),
          rgba(255, 255, 255, 0.95);
      }

      .hero-kicker,
      .section-kicker {
        display: inline-block;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero-kicker {
        color: #7a6400;
      }

      .profile-hero h1,
      .profile-card h2 {
        margin: 0.45rem 0 0.5rem;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .profile-hero h1 {
        font-size: clamp(1.9rem, 3vw, 2.7rem);
        line-height: 1.05;
      }

      .profile-hero p,
      .profile-card p {
        margin: 0;
        color: var(--helmos-muted);
        line-height: 1.6;
      }

      .profile-layout,
      .profile-main-column,
      .profile-side-column {
        display: grid;
        gap: 1rem;
      }

      .status-strip {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      .status-pill,
      .tag-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.3rem 0.6rem;
        border-radius: 999px;
        background: rgba(23, 34, 53, 0.08);
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .lineage-list {
        display: grid;
        gap: 0.8rem;
      }

      .lineage-item {
        display: grid;
        gap: 0.22rem;
        padding: 0.9rem 1rem;
        border-radius: 0.95rem;
        background: rgba(247, 251, 255, 0.92);
        border: 1px solid rgba(219, 228, 238, 0.92);
      }

      .lineage-item strong {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .lineage-item span,
      .lineage-item a {
        color: var(--helmos-muted);
      }

      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .metadata-list,
      .detail-list {
        display: grid;
        gap: 0.7rem;
      }

      .metadata-item {
        display: grid;
        gap: 0.22rem;
        padding: 0.9rem 1rem;
        border-radius: 0.95rem;
        background: rgba(247, 251, 255, 0.92);
        border: 1px solid rgba(219, 228, 238, 0.92);
      }

      .metadata-item strong {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .metadata-item span,
      .detail-list li {
        color: var(--helmos-muted);
      }

      .detail-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .detail-list li {
        padding: 1rem 1.05rem;
        border-radius: 0.95rem;
        background: rgba(247, 251, 255, 0.92);
        border: 1px solid rgba(219, 228, 238, 0.92);
      }

      @media (min-width: 1200px) {
        .profile-layout {
          grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.95fr);
          align-items: start;
        }

        .profile-side-column {
          position: sticky;
          top: 84px;
        }
      }

      @media (max-width: 1199.98px) {
        .profile-side-column {
          order: 2;
        }

        .profile-main-column {
          order: 1;
        }
      }
    `
  ]
})
export class IdeaFoundryProfileComponent implements OnInit {
  private readonly ideaFoundryApi = inject(IdeaFoundryApiService);
  private readonly explicitRoute = inject('ActivatedRoute' as never, { optional: true }) as { snapshot?: RouteSnapshotLike } | null;
  private readonly route = inject(ActivatedRoute, { optional: true });

  isLoading = true;
  loadError = '';
  profile: IdeaFoundryProfileViewModel | null = null;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      const payload = await this.ideaFoundryApi.getIdeaFoundryContents();
      const params = this.currentSnapshot()?.paramMap;
      const stage = params?.get('stage') as ProfileStage | null;
      const id = params?.get('id');
      this.profile = stage && id ? buildProfile(payload, stage, id) : null;

      if (!this.profile) {
        this.loadError = 'The requested Idea Foundry record could not be found.';
      }
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to load the Idea Foundry profile.';
    } finally {
      this.isLoading = false;
    }
  }

  private currentSnapshot(): RouteSnapshotLike | null {
    return this.explicitRoute?.snapshot ?? this.route?.snapshot ?? null;
  }
}

function buildProfile(
  payload: IdeaFoundryPipelineContentsResponse,
  stage: ProfileStage,
  id: string
): IdeaFoundryProfileViewModel | null {
  const sourceLookup = new Map<string, ProtoIdeaSourceRecord>(
    (payload.sourceProcessing ?? [])
      .filter((record) => typeof record?.id === 'string' && record.id.trim().length > 0)
      .map((record) => [record.id, record] as const)
  );
  const protoLookup = new Map<string, ProtoIdeaRecord>(
    (payload.protoIdeas ?? [])
      .filter((record) => typeof record?.id === 'string' && record.id.trim().length > 0)
      .map((record) => [record.id, record] as const)
  );
  const candidateLookup = new Map<string, IdeaCandidateRecord>(
    (payload.ideaCandidates ?? [])
      .filter((record) => typeof record?.id === 'string' && record.id.trim().length > 0)
      .map((record) => [record.id, record] as const)
  );

  if (stage === 'curated-opportunity') {
    const opportunity = (payload.curatedOpportunities ?? []).find((record) => record.id === id);
    if (!opportunity) {
      return null;
    }
    const candidate = candidateLookup.get(opportunity.ideaCandidateId) ?? null;
    const proto = candidate ? protoLookup.get(candidate.protoIdeaId) ?? null : null;
    const source = proto ? sourceLookup.get(proto.sourceId) ?? null : null;
    return {
      record: {
        id: opportunity.id,
        title: opportunity.title,
        stage,
        stageLabel: 'Curated Opportunity',
        summary: opportunity.summary || opportunity.valueProposition,
        earlyMonetizationIdea: opportunity.earlyMonetizationIdea
      },
      lineage: [
        ...(source?.sourceTitle ? [{ label: 'Source', title: source.sourceTitle, url: source.sourceUrl }] : []),
        ...(proto ? [{ label: 'Proto-Idea', title: proto.title }] : []),
        ...(candidate ? [{ label: 'Idea Candidate', title: candidate.opportunityConcept || candidate.protoIdeaTitle || candidate.id }] : [])
      ],
      tags: flattenTagLabels(opportunity.tagsJson),
      metadata: compactMetadata([
        ['Target customer', opportunity.targetCustomer],
        ['Readiness', opportunity.readinessLabel],
        ['Duplicate risk', opportunity.duplicateRiskLabel],
        ['Promoted at', opportunity.promotedAt],
        ['Source', source?.sourceTitle ?? null]
      ]),
      details: compactDetails([
        `Problem statement: ${opportunity.problemStatement}`,
        `Value proposition: ${opportunity.valueProposition}`,
        `Product / service: ${opportunity.productServiceDescription}`,
        `Differentiation: ${opportunity.differentiation}`,
        `Strongest aspect: ${opportunity.strongestAspect}`,
        `Biggest risk: ${opportunity.biggestRisk}`,
        `Next best action: ${opportunity.nextBestAction}`,
        `Promotion reason: ${opportunity.promotionReason}`
      ])
    };
  }

  if (stage === 'idea-candidate') {
    const candidate = candidateLookup.get(id) ?? null;
    if (!candidate) {
      return null;
    }
    const proto = protoLookup.get(candidate.protoIdeaId) ?? null;
    const source = proto ? sourceLookup.get(proto.sourceId) ?? null : null;
    return {
      record: {
        id: candidate.id,
        title: candidate.opportunityConcept || candidate.protoIdeaTitle || 'Idea candidate',
        stage,
        stageLabel: 'Idea Candidate',
        summary: candidate.improvementSummary || candidate.valueProposition || candidate.problemStatement,
        earlyMonetizationIdea: null
      },
      lineage: [
        ...(source?.sourceTitle ? [{ label: 'Source', title: source.sourceTitle, url: source.sourceUrl }] : []),
        ...(proto ? [{ label: 'Proto-Idea', title: proto.title }] : [])
      ],
      tags: flattenTagLabels(candidate.evaluationPayloadJson),
      metadata: compactMetadata([
        ['Target customer', candidate.targetCustomer],
        ['Workflow state', candidate.workflowState ?? null],
        ['Readiness', candidate.evaluationReadinessLabel ?? null],
        ['Duplicate risk', candidate.evaluationDuplicateRiskLabel ?? null],
        ['Source', source?.sourceTitle ?? null]
      ]),
      details: compactDetails([
        `Problem statement: ${candidate.problemStatement}`,
        `Value proposition: ${candidate.valueProposition}`,
        `Opportunity concept: ${candidate.opportunityConcept}`,
        `Differentiation: ${candidate.differentiation}`,
        `Improvement summary: ${candidate.improvementSummary}`,
        candidate.evaluationStrongestAspect ? `Strongest aspect: ${candidate.evaluationStrongestAspect}` : '',
        candidate.evaluationBiggestRisk ? `Biggest risk: ${candidate.evaluationBiggestRisk}` : '',
        candidate.evaluationBlockingIssue ? `Blocking issue: ${candidate.evaluationBlockingIssue}` : ''
      ])
    };
  }

  const proto = protoLookup.get(id) ?? null;
  if (!proto) {
    return null;
  }
  const source = sourceLookup.get(proto.sourceId) ?? null;
  return {
    record: {
      id: proto.id,
      title: proto.title,
      stage,
      stageLabel: 'Proto-Idea',
      summary: proto.problemStatement || proto.opportunityHypothesis,
      earlyMonetizationIdea: null
    },
    lineage: source?.sourceTitle ? [{ label: 'Source', title: source.sourceTitle, url: source.sourceUrl }] : [],
    tags: [],
    metadata: compactMetadata([
      ['Target customer', proto.targetCustomer],
      ['Opportunity type', proto.opportunityType],
      ['Confidence', proto.agentConfidence],
      ['Source', source?.sourceTitle ?? null]
    ]),
    details: compactDetails([
      `Problem statement: ${proto.problemStatement}`,
      `Opportunity hypothesis: ${proto.opportunityHypothesis}`,
      `Why it matters: ${proto.whyItMatters}`,
      ...proto.explicitSignals.map((signal) => `Explicit signal: ${signal}`),
      ...proto.inferredSignals.map((signal) => `Inferred signal: ${signal}`)
    ])
  };
}

function flattenTagLabels(input: unknown): string[] {
  const container = isRecord(input) && isRecord(input['tags']) ? input['tags'] : input;
  if (!isRecord(container)) {
    return [];
  }

  return Object.values(container)
    .flatMap((values) =>
      Array.isArray(values)
        ? values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : []
    )
    .map(humanizeToken);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function humanizeToken(value: string): string {
  return value
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function compactMetadata(entries: Array<[string, string | null | undefined]>): Array<{ label: string; value: string }> {
  return entries
    .filter((entry) => typeof entry[1] === 'string' && entry[1].trim().length > 0)
    .map(([label, value]) => ({ label, value: value!.trim() }));
}

function compactDetails(entries: string[]): string[] {
  return entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}
