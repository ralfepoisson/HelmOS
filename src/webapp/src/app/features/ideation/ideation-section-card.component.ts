import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IdeationSection } from './ideation.models';

@Component({
  selector: 'app-ideation-section-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <article
      class="card border-0 helmos-card section-card"
      [class.primary-card]="section.emphasis === 'primary'"
      [class.recent-update]="section.recentlyUpdated"
      [class.needs-attention]="section.needsAttention"
    >
      <div class="card-body p-4">
        <div class="d-flex flex-column flex-md-row gap-3 justify-content-between align-items-start mb-3">
          <div>
            <h3 class="section-title">{{ section.title }}</h3>
            <p class="section-helper mb-0">{{ section.helper }}</p>
          </div>
          <div class="section-status-wrap">
            <span class="section-state badge rounded-pill" [ngClass]="'state-' + section.statusTone">
              {{ section.statusLabel }}
            </span>
            <span class="section-confidence">Agent confidence: {{ section.confidence }}</span>
          </div>
        </div>

        <textarea
          class="form-control section-editor"
          rows="5"
          [(ngModel)]="section.content"
          [attr.aria-label]="section.title"
        ></textarea>

        <div class="section-history">
          <span class="history-copy">Updated by {{ section.updatedBy }} {{ section.updatedAgo }}</span>
          <button type="button" class="btn btn-outline-secondary btn-sm history-action">View changes</button>
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .section-card {
        overflow: hidden;
        border: 1px solid rgba(219, 228, 238, 0.96);
        transition: box-shadow 0.18s ease, border-color 0.18s ease;
      }

      .primary-card {
        min-height: 100%;
      }

      .recent-update {
        border-color: rgba(31, 111, 235, 0.34);
        box-shadow: 0 10px 28px rgba(31, 111, 235, 0.09);
      }

      .needs-attention:not(.recent-update) {
        border-color: rgba(217, 164, 65, 0.35);
      }

      .section-title {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
      }

      .primary-card .section-title {
        font-size: 1.18rem;
      }

      .section-helper {
        margin-top: 0.35rem;
        color: var(--helmos-muted);
        max-width: 44rem;
      }

      .section-status-wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.35rem;
      }

      .section-state {
        padding: 0.45rem 0.8rem;
      }

      .section-confidence {
        font-size: 0.77rem;
        color: var(--helmos-muted);
      }

      .state-success {
        background: #edf9f2;
        color: #18794e;
      }

      .state-warning {
        background: #fff5e8;
        color: #9a6700;
      }

      .state-info {
        background: #eef5ff;
        color: #1f6feb;
      }

      .state-muted {
        background: #f3f5f8;
        color: #66758b;
      }

      .section-editor {
        min-height: 150px;
        border-radius: 1rem;
        padding: 1rem 1.05rem;
        background: linear-gradient(180deg, #fcfdff 0%, #f8fbff 100%);
        line-height: 1.65;
        resize: vertical;
      }

      .primary-card .section-editor {
        min-height: 190px;
      }

      .section-history {
        margin-top: 0.85rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
      }

      .history-copy {
        font-size: 0.82rem;
        color: var(--helmos-muted);
      }

      .history-action {
        border-radius: 999px;
      }
    `
  ]
})
export class IdeationSectionCardComponent {
  @Input({ required: true }) section!: IdeationSection;
}
