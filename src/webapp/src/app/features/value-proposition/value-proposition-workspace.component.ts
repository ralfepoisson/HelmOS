import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { IdeationOverview, IdeationSection } from '../ideation/ideation.models';
import { IdeationSectionCardComponent } from '../ideation/ideation-section-card.component';

@Component({
  selector: 'app-value-proposition-workspace',
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
            <span class="workspace-kicker">Guided value proposition canvas</span>
            <h1 class="workspace-title">{{ title }}</h1>
            <p class="workspace-copy mb-0">
              Clarify the customer profile, value map, and the fit between them. The agent keeps pressure on weak assumptions and gaps in the canvas.
            </p>
          </div>

          <div class="workspace-insights">
            <div class="insight-card">
              <div class="insight-label-row">
                <span class="insight-label">Canvas quality</span>
                <span class="insight-value">Canvas quality: {{ overview.completeness }}%</span>
              </div>
              <div class="progress workspace-progress" role="progressbar" [attr.aria-valuenow]="overview.completeness" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-bar" [style.width.%]="overview.completeness"></div>
              </div>
              <p class="insight-copy mb-0">{{ overview.completionSummary }}</p>
            </div>

            <div class="insight-card next-action-card">
              <span class="insight-label">Best next question</span>
              <p class="next-action-copy mb-0">{{ overview.nextAction }}</p>
            </div>
          </div>
        </div>
      </div>

      <section class="canvas-panel helmos-card p-4">
        <div class="canvas-header">
          <div>
            <span class="canvas-kicker">Customer profile</span>
            <h2>Customer Profile</h2>
          </div>
          <p class="canvas-copy mb-0">Be specific about who the customer is, what they need to get done, and what makes their current reality painful or desirable.</p>
        </div>

        <div class="profile-grid">
          <app-ideation-section-card
            *ngFor="let section of customerProfileSections; trackBy: trackBySectionId"
            [section]="section"
          />
        </div>
      </section>

      <section class="canvas-panel helmos-card p-4">
        <div class="canvas-header">
          <div>
            <span class="canvas-kicker">Value map</span>
            <h2>Value Map</h2>
          </div>
          <p class="canvas-copy mb-0">Describe the offer itself and show how it reduces pains and creates gains for the chosen customer profile.</p>
        </div>

        <div class="value-map-grid">
          <app-ideation-section-card
            *ngFor="let section of valueMapSections; trackBy: trackBySectionId"
            [section]="section"
          />
        </div>
      </section>

      <div class="section-stack">
        <app-ideation-section-card
          *ngFor="let section of diagnosticSections; trackBy: trackBySectionId"
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

      .workspace-header,
      .canvas-panel {
        position: relative;
        overflow: hidden;
      }

      .workspace-header {
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
        background: radial-gradient(circle, rgba(32, 140, 107, 0.14), transparent 70%);
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

      .workspace-kicker,
      .canvas-kicker {
        display: inline-block;
        color: #12715a;
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

      .workspace-copy,
      .canvas-copy {
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

      .insight-label-row,
      .canvas-header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 1rem;
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
        background: rgba(18, 113, 90, 0.1);
        margin: 0.65rem 0;
      }

      .workspace-progress .progress-bar {
        background: linear-gradient(90deg, #12715a, #47a88c);
        border-radius: 999px;
      }

      .insight-copy,
      .next-action-copy {
        color: var(--helmos-muted);
        line-height: 1.55;
      }

      .canvas-panel {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 251, 248, 0.95));
        border: 1px solid rgba(210, 224, 218, 0.9);
      }

      .canvas-header h2 {
        margin: 0.3rem 0 0;
        font-size: 1.3rem;
      }

      .profile-grid,
      .value-map-grid {
        margin-top: 1rem;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
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
        .profile-grid,
        .value-map-grid,
        .canvas-header {
          grid-template-columns: 1fr;
          display: grid;
        }
      }
    `
  ]
})
export class ValuePropositionWorkspaceComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) status!: string;
  @Input({ required: true }) overview!: IdeationOverview;
  @Input({ required: true }) sections: IdeationSection[] = [];

  get customerProfileSections(): IdeationSection[] {
    return this.sections.filter((section) =>
      ['customer-segments', 'customer-jobs', 'customer-pains', 'customer-gains'].includes(section.id)
    );
  }

  get valueMapSections(): IdeationSection[] {
    return this.sections.filter((section) =>
      ['products-services', 'pain-relievers', 'gain-creators'].includes(section.id)
    );
  }

  get diagnosticSections(): IdeationSection[] {
    return this.sections.filter((section) => ['fit-assessment', 'analysis'].includes(section.id));
  }

  trackBySectionId(_: number, section: IdeationSection): string {
    return section.id;
  }
}
