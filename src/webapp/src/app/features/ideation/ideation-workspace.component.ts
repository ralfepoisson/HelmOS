import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IdeationOverview, IdeationSection } from './ideation.models';
import { IdeationSectionCardComponent } from './ideation-section-card.component';

@Component({
  selector: 'app-ideation-workspace',
  standalone: true,
  imports: [CommonModule, IdeationSectionCardComponent],
  template: `
    <section class="workspace-column">
      <div class="workspace-header helmos-card p-4 p-xl-4">
        <div class="workspace-badges">
          <span class="badge rounded-pill readiness-badge" [class.readiness-warning]="overview.readinessTone === 'warning'">
            {{ overview.readinessLabel }}
          </span>
          <span class="badge rounded-pill document-badge">{{ status }}</span>
        </div>

        <div class="workspace-header-content">
          <div>
            <span class="workspace-kicker">Guided ideation workspace</span>
            <h1 class="workspace-title">{{ title }}</h1>
            <p class="workspace-copy mb-0">
              Shape the business concept in conversation with the agent. Each section is editable and evolves as the discussion becomes more concrete.
            </p>
          </div>

          <div class="workspace-insights">
            <div class="insight-card">
              <div class="insight-label-row">
                <span class="insight-label">Ideation completeness</span>
                <span class="insight-value">Ideation completeness: {{ overview.completeness }}%</span>
              </div>
              <div class="progress workspace-progress" role="progressbar" [attr.aria-valuenow]="overview.completeness" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-bar" [style.width.%]="overview.completeness"></div>
              </div>
              <p class="insight-copy mb-0">{{ overview.completionSummary }}</p>
            </div>

            <div class="insight-card next-action-card">
              <span class="insight-label">Best next action</span>
              <p class="next-action-copy mb-0">{{ overview.nextAction }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="primary-section-grid">
        <app-ideation-section-card
          *ngFor="let section of primarySections; trackBy: trackBySectionId"
          [section]="section"
        />
      </div>

      <div class="section-stack secondary-section-stack">
        <app-ideation-section-card
          *ngFor="let section of secondarySections; trackBy: trackBySectionId"
          [section]="section"
        />
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .workspace-column {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .workspace-header {
        position: relative;
        overflow: hidden;
        padding-right: 13rem !important;
      }

      .workspace-header::after {
        content: '';
        position: absolute;
        right: -80px;
        top: -80px;
        width: 220px;
        height: 220px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(31, 111, 235, 0.12), transparent 70%);
      }

      .workspace-badges {
        position: absolute;
        top: 1.5rem;
        right: 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.55rem;
        z-index: 1;
      }

      .workspace-kicker {
        display: inline-block;
        color: var(--helmos-accent);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
      }

      .workspace-title {
        margin: 0.5rem 0 0.35rem;
        font-size: clamp(1.5rem, 2vw, 2rem);
        font-weight: 700;
        letter-spacing: -0.03em;
      }

      .workspace-copy {
        max-width: 52rem;
        color: var(--helmos-muted);
      }

      .readiness-badge {
        background: #edf9f2;
        color: #18794e;
        padding: 0.55rem 0.85rem;
      }

      .readiness-warning {
        background: #fff6e9;
        color: #9a6700;
      }

      .document-badge {
        background: rgba(255, 255, 255, 0.9);
        color: var(--helmos-text);
        border: 1px solid rgba(108, 124, 148, 0.35);
        padding: 0.45rem 0.8rem;
      }

      .workspace-insights {
        margin-top: 1.25rem;
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
        gap: 1rem;
      }

      .insight-card {
        padding: 1rem 1.05rem;
        border-radius: 1rem;
        background: rgba(248, 251, 255, 0.88);
        border: 1px solid rgba(219, 228, 238, 0.96);
      }

      .insight-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.55rem;
      }

      .insight-label {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--helmos-muted);
      }

      .insight-value {
        font-weight: 700;
        color: var(--helmos-text);
      }

      .workspace-progress {
        height: 0.6rem;
        border-radius: 999px;
        background: rgba(31, 111, 235, 0.08);
        margin-bottom: 0.65rem;
      }

      .workspace-progress .progress-bar {
        background: linear-gradient(90deg, #1f6feb, #68a0ff);
        border-radius: 999px;
      }

      .insight-copy,
      .next-action-copy {
        color: var(--helmos-muted);
        line-height: 1.55;
      }

      .next-action-card {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(249, 251, 255, 0.98));
      }

      .primary-section-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .secondary-section-stack {
        gap: 0.95rem;
      }

      .section-stack {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      @media (max-width: 991.98px) {
        .workspace-header {
          padding-right: 1.5rem !important;
          padding-top: 6.5rem !important;
        }

        .workspace-badges {
          left: 1.5rem;
          right: auto;
          align-items: flex-start;
        }

        .workspace-insights,
        .primary-section-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class IdeationWorkspaceComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) status!: string;
  @Input({ required: true }) overview!: IdeationOverview;
  @Input({ required: true }) sections: IdeationSection[] = [];

  get primarySections(): IdeationSection[] {
    return this.sections.filter((section) => section.emphasis === 'primary');
  }

  get secondarySections(): IdeationSection[] {
    return this.sections.filter((section) => section.emphasis === 'secondary');
  }

  trackBySectionId(_: number, section: IdeationSection): string {
    return section.id;
  }
}
