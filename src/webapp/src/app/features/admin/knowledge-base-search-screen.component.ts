import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import {
  KnowledgeBaseAdminService,
  KnowledgeBaseSearchResult,
  KnowledgeBaseSummary
} from './knowledge-base-admin.service';

@Component({
  selector: 'app-knowledge-base-search-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      [surfaceLabel]="'Semantic retrieval search'"
      [saveStatus]="searching ? 'Searching knowledge base…' : 'Knowledge search ready'"
      [showWorkspaceSwitcher]="false"
    />

    <main class="search-shell container-fluid">
      <section class="hero-card helmos-card">
        <div>
          <div class="section-kicker">Admin</div>
          <h1>Knowledge Base Search</h1>
          <p>Run semantic search across all indexed knowledge or narrow the scope to a specific partition.</p>
        </div>
        <a class="btn btn-outline-secondary" routerLink="/admin/knowledge-bases">Manage knowledge bases</a>
      </section>

      <section class="filters-card helmos-card">
        <div class="search-row">
          <div class="field-group field-group-grow">
            <span class="field-label">Query</span>
            <input
              class="form-control"
              [(ngModel)]="query"
              placeholder="Search uploaded knowledge with a natural-language question"
              (keyup.enter)="runSearch()"
            />
          </div>

          <div class="field-group">
            <span class="field-label">Knowledge base</span>
            <select class="form-select" [(ngModel)]="selectedKnowledgeBaseId">
              <option value="">All knowledge bases</option>
              <option *ngFor="let knowledgeBase of knowledgeBases" [value]="knowledgeBase.id">
                {{ knowledgeBase.name }}
              </option>
            </select>
          </div>

          <div class="field-group">
            <span class="field-label">Media type</span>
            <select class="form-select" [(ngModel)]="selectedMediaType">
              <option value="">All media</option>
              <option value="text">Text</option>
              <option value="document">Document</option>
              <option value="image">Image</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
          </div>
        </div>

        <div class="search-row">
          <div class="field-group field-group-grow">
            <span class="field-label">Tags</span>
            <input class="form-control" [(ngModel)]="tagInput" placeholder="optional, comma-separated filters" />
          </div>

          <div class="field-group field-limit">
            <span class="field-label">Limit</span>
            <input class="form-control" [(ngModel)]="limit" type="number" min="1" max="25" />
          </div>

          <div class="actions-row">
            <button class="btn btn-primary" type="button" [disabled]="searching || !query.trim()" (click)="runSearch()">
              {{ searching ? 'Searching…' : 'Search knowledge' }}
            </button>
          </div>
        </div>
      </section>

      <section *ngIf="errorMessage" class="state-card helmos-card" role="alert">{{ errorMessage }}</section>

      <section *ngIf="results.length === 0 && searched" class="state-card helmos-card">
        <div class="section-kicker">No results</div>
        <h2>No matching chunks were found</h2>
        <p>Try broadening the query, removing filters, or uploading additional content into the selected knowledge base.</p>
      </section>

      <section *ngIf="results.length > 0" class="results-grid">
        <article class="result-card helmos-card" *ngFor="let result of results">
          <div class="result-header">
            <div>
              <div class="section-kicker">{{ result.knowledgeBaseName }}</div>
              <h2>{{ result.filename }}</h2>
            </div>
            <div class="score-pill">{{ result.score | number: '1.2-2' }}</div>
          </div>

          <div class="result-meta">
            Chunk {{ result.chunkIndex + 1 }} · {{ result.mimeType }} · {{ formatDate(result.submittedAt) }}
          </div>

          <p>{{ result.chunkSummary || result.chunkText }}</p>

          <div class="tag-row" *ngIf="result.tags.length > 0">
            <span class="tag-chip" *ngFor="let tag of result.tags">{{ tag }}</span>
          </div>

          <a class="btn btn-sm btn-light" [routerLink]="['/admin/knowledge-bases', result.knowledgeBaseId]">
            Open knowledge base
          </a>
        </article>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .search-shell {
        padding: 92px 1rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .hero-card,
      .filters-card,
      .state-card,
      .result-card {
        padding: 1rem 1.1rem;
      }

      .hero-card,
      .search-row,
      .result-header {
        display: flex;
        gap: 1rem;
      }

      .hero-card,
      .result-header {
        justify-content: space-between;
        align-items: flex-start;
      }

      .filters-card {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        min-width: 0;
      }

      .field-group-grow {
        flex: 1 1 auto;
      }

      .field-limit {
        width: 8rem;
      }

      .actions-row {
        display: flex;
        align-items: flex-end;
      }

      .results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
      }

      .result-card {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .section-kicker,
      .field-label,
      .result-meta {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--helmos-muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      h1,
      h2 {
        margin: 0.25rem 0 0.35rem;
        letter-spacing: -0.03em;
      }

      p {
        margin: 0;
        color: var(--helmos-text);
      }

      .score-pill,
      .tag-chip {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.25rem 0.58rem;
        font-size: 0.74rem;
        font-weight: 700;
      }

      .score-pill {
        color: var(--helmos-accent);
        background: rgba(31, 111, 235, 0.12);
      }

      .tag-row {
        display: flex;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .tag-chip {
        background: rgba(31, 111, 235, 0.08);
        color: var(--helmos-accent);
      }

      @media (max-width: 991.98px) {
        .hero-card,
        .search-row,
        .result-header {
          flex-direction: column;
        }
      }
    `
  ]
})
export class KnowledgeBaseSearchScreenComponent implements OnInit {
  readonly shell = inject(WorkspaceShellService);
  private readonly service = inject(KnowledgeBaseAdminService);

  knowledgeBases: KnowledgeBaseSummary[] = [];
  results: KnowledgeBaseSearchResult[] = [];
  query = '';
  tagInput = '';
  selectedKnowledgeBaseId = '';
  selectedMediaType = '';
  limit = 10;
  searching = false;
  searched = false;
  errorMessage = '';

  async ngOnInit(): Promise<void> {
    try {
      this.knowledgeBases = await this.service.listKnowledgeBases();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to load knowledge base filters.';
    }
  }

  async runSearch(): Promise<void> {
    this.searching = true;
    this.errorMessage = '';

    try {
      this.results = await this.service.search({
        query: this.query.trim(),
        knowledgeBaseIds: this.selectedKnowledgeBaseId ? [this.selectedKnowledgeBaseId] : [],
        tags: this.tagInput
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
        mediaTypes: this.selectedMediaType
          ? [this.selectedMediaType as 'text' | 'document' | 'image' | 'audio' | 'video']
          : [],
        limit: this.limit
      });
      this.searched = true;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to search the knowledge base.';
    } finally {
      this.searching = false;
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }
}
