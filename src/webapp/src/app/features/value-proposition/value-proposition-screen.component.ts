import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { BusinessIdeasApiService } from '../../core/services/business-ideas-api.service';
import { StrategyTool, WorkspaceOption, WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { StrategyCopilotShellComponent } from '../strategy-copilot/strategy-copilot-shell.component';
import { AgentChatService } from '../ideation/services/agent-chat.service';
import { AgentGatewayApiService, RunSummaryResponse } from '../ideation/services/agent-gateway-api.service';
import {
  ChatMessage,
  IdeationAgentSectionPayload,
  IdeationOverview,
  IdeationSection,
  StrategyCopilotData
} from '../ideation/ideation.models';
import { ValuePropositionWorkspaceComponent } from './value-proposition-workspace.component';

@Component({
  selector: 'app-value-proposition-screen',
  standalone: true,
  imports: [CommonModule, StrategyCopilotShellComponent, ValuePropositionWorkspaceComponent],
  template: `
    <ng-container *ngIf="screenReady; else loadingState">
      <app-strategy-copilot-shell
        *ngIf="!loadErrorMessage; else errorState"
        [productName]="shell.productName"
        [workspaces]="workspaces"
        [selectedWorkspaceId]="selectedWorkspaceId"
        [saveStatus]="shell.saveStatus"
        [showWorkspaceSwitcher]="workspaces.length > 0"
        [primaryTools]="primaryTools"
        [laterTools]="laterTools"
        activeToolId="value-proposition"
        [guidanceTitle]="completionHintTitle"
        [guidanceCopy]="completionHint"
        [panelTitle]="panelTitle"
        [panelSubtitle]="panelSubtitle"
        [placeholder]="placeholder"
        [messages]="messages"
        [isSending]="isSendingAgentMessage"
        [resendAvailable]="canResendLastUserMessage"
        [showStrategySidebar]="true"
        (workspaceChange)="handleWorkspaceSelection($event)"
        (messageSend)="handleAgentMessage($event)"
        (resendLastMessage)="handleResendLastMessage()"
      >
        <app-value-proposition-workspace
          [title]="pageTitle"
          [status]="pageStatus"
          [overview]="overview"
          [sections]="sections"
        />
      </app-strategy-copilot-shell>

      <ng-template #errorState>
        <section class="screen-loading-state">
          <p class="mb-0">{{ loadErrorMessage }}</p>
        </section>
      </ng-template>
    </ng-container>

    <ng-template #loadingState>
      <section class="screen-loading-state">
        <p class="mb-0">Loading the value proposition workspace...</p>
      </section>
    </ng-template>
  `,
  styles: [
    `
      .screen-loading-state {
        min-height: 100vh;
        display: grid;
        place-items: center;
        color: var(--helmos-muted);
        font-size: 0.95rem;
      }
    `
  ]
})
export class ValuePropositionScreenComponent implements OnInit {
  private readonly sectionBlueprints: Array<Pick<IdeationSection, 'id' | 'title' | 'helper' | 'emphasis'>> = [
    { id: 'customer-segments', title: 'Customer Segments', helper: 'Identify the most specific customer groups this canvas is designed around.', emphasis: 'primary' },
    { id: 'customer-jobs', title: 'Customer Jobs', helper: 'Capture the functional, emotional, and social jobs the customer is trying to get done.', emphasis: 'primary' },
    { id: 'customer-pains', title: 'Customer Pains', helper: 'List the frictions, risks, blockers, and frustrations that slow the customer down.', emphasis: 'primary' },
    { id: 'customer-gains', title: 'Customer Gains', helper: 'Describe the outcomes, benefits, and aspirations the customer values most.', emphasis: 'primary' },
    { id: 'products-services', title: 'Products & Services', helper: 'Outline the products or services that create value for this customer.', emphasis: 'secondary' },
    { id: 'pain-relievers', title: 'Pain Relievers', helper: 'Explain how the offer reduces or removes the most meaningful customer pains.', emphasis: 'secondary' },
    { id: 'gain-creators', title: 'Gain Creators', helper: 'Show how the offer creates the gains the customer actually cares about.', emphasis: 'secondary' },
    { id: 'fit-assessment', title: 'Fit Assessment', helper: 'Summarise the strength of customer clarity, value definition, and fit consistency.', emphasis: 'secondary' },
    { id: 'analysis', title: 'Analysis', helper: 'Call out the weakest area, issues, inconsistencies, and the highest-value recommendations.', emphasis: 'secondary' }
  ];

  primaryTools: StrategyTool[];
  laterTools: StrategyTool[];
  readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

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
  loadErrorMessage = '';
  private backendIdeasAvailable = false;
  private lastFailedUserMessage: string | null = null;

  get canResendLastUserMessage(): boolean {
    return !this.isSendingAgentMessage && this.lastFailedUserMessage !== null;
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly businessIdeasApi: BusinessIdeasApiService,
    private readonly agentGatewayApi: AgentGatewayApiService,
    readonly shell: WorkspaceShellService,
    readonly chat: AgentChatService
  ) {
    const initialTools = this.shell.getStrategyTools();
    this.primaryTools = initialTools.filter((tool) => tool.group === 'core');
    this.laterTools = initialTools.filter((tool) => tool.group === 'later');
    this.panelTitle = 'Value Proposition Agent';
    this.panelSubtitle = 'Canvas design collaboration';
    this.placeholder = 'Ask the agent to tighten the canvas, challenge weak fit, or sharpen customer-value alignment...';
    this.messages = [];
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
    await this.sendMessageToAgent(message, { appendUserMessage: true });
  }

  async handleResendLastMessage(): Promise<void> {
    if (!this.lastFailedUserMessage) {
      return;
    }
    this.isSendingAgentMessage = true;

    try {
      if (this.backendIdeasAvailable && this.selectedWorkspaceId) {
        const strategyCopilot = await this.businessIdeasApi.resendLastValuePropositionMessage(this.selectedWorkspaceId);
        this.applyStrategyCopilotData(strategyCopilot);
        this.lastFailedUserMessage = null;
        this.changeDetectorRef.detectChanges();
        return;
      }

      await this.sendMessageToAgent(this.lastFailedUserMessage, { appendUserMessage: false });
    } finally {
      this.isSendingAgentMessage = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  private async sendMessageToAgent(message: string, options: { appendUserMessage: boolean }): Promise<void> {
    if (options.appendUserMessage) {
      this.messages = [
        ...this.messages,
        { id: this.messages.length + 1, role: 'user', author: 'You', content: message, timestamp: 'Now' }
      ];
    }

    this.lastFailedUserMessage = null;
    this.isSendingAgentMessage = true;

    try {
      if (this.backendIdeasAvailable && this.selectedWorkspaceId) {
        const strategyCopilot = await this.businessIdeasApi.sendValuePropositionMessage(this.selectedWorkspaceId, message);
        this.applyStrategyCopilotData(strategyCopilot);
        this.changeDetectorRef.detectChanges();
        return;
      }

      const run = await this.agentGatewayApi.startValuePropositionRun(message, this.pageTitle);
      const summary = await this.agentGatewayApi.waitForRunCompletion(run.id);
      this.applyRunSummary(summary);
      this.changeDetectorRef.detectChanges();
    } catch (error) {
      this.lastFailedUserMessage = message;
      const detail = error instanceof Error ? error.message : 'The value proposition agent could not be reached.';
      this.messages = [
        ...this.messages,
        { id: this.messages.length + 1, role: 'agent', author: 'Value Proposition Agent', content: `I hit a delivery problem while contacting the agent gateway. ${detail}`, timestamp: 'Now' }
      ];
      this.changeDetectorRef.detectChanges();
    } finally {
      this.isSendingAgentMessage = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  private async refreshWorkspaceOptions(): Promise<void> {
    this.loadErrorMessage = '';

    try {
      const ideas = await this.businessIdeasApi.listBusinessIdeas();
      this.backendIdeasAvailable = true;
      if (ideas.length === 0) {
        await this.router.navigate(['/strategy-copilot/new-idea'], { replaceUrl: true });
        return;
      }

      this.workspaces = [...ideas.map((idea) => ({ id: idea.id, name: idea.name })), this.shell.newIdeaOption];
      const activeWorkspaceId = this.route.snapshot.queryParamMap.get('workspaceId') ?? ideas[0].id;

      await this.router.navigate([], {
        queryParams: { workspaceId: activeWorkspaceId },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    } catch {
      this.backendIdeasAvailable = false;
      this.loadErrorMessage =
        'HelmOS could not load this value proposition workspace. Make sure the backend is running and try again.';
    }
  }

  private async loadWorkspaceForRoute(workspaceId: string | null): Promise<void> {
    if (!this.backendIdeasAvailable || !workspaceId) {
      return;
    }

    try {
      const strategyCopilot = await this.businessIdeasApi.getValueProposition(workspaceId);
      this.applyStrategyCopilotData(strategyCopilot);
    } catch {
      this.loadErrorMessage =
        'HelmOS could not load this value proposition workspace. Make sure the backend is running and try again.';
    }
  }

  private applyStrategyCopilotData(strategyCopilot: StrategyCopilotData): void {
    this.loadErrorMessage = '';
    this.selectedWorkspaceId = strategyCopilot.workspaceOption.id;
    this.pageTitle = strategyCopilot.workspace.pageTitle;
    this.pageStatus = strategyCopilot.workspace.pageStatus;
    this.completionHintTitle = strategyCopilot.workspace.completionHintTitle;
    this.completionHint = strategyCopilot.workspace.completionHint;
    this.overview = strategyCopilot.workspace.overview;
    const tools = this.shell.getStrategyTools(strategyCopilot.workspace.availableToolIds);
    this.primaryTools = tools.filter((tool) => tool.group === 'core');
    this.laterTools = tools.filter((tool) => tool.group === 'later');
    this.sections = this.buildCompleteSectionSet(strategyCopilot.workspace.sections);
    this.panelTitle = strategyCopilot.chat.panelTitle;
    this.panelSubtitle = strategyCopilot.chat.panelSubtitle;
    this.placeholder = strategyCopilot.chat.placeholder;
    this.messages = strategyCopilot.chat.messages;
    this.lastFailedUserMessage = strategyCopilot.chat.resendAvailable
      ? [...this.messages].reverse().find((message) => message.role === 'user')?.content ?? null
      : null;
  }

  private applyRunSummary(summary: RunSummaryResponse): void {
    const payload = this.coerceValuePropositionResponse(summary.normalized_output);
    if (!payload) {
      this.messages = [
        ...this.messages,
        { id: this.messages.length + 1, role: 'agent', author: 'Value Proposition Agent', content: 'I updated the canvas, but the response was not structured enough to refresh the workspace automatically.', timestamp: 'Now' }
      ];
      return;
    }

    this.messages = [
      ...this.messages,
      {
        id: this.messages.length + 1,
        role: 'agent',
        author: 'Value Proposition Agent',
        content: payload.next_question?.trim() || 'I updated the value proposition canvas.',
        timestamp: 'Now'
      }
    ];

    this.overview = {
      completeness:
        typeof payload.value_proposition_overview?.completeness_percent === 'number'
          ? payload.value_proposition_overview.completeness_percent
          : this.overview.completeness,
      readinessLabel: this.normalizeReadinessLabel(payload.value_proposition_overview?.readiness?.label) ?? this.overview.readinessLabel,
      readinessTone: this.normalizeReadinessTone(payload.value_proposition_overview?.readiness?.label) ?? this.overview.readinessTone,
      nextAction: payload.value_proposition_overview?.readiness?.next_best_action?.trim() || this.overview.nextAction,
      completionSummary: payload.value_proposition_overview?.readiness?.reason?.trim() || this.overview.completionSummary
    };

    const incomingById: Record<string, IdeationAgentSectionPayload | undefined> = {
      'customer-segments': payload.customer_segments,
      'customer-jobs': payload.customer_jobs,
      'customer-pains': payload.customer_pains,
      'customer-gains': payload.customer_gains,
      'products-services': payload.products_services,
      'pain-relievers': payload.pain_relievers,
      'gain-creators': payload.gain_creators,
      'fit-assessment': payload.fit_assessment,
      analysis: payload.analysis
    };

    this.sections = this.buildCompleteSectionSet(this.sections).map((section) => {
      const incoming = incomingById[section.id];
      if (!incoming) {
        return section;
      }

      return {
        ...section,
        content: incoming.content?.trim() || section.content,
        helper: incoming.helper?.trim() || section.helper,
        emphasis: incoming.priority ?? section.emphasis,
        statusLabel: this.normalizeStatusLabel(incoming.status?.label) ?? section.statusLabel,
        statusTone: this.normalizeStatusTone(incoming.status?.tone) ?? section.statusTone,
        confidence: incoming.status?.agent_confidence ?? section.confidence,
        updatedAgo: 'Just now',
        updatedBy: 'Value Proposition Agent',
        recentlyUpdated: Boolean(incoming.ui_hints?.highlight),
        needsAttention:
          typeof incoming.ui_hints?.needs_attention === 'boolean' ? incoming.ui_hints.needs_attention : section.needsAttention
      };
    });
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
        content: 'No draft yet. Use the agent to populate and challenge this part of the canvas.',
        emphasis: blueprint.emphasis,
        statusLabel: 'Too vague',
        statusTone: 'muted',
        confidence: 'medium',
        updatedAgo: 'Not updated yet',
        updatedBy: 'Value Proposition Agent',
        recentlyUpdated: false,
        needsAttention: true
      };
    });
  }

  private coerceValuePropositionResponse(payload: unknown): ValuePropositionAgentResponse | null {
    if (typeof payload === 'string') {
      try {
        return this.coerceValuePropositionResponse(JSON.parse(payload));
      } catch {
        return null;
      }
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const raw = payload as Record<string, unknown>;
    const scoring = (raw['scoring'] ?? {}) as Record<string, unknown>;
    const nextQuestion = typeof raw['next_question'] === 'string' ? raw['next_question'] : '';
    const overall = typeof scoring['overall'] === 'string' ? scoring['overall'] : '';

    const toList = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []);
    const derive = (
      content: string,
      priority: 'primary' | 'secondary',
      label: IdeationSection['statusLabel'],
      tone: IdeationSection['statusTone']
    ): IdeationAgentSectionPayload => ({
      content,
      priority,
      status: { label, tone, agent_confidence: 'medium' },
      ui_hints: { highlight: true, needs_attention: tone !== 'success' }
    });

    const profile = (raw['customer_profile'] ?? {}) as Record<string, unknown>;
    const jobs = (profile['jobs'] ?? {}) as Record<string, unknown>;
    const valueMap = (raw['value_map'] ?? {}) as Record<string, unknown>;
    const analysis = (raw['analysis'] ?? {}) as Record<string, unknown>;
    const readinessLabel = overall === 'Strong' ? 'Ready for next tool' : overall === 'Emerging' ? 'Needs refinement' : 'In progress';

    return {
      customer_segments: derive(toList(profile['segments']).map((item) => `- ${item}`).join('\n'), 'primary', 'Draft', 'info'),
      customer_jobs: derive(
        [
          'Functional jobs:',
          ...toList(jobs['functional']).map((item) => `- ${item}`),
          '',
          'Emotional jobs:',
          ...toList(jobs['emotional']).map((item) => `- ${item}`),
          '',
          'Social jobs:',
          ...toList(jobs['social']).map((item) => `- ${item}`)
        ].join('\n'),
        'primary',
        'Draft',
        'info'
      ),
      customer_pains: derive(toList(profile['pains']).map((item) => `- ${item}`).join('\n'), 'primary', 'Draft', 'info'),
      customer_gains: derive(toList(profile['gains']).map((item) => `- ${item}`).join('\n'), 'primary', 'Draft', 'info'),
      products_services: derive(toList(valueMap['products_services']).map((item) => `- ${item}`).join('\n'), 'secondary', 'Draft', 'info'),
      pain_relievers: derive(toList(valueMap['pain_relievers']).map((item) => `- ${item}`).join('\n'), 'secondary', 'Draft', 'info'),
      gain_creators: derive(toList(valueMap['gain_creators']).map((item) => `- ${item}`).join('\n'), 'secondary', 'Draft', 'info'),
      fit_assessment: derive(
        [
          `- Customer clarity: ${String(scoring['customer_clarity'] ?? 'Low')}`,
          `- Problem depth: ${String(scoring['problem_depth'] ?? 'Low')}`,
          `- Value definition: ${String(scoring['value_definition'] ?? 'Low')}`,
          `- Pain/gain relevance: ${String(scoring['pain_gain_relevance'] ?? 'Low')}`,
          `- Fit consistency: ${String(scoring['fit_consistency'] ?? 'Low')}`,
          `- Overall: ${overall || 'Weak'}`
        ].join('\n'),
        'secondary',
        overall === 'Strong' ? 'Strong' : overall === 'Emerging' ? 'Needs refinement' : 'Too vague',
        overall === 'Strong' ? 'success' : overall === 'Emerging' ? 'warning' : 'muted'
      ),
      analysis: derive(
        [
          `Weakest area: ${String(analysis['weakest_area'] ?? 'Not identified')}`,
          '',
          'Issues:',
          ...toList(analysis['issues']).map((item) => `- ${item}`),
          '',
          'Inconsistencies:',
          ...toList(analysis['inconsistencies']).map((item) => `- ${item}`),
          '',
          'Recommendations:',
          ...toList(analysis['recommendations']).map((item) => `- ${item}`)
        ].join('\n'),
        'secondary',
        'Needs refinement',
        'warning'
      ),
      value_proposition_overview: {
        completeness_percent: overall === 'Strong' ? 85 : overall === 'Emerging' ? 60 : nextQuestion ? 30 : 0,
        readiness: {
          label: readinessLabel,
          reason:
            overall === 'Strong'
              ? 'The value proposition canvas is coherent and the fit looks strong.'
              : overall === 'Emerging'
                ? 'The canvas is taking shape, but important areas still need refinement.'
                : 'The canvas still needs clearer customer detail and tighter value mapping.',
          next_best_action: nextQuestion || 'Strengthen the weakest area and tighten the fit between customer needs and the value map.'
        }
      },
      next_question: nextQuestion
    };
  }

  private normalizeReadinessLabel(label: string | null | undefined): IdeationOverview['readinessLabel'] | null {
    const normalized = label?.trim().toLowerCase();
    if (normalized === 'ready for next tool') return 'Ready for next tool';
    if (normalized === 'needs refinement') return 'Needs refinement';
    if (normalized === 'in progress') return 'In progress';
    return null;
  }

  private normalizeReadinessTone(label: string | null | undefined): IdeationOverview['readinessTone'] | null {
    const normalized = label?.trim().toLowerCase();
    if (normalized === 'ready for next tool') return 'success';
    if (normalized === 'needs refinement') return 'warning';
    if (normalized === 'in progress') return 'info';
    return null;
  }

  private normalizeStatusLabel(label: string | null | undefined): IdeationSection['statusLabel'] | null {
    const normalized = label?.trim().toLowerCase();
    if (normalized === 'strong') return 'Strong';
    if (normalized === 'needs refinement') return 'Needs refinement';
    if (normalized === 'draft') return 'Draft';
    if (normalized === 'too vague') return 'Too vague';
    return null;
  }

  private normalizeStatusTone(tone: string | null | undefined): IdeationSection['statusTone'] | null {
    if (tone === 'success' || tone === 'warning' || tone === 'info' || tone === 'muted') {
      return tone;
    }
    return null;
  }
}

interface ValuePropositionAgentResponse {
  customer_segments?: IdeationAgentSectionPayload;
  customer_jobs?: IdeationAgentSectionPayload;
  customer_pains?: IdeationAgentSectionPayload;
  customer_gains?: IdeationAgentSectionPayload;
  products_services?: IdeationAgentSectionPayload;
  pain_relievers?: IdeationAgentSectionPayload;
  gain_creators?: IdeationAgentSectionPayload;
  fit_assessment?: IdeationAgentSectionPayload;
  analysis?: IdeationAgentSectionPayload;
  value_proposition_overview?: {
    completeness_percent?: number;
    readiness?: {
      label?: string;
      reason?: string;
      next_best_action?: string;
    };
  };
  next_question?: string;
}
