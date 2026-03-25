import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBullseye,
  faChartLine,
  faCompass,
  faGem,
  faLightbulb,
  faPeopleGroup,
  faProjectDiagram,
  faTableCellsLarge
} from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

import { BusinessIdeasApiService } from '../../core/services/business-ideas-api.service';
import { WorkspaceOption, WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { AgentChatService } from '../ideation/services/agent-chat.service';
import { StrategyCopilotShellComponent } from './strategy-copilot-shell.component';

@Component({
  selector: 'app-strategy-copilot-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FaIconComponent, StrategyCopilotShellComponent],
  template: `
    <app-strategy-copilot-shell
      [productName]="shell.productName"
      [workspaces]="workspaces"
      [selectedWorkspaceId]="selectedWorkspaceId"
      [saveStatus]="shell.saveStatus"
      [primaryTools]="primaryTools"
      [laterTools]="laterTools"
      [guidanceTitle]="guidanceTitle"
      [guidanceCopy]="guidanceCopy"
      [panelTitle]="chat.panelTitle"
      [panelSubtitle]="chat.panelSubtitle"
      [placeholder]="chat.placeholder"
      [messages]="messages"
      (workspaceChange)="handleWorkspaceSelection($event)"
    >
      <section class="copilot-home">
        <header class="home-hero helmos-card p-4 p-xl-4">
          <div class="hero-copy">
            <span class="hero-kicker">Strategy Copilot</span>
            <h1 class="hero-title">Choose the next strategy tool for this workspace</h1>
            <p class="hero-text mb-0">
              Move through a guided sequence of strategy tools. Each workspace keeps the shared menu, central artefacts, and persistent agent collaboration in sync as the strategy becomes more mature.
            </p>
          </div>
        </header>

        <section class="tool-grid" aria-label="Strategy tool directory">
          <article
            *ngFor="let tool of allTools; trackBy: trackByToolId"
            class="tool-card helmos-card"
            [class.tool-card-locked]="tool.status === 'locked'"
          >
            <div class="tool-card-head">
              <div class="tool-card-icon">
                <fa-icon [icon]="iconMap[tool.icon]"></fa-icon>
              </div>
              <span class="badge rounded-pill" [class.text-bg-primary]="tool.status === 'available'" [class.locked-badge]="tool.status === 'locked'">
                {{ tool.status === 'available' ? 'Available now' : 'Locked' }}
              </span>
            </div>

            <h2 class="tool-card-title">{{ tool.label }}</h2>
            <p class="tool-card-copy">{{ tool.description }}</p>
            <p class="tool-card-helper mb-0">{{ tool.helper }}</p>

            <a
              *ngIf="tool.route; else unavailableTool"
              class="btn btn-primary tool-card-link"
              [routerLink]="tool.route"
              queryParamsHandling="merge"
            >
              Open {{ tool.label }}
            </a>

            <ng-template #unavailableTool>
              <button type="button" class="btn btn-outline-secondary tool-card-link" disabled>
                Coming soon
              </button>
            </ng-template>
          </article>
        </section>
      </section>
    </app-strategy-copilot-shell>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .copilot-home {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .home-hero {
        position: relative;
        overflow: hidden;
      }

      .home-hero::after {
        content: '';
        position: absolute;
        inset: auto -60px -70px auto;
        width: 220px;
        height: 220px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(31, 111, 235, 0.14), transparent 70%);
      }

      .hero-copy {
        position: relative;
        z-index: 1;
        max-width: 48rem;
      }

      .hero-kicker {
        display: inline-block;
        color: var(--helmos-accent);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
      }

      .hero-title {
        margin: 0.5rem 0 0.45rem;
        font-size: clamp(1.7rem, 2.6vw, 2.35rem);
        font-weight: 700;
        letter-spacing: -0.03em;
      }

      .hero-text,
      .tool-card-copy,
      .tool-card-helper {
        color: var(--helmos-muted);
        line-height: 1.6;
      }

      .tool-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .tool-card {
        padding: 1.2rem;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }

      .tool-card-locked {
        background: rgba(255, 255, 255, 0.82);
      }

      .tool-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .tool-card-icon {
        width: 3rem;
        height: 3rem;
        border-radius: 1rem;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, rgba(234, 242, 255, 0.96), rgba(248, 251, 255, 0.98));
        border: 1px solid rgba(31, 111, 235, 0.16);
        color: var(--helmos-accent);
        font-size: 1.05rem;
      }

      .locked-badge {
        background: #eef2f7;
        color: #7d8aa0;
      }

      .tool-card-title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
      }

      .tool-card-copy,
      .tool-card-helper {
        margin: 0;
      }

      .tool-card-link {
        align-self: flex-start;
        margin-top: auto;
      }

      @media (max-width: 991.98px) {
        .tool-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class StrategyCopilotHomeComponent {
  readonly destroyRef = inject(DestroyRef);
  readonly guidanceTitle = 'Start with ideation';
  readonly guidanceCopy =
    'Ideation is the first unlocked tool in Strategy Copilot. As the concept becomes clearer, HelmOS can open the next structured strategy tools.';
  readonly iconMap: Record<string, IconDefinition> = {
    spark: faLightbulb,
    diamond: faGem,
    people: faPeopleGroup,
    grid: faTableCellsLarge,
    chart: faChartLine,
    stack: faProjectDiagram,
    target: faBullseye,
    compass: faCompass
  };

  readonly primaryTools;
  readonly laterTools;
  readonly allTools;
  readonly messages;
  workspaces: WorkspaceOption[] = [];
  selectedWorkspaceId = '';
  private backendIdeasAvailable = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly businessIdeasApi: BusinessIdeasApiService,
    readonly shell: WorkspaceShellService,
    readonly chat: AgentChatService
  ) {
    this.primaryTools = this.shell.strategyTools.filter((tool) => tool.group === 'core');
    this.laterTools = this.shell.strategyTools.filter((tool) => tool.group === 'later');
    this.allTools = this.shell.strategyTools;
    this.messages = this.chat.getMessages();
    this.workspaces = this.shell.getDemoWorkspaces();
    this.selectedWorkspaceId = this.shell.getDemoWorkspaces()[0]?.id ?? '';

    void this.refreshWorkspaceOptions();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyWorkspaceSelection(params.get('workspaceId'));
    });
  }

  async handleWorkspaceSelection(workspaceId: string): Promise<void> {
    if (workspaceId === this.shell.newIdeaOption.id) {
      await this.router.navigate(['/strategy-copilot/new-idea']);
      return;
    }

    await this.router.navigate([], {
      queryParams: { workspaceId },
      queryParamsHandling: 'merge'
    });
  }

  trackByToolId(_: number, tool: { id: string }): string {
    return tool.id;
  }

  private async refreshWorkspaceOptions(preferredWorkspaceId?: string): Promise<void> {
    try {
      const ideas = await this.businessIdeasApi.listBusinessIdeas();
      this.backendIdeasAvailable = true;
      this.workspaces = [...ideas.map((idea) => ({ id: idea.id, name: idea.name })), this.shell.newIdeaOption];

      const routeWorkspaceId = this.route.snapshot.queryParamMap.get('workspaceId');
      const activeWorkspaceId = preferredWorkspaceId ?? routeWorkspaceId;

      if (!activeWorkspaceId && ideas.length > 0) {
        await this.router.navigate([], {
          queryParams: { workspaceId: ideas[0].id },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
        return;
      }

      this.applyWorkspaceSelection(activeWorkspaceId);
    } catch {
      this.backendIdeasAvailable = false;
      this.workspaces = this.shell.getDemoWorkspaces();
      this.applyWorkspaceSelection(this.route.snapshot.queryParamMap.get('workspaceId'));
    }
  }

  private applyWorkspaceSelection(workspaceId: string | null): void {
    const selectedWorkspace = this.workspaces.find((option) => option.id === workspaceId && option.id !== 'new');

    if (selectedWorkspace) {
      this.selectedWorkspaceId = selectedWorkspace.id;
      return;
    }

    const fallbackWorkspace = this.workspaces.find((option) => option.id !== 'new');
    this.selectedWorkspaceId = fallbackWorkspace?.id ?? '';

    if (workspaceId === 'new' && this.backendIdeasAvailable) {
      this.selectedWorkspaceId = workspaceId;
    }
  }
}
