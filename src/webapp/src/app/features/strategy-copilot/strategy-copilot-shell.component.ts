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
          class="col-12 col-lg-4 col-xl-3 strategy-column"
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
          [class.col-lg-8]="showStrategySidebar"
          [class.col-xl-6]="showStrategySidebar"
          [class.col-xl-9]="!showStrategySidebar"
          data-testid="workspace-column"
        >
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

      .workspace-column {
        padding: 1.5rem;
        height: calc(100vh - 68px);
        overflow-y: auto;
        overscroll-behavior: contain;
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
      }
    `
  ]
})
export class StrategyCopilotShellComponent {
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
}
