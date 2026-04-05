import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface IdeaPipelineCard {
  title: string;
  summary: string;
  signal: string;
  status: string;
}

interface IdeaPipelineColumn {
  id: string;
  title: string;
  helper: string;
  cards: IdeaPipelineCard[];
}

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
        <div>
          <span class="section-kicker">Overview</span>
          <h3>Pipeline board</h3>
          <p>
            This view follows the opportunity flow from incoming source material through to curated opportunities ready
            for deeper strategy work.
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
            <span class="pipeline-count">{{ column.cards.length }}</span>
          </header>

          <div class="pipeline-card-list">
            <article *ngFor="let card of column.cards" class="pipeline-card">
              <span class="pipeline-card-status">{{ card.status }}</span>
              <h5>{{ card.title }}</h5>
              <p>{{ card.summary }}</p>
              <div class="pipeline-card-meta">{{ card.signal }}</div>
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
        padding: 0.1rem 0.1rem 0;
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

      .pipeline-card h5 {
        margin: 0.6rem 0 0.35rem;
        font-size: 0.98rem;
        font-weight: 700;
      }

      .pipeline-card-meta {
        margin-top: 0.65rem;
        padding-top: 0.65rem;
        border-top: 1px solid rgba(219, 228, 238, 0.95);
        font-size: 0.8rem;
        color: #445167;
      }

    `
  ]
})
export class IdeaFoundryOverviewComponent {
  readonly columns: IdeaPipelineColumn[] = [
    {
      id: 'sources',
      title: 'Sources',
      helper: 'Raw market signals and observed needs entering the pipeline.',
      cards: [
        {
          title: 'Freelancer tax workflow complaints',
          summary: 'Repeated forum posts about fragmented VAT, invoicing, and quarterly filing workflows across Europe.',
          signal: 'Signal: niche ops pain with recurring compliance pressure',
          status: 'Captured'
        },
        {
          title: 'Clinic staffing bottleneck thread',
          summary: 'Practice managers compare manual rota coordination, agency spend, and late-shift coverage failures.',
          signal: 'Signal: urgent scheduling friction with budget sensitivity',
          status: 'Normalized'
        }
      ]
    },
    {
      id: 'proto-ideas',
      title: 'Proto-Ideas',
      helper: 'Early opportunity fragments extracted from the strongest signals.',
      cards: [
        {
          title: 'Compliance co-pilot for solo operators',
          summary: 'Translate scattered filing tasks into a lightweight workflow assistant for one-person businesses.',
          signal: 'Focus: reduce mental load around recurring compliance work',
          status: 'Extracted'
        },
        {
          title: 'Shift-coverage orchestration layer',
          summary: 'Coordinate internal availability and agency fallback for short-notice clinical staffing gaps.',
          signal: 'Focus: recover revenue lost to canceled appointments',
          status: 'Structured'
        }
      ]
    },
    {
      id: 'idea-candidates',
      title: 'Idea Candidates',
      helper: 'Strengthened opportunities being challenged, expanded, and differentiated.',
      cards: [
        {
          title: 'EU freelancer compliance cockpit',
          summary: 'A regional workflow layer combining filing reminders, evidence capture, and accountant handoff.',
          signal: 'Refinement: sharpen wedge around cross-border freelancers',
          status: 'In refinement'
        },
        {
          title: 'Clinic fill-rate recovery platform',
          summary: 'Turn staffing volatility into a triage dashboard that protects appointment capacity.',
          signal: 'Refinement: test buyer urgency and procurement complexity',
          status: 'Quality check'
        }
      ]
    },
    {
      id: 'curated-opportunities',
      title: 'Curated Opportunities',
      helper: 'Higher-confidence opportunities that look ready for downstream strategy work.',
      cards: [
        {
          title: 'Managed onboarding ops for AI-heavy B2B SaaS',
          summary: 'Service-plus-software opportunity aimed at reducing stalled enterprise onboarding after sales close.',
          signal: 'Outcome: recommended for Strategy Copilot handoff',
          status: 'Promoted'
        }
      ]
    }
  ];
}
