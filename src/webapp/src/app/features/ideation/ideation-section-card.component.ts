import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';

import { IdeationSection } from './ideation.models';

@Component({
  selector: 'app-ideation-section-card',
  standalone: true,
  imports: [CommonModule, FormsModule, FaIconComponent],
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

        <ng-container *ngIf="isEditing; else renderedView">
          <textarea
            class="form-control section-editor"
            rows="7"
            [(ngModel)]="draftContent"
            [attr.aria-label]="section.title"
          ></textarea>
          <div class="section-edit-actions">
            <button type="button" class="btn btn-primary btn-sm px-3" (click)="saveEdits()">Save</button>
            <button type="button" class="btn btn-outline-secondary btn-sm px-3" (click)="cancelEdits()">Cancel</button>
          </div>
        </ng-container>

        <ng-template #renderedView>
          <div class="section-content-markdown" [innerHTML]="renderMarkdown(section.content)"></div>
        </ng-template>

        <div class="section-history">
          <span class="history-copy">Updated by {{ section.updatedBy }} {{ section.updatedAgo }}</span>
          <div class="history-actions">
            <button
              *ngIf="!isEditing"
              type="button"
              class="btn btn-outline-secondary btn-sm history-action"
              (click)="startEditing()"
            >
              <fa-icon [icon]="editIcon"></fa-icon>
              <span>Edit</span>
            </button>
            <button
              *ngIf="!isEditing"
              type="button"
              class="btn btn-outline-secondary btn-sm history-action"
            >
              View changes
            </button>
          </div>
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

      .section-content-markdown {
        min-height: 150px;
        border: 1px solid rgba(219, 228, 238, 0.96);
        border-radius: 1rem;
        padding: 1rem 1.05rem;
        background: linear-gradient(180deg, #fcfdff 0%, #f8fbff 100%);
        line-height: 1.7;
        white-space: normal;
      }

      .primary-card .section-content-markdown {
        min-height: 190px;
      }

      .section-content-markdown :is(p, ul) {
        margin: 0 0 0.85rem;
      }

      .section-content-markdown p:last-child,
      .section-content-markdown ul:last-child {
        margin-bottom: 0;
      }

      .section-content-markdown ul {
        padding-left: 1.2rem;
      }

      .section-content-markdown code {
        border-radius: 0.45rem;
        padding: 0.1rem 0.35rem;
        background: rgba(108, 124, 148, 0.08);
        color: #20314c;
      }

      .section-content-markdown .markdown-empty {
        color: var(--helmos-muted);
      }

      .section-edit-actions {
        margin-top: 0.75rem;
        display: flex;
        justify-content: flex-end;
        gap: 0.65rem;
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

      .history-actions {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }

      .history-action {
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
      }
    `
  ]
})
export class IdeationSectionCardComponent {
  readonly editIcon = faPenToSquare;
  @Input({ required: true }) section!: IdeationSection;
  isEditing = false;
  draftContent = '';

  renderMarkdown(content: string): string {
    const normalized = (content ?? '').replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return '<p class="markdown-empty">No draft yet. Use the agent to turn the first assumptions into a working section draft.</p>';
    }

    const lines = normalized.split('\n');
    const blocks: string[] = [];
    let paragraphLines: string[] = [];
    let listItems: string[] = [];

    const flushParagraph = (): void => {
      if (!paragraphLines.length) {
        return;
      }
      blocks.push(`<p>${this.applyInlineMarkdown(paragraphLines.join(' '))}</p>`);
      paragraphLines = [];
    };

    const flushList = (): void => {
      if (!listItems.length) {
        return;
      }
      blocks.push(`<ul>${listItems.map((item) => `<li>${this.applyInlineMarkdown(item)}</li>`).join('')}</ul>`);
      listItems = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        flushParagraph();
        listItems.push(line.replace(/^[-*]\s+/, ''));
        continue;
      }

      flushList();
      paragraphLines.push(line);
    }

    flushParagraph();
    flushList();

    return blocks.join('');
  }

  startEditing(): void {
    this.draftContent = this.section.content;
    this.isEditing = true;
  }

  saveEdits(): void {
    this.section.content = this.draftContent.trim();
    this.isEditing = false;
  }

  cancelEdits(): void {
    this.draftContent = this.section.content;
    this.isEditing = false;
  }

  private applyInlineMarkdown(content: string): string {
    return this.escapeHtml(content)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  private escapeHtml(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
