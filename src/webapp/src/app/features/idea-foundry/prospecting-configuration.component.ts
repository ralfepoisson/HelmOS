import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IdeaFoundryApiService, ProspectingConfigurationRuntimeState } from './idea-foundry-api.service';
import { ProspectingConfigSectionComponent } from './prospecting-config-section.component';
import { ProspectingQueryFamilyCardComponent } from './prospecting-query-family-card.component';
import {
  ConfigurationHealthItem,
  OutputQualityMetric,
  PriorityLevel,
  ProspectingAgentState,
  ProspectingConfigurationSnapshot,
  QueryFamily,
  SearchTheme,
  SignalQualityRule,
  SourceMixItem,
  StrategyChangeEntry,
  StrategyPattern
} from './prospecting-configuration.models';
import { PROSPECTING_CONFIGURATION_MOCK } from './prospecting-configuration.mock';

@Component({
  selector: 'app-prospecting-configuration',
  standalone: true,
  imports: [CommonModule, FormsModule, ProspectingConfigSectionComponent, ProspectingQueryFamilyCardComponent],
  template: `
    <section class="prospecting-page">
      <header class="hero-shell helmos-card">
        <div class="hero-copy">
          <span class="hero-kicker">Prospecting Configuration</span>
          <h1>Control how the Prospecting Agent searches for new opportunity signals</h1>
          <p>
            This control surface governs how the upstream prospecting strategy explores sources, tests search directions,
            and surfaces raw material into the Idea Foundry pipeline.
          </p>
        </div>

        <div class="hero-actions">
          <button type="button" class="btn btn-outline-secondary" (click)="previewStrategy()">
            Preview strategy
          </button>
          <button type="button" class="btn btn-outline-secondary" (click)="runNow()" [disabled]="isRunningAgent || isExecutingNow">
            {{ isExecutingNow ? 'Executing…' : 'Run now' }}
          </button>
          <button type="button" class="btn btn-outline-secondary" (click)="handleAgentAction()" [disabled]="isRunningAgent || isExecutingNow">
            {{ isRunningAgent ? 'Running…' : 'Run Agent' }}
          </button>
          <button type="button" class="btn btn-primary" [disabled]="!hasUnsavedChanges" (click)="saveChanges()">
            Save changes
          </button>
        </div>

        <div class="status-strip">
          <div class="status-pill" [class.status-pill-paused]="runtimeState.agentState === 'paused' || !isRunningAgent && runtimeState.latestRunStatus !== 'RUNNING'">
            Agent state: {{ isRunningAgent || runtimeState.agentState === 'active' ? 'Active' : 'Paused' }}
          </div>
          <div class="status-pill status-pill-neutral">Strategy mode: {{ snapshot.strategyMode }}</div>
          <div class="status-pill status-pill-neutral">Last run: {{ runtimeState.lastRun ?? snapshot.lastRun }}</div>
          <div class="status-pill status-pill-neutral">Next scheduled run: {{ runtimeState.nextRun ?? snapshot.nextRun }}</div>
          <div class="status-pill status-pill-neutral">Sources enabled: {{ enabledSourceCount }}</div>
        </div>

        <div *ngIf="surfaceMessage" class="hero-message" aria-live="polite">
          {{ surfaceMessage }}
        </div>
      </header>

      <div class="content-grid">
        <div class="main-column">
          <app-prospecting-config-section
            eyebrow="Objective"
            title="Prospecting objective"
            description="Define what the agent is trying to discover and the boundaries it should respect."
          >
            <div class="field-grid two-up">
              <label class="field-block">
                <span>Objective name</span>
                <input class="form-control" [(ngModel)]="snapshot.objective.name" />
              </label>
              <label class="field-block">
                <span>Target domain / market</span>
                <input class="form-control" [(ngModel)]="snapshot.objective.targetDomain" />
              </label>
            </div>

            <label class="field-block">
              <span>Objective description</span>
              <textarea class="form-control" rows="3" [(ngModel)]="snapshot.objective.description"></textarea>
            </label>

            <div class="field-grid two-up">
              <label class="field-block">
                <span>Search posture</span>
                <select class="form-select" [(ngModel)]="snapshot.objective.searchPosture">
                  <option>Broad exploration</option>
                  <option>Targeted exploration</option>
                </select>
              </label>
              <label class="field-block">
                <span>Operator note</span>
                <textarea class="form-control" rows="2" [(ngModel)]="snapshot.objective.operatorNote"></textarea>
              </label>
            </div>

            <div class="field-grid two-up">
              <label class="field-block">
                <span>Include keywords / themes</span>
                <textarea class="form-control" rows="3" [(ngModel)]="snapshot.objective.includeKeywords"></textarea>
              </label>
              <label class="field-block">
                <span>Exclude themes / guardrails</span>
                <textarea class="form-control" rows="3" [(ngModel)]="snapshot.objective.excludeThemes"></textarea>
              </label>
            </div>
          </app-prospecting-config-section>

          <app-prospecting-config-section
            eyebrow="Search strategy"
            title="Strategic logic"
            description="Steer the search style in human terms rather than raw query syntax."
          >
            <div class="strategy-summary-box">
              <span class="mini-label">Strategy summary</span>
              <textarea class="form-control" rows="2" [(ngModel)]="snapshot.strategySummary"></textarea>
            </div>

            <div class="pattern-grid">
              <article
                *ngFor="let pattern of snapshot.strategyPatterns"
                class="pattern-card"
                [class.pattern-card-selected]="pattern.selected"
              >
                <div class="pattern-head">
                  <label class="pattern-toggle">
                    <input type="checkbox" [(ngModel)]="pattern.selected" />
                    <span>{{ pattern.label }}</span>
                  </label>
                  <select class="form-select form-select-sm pattern-priority" [(ngModel)]="pattern.priority">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
                <p>{{ pattern.description }}</p>
              </article>
            </div>

            <label class="field-block">
              <span>Current steering hypothesis</span>
              <textarea class="form-control" rows="3" [(ngModel)]="snapshot.steeringHypothesis"></textarea>
            </label>
          </app-prospecting-config-section>

          <app-prospecting-config-section
            eyebrow="Themes"
            title="Search themes / lenses"
            description="Shape the patterns the agent should actively search for and explain why they matter."
          >
            <div class="theme-composer">
              <input class="form-control" [(ngModel)]="newThemeLabel" placeholder="Add a new theme..." />
              <select class="form-select" [(ngModel)]="newThemePriority">
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
              <input class="form-control" [(ngModel)]="newThemeRationale" placeholder="Short rationale..." />
              <button type="button" class="btn btn-outline-secondary" (click)="addTheme()">Add theme</button>
            </div>

            <div class="theme-list">
              <article *ngFor="let theme of snapshot.themes; let i = index" class="theme-row">
                <div class="theme-main">
                  <div class="theme-top">
                    <span class="theme-label">{{ theme.label }}</span>
                    <span class="theme-status" [class.theme-status-paused]="theme.status === 'paused'">
                      {{ theme.status === 'active' ? 'Active' : 'Paused' }}
                    </span>
                  </div>
                  <div class="theme-controls">
                    <select class="form-select form-select-sm" [(ngModel)]="theme.priority">
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                    <button type="button" class="btn btn-link btn-sm" (click)="toggleThemeStatus(theme.id)">
                      {{ theme.status === 'active' ? 'Pause' : 'Resume' }}
                    </button>
                    <button type="button" class="btn btn-link btn-sm" [disabled]="i === 0" (click)="moveTheme(i, -1)">
                      Move up
                    </button>
                    <button
                      type="button"
                      class="btn btn-link btn-sm"
                      [disabled]="i === snapshot.themes.length - 1"
                      (click)="moveTheme(i, 1)"
                    >
                      Move down
                    </button>
                    <button type="button" class="btn btn-link btn-sm text-danger" (click)="removeTheme(theme.id)">
                      Remove
                    </button>
                  </div>
                </div>
                <textarea class="form-control" rows="2" [(ngModel)]="theme.rationale"></textarea>
              </article>
            </div>
          </app-prospecting-config-section>

          <app-prospecting-config-section
            eyebrow="Source mix"
            title="Where the agent is looking"
            description="Control the mix of conversational, structured, and contextual sources that feed prospecting."
          >
            <div class="source-grid">
              <article *ngFor="let source of snapshot.sources" class="source-card" [class.source-card-disabled]="!source.enabled">
                <div class="source-head">
                  <label class="source-toggle">
                    <input type="checkbox" [(ngModel)]="source.enabled" />
                    <span>{{ source.label }}</span>
                  </label>
                  <span class="freshness-pill">{{ source.freshness }}</span>
                </div>
                <p>{{ source.description }}</p>
                <div class="source-meta">
                  <div>
                    <span class="mini-label">Expected signal</span>
                    <strong>{{ source.signalType }}</strong>
                  </div>
                  <div>
                    <span class="mini-label">Trust / noise</span>
                    <strong>{{ source.noiseProfile }}</strong>
                  </div>
                  <label class="field-block field-block-compact">
                    <span>Review frequency</span>
                    <select class="form-select form-select-sm" [(ngModel)]="source.reviewFrequency">
                      <option>Every run</option>
                      <option>Daily</option>
                      <option>Every other day</option>
                      <option>Twice weekly</option>
                      <option>Weekly</option>
                    </select>
                  </label>
                </div>
              </article>
            </div>
          </app-prospecting-config-section>

          <app-prospecting-config-section
            eyebrow="Search directions"
            title="Query families / active search directions"
            description="Inspect and steer the search families that translate strategy into actual prospecting behaviour."
          >
            <div class="query-family-list">
              <app-prospecting-query-family-card
                *ngFor="let family of orderedQueryFamilies"
                [family]="family"
                (toggleExpand)="toggleQueryExpand($event)"
                (duplicate)="duplicateQueryFamily($event)"
                (togglePause)="toggleQueryPause($event)"
                (edit)="toggleQueryExpand($event)"
                (boost)="adjustQueryPriority($event, -1)"
                (demote)="adjustQueryPriority($event, 1)"
              />
            </div>
          </app-prospecting-config-section>

          <app-prospecting-config-section
            eyebrow="Signal filters"
            title="Signal quality rules"
            description="Explain what gets favoured, filtered, or down-ranked before a raw hit becomes a source item."
          >
            <div class="rule-list">
              <article *ngFor="let rule of snapshot.signalRules" class="rule-row">
                <div class="rule-copy">
                  <div class="rule-title-row">
                    <label class="source-toggle">
                      <input type="checkbox" [(ngModel)]="rule.enabled" />
                      <span>{{ rule.title }}</span>
                    </label>
                    <select class="form-select form-select-sm rule-strictness" [(ngModel)]="rule.strictness">
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>
                  <p>{{ rule.description }}</p>
                </div>
              </article>
            </div>
          </app-prospecting-config-section>

          <app-prospecting-config-section
            eyebrow="Run controls"
            title="Scan cadence & run mode"
            description="Set the operating rhythm, geographic scope, and practical search guardrails."
          >
            <div class="field-grid three-up">
              <label class="field-block">
                <span>Run mode</span>
                <select class="form-select" [(ngModel)]="snapshot.cadence.runMode">
                  <option>Continuous</option>
                  <option>Scheduled</option>
                  <option>Manual only</option>
                </select>
              </label>
              <label class="field-block">
                <span>Cadence</span>
                <select class="form-select" [(ngModel)]="snapshot.cadence.cadence">
                  <option>Every hour</option>
                  <option>Every 4 hours</option>
                  <option>Twice daily</option>
                  <option>Daily</option>
                </select>
              </label>
              <label class="field-block">
                <span>Max results per run</span>
                <input class="form-control" type="number" min="5" [(ngModel)]="snapshot.cadence.maxResultsPerRun" />
              </label>
            </div>

            <div class="field-grid two-up">
              <label class="field-block">
                <span>Review threshold for Source promotion</span>
                <textarea class="form-control" rows="3" [(ngModel)]="snapshot.cadence.reviewThreshold"></textarea>
              </label>
              <label class="field-block">
                <span>Budget / rate-limit guardrails</span>
                <textarea class="form-control" rows="3" [(ngModel)]="snapshot.cadence.budgetGuardrail"></textarea>
              </label>
            </div>

            <div class="field-grid two-up">
              <label class="field-block">
                <span>Geographic scope</span>
                <input class="form-control" [(ngModel)]="snapshot.cadence.geographicScope" />
              </label>
              <label class="field-block">
                <span>Language scope</span>
                <input class="form-control" [(ngModel)]="snapshot.cadence.languageScope" />
              </label>
            </div>

            <div class="action-row">
              <button type="button" class="btn btn-outline-secondary" (click)="resetChanges()">Reset draft changes</button>
            </div>
          </app-prospecting-config-section>
        </div>

        <aside class="side-column">
          <app-prospecting-config-section eyebrow="Health" title="Configuration health" [compact]="true">
            <div class="health-list">
              <article *ngFor="let item of configurationHealth" class="health-row">
                <div>
                  <strong>{{ item.label }}</strong>
                  <p>{{ item.helper }}</p>
                </div>
                <span class="health-state" [attr.data-state]="item.state">{{ item.state }}</span>
              </article>
            </div>
          </app-prospecting-config-section>

          <app-prospecting-config-section eyebrow="Snapshot" title="Current strategy snapshot" [compact]="true">
            <p class="snapshot-copy">{{ strategySnapshot }}</p>
          </app-prospecting-config-section>

          <app-prospecting-config-section eyebrow="Output quality" title="Recent output quality" [compact]="true">
            <div class="metric-grid">
              <article *ngFor="let metric of snapshot.recentMetrics" class="metric-card">
                <span class="mini-label">{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
                <span class="metric-trend" [attr.data-trend]="metric.trend">{{ metric.helper }}</span>
              </article>
            </div>
          </app-prospecting-config-section>

          <app-prospecting-config-section eyebrow="Recent changes" title="Recent strategy changes" [compact]="true">
            <div class="timeline">
              <article *ngFor="let change of snapshot.recentChanges" class="timeline-item">
                <div class="timeline-marker"></div>
                <div>
                  <strong>{{ change.title }}</strong>
                  <p>{{ change.detail }}</p>
                  <span class="timeline-time">{{ change.timestamp }}</span>
                </div>
              </article>
            </div>
          </app-prospecting-config-section>
        </aside>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .prospecting-page {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .hero-shell {
        padding: 1.3rem;
        border: 1px solid rgba(255, 206, 0, 0.18);
        background:
          linear-gradient(135deg, rgba(255, 249, 214, 0.94), rgba(255, 255, 255, 0.98) 46%),
          rgba(255, 255, 255, 0.96);
      }

      .hero-shell h1 {
        margin: 0.45rem 0 0.5rem;
        font-size: clamp(1.9rem, 3vw, 2.8rem);
        font-weight: 800;
        letter-spacing: -0.05em;
        line-height: 1.03;
        max-width: 52rem;
      }

      .hero-shell p,
      .field-block span,
      .strategy-summary-box,
      .theme-row textarea,
      .source-card p,
      .rule-copy p,
      .snapshot-copy,
      .health-row p,
      .timeline-item p {
        color: var(--helmos-muted);
      }

      .hero-kicker,
      .mini-label {
        display: inline-block;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero-kicker {
        color: #7a6400;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
        justify-content: flex-end;
        margin-top: 1rem;
      }

      .status-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
        margin-top: 1rem;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        min-height: 2rem;
        padding: 0 0.75rem;
        border-radius: 999px;
        background: rgba(225, 246, 234, 0.92);
        color: #177245;
        font-size: 0.8rem;
        font-weight: 700;
      }

      .status-pill-paused {
        background: rgba(255, 241, 217, 0.92);
        color: #9a6700;
      }

      .status-pill-neutral {
        background: rgba(255, 255, 255, 0.82);
        color: #46566d;
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      .hero-message {
        margin-top: 0.9rem;
        padding: 0.8rem 0.95rem;
        border-radius: 0.95rem;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(219, 228, 238, 0.95);
        color: #445167;
        font-weight: 600;
      }

      .content-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.8fr) minmax(290px, 0.9fr);
        gap: 1rem;
        align-items: start;
      }

      .main-column,
      .side-column {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .side-column {
        position: sticky;
        top: 84px;
      }

      .field-grid {
        display: grid;
        gap: 0.9rem;
      }

      .two-up {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .three-up {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .field-block {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .field-block > span {
        font-size: 0.82rem;
        font-weight: 700;
      }

      .field-block-compact > span {
        font-size: 0.76rem;
      }

      .strategy-summary-box {
        margin-bottom: 1rem;
      }

      .mini-label {
        color: var(--helmos-accent);
        margin-bottom: 0.25rem;
      }

      .pattern-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
        margin-bottom: 1rem;
      }

      .pattern-card {
        padding: 0.95rem;
        border-radius: 1rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(248, 251, 255, 0.78);
      }

      .pattern-card-selected {
        border-color: rgba(255, 206, 0, 0.55);
        background: linear-gradient(180deg, rgba(255, 248, 196, 0.72), rgba(255, 255, 255, 0.92));
      }

      .pattern-head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: flex-start;
      }

      .pattern-toggle,
      .source-toggle {
        display: inline-flex;
        gap: 0.55rem;
        align-items: center;
        font-weight: 700;
        color: var(--helmos-text);
      }

      .pattern-priority,
      .rule-strictness {
        width: 110px;
      }

      .pattern-card p {
        margin: 0.6rem 0 0;
        color: var(--helmos-muted);
        line-height: 1.55;
      }

      .theme-composer {
        display: grid;
        grid-template-columns: minmax(180px, 1.2fr) 140px minmax(180px, 1.4fr) auto;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .theme-list {
        display: grid;
        gap: 0.8rem;
      }

      .theme-row {
        padding: 0.95rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.86);
      }

      .theme-main,
      .theme-top,
      .theme-controls,
      .source-head,
      .rule-title-row,
      .health-row {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .theme-top {
        align-items: center;
      }

      .theme-label {
        font-weight: 800;
      }

      .theme-status {
        display: inline-flex;
        align-items: center;
        min-height: 1.65rem;
        padding: 0 0.55rem;
        border-radius: 999px;
        background: rgba(225, 246, 234, 0.92);
        color: #177245;
        font-size: 0.72rem;
        font-weight: 800;
      }

      .theme-status-paused {
        background: rgba(234, 242, 255, 0.92);
        color: var(--helmos-accent);
      }

      .theme-controls {
        flex-wrap: wrap;
        align-items: center;
        margin: 0.65rem 0;
      }

      .source-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
      }

      .source-card {
        padding: 0.95rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.88);
      }

      .source-card-disabled {
        opacity: 0.68;
      }

      .freshness-pill {
        display: inline-flex;
        align-items: center;
        min-height: 1.65rem;
        padding: 0 0.55rem;
        border-radius: 999px;
        background: rgba(245, 247, 251, 0.95);
        color: #506079;
        font-size: 0.72rem;
        font-weight: 800;
      }

      .source-card p,
      .rule-copy p,
      .health-row p,
      .timeline-item p,
      .snapshot-copy {
        margin: 0.55rem 0 0;
        line-height: 1.55;
      }

      .source-meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        margin-top: 0.8rem;
      }

      .query-family-list,
      .rule-list,
      .health-list,
      .timeline {
        display: grid;
        gap: 0.8rem;
      }

      .rule-row {
        padding: 0.95rem;
        border-radius: 1rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(248, 251, 255, 0.78);
      }

      .rule-title-row {
        align-items: center;
      }

      .action-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.75rem;
      }

      .health-row {
        align-items: flex-start;
        padding: 0.85rem 0.9rem;
        border-radius: 0.95rem;
        background: rgba(248, 251, 255, 0.78);
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      .health-row strong,
      .metric-card strong,
      .timeline-item strong {
        color: var(--helmos-text);
      }

      .health-state {
        display: inline-flex;
        align-items: center;
        min-height: 1.7rem;
        padding: 0 0.55rem;
        border-radius: 999px;
        font-size: 0.73rem;
        font-weight: 800;
        white-space: nowrap;
      }

      .health-state[data-state='Strong'],
      .health-state[data-state='Healthy'] {
        background: rgba(225, 246, 234, 0.92);
        color: #177245;
      }

      .health-state[data-state='Needs attention'] {
        background: rgba(255, 241, 217, 0.92);
        color: #9a6700;
      }

      .health-state[data-state='At risk'] {
        background: rgba(255, 230, 232, 0.92);
        color: #b42318;
      }

      .metric-grid {
        display: grid;
        gap: 0.75rem;
      }

      .metric-card {
        padding: 0.9rem;
        border-radius: 0.95rem;
        background: rgba(248, 251, 255, 0.78);
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      .metric-card strong {
        display: block;
        margin-top: 0.25rem;
        font-size: 1.15rem;
      }

      .metric-trend {
        display: block;
        margin-top: 0.35rem;
        font-size: 0.82rem;
        line-height: 1.5;
      }

      .metric-trend[data-trend='up'] {
        color: #177245;
      }

      .metric-trend[data-trend='down'] {
        color: #9a6700;
      }

      .metric-trend[data-trend='steady'] {
        color: var(--helmos-muted);
      }

      .timeline-item {
        position: relative;
        display: grid;
        grid-template-columns: 14px minmax(0, 1fr);
        gap: 0.75rem;
      }

      .timeline-marker {
        position: relative;
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 50%;
        margin-top: 0.35rem;
        background: rgba(255, 206, 0, 0.96);
        box-shadow: 0 0 0 5px rgba(255, 248, 196, 0.65);
      }

      .timeline-time {
        display: inline-block;
        margin-top: 0.35rem;
        font-size: 0.78rem;
        font-weight: 700;
        color: #506079;
      }

      @media (max-width: 1399.98px) {
        .content-grid {
          grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.95fr);
        }
      }

      @media (max-width: 1199.98px) {
        .content-grid {
          grid-template-columns: 1fr;
        }

        .side-column {
          position: static;
        }
      }

      @media (max-width: 991.98px) {
        .two-up,
        .three-up,
        .pattern-grid,
        .source-grid,
        .source-meta,
        .theme-composer {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class ProspectingConfigurationComponent implements OnInit {
  snapshot = cloneSnapshot(PROSPECTING_CONFIGURATION_MOCK);
  private baseline = cloneSnapshot(PROSPECTING_CONFIGURATION_MOCK);
  runtimeState: ProspectingConfigurationRuntimeState = {
    agentState: 'active',
    latestRunStatus: 'idle',
    isRunning: false,
    lastRun: null,
    nextRun: null,
    resultRecordCount: 0
  };
  isLoading = false;
  isRunningAgent = false;
  isExecutingNow = false;

  surfaceMessage = 'The current strategy is tuned for recurring administrative and compliance pain with strong operator-language evidence.';
  newThemeLabel = '';
  newThemePriority: PriorityLevel = 'Medium';
  newThemeRationale = '';

  constructor(private readonly ideaFoundryApi: IdeaFoundryApiService) {}

  async ngOnInit(): Promise<void> {
    this.isLoading = true;

    try {
      const payload = await this.ideaFoundryApi.getProspectingConfiguration();
      if (payload.snapshot) {
        this.snapshot = normalizeIncomingSnapshot(payload.snapshot, this.snapshot);
        this.baseline = cloneSnapshot(this.snapshot);
      }
      this.runtimeState = payload.runtime;

      const reply = payload.latestReview?.['reply_to_user'] as { content?: unknown } | null | undefined;
      const replyContent = typeof reply?.content === 'string' ? reply.content : null;
      if (replyContent) {
        this.surfaceMessage = replyContent;
      }
    } catch (error) {
      this.surfaceMessage =
        error instanceof Error
          ? error.message
          : 'The persisted prospecting configuration could not be loaded, so the local draft remains in use.';
    } finally {
      this.isLoading = false;
    }
  }

  get enabledSourceCount(): number {
    return this.snapshot.sources.filter((source) => source.enabled).length;
  }

  get hasUnsavedChanges(): boolean {
    return JSON.stringify(this.snapshot) !== JSON.stringify(this.baseline);
  }

  get orderedQueryFamilies(): QueryFamily[] {
    return [...this.snapshot.queryFamilies].sort((left, right) => left.priorityRank - right.priorityRank);
  }

  get configurationHealth(): ConfigurationHealthItem[] {
    return [
      {
        label: 'Objective clarity',
        state: this.snapshot.objective.description.length > 120 ? 'Strong' : 'Needs attention',
        helper: 'The objective is most useful when it names pain, context, and signal boundaries clearly.'
      },
      {
        label: 'Source coverage',
        state: this.enabledSourceCount >= 5 ? 'Healthy' : 'Needs attention',
        helper: 'A healthy source mix balances conversational evidence with validating context.'
      },
      {
        label: 'Strategy coherence',
        state: this.snapshot.strategyPatterns.filter((pattern) => pattern.selected).length >= 3 ? 'Strong' : 'At risk',
        helper: 'Selected strategy patterns should reinforce one another instead of scattering the search.'
      },
      {
        label: 'Signal filter quality',
        state: this.snapshot.signalRules.filter((rule) => rule.enabled).length >= 5 ? 'Healthy' : 'Needs attention',
        helper: 'Strong filters keep noisy hits from obscuring the source queue.'
      },
      {
        label: 'Operating cadence',
        state: this.snapshot.agentState === 'paused' ? 'Needs attention' : 'Healthy',
        helper: 'Cadence should match how quickly new signal is needed without wasting search budget.'
      }
    ];
  }

  get strategySnapshot(): string {
    const activeThemes = this.snapshot.themes
      .filter((theme) => theme.status === 'active')
      .slice(0, 3)
      .map((theme) => theme.label)
      .join(', ');
    const activeSources = this.snapshot.sources
      .filter((source) => source.enabled)
      .slice(0, 2)
      .map((source) => source.label)
      .join(' and ');

    return `The agent is currently running a ${this.snapshot.strategyMode.toLowerCase()} around ${activeThemes}, prioritising ${activeSources} over lower-signal channels while filtering for repeated, operationally costly pain.`;
  }

  previewStrategy(): void {
    this.surfaceMessage =
      'Preview ready: the next run will emphasise complaint-led search directions, repeated admin burden, and high-evidence forum signals.';
    this.logStrategyChange('Previewed strategy', 'Reviewed the current search posture and active query-family mix.');
  }

  async runNow(): Promise<void> {
    if (this.isExecutingNow || this.isRunningAgent) {
      return;
    }

    this.isExecutingNow = true;
    this.runtimeState = {
      ...this.runtimeState,
      latestRunStatus: 'RUNNING',
      isRunning: true,
      agentState: 'active',
    };
    this.surfaceMessage = 'Prospecting Execution is searching the web using the latest saved strategy...';

    try {
      const payload = await this.ideaFoundryApi.executeProspectingRun();
      if (payload.snapshot) {
        this.snapshot = normalizeIncomingSnapshot(payload.snapshot, this.snapshot);
        this.baseline = cloneSnapshot(this.snapshot);
      }
      this.runtimeState = payload.runtime;
      this.snapshot.lastRun = payload.runtime.lastRun ?? this.snapshot.lastRun;
      this.snapshot.nextRun = payload.runtime.nextRun ?? this.snapshot.nextRun;
      this.surfaceMessage = `Prospecting execution completed and stored ${payload.runtime.resultRecordCount} normalized source records.`;
      this.logStrategyChange(
        'Triggered manual prospecting execution',
        `Executed the saved prospecting strategy and stored ${payload.runtime.resultRecordCount} normalized source records.`
      );
    } catch (error) {
      this.runtimeState = {
        ...this.runtimeState,
        latestRunStatus: 'FAILED',
        isRunning: false,
      };
      this.surfaceMessage =
        error instanceof Error ? error.message : 'Prospecting execution failed before any source records could be stored.';
    } finally {
      this.isExecutingNow = false;
      this.runtimeState = {
        ...this.runtimeState,
        isRunning: false,
      };
    }
  }

  async handleAgentAction(): Promise<void> {
    if (this.isRunningAgent) {
      return;
    }

    this.isRunningAgent = true;
    this.runtimeState = {
      ...this.runtimeState,
      latestRunStatus: 'RUNNING',
      isRunning: true,
      agentState: 'active',
    };
    this.surfaceMessage = 'Prospecting Agent is reviewing the current strategy and recent search results...';

    try {
      const payload = await this.ideaFoundryApi.runProspectingConfigurationReview(this.snapshot);
      if (payload.snapshot) {
        this.snapshot = normalizeIncomingSnapshot(payload.snapshot, this.snapshot);
        this.baseline = cloneSnapshot(this.snapshot);
      }
      this.runtimeState = payload.runtime;

      const reply = payload.latestReview?.['reply_to_user'] as { content?: unknown } | null | undefined;
      const replyContent =
        typeof reply?.content === 'string'
          ? reply.content
          : 'Prospecting Agent completed the review and updated the saved configuration.';
      this.surfaceMessage = replyContent;
      this.logStrategyChange(
        'Ran Prospecting Agent review',
        'The agent reviewed the current strategy, considered recent search results, and persisted a refined configuration.'
      );
    } catch (error) {
      this.runtimeState = {
        ...this.runtimeState,
        latestRunStatus: 'FAILED',
        isRunning: false,
      };
      this.surfaceMessage =
        error instanceof Error ? error.message : 'The Prospecting Agent review failed before a new configuration could be saved.';
    } finally {
      this.isRunningAgent = false;
      this.runtimeState = {
        ...this.runtimeState,
        isRunning: false,
      };
    }
  }

  saveChanges(): void {
    this.baseline = cloneSnapshot(this.snapshot);
    this.surfaceMessage = 'Draft changes saved locally. Ready for future backend persistence.';
    this.logStrategyChange('Saved prospecting configuration', 'Committed the current local draft as the active working configuration.');
  }

  resetChanges(): void {
    this.snapshot = cloneSnapshot(this.baseline);
    this.newThemeLabel = '';
    this.newThemePriority = 'Medium';
    this.newThemeRationale = '';
    this.surfaceMessage = 'Draft changes were reset to the last saved configuration.';
  }

  addTheme(): void {
    const label = this.newThemeLabel.trim();
    if (!label) {
      this.surfaceMessage = 'Add a short theme label before creating a new search lens.';
      return;
    }

    const theme: SearchTheme = {
      id: `theme-${Date.now()}`,
      label,
      status: 'active',
      priority: this.newThemePriority,
      rationale: this.newThemeRationale.trim() || 'Operator-added theme awaiting a fuller rationale.'
    };

    this.snapshot.themes = [...this.snapshot.themes, theme];
    this.newThemeLabel = '';
    this.newThemePriority = 'Medium';
    this.newThemeRationale = '';
    this.surfaceMessage = `Added "${theme.label}" to the active prospecting lenses.`;
    this.logStrategyChange(`Added “${theme.label}” theme`, 'Expanded the active search lens set from the operator control surface.');
  }

  removeTheme(themeId: string): void {
    const theme = this.snapshot.themes.find((item) => item.id === themeId);
    this.snapshot.themes = this.snapshot.themes.filter((item) => item.id !== themeId);
    if (theme) {
      this.surfaceMessage = `Removed "${theme.label}" from the theme stack.`;
      this.logStrategyChange(`Removed “${theme.label}” theme`, 'Trimmed the active search theme list to sharpen prospecting focus.');
    }
  }

  moveTheme(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.snapshot.themes.length) {
      return;
    }

    const themes = [...this.snapshot.themes];
    const [theme] = themes.splice(index, 1);
    themes.splice(target, 0, theme);
    this.snapshot.themes = themes;
  }

  toggleThemeStatus(themeId: string): void {
    this.snapshot.themes = this.snapshot.themes.map((theme) =>
      theme.id === themeId ? { ...theme, status: theme.status === 'active' ? 'paused' : 'active' } : theme
    );
  }

  toggleQueryExpand(queryId: string): void {
    this.snapshot.queryFamilies = this.snapshot.queryFamilies.map((family) =>
      family.id === queryId ? { ...family, expanded: !family.expanded } : family
    );
  }

  duplicateQueryFamily(queryId: string): void {
    const family = this.snapshot.queryFamilies.find((item) => item.id === queryId);
    if (!family) {
      return;
    }

    const duplicate: QueryFamily = {
      ...family,
      id: `query-${Date.now()}`,
      title: `${family.title} (copy)`,
      expanded: true,
      priorityRank: this.snapshot.queryFamilies.length + 1
    };

    this.snapshot.queryFamilies = [...this.snapshot.queryFamilies, duplicate];
    this.surfaceMessage = `Duplicated "${family.title}" so it can be edited as a separate search direction.`;
    this.logStrategyChange(`Duplicated query family`, `Created a copy of "${family.title}" for further steering.`);
  }

  toggleQueryPause(queryId: string): void {
    this.snapshot.queryFamilies = this.snapshot.queryFamilies.map((family) =>
      family.id === queryId
        ? { ...family, status: family.status === 'Paused' ? 'Active' : 'Paused' }
        : family
    );
  }

  adjustQueryPriority(queryId: string, delta: -1 | 1): void {
    const families = [...this.snapshot.queryFamilies];
    const family = families.find((item) => item.id === queryId);
    if (!family) {
      return;
    }

    family.priorityRank = Math.max(1, family.priorityRank + delta);
    families
      .sort((left, right) => left.priorityRank - right.priorityRank)
      .forEach((item, index) => {
        item.priorityRank = index + 1;
      });
    this.snapshot.queryFamilies = families;
  }

  private logStrategyChange(title: string, detail: string): void {
    const entry: StrategyChangeEntry = {
      id: `change-${Date.now()}`,
      title,
      detail,
      timestamp: 'Just now'
    };

    this.snapshot.recentChanges = [entry, ...this.snapshot.recentChanges].slice(0, 6);
  }
}

function cloneSnapshot(snapshot: ProspectingConfigurationSnapshot): ProspectingConfigurationSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as ProspectingConfigurationSnapshot;
}

function normalizeIncomingSnapshot(
  snapshot: ProspectingConfigurationSnapshot,
  fallback: ProspectingConfigurationSnapshot
): ProspectingConfigurationSnapshot {
  return {
    agentState: readEnumValue(snapshot.agentState, fallback.agentState),
    strategyMode: readNonEmptyString(snapshot.strategyMode, fallback.strategyMode) as ProspectingConfigurationSnapshot['strategyMode'],
    lastRun: readNonEmptyString(snapshot.lastRun, fallback.lastRun),
    nextRun: readNonEmptyString(snapshot.nextRun, fallback.nextRun),
    objective: {
      name: readNonEmptyString(snapshot.objective?.name, fallback.objective.name),
      description: readNonEmptyString(snapshot.objective?.description, fallback.objective.description),
      targetDomain: readNonEmptyString(snapshot.objective?.targetDomain, fallback.objective.targetDomain),
      searchPosture: readEnumValue(snapshot.objective?.searchPosture, fallback.objective.searchPosture),
      includeKeywords: readNonEmptyString(snapshot.objective?.includeKeywords, fallback.objective.includeKeywords),
      excludeThemes: readNonEmptyString(snapshot.objective?.excludeThemes, fallback.objective.excludeThemes),
      operatorNote: readNonEmptyString(snapshot.objective?.operatorNote, fallback.objective.operatorNote)
    },
    strategySummary: readNonEmptyString(snapshot.strategySummary, fallback.strategySummary),
    steeringHypothesis: readNonEmptyString(snapshot.steeringHypothesis, fallback.steeringHypothesis),
    strategyPatterns:
      Array.isArray(snapshot.strategyPatterns) && snapshot.strategyPatterns.length > 0
        ? snapshot.strategyPatterns.map((pattern, index) => ({
            id: readNonEmptyString(pattern?.id, fallback.strategyPatterns[index]?.id ?? `pattern-${index + 1}`),
            label: readNonEmptyString(pattern?.label, fallback.strategyPatterns[index]?.label ?? 'Strategy pattern'),
            description: readNonEmptyString(pattern?.description, fallback.strategyPatterns[index]?.description ?? ''),
            selected: typeof pattern?.selected === 'boolean' ? pattern.selected : (fallback.strategyPatterns[index]?.selected ?? false),
            priority: readEnumValue(pattern?.priority, fallback.strategyPatterns[index]?.priority ?? 'Medium')
          }))
        : cloneSnapshot(fallback).strategyPatterns,
    themes:
      Array.isArray(snapshot.themes) && snapshot.themes.length > 0
        ? snapshot.themes.map((theme, index) => ({
            id: readNonEmptyString(theme?.id, fallback.themes[index]?.id ?? `theme-${index + 1}`),
            label: readNonEmptyString(theme?.label, fallback.themes[index]?.label ?? 'Theme'),
            status: readEnumValue(theme?.status, fallback.themes[index]?.status ?? 'active'),
            priority: readEnumValue(theme?.priority, fallback.themes[index]?.priority ?? 'Medium'),
            rationale: readNonEmptyString(theme?.rationale, fallback.themes[index]?.rationale ?? '')
          }))
        : cloneSnapshot(fallback).themes,
    sources:
      Array.isArray(snapshot.sources) && snapshot.sources.length > 0
        ? snapshot.sources.map((source, index) => ({
            id: readNonEmptyString(source?.id, fallback.sources[index]?.id ?? `source-${index + 1}`),
            label: readNonEmptyString(source?.label, fallback.sources[index]?.label ?? 'Source'),
            description: readNonEmptyString(source?.description, fallback.sources[index]?.description ?? ''),
            enabled: typeof source?.enabled === 'boolean' ? source.enabled : (fallback.sources[index]?.enabled ?? false),
            freshness: readEnumValue(source?.freshness, fallback.sources[index]?.freshness ?? 'Stable'),
            signalType: readNonEmptyString(source?.signalType, fallback.sources[index]?.signalType ?? ''),
            noiseProfile: readEnumValue(source?.noiseProfile, fallback.sources[index]?.noiseProfile ?? 'Balanced'),
            reviewFrequency: readNonEmptyString(source?.reviewFrequency, fallback.sources[index]?.reviewFrequency ?? 'Every run')
          }))
        : cloneSnapshot(fallback).sources,
    queryFamilies:
      Array.isArray(snapshot.queryFamilies) && snapshot.queryFamilies.length > 0
        ? snapshot.queryFamilies.map((family, index) => ({
            id: readNonEmptyString(family?.id, fallback.queryFamilies[index]?.id ?? `query-${index + 1}`),
            title: readNonEmptyString(family?.title, fallback.queryFamilies[index]?.title ?? 'Query family'),
            intent: readNonEmptyString(family?.intent, fallback.queryFamilies[index]?.intent ?? ''),
            representativeQueries:
              Array.isArray(family?.representativeQueries) && family.representativeQueries.length > 0
                ? [...family.representativeQueries]
                : [...(fallback.queryFamilies[index]?.representativeQueries ?? [])],
            themeLink: readNonEmptyString(family?.themeLink, fallback.queryFamilies[index]?.themeLink ?? ''),
            sourceApplicability:
              Array.isArray(family?.sourceApplicability) && family.sourceApplicability.length > 0
                ? [...family.sourceApplicability]
                : [...(fallback.queryFamilies[index]?.sourceApplicability ?? [])],
            status: readEnumValue(family?.status, fallback.queryFamilies[index]?.status ?? 'Active'),
            confidence: readEnumValue(family?.confidence, fallback.queryFamilies[index]?.confidence ?? 'Promising'),
            expanded: typeof family?.expanded === 'boolean' ? family.expanded : (fallback.queryFamilies[index]?.expanded ?? false),
            priorityRank:
              typeof family?.priorityRank === 'number' && Number.isFinite(family.priorityRank)
                ? family.priorityRank
                : (fallback.queryFamilies[index]?.priorityRank ?? index + 1)
          }))
        : cloneSnapshot(fallback).queryFamilies,
    signalRules:
      Array.isArray(snapshot.signalRules) && snapshot.signalRules.length > 0
        ? snapshot.signalRules.map((rule, index) => ({
            id: readNonEmptyString(rule?.id, fallback.signalRules[index]?.id ?? `rule-${index + 1}`),
            title: readNonEmptyString(rule?.title, fallback.signalRules[index]?.title ?? 'Rule'),
            description: readNonEmptyString(rule?.description, fallback.signalRules[index]?.description ?? ''),
            enabled: typeof rule?.enabled === 'boolean' ? rule.enabled : (fallback.signalRules[index]?.enabled ?? false),
            strictness: readEnumValue(rule?.strictness, fallback.signalRules[index]?.strictness ?? 'Medium')
          }))
        : cloneSnapshot(fallback).signalRules,
    cadence: {
      runMode: readEnumValue(snapshot.cadence?.runMode, fallback.cadence.runMode),
      cadence: readNonEmptyString(snapshot.cadence?.cadence, fallback.cadence.cadence),
      maxResultsPerRun:
        typeof snapshot.cadence?.maxResultsPerRun === 'number' && Number.isFinite(snapshot.cadence.maxResultsPerRun)
          ? snapshot.cadence.maxResultsPerRun
          : fallback.cadence.maxResultsPerRun,
      reviewThreshold: readNonEmptyString(snapshot.cadence?.reviewThreshold, fallback.cadence.reviewThreshold),
      geographicScope: readNonEmptyString(snapshot.cadence?.geographicScope, fallback.cadence.geographicScope),
      languageScope: readNonEmptyString(snapshot.cadence?.languageScope, fallback.cadence.languageScope),
      budgetGuardrail: readNonEmptyString(snapshot.cadence?.budgetGuardrail, fallback.cadence.budgetGuardrail)
    },
    recentMetrics:
      Array.isArray(snapshot.recentMetrics) && snapshot.recentMetrics.length > 0
        ? snapshot.recentMetrics.map((metric, index) => ({
            label: readNonEmptyString(metric?.label, fallback.recentMetrics[index]?.label ?? 'Metric'),
            value: readNonEmptyString(metric?.value, fallback.recentMetrics[index]?.value ?? ''),
            trend: readEnumValue(metric?.trend, fallback.recentMetrics[index]?.trend ?? 'steady'),
            helper: readNonEmptyString(metric?.helper, fallback.recentMetrics[index]?.helper ?? '')
          }))
        : cloneSnapshot(fallback).recentMetrics,
    recentChanges:
      Array.isArray(snapshot.recentChanges) && snapshot.recentChanges.length > 0
        ? snapshot.recentChanges.map((change, index) => ({
            id: readNonEmptyString(change?.id, fallback.recentChanges[index]?.id ?? `change-${index + 1}`),
            title: readNonEmptyString(change?.title, fallback.recentChanges[index]?.title ?? 'Change'),
            detail: readNonEmptyString(change?.detail, fallback.recentChanges[index]?.detail ?? ''),
            timestamp: readNonEmptyString(change?.timestamp, fallback.recentChanges[index]?.timestamp ?? 'Just now')
          }))
        : cloneSnapshot(fallback).recentChanges
  };
}

function readNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readEnumValue<T extends string>(value: unknown, fallback: T): T {
  return typeof value === 'string' && value.trim().length > 0 ? (value as T) : fallback;
}
