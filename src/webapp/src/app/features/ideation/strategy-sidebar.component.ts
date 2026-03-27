import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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

import { StrategyTool } from '../../core/services/workspace-shell.service';
import { CompletionCalloutComponent } from './completion-callout.component';

@Component({
  selector: 'app-strategy-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, FaIconComponent, CompletionCalloutComponent],
  template: `
    <aside class="sidebar-panel p-3 p-xl-4">
      <div class="sidebar-header">
        <span class="sidebar-kicker">Strategy Copilot</span>
      </div>

      <app-completion-callout [title]="guidanceTitle" [copy]="guidanceCopy" />

      <div class="list-group list-group-flush tool-list">
        <ng-container *ngFor="let tool of tools">
          <a
            *ngIf="tool.status === 'available' && tool.route; else availableWithoutRouteOrLocked"
            class="list-group-item list-group-item-action tool-item tool-link"
            [class.active-tool]="tool.id === activeToolId"
            [routerLink]="tool.route"
            queryParamsHandling="merge"
          >
            <ng-container [ngTemplateOutlet]="toolContent" [ngTemplateOutletContext]="{ tool: tool }"></ng-container>
          </a>

          <ng-template #availableWithoutRouteOrLocked>
            <button
              *ngIf="tool.status === 'available'; else lockedPrimaryTool"
              type="button"
              class="list-group-item list-group-item-action tool-item"
              aria-disabled="true"
            >
              <ng-container [ngTemplateOutlet]="toolContent" [ngTemplateOutletContext]="{ tool: tool }"></ng-container>
            </button>
          </ng-template>

          <ng-template #lockedPrimaryTool>
            <button
              type="button"
              class="list-group-item list-group-item-action tool-item locked-tool"
              aria-disabled="true"
            >
              <ng-container [ngTemplateOutlet]="toolContent" [ngTemplateOutletContext]="{ tool: tool }"></ng-container>
            </button>
          </ng-template>
        </ng-container>
      </div>

      <ng-template #toolContent let-tool="tool">
        <div class="tool-icon">
          <fa-icon [icon]="iconMap[tool.icon]"></fa-icon>
        </div>
        <div class="tool-copy">
          <div class="tool-label-row">
            <span class="tool-label">{{ tool.label }}</span>
            <span *ngIf="tool.id === activeToolId" class="active-badge-wrap">
              <span class="badge rounded-pill text-bg-primary">Current</span>
            </span>
            <span *ngIf="tool.status === 'locked'" class="lock-badge-wrap">
              <span
                class="badge rounded-pill lock-badge"
                title="Unlocks when the ideation draft is complete enough for the agent to recommend the next strategy step."
              >
                Locked
              </span>
              <span class="lock-tooltip" role="tooltip">
                Unlocks when the ideation draft is complete enough for the agent to recommend the next strategy step.
              </span>
            </span>
          </div>
          <span class="tool-helper">{{ tool.helper }}</span>
        </div>
      </ng-template>

      <details class="later-tools">
        <summary>More tools later</summary>
        <div class="later-tools-list">
          <button
            *ngFor="let tool of moreTools"
            type="button"
            class="list-group-item list-group-item-action tool-item locked-tool"
            aria-disabled="true"
          >
            <div class="tool-icon">
              <fa-icon [icon]="iconMap[tool.icon]"></fa-icon>
            </div>
            <div class="tool-copy">
              <div class="tool-label-row">
                <span class="tool-label">{{ tool.label }}</span>
                <span class="lock-badge-wrap">
                  <span class="badge rounded-pill lock-badge">Locked</span>
                </span>
              </div>
              <span class="tool-helper">{{ tool.helper }}</span>
            </div>
          </button>
        </div>
      </details>
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .sidebar-panel {
        height: calc(100vh - 96px);
        position: sticky;
        top: 68px;
        overflow: auto;
        padding-bottom: 1.25rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(247, 250, 255, 0.97));
        border-right: 1px solid rgba(219, 228, 238, 0.95);
      }

      .sidebar-kicker {
        display: inline-block;
        font-size: 0.72rem;
        letter-spacing: 0.1em;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--helmos-accent);
      }

      .tool-helper {
        color: var(--helmos-muted);
      }

      .tool-list {
        gap: 0.7rem;
        margin-top: 0.9rem;
      }

      .later-tools {
        margin-top: 1rem;
        border-top: 1px solid rgba(219, 228, 238, 0.9);
        padding-top: 0.85rem;
      }

      .later-tools summary {
        cursor: pointer;
        list-style: none;
        color: var(--helmos-muted);
        font-size: 0.86rem;
        font-weight: 700;
      }

      .later-tools summary::-webkit-details-marker {
        display: none;
      }

      .later-tools-list {
        margin-top: 0.85rem;
        display: grid;
        gap: 0.7rem;
      }

      .tool-item {
        border: 1px solid var(--helmos-border);
        border-radius: 1rem;
        padding: 0.9rem 0.95rem;
        display: flex;
        gap: 0.85rem;
        align-items: flex-start;
        background: rgba(255, 255, 255, 0.82);
        position: relative;
      }

      .tool-link {
        color: inherit;
        text-decoration: none;
      }

      .tool-icon {
        width: 2.2rem;
        height: 2.2rem;
        border-radius: 0.8rem;
        background: var(--helmos-surface-alt);
        border: 1px solid var(--helmos-border);
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        color: #6c7c94;
      }

      .tool-icon fa-icon {
        font-size: 0.92rem;
      }

      .tool-copy {
        min-width: 0;
      }

      .tool-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        margin-bottom: 0.15rem;
        padding-right: 4.25rem;
      }

      .tool-label {
        font-weight: 700;
        color: var(--helmos-text);
      }

      .lock-badge-wrap,
      .active-badge-wrap {
        position: absolute;
        top: 0.9rem;
        right: 0.95rem;
        display: inline-flex;
        align-items: center;
      }

      .lock-badge {
        background: rgba(226, 232, 240, 0.72);
        color: #94a3b8;
      }

      .lock-tooltip {
        position: absolute;
        top: calc(100% + 0.45rem);
        right: 0;
        width: 220px;
        padding: 0.65rem 0.75rem;
        border-radius: 0.85rem;
        background: #172235;
        color: #fff;
        font-size: 0.76rem;
        line-height: 1.45;
        text-align: left;
        box-shadow: 0 18px 40px rgba(23, 34, 53, 0.22);
        opacity: 0;
        pointer-events: none;
        transform: translateY(-4px);
        transition:
          opacity 0.16s ease,
          transform 0.16s ease;
        z-index: 5;
      }

      .lock-tooltip::before {
        content: '';
        position: absolute;
        top: -6px;
        right: 18px;
        width: 12px;
        height: 12px;
        background: #172235;
        transform: rotate(45deg);
      }

      .lock-badge-wrap:hover .lock-tooltip,
      .lock-badge-wrap:focus-within .lock-tooltip {
        opacity: 1;
        transform: translateY(0);
      }

      .active-tool {
        background: linear-gradient(180deg, rgba(234, 242, 255, 0.9), rgba(255, 255, 255, 0.98));
        border-color: rgba(31, 111, 235, 0.28);
        box-shadow: inset 0 0 0 1px rgba(31, 111, 235, 0.08);
      }

      .locked-tool {
        background: linear-gradient(180deg, rgba(246, 248, 252, 0.96), rgba(241, 244, 249, 0.96));
        border-color: rgba(148, 163, 184, 0.18);
        cursor: default;
      }

      .locked-tool .tool-icon {
        background: linear-gradient(180deg, rgba(243, 246, 251, 0.98), rgba(239, 243, 248, 0.98));
        border-color: rgba(148, 163, 184, 0.18);
        color: #94a3b8;
      }

      .locked-tool .tool-label {
        color: #475569;
      }

      .locked-tool .tool-helper {
        color: #7c8aa0;
      }

      @media (max-width: 1199.98px) {
        .sidebar-panel {
          height: auto;
          position: static;
          overflow: visible;
          border-right: 0;
          border-bottom: 1px solid rgba(219, 228, 238, 0.95);
        }
      }
    `
  ]
})
export class StrategySidebarComponent {
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

  @Input() activeToolId?: string;
  @Input({ required: true }) tools: StrategyTool[] = [];
  @Input({ required: true }) moreTools: StrategyTool[] = [];
  @Input({ required: true }) guidanceTitle!: string;
  @Input({ required: true }) guidanceCopy!: string;
}
