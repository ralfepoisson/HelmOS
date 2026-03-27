import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceOption, StrategyTool } from '../../core/services/workspace-shell.service';
import { ChatMessage } from '../ideation/ideation.models';
import { StrategySidebarComponent } from '../ideation/strategy-sidebar.component';
import { AgentChatPanelComponent } from '../ideation/agent-chat-panel.component';

@Component({
  selector: 'app-strategy-copilot-shell',
  standalone: true,
  imports: [CommonModule, TopNavComponent, StrategySidebarComponent, AgentChatPanelComponent],
  template: `
    <app-top-nav
      [productName]="productName"
      [surfaceLabel]="surfaceLabel"
      [workspaces]="workspaces"
      [selectedWorkspaceId]="selectedWorkspaceId"
      [saveStatus]="saveStatus"
      [showWorkspaceSwitcher]="showWorkspaceSwitcher"
      (workspaceChange)="workspaceChange.emit($event)"
    />

    <main class="screen-shell container-fluid" data-testid="strategy-copilot-shell">
      <div class="row g-0 shell-grid">
        <div
          *ngIf="showStrategySidebar"
          class="strategy-column"
          [class.col-12]="!isStrategySidebarCollapsed"
          [class.col-lg-4]="!isStrategySidebarCollapsed"
          [class.col-xl-3]="!isStrategySidebarCollapsed"
          [class.strategy-column-collapsed]="isStrategySidebarCollapsed"
          data-testid="strategy-column"
        >
          <app-strategy-sidebar
            [activeToolId]="activeToolId"
            [tools]="primaryTools"
            [moreTools]="laterTools"
            [guidanceTitle]="guidanceTitle"
            [guidanceCopy]="guidanceCopy"
          />
        </div>

        <div
          class="workspace-column"
          [class.col-12]="true"
          [class.col-lg-8]="showStrategySidebar && !isStrategySidebarCollapsed"
          [class.col-xl-6]="showStrategySidebar && !isStrategySidebarCollapsed"
          [class.col-lg-12]="!showStrategySidebar || isStrategySidebarCollapsed"
          [class.col-xl-9]="!showStrategySidebar || isStrategySidebarCollapsed"
          data-testid="workspace-column"
        >
          <div *ngIf="showStrategySidebar" class="workspace-toolbar">
            <button
              type="button"
              class="btn btn-outline-secondary workspace-sidebar-toggle"
              data-testid="strategy-sidebar-toggle"
              [attr.aria-expanded]="!isStrategySidebarCollapsed"
              [attr.aria-label]="isStrategySidebarCollapsed ? 'Expand strategy menu' : 'Collapse strategy menu'"
              (click)="toggleStrategySidebar()"
            >
              <span class="toggle-icon" aria-hidden="true">{{ isStrategySidebarCollapsed ? '>' : '<' }}</span>
              <span>{{ isStrategySidebarCollapsed ? 'Show menu' : 'Hide menu' }}</span>
            </button>
          </div>
          <ng-content />
        </div>

        <div class="col-12 col-xl-3 chat-column" data-testid="chat-column">
          <app-agent-chat-panel
            [title]="panelTitle"
            [subtitle]="panelSubtitle"
            [placeholder]="placeholder"
            [messages]="messages"
            [isSending]="isSending"
            [resendAvailable]="resendAvailable"
            (messageSend)="messageSend.emit($event)"
            (resendLastMessage)="resendLastMessage.emit()"
          />
        </div>
      </div>
    </main>
  `,
  styles: [
    `
      .screen-shell {
        padding: 68px 0 0;
        height: 100vh;
        overflow: hidden;
      }

      .shell-grid {
        align-items: start;
        min-height: calc(100vh - 68px);
        height: calc(100vh - 68px);
      }

      .strategy-column,
      .chat-column {
        align-self: stretch;
      }

      .strategy-column {
        transition:
          width 0.24s ease,
          max-width 0.24s ease,
          flex-basis 0.24s ease,
          opacity 0.18s ease;
        overflow: hidden;
      }

      .strategy-column-collapsed {
        flex: 0 0 0;
        width: 0;
        max-width: 0;
        opacity: 0;
      }

      .workspace-column {
        padding: 1.5rem;
        height: calc(100vh - 68px);
        overflow-y: auto;
        overscroll-behavior: contain;
      }

      .workspace-toolbar {
        display: flex;
        justify-content: flex-start;
        margin-bottom: 0.85rem;
      }

      .workspace-sidebar-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        border-radius: 999px;
        padding: 0.45rem 0.8rem;
        background: rgba(255, 255, 255, 0.92);
        border-color: rgba(148, 163, 184, 0.42);
        color: #475569;
        font-weight: 600;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      }

      .workspace-sidebar-toggle:hover {
        background: rgba(248, 250, 252, 0.98);
      }

      .toggle-icon {
        display: inline-grid;
        place-items: center;
        width: 1.2rem;
        height: 1.2rem;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.14);
        font-size: 0.78rem;
      }

      @media (min-width: 992px) {
        .workspace-column {
          padding: 1.75rem;
        }
      }

      @media (max-width: 1199.98px) {
        .screen-shell {
          height: auto;
          overflow: visible;
        }

        .shell-grid {
          height: auto;
        }

        .workspace-column {
          padding: 1rem;
          height: auto;
          overflow: visible;
        }

        .workspace-toolbar {
          margin-bottom: 0.7rem;
        }
      }
    `
  ]
})
export class StrategyCopilotShellComponent {
  private readonly sidebarStorageKey = 'helmos.strategySidebarCollapsed';
  isStrategySidebarCollapsed = this.readStoredSidebarState();

  @Input({ required: true }) productName!: string;
  @Input() surfaceLabel = 'Strategy Copilot';
  @Input() workspaces: WorkspaceOption[] = [];
  @Input() selectedWorkspaceId = '';
  @Input({ required: true }) saveStatus!: string;
  @Input() showWorkspaceSwitcher = true;
  @Input({ required: true }) primaryTools: StrategyTool[] = [];
  @Input({ required: true }) laterTools: StrategyTool[] = [];
  @Input() activeToolId?: string;
  @Input({ required: true }) guidanceTitle!: string;
  @Input({ required: true }) guidanceCopy!: string;
  @Input({ required: true }) panelTitle!: string;
  @Input({ required: true }) panelSubtitle!: string;
  @Input({ required: true }) placeholder!: string;
  @Input({ required: true }) messages: ChatMessage[] = [];
  @Input() isSending = false;
  @Input() resendAvailable = false;
  @Input() showStrategySidebar = true;
  @Output() readonly workspaceChange = new EventEmitter<string>();
  @Output() readonly messageSend = new EventEmitter<string>();
  @Output() readonly resendLastMessage = new EventEmitter<void>();

  toggleStrategySidebar(): void {
    this.isStrategySidebarCollapsed = !this.isStrategySidebarCollapsed;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.sidebarStorageKey, String(this.isStrategySidebarCollapsed));
    }
  }

  private readStoredSidebarState(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(this.sidebarStorageKey) === 'true';
  }
}
