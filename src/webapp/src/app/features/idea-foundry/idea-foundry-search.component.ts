import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  CuratedOpportunityRecord,
  IdeaCandidateRecord,
  IdeaFoundryApiService,
  IdeaFoundryPipelineContentsResponse,
  ProtoIdeaRecord,
  ProtoIdeaSourceRecord
} from './idea-foundry-api.service';

type SearchStage = 'proto-idea' | 'idea-candidate' | 'curated-opportunity';

interface SearchResultRecord {
  id: string;
  stage: SearchStage;
  stageLabel: string;
  title: string;
  summary: string;
  sourceTitle: string | null;
  tags: Record<string, string[]>;
}

interface SearchTagGroup {
  facet: string;
  label: string;
  values: Array<{ value: string; label: string }>;
}

@Component({
  selector: 'app-idea-foundry-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="search-page">
      <header class="search-hero helmos-card">
        <span class="hero-kicker">Search</span>
        <h1>Search across proto-ideas, refined candidates, and curated opportunities</h1>
        <p>
          Jump across the Idea Foundry record graph without losing lineage. Search uses titles, summaries, source
          context, and evaluation tags to help operators find the right opportunity faster.
        </p>

        <div class="search-controls">
          <input
            type="search"
            class="form-control"
            [(ngModel)]="queryDraft"
            (keyup.enter)="applySearch()"
            placeholder="Search by concept, customer, source, or tag"
            aria-label="Search Idea Foundry records"
          />
          <button type="button" class="btn btn-primary" (click)="applySearch()" [disabled]="isLoading">
            Search
          </button>
        </div>

        <div class="filters-toggle-row">
          <button type="button" class="filters-toggle" (click)="showFilters = !showFilters">
            Filters
          </button>
          <span class="filters-count" *ngIf="activeFilterCount > 0">{{ activeFilterCount }} active</span>
        </div>

        <p *ngIf="loadError" class="hero-error">{{ loadError }}</p>
      </header>

      <section *ngIf="showFilters" class="filter-panel helmos-card">
        <div class="filter-header">
          <span class="section-kicker">Filters</span>
          <p>Trim the result set by pipeline stage and persisted evaluation tags.</p>
        </div>

        <div class="filter-group">
          <span class="filter-label">Stages</span>
          <div class="chip-row">
            <button
              *ngFor="let stage of stageOptions"
              type="button"
              class="filter-chip"
              [class.filter-chip-active]="activeStages.has(stage.value)"
              (click)="toggleStage(stage.value)"
            >
              {{ stage.label }}
            </button>
          </div>
        </div>

        <div class="filter-group" *ngFor="let group of tagGroups">
          <span class="filter-label">{{ group.label }}</span>
          <div class="chip-row">
            <button
              *ngFor="let tag of group.values"
              type="button"
              class="filter-chip"
              [class.filter-chip-active]="isTagActive(group.facet, tag.value)"
              (click)="toggleTag(group.facet, tag.value)"
            >
              {{ tag.label }}
            </button>
          </div>
        </div>
      </section>

      <section class="results-grid">
        <a
          *ngFor="let record of results"
          class="result-card helmos-card"
          data-testid="idea-search-card"
          [routerLink]="['/idea-foundry/idea-profile', record.stage, record.id]"
        >
          <span class="stage-pill">{{ record.stageLabel }}</span>
          <h2>{{ record.title }}</h2>
          <p>{{ record.summary }}</p>
          <div class="meta-line" *ngIf="record.sourceTitle">Source: {{ record.sourceTitle }}</div>
          <div class="tag-line" *ngIf="flattenedTagLabels(record).length">
            {{ flattenedTagLabels(record).join(' · ') }}
          </div>
        </a>

        <article *ngIf="!isLoading && results.length === 0" class="result-card helmos-card empty-state">
          <span class="stage-pill">No matches</span>
          <h2>No records match the current search</h2>
          <p>Try a broader query, remove a tag filter, or re-open additional pipeline stages.</p>
        </article>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .search-page {
        display: grid;
        gap: 1rem;
      }

      .search-hero,
      .filter-panel,
      .result-card {
        padding: 1.25rem;
      }

      .search-hero {
        border: 1px solid rgba(255, 206, 0, 0.18);
        background:
          linear-gradient(135deg, rgba(255, 250, 209, 0.92), rgba(255, 255, 255, 0.98) 48%),
          rgba(255, 255, 255, 0.95);
      }

      .hero-kicker,
      .section-kicker,
      .filter-label {
        display: inline-block;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero-kicker {
        color: #7a6400;
      }

      .search-hero h1 {
        margin: 0.45rem 0 0.55rem;
        font-size: clamp(1.8rem, 2.8vw, 2.5rem);
        line-height: 1.06;
        letter-spacing: -0.04em;
        font-weight: 800;
      }

      .search-hero p,
      .filter-header p,
      .result-card p {
        margin: 0;
        color: var(--helmos-muted);
        line-height: 1.6;
      }

      .search-controls {
        display: flex;
        gap: 0.75rem;
        margin-top: 1rem;
        flex-wrap: wrap;
      }

      .search-controls .form-control {
        flex: 1 1 18rem;
      }

      .filters-toggle-row {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        margin-top: 0.65rem;
      }

      .filters-toggle {
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--helmos-muted);
        font-size: 0.88rem;
        font-weight: 700;
      }

      .filters-count {
        color: var(--helmos-muted);
        font-size: 0.8rem;
      }

      .filter-panel {
        display: grid;
        gap: 0.9rem;
      }

      .filter-group {
        display: grid;
        gap: 0.4rem;
      }

      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .filter-chip {
        padding: 0.45rem 0.8rem;
        border-radius: 999px;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(255, 255, 255, 0.92);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .filter-chip-active {
        border-color: rgba(255, 206, 0, 0.55);
        background: rgba(255, 248, 196, 0.92);
      }

      .results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 1rem;
      }

      .result-card {
        text-decoration: none;
        color: inherit;
        border: 1px solid rgba(219, 228, 238, 0.95);
        transition:
          transform 160ms ease,
          box-shadow 160ms ease,
          border-color 160ms ease;
      }

      .result-card:hover {
        transform: translateY(-1px);
        border-color: rgba(255, 206, 0, 0.38);
        box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
      }

      .stage-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.28rem 0.58rem;
        border-radius: 999px;
        background: rgba(23, 34, 53, 0.08);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .result-card h2 {
        margin: 0.7rem 0 0.45rem;
        font-size: 1.08rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .meta-line,
      .tag-line {
        margin-top: 0.7rem;
        color: var(--helmos-muted);
        font-size: 0.84rem;
        line-height: 1.5;
      }

      .hero-error {
        margin-top: 0.8rem;
        color: #b42318;
      }
    `
  ]
})
export class IdeaFoundrySearchComponent implements OnInit {
  private readonly ideaFoundryApi = inject(IdeaFoundryApiService);

  isLoading = true;
  loadError = '';
  queryDraft = '';
  showFilters = false;
  results: SearchResultRecord[] = [];
  readonly stageOptions = [
    { value: 'proto-idea' as const, label: 'Proto-Idea' },
    { value: 'idea-candidate' as const, label: 'Idea Candidate' },
    { value: 'curated-opportunity' as const, label: 'Curated Opportunity' }
  ];

  private allResults: SearchResultRecord[] = [];
  private committedQuery = '';
  readonly activeStages = new Set<SearchStage>();
  private readonly activeTags = new Map<string, Set<string>>();
  tagGroups: SearchTagGroup[] = [];

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      const payload = await this.ideaFoundryApi.getIdeaFoundryContents();
      this.allResults = buildSearchResults(payload);
      this.tagGroups = buildTagGroups(this.allResults);
      this.applySearch();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unable to load Idea Foundry search records.';
    } finally {
      this.isLoading = false;
    }
  }

  applySearch(): void {
    this.committedQuery = this.queryDraft.trim().toLowerCase();
    this.results = this.allResults.filter((record) => this.matchesFilters(record));
  }

  toggleStage(stage: SearchStage): void {
    if (this.activeStages.has(stage)) {
      this.activeStages.delete(stage);
    } else {
      this.activeStages.add(stage);
    }
    this.applySearch();
  }

  toggleTag(facet: string, value: string): void {
    const existing = this.activeTags.get(facet) ?? new Set<string>();
    if (existing.has(value)) {
      existing.delete(value);
    } else {
      existing.add(value);
    }

    if (existing.size === 0) {
      this.activeTags.delete(facet);
    } else {
      this.activeTags.set(facet, existing);
    }

    this.applySearch();
  }

  isTagActive(facet: string, value: string): boolean {
    return this.activeTags.get(facet)?.has(value) ?? false;
  }

  flattenedTagLabels(record: SearchResultRecord): string[] {
    return Object.values(record.tags).flat().map(humanizeToken);
  }

  get activeFilterCount(): number {
    return this.activeStages.size + Array.from(this.activeTags.values()).reduce((total, values) => total + values.size, 0);
  }

  private matchesFilters(record: SearchResultRecord): boolean {
    if (this.activeStages.size > 0 && !this.activeStages.has(record.stage)) {
      return false;
    }

    for (const [facet, values] of this.activeTags.entries()) {
      const recordValues = record.tags[facet] ?? [];
      if (!recordValues.some((value) => values.has(value))) {
        return false;
      }
    }

    if (!this.committedQuery) {
      return true;
    }

    const haystack = [
      record.title,
      record.summary,
      record.sourceTitle,
      ...Object.values(record.tags).flat()
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .toLowerCase();

    return haystack.includes(this.committedQuery);
  }
}

function buildSearchResults(payload: IdeaFoundryPipelineContentsResponse): SearchResultRecord[] {
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

  return [
    ...(payload.protoIdeas ?? []).map((record) => ({
      id: record.id,
      stage: 'proto-idea' as const,
      stageLabel: 'Proto-Idea',
      title: record.title,
      summary: record.problemStatement || record.opportunityHypothesis,
      sourceTitle: sourceLookup.get(record.sourceId)?.sourceTitle ?? null,
      tags: {}
    })),
    ...(payload.ideaCandidates ?? []).map((record) => ({
      id: record.id,
      stage: 'idea-candidate' as const,
      stageLabel: 'Idea Candidate',
      title: record.protoIdeaTitle || record.opportunityConcept || 'Idea candidate',
      summary: record.improvementSummary || record.valueProposition || record.problemStatement,
      sourceTitle: record.sourceTitle ?? sourceLookup.get(protoLookup.get(record.protoIdeaId)?.sourceId ?? '')?.sourceTitle ?? null,
      tags: extractTagMap(record.evaluationPayloadJson)
    })),
    ...(payload.curatedOpportunities ?? []).map((record) =>
      mapOpportunityToSearchRecord(record, payload.ideaCandidates ?? [], protoLookup, sourceLookup)
    )
  ];
}

function mapOpportunityToSearchRecord(
  record: CuratedOpportunityRecord,
  candidates: IdeaCandidateRecord[],
  protoLookup: Map<string, ProtoIdeaRecord>,
  sourceLookup: Map<string, ProtoIdeaSourceRecord>
): SearchResultRecord {
  const candidate = candidates.find((item) => item.id === record.ideaCandidateId);
  const proto = candidate ? protoLookup.get(candidate.protoIdeaId) : null;
  return {
    id: record.id,
    stage: 'curated-opportunity',
    stageLabel: 'Curated Opportunity',
    title: record.title,
    summary: record.summary || record.valueProposition,
    sourceTitle: candidate?.sourceTitle ?? (proto ? sourceLookup.get(proto.sourceId)?.sourceTitle ?? null : null),
    tags: extractTagMap(record.tagsJson)
  };
}

function buildTagGroups(records: SearchResultRecord[]): SearchTagGroup[] {
  const grouped = new Map<string, Set<string>>();
  for (const record of records) {
    for (const [facet, values] of Object.entries(record.tags)) {
      const bucket = grouped.get(facet) ?? new Set<string>();
      for (const value of values) {
        bucket.add(value);
      }
      grouped.set(facet, bucket);
    }
  }

  return Array.from(grouped.entries())
    .map(([facet, values]) => ({
      facet,
      label: humanizeToken(facet),
      values: Array.from(values)
        .sort((left, right) => left.localeCompare(right))
        .map((value) => ({ value, label: humanizeToken(value) }))
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function extractTagMap(input: unknown): Record<string, string[]> {
  const container = isRecord(input) && isRecord(input['tags']) ? input['tags'] : input;
  if (!isRecord(container)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(container)
      .map(([facet, values]) => [
        facet,
        Array.isArray(values)
          ? values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : []
      ])
      .filter((entry) => entry[1].length > 0)
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function humanizeToken(value: string): string {
  return value
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
