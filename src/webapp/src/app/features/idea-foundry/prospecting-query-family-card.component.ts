import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { QueryFamily } from './prospecting-configuration.models';

@Component({
  selector: 'app-prospecting-query-family-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="query-family-card">
      <div class="query-family-top">
        <div class="query-family-copy">
          <div class="badge-row">
            <span class="status-pill" [class.status-pill-muted]="family.status !== 'Active'">{{ family.status }}</span>
            <span class="confidence-pill">{{ family.confidence }}</span>
            <span class="rank-pill">Priority {{ family.priorityRank }}</span>
          </div>
          <h3>{{ family.title }}</h3>
          <p>{{ family.intent }}</p>
        </div>
        <button type="button" class="btn btn-link query-toggle" (click)="toggleExpand.emit(family.id)">
          {{ family.expanded ? 'Collapse' : 'Expand' }}
        </button>
      </div>

      <div class="query-meta-grid">
        <div>
          <span class="meta-label">Theme link</span>
          <div class="meta-value">{{ family.themeLink }}</div>
        </div>
        <div>
          <span class="meta-label">Source applicability</span>
          <div class="meta-value">{{ family.sourceApplicability.join(' • ') }}</div>
        </div>
      </div>

      <div *ngIf="family.expanded" class="query-expanded">
        <div class="query-list-block">
          <span class="meta-label">Representative queries</span>
          <ul>
            <li *ngFor="let query of family.representativeQueries">{{ query }}</li>
          </ul>
        </div>

        <div class="query-actions">
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="duplicate.emit(family.id)">Duplicate</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="togglePause.emit(family.id)">
            {{ family.status === 'Paused' ? 'Resume' : 'Pause' }}
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="edit.emit(family.id)">Edit</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="boost.emit(family.id)">Boost priority</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="demote.emit(family.id)">Demote</button>
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      .query-family-card {
        padding: 1rem;
        border-radius: 1rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(255, 255, 255, 0.88);
      }

      .query-family-top {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }

      .badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        margin-bottom: 0.5rem;
      }

      .status-pill,
      .confidence-pill,
      .rank-pill {
        display: inline-flex;
        align-items: center;
        min-height: 1.7rem;
        padding: 0 0.55rem;
        border-radius: 999px;
        font-size: 0.73rem;
        font-weight: 800;
      }

      .status-pill {
        background: rgba(225, 246, 234, 0.92);
        color: #177245;
      }

      .status-pill-muted {
        background: rgba(234, 242, 255, 0.92);
        color: var(--helmos-accent);
      }

      .confidence-pill,
      .rank-pill {
        background: rgba(245, 247, 251, 0.95);
        color: #506079;
      }

      .query-family-copy h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 800;
      }

      .query-family-copy p,
      .meta-value,
      .query-list-block li {
        color: var(--helmos-muted);
        line-height: 1.6;
      }

      .query-family-copy p {
        margin: 0.35rem 0 0;
      }

      .query-toggle {
        padding: 0;
        font-weight: 700;
        text-decoration: none;
      }

      .query-meta-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
        margin-top: 0.9rem;
      }

      .meta-label {
        display: block;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--helmos-accent);
        margin-bottom: 0.22rem;
      }

      .query-expanded {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(219, 228, 238, 0.95);
      }

      .query-list-block ul {
        margin: 0;
        padding-left: 1.15rem;
      }

      .query-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        margin-top: 0.9rem;
      }

      @media (max-width: 767.98px) {
        .query-meta-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class ProspectingQueryFamilyCardComponent {
  @Input({ required: true }) family!: QueryFamily;
  @Output() readonly toggleExpand = new EventEmitter<string>();
  @Output() readonly duplicate = new EventEmitter<string>();
  @Output() readonly togglePause = new EventEmitter<string>();
  @Output() readonly edit = new EventEmitter<string>();
  @Output() readonly boost = new EventEmitter<string>();
  @Output() readonly demote = new EventEmitter<string>();
}
