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
import { StrategyTool, WorkspaceOption, WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { ChatMessage } from '../ideation/ideation.models';
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
      [showWorkspaceSwitcher]="workspaceOptionsReady"
      [primaryTools]="primaryTools"
      [laterTools]="laterTools"
      [guidanceTitle]="guidanceTitle"
      [guidanceCopy]="guidanceCopy"
      [panelTitle]="panelTitle"
      [panelSubtitle]="panelSubtitle"
      [placeholder]="placeholder"
      [messages]="messages"
      (workspaceChange)="handleWorkspaceSelection($event)"
    >
      <section class="copilot-home">
        <p *ngIf="workspaceErrorMessage" class="workspace-feedback workspace-feedback-error" role="alert">
          {{ workspaceErrorMessage }}
        </p>
        <p *ngIf="!workspaceOptionsReady && !workspaceErrorMessage" class="workspace-feedback" aria-live="polite">
          Loading your business ideas...
        </p>

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

      .workspace-feedback {
        margin: 0;
        color: var(--helmos-muted);
      }

      .workspace-feedback-error {
        color: #b42318;
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
        border: 1px solid rgba(31, 111, 235, 0.12);
        box-shadow: 0 18px 38px rgba(15, 23, 42, 0.06);
      }

      .tool-card-locked {
        background: linear-gradient(180deg, rgba(246, 248, 252, 0.96), rgba(241, 244, 249, 0.96));
        border-color: rgba(148, 163, 184, 0.18);
        box-shadow: none;
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

      .tool-card-locked .tool-card-icon {
        background: linear-gradient(180deg, rgba(243, 246, 251, 0.98), rgba(239, 243, 248, 0.98));
        border-color: rgba(148, 163, 184, 0.18);
        color: #94a3b8;
      }

      .locked-badge {
        background: rgba(226, 232, 240, 0.72);
        color: #94a3b8;
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

      .tool-card-locked .tool-card-title {
        color: #475569;
      }

      .tool-card-locked .tool-card-copy,
      .tool-card-locked .tool-card-helper {
        color: #7c8aa0;
      }

      .tool-card-link {
        align-self: flex-start;
        margin-top: auto;
      }

      .tool-card-locked .tool-card-link {
        border-color: rgba(148, 163, 184, 0.45);
        background: rgba(255, 255, 255, 0.72);
        color: #94a3b8;
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

  primaryTools: StrategyTool[];
  laterTools: StrategyTool[];
  allTools: StrategyTool[];
  panelTitle: string;
  panelSubtitle: string;
  placeholder: string;
  messages: ChatMessage[];
  workspaces: WorkspaceOption[] = [];
  selectedWorkspaceId = '';
  workspaceOptionsReady = false;
  workspaceErrorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly businessIdeasApi: BusinessIdeasApiService,
    readonly shell: WorkspaceShellService,
    readonly chat: AgentChatService
  ) {
    const initialTools = this.shell.getStrategyTools();
    this.primaryTools = initialTools.filter((tool) => tool.group === 'core');
    this.laterTools = initialTools.filter((tool) => tool.group === 'later');
    this.allTools = initialTools;
    this.panelTitle = this.chat.panelTitle;
    this.panelSubtitle = this.chat.panelSubtitle;
    this.placeholder = this.chat.placeholder;
    this.messages = this.chat.getMessages();

    void this.refreshWorkspaceOptions();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      void this.applyWorkspaceSelection(params.get('workspaceId'));
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
    this.workspaceOptionsReady = false;
    this.workspaceErrorMessage = '';

    try {
      const ideas = await this.businessIdeasApi.listBusinessIdeas();
      if (ideas.length === 0) {
        await this.router.navigate(['/strategy-copilot/new-idea'], { replaceUrl: true });
        return;
      }

      this.workspaces = [...ideas.map((idea) => ({ id: idea.id, name: idea.name })), this.shell.newIdeaOption];
      this.workspaceOptionsReady = true;

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

      void this.applyWorkspaceSelection(activeWorkspaceId);
    } catch {
      this.workspaces = [];
      this.selectedWorkspaceId = '';
      this.workspaceErrorMessage =
        'HelmOS could not load your business ideas. Make sure the backend is running and try again.';
    }
  }

  private async applyWorkspaceSelection(workspaceId: string | null): Promise<void> {
    const selectedWorkspace = this.workspaces.find((option) => option.id === workspaceId && option.id !== 'new');

    if (selectedWorkspace) {
      this.selectedWorkspaceId = selectedWorkspace.id;
      await this.loadWorkspaceTools(selectedWorkspace.id);
      return;
    }

    const fallbackWorkspace = this.workspaces.find((option) => option.id !== 'new');
    this.selectedWorkspaceId = fallbackWorkspace?.id ?? '';
    if (fallbackWorkspace) {
      await this.loadWorkspaceTools(fallbackWorkspace.id);
    }

    if (workspaceId === 'new' && this.workspaceOptionsReady) {
      this.selectedWorkspaceId = workspaceId;
    }
  }

  private async loadWorkspaceTools(workspaceId: string): Promise<void> {
    try {
      const strategyCopilot = await this.businessIdeasApi.getBusinessIdea(workspaceId);
      const tools = this.shell.getStrategyTools(strategyCopilot.workspace.availableToolIds);
      this.primaryTools = tools.filter((tool) => tool.group === 'core');
      this.laterTools = tools.filter((tool) => tool.group === 'later');
      this.allTools = tools;
      this.panelTitle = strategyCopilot.chat.panelTitle;
      this.panelSubtitle = strategyCopilot.chat.panelSubtitle;
      this.placeholder = strategyCopilot.chat.placeholder;
      this.messages = strategyCopilot.chat.messages;
    } catch {
      const fallbackTools = this.shell.getStrategyTools();
      this.primaryTools = fallbackTools.filter((tool) => tool.group === 'core');
      this.laterTools = fallbackTools.filter((tool) => tool.group === 'later');
      this.allTools = fallbackTools;
      this.panelTitle = this.chat.panelTitle;
      this.panelSubtitle = this.chat.panelSubtitle;
      this.placeholder = this.chat.placeholder;
      this.messages = this.chat.getMessages();
    }
  }
}
