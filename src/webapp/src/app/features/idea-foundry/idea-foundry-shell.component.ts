import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';

interface IdeaFoundryNavItem {
  label: string;
  route: string;
  helper: string;
}

@Component({
  selector: 'app-idea-foundry-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      surfaceLabel="Idea Foundry"
      [saveStatus]="shell.saveStatus"
      [showWorkspaceSwitcher]="false"
    />

    <main class="idea-foundry-shell container-fluid">
      <div class="row g-0 shell-grid">
        <aside class="col-12 col-lg-3 col-xl-2 section-nav-column">
          <div class="section-nav-panel">
            <div class="section-nav-header">
              <span class="section-kicker">Idea Foundry</span>
              <h1>Opportunity pipeline</h1>
              <p>Move from raw source material to curated opportunities through a staged refinement workflow.</p>
            </div>

            <nav aria-label="Idea Foundry sections" class="section-nav-list">
              <a
                *ngFor="let item of navItems"
                class="section-nav-link"
                [routerLink]="item.route"
                routerLinkActive="section-nav-link-active"
                [routerLinkActiveOptions]="item.route === '/idea-foundry' ? exactMatchOptions : subsetMatchOptions"
              >
                <span class="section-nav-label">{{ item.label }}</span>
                <span class="section-nav-helper">{{ item.helper }}</span>
              </a>
            </nav>
          </div>
        </aside>

        <section class="col-12 col-lg-9 col-xl-10 content-column">
          <router-outlet />
        </section>
      </div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .idea-foundry-shell {
        padding: 68px 0 0;
        min-height: 100vh;
      }

      .shell-grid {
        min-height: calc(100vh - 68px);
      }

      .section-nav-column {
        align-self: stretch;
      }

      .section-nav-panel {
        position: sticky;
        top: 68px;
        height: calc(100vh - 68px);
        overflow: auto;
        padding: 1.35rem 1rem 1.2rem;
        border-right: 1px solid rgba(219, 228, 238, 0.95);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(247, 251, 255, 0.98)),
          linear-gradient(180deg, rgba(255, 232, 110, 0.15), transparent 32%);
      }

      .section-nav-header h1 {
        margin: 0.4rem 0 0.45rem;
        font-size: 1.35rem;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .section-nav-header p {
        margin: 0;
        color: var(--helmos-muted);
        line-height: 1.55;
        font-size: 0.92rem;
      }

      .section-kicker {
        display: inline-block;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #7a6400;
      }

      .section-nav-list {
        display: grid;
        gap: 0.75rem;
        margin-top: 1.1rem;
      }

      .section-nav-link {
        display: block;
        padding: 0.95rem 1rem;
        border-radius: 1rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(255, 255, 255, 0.86);
        color: inherit;
        text-decoration: none;
        transition:
          transform 160ms ease,
          border-color 160ms ease,
          box-shadow 160ms ease,
          background 160ms ease;
      }

      .section-nav-link:hover,
      .section-nav-link-active {
        transform: translateY(-1px);
        border-color: rgba(255, 206, 0, 0.55);
        background: linear-gradient(180deg, rgba(255, 248, 196, 0.92), rgba(255, 255, 255, 0.98));
        box-shadow: 0 16px 30px rgba(121, 100, 0, 0.08);
      }

      .section-nav-label {
        display: block;
        font-weight: 700;
        color: var(--helmos-text);
      }

      .section-nav-helper {
        display: block;
        margin-top: 0.25rem;
        color: var(--helmos-muted);
        font-size: 0.82rem;
        line-height: 1.45;
      }

      .content-column {
        padding: 1.2rem;
      }

      @media (min-width: 992px) {
        .content-column {
          padding: 1.5rem;
        }
      }

      @media (max-width: 991.98px) {
        .idea-foundry-shell {
          min-height: auto;
        }

        .section-nav-panel {
          position: static;
          height: auto;
          border-right: 0;
          border-bottom: 1px solid rgba(219, 228, 238, 0.95);
        }
      }
    `
  ]
})
export class IdeaFoundryShellComponent {
  readonly exactMatchOptions = { exact: true };
  readonly subsetMatchOptions = { exact: false };
  readonly navItems: IdeaFoundryNavItem[] = [
    {
      label: 'Overview',
      route: '/idea-foundry',
      helper: 'Track how ideas move across the refinement pipeline.'
    },
    {
      label: 'Search',
      route: '/idea-foundry/search',
      helper: 'Search by stage and tags, then open an idea profile with lineage and metadata.'
    },
    {
      label: 'Prospecting Configuration',
      route: '/idea-foundry/prospecting-configuration',
      helper: 'Define the source mix, search strategy, and signal gathering rules.'
    },
    {
      label: 'Proto-Idea Extraction',
      route: '/idea-foundry/proto-idea-extraction',
      helper: 'Normalize raw signals into early, structured opportunity fragments.'
    },
    {
      label: 'Idea Refinement',
      route: '/idea-foundry/idea-refinement',
      helper: 'Strengthen weak ideas through challenge, enrichment, and restructuring.'
    },
    {
      label: 'Idea Evaluation',
      route: '/idea-foundry/idea-evaluator',
      helper: 'Apply progression checks before opportunities graduate to Strategy Copilot.'
    }
  ];

  constructor(readonly shell: WorkspaceShellService) {}
}
