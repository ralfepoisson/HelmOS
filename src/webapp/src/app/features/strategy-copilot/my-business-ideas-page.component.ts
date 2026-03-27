import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, map, of, tap } from 'rxjs';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { BusinessIdeasApiService } from '../../core/services/business-ideas-api.service';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { BusinessIdeaOption } from '../ideation/ideation.models';

interface BusinessIdeasViewModel {
  ideas: BusinessIdeaOption[];
  loading: boolean;
  errorMessage: string;
}

@Component({
  selector: 'app-my-business-ideas-page',
  standalone: true,
  imports: [CommonModule, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      surfaceLabel="Strategy Copilot"
      [saveStatus]="shell.saveStatus"
      [showWorkspaceSwitcher]="false"
    />

    <main class="business-ideas-page">
      <section class="ideas-shell">
        <header class="ideas-header">
          <div class="header-copy">
            <p class="eyebrow">My Business Ideas</p>
            <h1 class="page-title">Pick the idea you want to shape next.</h1>
            <p class="page-subtitle">
              Every workspace keeps its strategy tools, artefacts, and agent collaboration in one place.
            </p>
          </div>

          <button type="button" class="new-idea-button" (click)="createNewIdea()">
            + New Business Idea
          </button>
        </header>

        <ng-container *ngIf="ideasViewModel$ | async as viewModel">
          <p *ngIf="viewModel.errorMessage" class="error-message" role="alert">
            {{ viewModel.errorMessage }}
          </p>

          <section *ngIf="viewModel.ideas.length > 0; else loadingOrEmpty" class="ideas-grid" aria-label="Business ideas">
            <button
              *ngFor="let idea of viewModel.ideas; trackBy: trackByIdeaId"
              type="button"
              class="idea-card"
              (click)="openIdea(idea)"
            >
              <span class="idea-card-label">{{ idea.businessTypeLabel }}</span>
              <h2 class="idea-card-title">{{ idea.name }}</h2>
              <p class="idea-card-helper">Open this workspace in Strategy Copilot.</p>
            </button>
          </section>

          <ng-template #loadingOrEmpty>
            <section class="empty-state helmos-card" *ngIf="viewModel.loading; else emptyState">
              <p class="empty-title">Loading your business ideas...</p>
            </section>
            <ng-template #emptyState>
              <section class="empty-state helmos-card">
                <p class="empty-title">You do not have any business ideas yet.</p>
                <button type="button" class="empty-action" (click)="createNewIdea()">Create your first idea</button>
              </section>
            </ng-template>
          </ng-template>
        </ng-container>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(241, 122, 74, 0.12), transparent 30%),
          radial-gradient(circle at top right, rgba(31, 111, 235, 0.12), transparent 28%),
          linear-gradient(180deg, #f8fbff 0%, #f5f7fb 100%);
      }

      .business-ideas-page {
        min-height: 100vh;
        padding: 96px 1.5rem 2rem;
      }

      .ideas-shell {
        width: min(1160px, 100%);
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .ideas-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
      }

      .header-copy {
        max-width: 44rem;
      }

      .eyebrow {
        margin: 0 0 0.7rem;
        color: #f17a4a;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .page-title {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1.05;
        letter-spacing: -0.05em;
      }

      .page-subtitle {
        margin: 0.85rem 0 0;
        max-width: 40rem;
        color: var(--helmos-muted);
        font-size: 1rem;
        line-height: 1.7;
      }

      .new-idea-button {
        flex: 0 0 auto;
        min-height: 3.5rem;
        border: 0;
        border-radius: 1rem;
        padding: 0 1.4rem;
        background: linear-gradient(135deg, #f17a4a 0%, #f4b048 100%);
        color: #fff;
        font-size: 1rem;
        font-weight: 800;
        box-shadow: 0 20px 40px rgba(241, 122, 74, 0.24);
        transition:
          transform 160ms ease,
          box-shadow 160ms ease;
      }

      .new-idea-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 24px 44px rgba(241, 122, 74, 0.3);
      }

      .ideas-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 1rem;
      }

      .idea-card {
        border: 1px solid rgba(31, 111, 235, 0.14);
        border-radius: 1.4rem;
        padding: 1.25rem;
        background: rgba(255, 255, 255, 0.92);
        text-align: left;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
        transition:
          transform 160ms ease,
          box-shadow 160ms ease,
          border-color 160ms ease;
      }

      .idea-card:hover {
        transform: translateY(-2px);
        border-color: rgba(31, 111, 235, 0.28);
        box-shadow: 0 24px 46px rgba(31, 111, 235, 0.12);
      }

      .idea-card-label {
        display: inline-flex;
        margin-bottom: 0.8rem;
        border-radius: 999px;
        padding: 0.35rem 0.65rem;
        background: rgba(234, 242, 255, 0.96);
        color: var(--helmos-accent);
        font-size: 0.76rem;
        font-weight: 700;
      }

      .idea-card-title {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .idea-card-helper {
        margin: 0.75rem 0 0;
        color: var(--helmos-muted);
        line-height: 1.6;
      }

      .empty-state {
        padding: 1.5rem;
      }

      .empty-title {
        margin: 0;
        font-size: 1rem;
      }

      .empty-action {
        margin-top: 1rem;
        min-height: 2.8rem;
        border: 0;
        border-radius: 999px;
        padding: 0 1rem;
        background: linear-gradient(135deg, #1f6feb 0%, #4b8bff 100%);
        color: #fff;
        font-weight: 700;
      }

      .error-message {
        margin: 0;
        color: #b42318;
      }

      @media (max-width: 767.98px) {
        .business-ideas-page {
          padding-inline: 1rem;
        }

        .ideas-header {
          flex-direction: column;
        }

        .new-idea-button {
          width: 100%;
          justify-content: center;
        }
      }
    `
  ]
})
export class MyBusinessIdeasPageComponent {
  selectedWorkspaceId = '';
  readonly ideasViewModel$;

  constructor(
    private readonly router: Router,
    private readonly businessIdeasApi: BusinessIdeasApiService,
    readonly shell: WorkspaceShellService
  ) {
    this.ideasViewModel$ = from(this.businessIdeasApi.listBusinessIdeas()).pipe(
      tap(async (ideas) => {
        if (ideas.length === 0) {
          await this.createNewIdea();
          return;
        }

        this.selectedWorkspaceId = ideas[0].id;
      }),
      map<BusinessIdeaOption[], BusinessIdeasViewModel>((ideas) => ({
        ideas,
        loading: false,
        errorMessage: ''
      })),
      catchError(() =>
        of<BusinessIdeasViewModel>({
          ideas: [],
          loading: false,
          errorMessage: 'HelmOS could not load your business ideas. Make sure the backend is running and try again.'
        })
      )
    );
  }

  trackByIdeaId(_: number, idea: BusinessIdeaOption): string {
    return idea.id;
  }

  async createNewIdea(): Promise<void> {
    await this.router.navigate(['/strategy-copilot/new-idea']);
  }

  async openIdea(idea: BusinessIdeaOption): Promise<void> {
    this.selectedWorkspaceId = idea.id;
    await this.router.navigate(['/strategy-copilot'], {
      queryParams: { workspaceId: idea.id }
    });
  }
}
