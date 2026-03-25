import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { BusinessIdeasApiService } from '../../core/services/business-ideas-api.service';
import { WorkspaceOption, WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { IdeationWorkspaceComponent } from './ideation-workspace.component';
import { IdeationWorkspaceService } from './services/ideation-workspace.service';
import { AgentChatService } from './services/agent-chat.service';
import {
  ChatMessage,
  IdeationAgentResponsePayload,
  IdeationAgentSectionPayload,
  IdeationOverview,
  IdeationSection,
  StrategyCopilotData
} from './ideation.models';
import { AgentGatewayApiService, RunSummaryResponse } from './services/agent-gateway-api.service';
import { StrategyCopilotShellComponent } from '../strategy-copilot/strategy-copilot-shell.component';

@Component({
  selector: 'app-ideation-screen',
  standalone: true,
  imports: [CommonModule, StrategyCopilotShellComponent, IdeationWorkspaceComponent],
  template: `
    <ng-container *ngIf="screenReady; else loadingState">
      <app-strategy-copilot-shell
        [productName]="shell.productName"
        [workspaces]="workspaces"
        [selectedWorkspaceId]="selectedWorkspaceId"
        [saveStatus]="shell.saveStatus"
        [primaryTools]="primaryTools"
        [laterTools]="laterTools"
        activeToolId="ideation"
        [guidanceTitle]="completionHintTitle"
        [guidanceCopy]="completionHint"
        [panelTitle]="panelTitle"
        [panelSubtitle]="panelSubtitle"
        [placeholder]="placeholder"
        [messages]="messages"
        [isSending]="isSendingAgentMessage"
        (workspaceChange)="handleWorkspaceSelection($event)"
        (messageSend)="handleAgentMessage($event)"
      >
        <app-ideation-workspace
          [title]="pageTitle"
          [status]="pageStatus"
          [overview]="overview"
          [sections]="sections"
        />
      </app-strategy-copilot-shell>
    </ng-container>

    <ng-template #loadingState>
      <section class="ideation-loading-state">
        <p class="mb-0">Loading the ideation workspace...</p>
      </section>
    </ng-template>
  `,
  styles: [
    `
      .ideation-loading-state {
        min-height: 100vh;
        display: grid;
        place-items: center;
        color: var(--helmos-muted);
        font-size: 0.95rem;
      }
    `
  ]
})
export class IdeationScreenComponent implements OnInit {
  private readonly sectionBlueprints: Array<Pick<IdeationSection, 'id' | 'title' | 'helper' | 'emphasis'>> = [
    {
      id: 'problem-statement',
      title: 'Problem Statement',
      helper: 'Describe the pain, inefficiency, or unmet need the business should solve.',
      emphasis: 'primary'
    },
    {
      id: 'target-customer',
      title: 'Target Customer',
      helper: 'Clarify the first users or buyers who feel this problem most acutely.',
      emphasis: 'primary'
    },
    {
      id: 'value-proposition',
      title: 'Value Proposition',
      helper: 'Explain why this concept is useful and what meaningful outcome it creates.',
      emphasis: 'primary'
    },
    {
      id: 'product-service-description',
      title: 'Product / Service Description',
      helper: 'Summarise what the product does today and what the user experiences on the platform.',
      emphasis: 'secondary'
    },
    {
      id: 'differentiation',
      title: 'Differentiation',
      helper: 'Note what makes this offer distinct from consultants, canvases, or generic AI tools.',
      emphasis: 'secondary'
    },
    {
      id: 'early-monetisation-idea',
      title: 'Early Monetisation Idea',
      helper: 'Capture the first revenue model assumptions, even if they are tentative.',
      emphasis: 'secondary'
    }
  ];
  readonly primaryTools;
  readonly laterTools;
  readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly pendingCreatedIdea = history.state?.['createdIdea'] as StrategyCopilotData | undefined;

  workspaces: WorkspaceOption[] = [];
  selectedWorkspaceId = '';
  pageTitle = '';
  pageStatus = '';
  completionHintTitle = '';
  completionHint = '';
  overview!: IdeationOverview;
  sections: IdeationSection[] = [];
  messages: ChatMessage[] = [];
  panelTitle = '';
  panelSubtitle = '';
  placeholder = '';
  isSendingAgentMessage = false;
  screenReady = false;
  private backendIdeasAvailable = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly businessIdeasApi: BusinessIdeasApiService,
    private readonly agentGatewayApi: AgentGatewayApiService,
    readonly shell: WorkspaceShellService,
    readonly workspace: IdeationWorkspaceService,
    readonly chat: AgentChatService
  ) {
    this.primaryTools = this.shell.strategyTools.filter((tool) => tool.group === 'core');
    this.laterTools = this.shell.strategyTools.filter((tool) => tool.group === 'later');
    this.workspaces = this.getInitialWorkspaces();
    this.applyFallbackWorkspace(this.shell.getDemoWorkspaces()[0]?.id ?? '');
  }

  ngOnInit(): void {
    window.setTimeout(async () => {
      await this.refreshWorkspaceOptions();
      this.screenReady = true;
      this.changeDetectorRef.detectChanges();
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        void this.loadWorkspaceForRoute(params.get('workspaceId'));
      });
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

  async handleAgentMessage(message: string): Promise<void> {
    this.messages = [
      ...this.messages,
      {
        id: this.messages.length + 1,
        role: 'user',
        author: 'You',
        content: message,
        timestamp: 'Now'
      }
    ];
    this.isSendingAgentMessage = true;

    try {
      const run = await this.agentGatewayApi.startIdeationRun(message, this.pageTitle);
      const summary = await this.agentGatewayApi.waitForRunCompletion(run.id);
      this.applyRunSummary(summary);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'The ideation agent could not be reached.';
      this.messages = [
        ...this.messages,
        {
          id: this.messages.length + 1,
          role: 'agent',
          author: 'HelmOS Agent',
          content: `I hit a delivery problem while contacting the agent gateway. ${detail}`,
          timestamp: 'Now'
        }
      ];
    } finally {
      this.isSendingAgentMessage = false;
    }
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

      if (activeWorkspaceId) {
        await this.loadWorkspaceForRoute(activeWorkspaceId);
      }
    } catch {
      this.backendIdeasAvailable = false;
      this.workspaces = this.shell.getDemoWorkspaces();
    }
  }

  private async loadWorkspaceForRoute(workspaceId: string | null): Promise<void> {
    if (this.pendingCreatedIdea && workspaceId === this.pendingCreatedIdea.workspaceOption.id) {
      this.applyStrategyCopilotData(this.pendingCreatedIdea);
      return;
    }

    if (this.backendIdeasAvailable && workspaceId) {
      try {
        const strategyCopilot = await this.businessIdeasApi.getBusinessIdea(workspaceId);
        this.applyStrategyCopilotData(strategyCopilot);
        return;
      } catch {
        this.backendIdeasAvailable = false;
        this.workspaces = this.shell.getDemoWorkspaces();
      }
    }

    this.applyFallbackWorkspace(workspaceId ?? this.shell.getDemoWorkspaces()[0]?.id ?? '');
  }

  private applyStrategyCopilotData(strategyCopilot: StrategyCopilotData): void {
    this.selectedWorkspaceId = strategyCopilot.workspaceOption.id;
    this.pageTitle = strategyCopilot.workspace.pageTitle;
    this.pageStatus = strategyCopilot.workspace.pageStatus;
    this.completionHintTitle = strategyCopilot.workspace.completionHintTitle;
    this.completionHint = strategyCopilot.workspace.completionHint;
    this.overview = strategyCopilot.workspace.overview;
    this.sections = strategyCopilot.workspace.sections;
    this.panelTitle = strategyCopilot.chat.panelTitle;
    this.panelSubtitle = strategyCopilot.chat.panelSubtitle;
    this.placeholder = strategyCopilot.chat.placeholder;
    this.messages = strategyCopilot.chat.messages;
  }

  private applyRunSummary(summary: RunSummaryResponse): void {
    const normalized = this.coerceIdeationAgentResponse(summary.normalized_output);

    if (normalized) {
      this.applyIdeationAgentResponse(normalized, summary);
      return;
    }

    const artifact = summary.artifacts[0];
    const nextActions = this.readNormalizedValue(summary.normalized_output, 'next_actions');
    const fallbackReply =
      summary.status === 'failed'
        ? `The ideation run failed. ${summary.error_message ?? 'Check the backend logs for details.'}`
        : summary.status === 'waiting_for_approval'
          ? 'The ideation run is waiting for approval before it can be finalized.'
          : 'The ideation run completed without a structured artifact.';
    const agentReply =
      artifact?.summary ??
      artifact?.sections?.map((section) => section.content).filter(Boolean).join('\n\n') ??
      fallbackReply;

    this.appendAgentMessage(agentReply);

    if (artifact?.sections?.length) {
      this.sections = this.mergeArtifactIntoSections(this.sections, artifact.sections);
      this.overview = {
        ...this.overview,
        completionSummary: artifact.summary ?? this.overview.completionSummary,
        nextAction:
          Array.isArray(nextActions) && nextActions.length > 0 ? String(nextActions[0]) : this.overview.nextAction
      };
    }
  }

  private applyIdeationAgentResponse(payload: IdeationAgentResponsePayload, summary: RunSummaryResponse): void {
    const fallbackReply =
      summary.status === 'failed'
        ? `The ideation run failed. ${summary.error_message ?? 'Check the backend logs for details.'}`
        : 'The ideation run completed.';

    const reply = payload.reply_to_user?.content?.trim() || fallbackReply;
    this.appendAgentMessage(reply);

    if (payload.ideation_overview) {
      this.overview = {
        completeness:
          typeof payload.ideation_overview.completeness_percent === 'number'
            ? payload.ideation_overview.completeness_percent
            : this.overview.completeness,
        readinessLabel: this.normalizeReadinessLabel(payload.ideation_overview.readiness?.label) ?? this.overview.readinessLabel,
        readinessTone:
          this.normalizeReadinessTone(payload.ideation_overview.readiness?.label) ?? this.overview.readinessTone,
        nextAction: payload.ideation_overview.readiness?.next_best_action?.trim() || this.overview.nextAction,
        completionSummary: payload.ideation_overview.readiness?.reason?.trim() || this.overview.completionSummary
      };
    }

    const sectionPayloads: Record<string, IdeationAgentSectionPayload | null | undefined> = {
      'problem-statement': payload.problem_statement,
      'target-customer': payload.target_customer,
      'value-proposition': payload.value_proposition ?? payload['Value Proposition'],
      'product-service-description': payload.product_service_description,
      differentiation: payload.differentiation,
      'early-monetisation-idea': payload.early_monetization_idea ?? payload.early_monitization_idea
    };

    const baseSections = this.buildCompleteSectionSet(this.sections);

    this.sections = baseSections.map((section) => {
      const incoming = sectionPayloads[section.id];
      if (!incoming) {
        return {
          ...section,
          recentlyUpdated: false
        };
      }

      return {
        ...section,
        helper: incoming.helper?.trim() || section.helper,
        content: incoming.content?.trim() || section.content,
        emphasis: incoming.priority ?? section.emphasis,
        statusLabel: this.normalizeStatusLabel(incoming.status?.label) ?? section.statusLabel,
        statusTone: this.normalizeStatusTone(incoming.status?.tone) ?? section.statusTone,
        confidence: incoming.status?.agent_confidence ?? section.confidence,
        updatedAgo: 'Just now',
        updatedBy: 'HelmOS Agent',
        recentlyUpdated: Boolean(incoming.ui_hints?.highlight),
        needsAttention:
          typeof incoming.ui_hints?.needs_attention === 'boolean' ? incoming.ui_hints.needs_attention : section.needsAttention
      };
    });
  }

  private appendAgentMessage(content: string): void {
    this.messages = [
      ...this.messages,
      {
        id: this.messages.length + 1,
        role: 'agent',
        author: 'HelmOS Agent',
        content,
        timestamp: 'Now'
      }
    ];
  }

  private coerceIdeationAgentResponse(payload: unknown): IdeationAgentResponsePayload | null {
    if (typeof payload === 'string') {
      try {
        return this.coerceIdeationAgentResponse(JSON.parse(payload));
      } catch {
        return null;
      }
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const candidate = payload as IdeationAgentResponsePayload;
    if (
      !candidate.reply_to_user &&
      !candidate.ideation_overview &&
      !candidate.problem_statement &&
      !candidate.target_customer &&
      !candidate.value_proposition &&
      !candidate['Value Proposition'] &&
      !candidate.product_service_description &&
      !candidate.differentiation &&
      !candidate.early_monetization_idea &&
      !candidate.early_monitization_idea
    ) {
      return null;
    }

    return candidate;
  }

  private readNormalizedValue(payload: Record<string, unknown> | IdeationAgentResponsePayload, key: string): unknown {
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }

    return (payload as Record<string, unknown>)[key];
  }

  private normalizeReadinessLabel(
    label: string | null | undefined
  ): IdeationOverview['readinessLabel'] | null {
    const normalized = label?.trim().toLowerCase();
    if (normalized === 'ready for next tool') {
      return 'Ready for next tool';
    }
    if (normalized === 'needs refinement') {
      return 'Needs refinement';
    }
    if (normalized === 'in progress') {
      return 'In progress';
    }
    return null;
  }

  private normalizeReadinessTone(
    label: string | null | undefined
  ): IdeationOverview['readinessTone'] | null {
    const normalized = label?.trim().toLowerCase();
    if (normalized === 'ready for next tool') {
      return 'success';
    }
    if (normalized === 'needs refinement') {
      return 'warning';
    }
    if (normalized === 'in progress') {
      return 'info';
    }
    return null;
  }

  private normalizeStatusLabel(
    label: string | null | undefined
  ): IdeationSection['statusLabel'] | null {
    const normalized = label?.trim().toLowerCase();
    if (normalized === 'strong') {
      return 'Strong';
    }
    if (normalized === 'needs refinement') {
      return 'Needs refinement';
    }
    if (normalized === 'draft') {
      return 'Draft';
    }
    if (normalized === 'too vague') {
      return 'Too vague';
    }
    return null;
  }

  private normalizeStatusTone(
    tone: string | null | undefined
  ): IdeationSection['statusTone'] | null {
    if (tone === 'success' || tone === 'warning' || tone === 'info' || tone === 'muted') {
      return tone;
    }
    return null;
  }

  private buildCompleteSectionSet(existingSections: IdeationSection[]): IdeationSection[] {
    const existingById = new Map(existingSections.map((section) => [section.id, section]));

    return this.sectionBlueprints.map((blueprint) => {
      const existing = existingById.get(blueprint.id);
      if (existing) {
        return existing;
      }

      return {
        id: blueprint.id,
        title: blueprint.title,
        helper: blueprint.helper,
        content: 'No draft yet. Use the agent to turn the first assumptions into a working section draft.',
        emphasis: blueprint.emphasis,
        statusLabel: 'Too vague',
        statusTone: 'muted',
        confidence: 'medium',
        updatedAgo: 'Not updated yet',
        updatedBy: 'HelmOS Agent',
        recentlyUpdated: false,
        needsAttention: true
      };
    });
  }

  private mergeArtifactIntoSections(
    existingSections: IdeationSection[],
    artifactSections: Array<{ heading?: string; content?: string }>
  ): IdeationSection[] {
    const updated = [...existingSections];
    const headingToIndex = new Map(existingSections.map((section, index) => [section.title.toLowerCase(), index]));

    artifactSections.forEach((section, artifactIndex) => {
      const heading = (section.heading ?? '').toLowerCase();
      const targetIndex = headingToIndex.get(heading) ?? artifactIndex;
      if (targetIndex < 0 || targetIndex >= updated.length || !section.content) {
        return;
      }

      updated[targetIndex] = {
        ...updated[targetIndex],
        content: section.content,
        updatedAgo: 'Just now',
        updatedBy: 'HelmOS Agent',
        recentlyUpdated: true
      };
    });

    return updated;
  }

  private applyFallbackWorkspace(workspaceId: string): void {
    const fallbackWorkspace = this.shell.getDemoWorkspaces().find((option) => option.id === workspaceId && option.id !== 'new');

    this.selectedWorkspaceId = fallbackWorkspace?.id ?? this.shell.getDemoWorkspaces()[0]?.id ?? '';
    this.pageTitle = this.workspace.pageTitle;
    this.pageStatus = this.workspace.pageStatus;
    this.completionHintTitle = this.workspace.completionHintTitle;
    this.completionHint = this.workspace.completionHint;
    this.overview = this.workspace.getOverview();
    this.sections = this.workspace.getSections();
    this.panelTitle = this.chat.panelTitle;
    this.panelSubtitle = this.chat.panelSubtitle;
    this.placeholder = this.chat.placeholder;
    this.messages = this.chat.getMessages();
  }

  private getInitialWorkspaces(): WorkspaceOption[] {
    if (!this.pendingCreatedIdea) {
      return this.shell.getDemoWorkspaces();
    }

    return [
      {
        id: this.pendingCreatedIdea.workspaceOption.id,
        name: this.pendingCreatedIdea.workspaceOption.name
      },
      ...this.shell.getDemoWorkspaces().filter((workspace) => workspace.id !== this.shell.newIdeaOption.id),
      this.shell.newIdeaOption
    ];
  }
}
