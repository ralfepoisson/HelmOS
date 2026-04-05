import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faCheck,
  faChevronDown,
  faMagnifyingGlass,
  faToggleOff,
  faToggleOn,
  faRotateRight
} from '@fortawesome/free-solid-svg-icons';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import {
  AdminLogRecord,
  AdminLogsService,
  AdminLogsSnapshot,
  LogLevel,
  LogTimeRange
} from './admin-logs.service';

@Component({
  selector: 'app-admin-logs-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, FaIconComponent, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      [surfaceLabel]="'Backend observability'"
      [saveStatus]="loading ? 'Refreshing logs…' : 'Backend logs ready'"
      [showWorkspaceSwitcher]="false"
    />

    <main class="logs-shell container-fluid">
      <section class="logs-hero helmos-card">
        <div>
          <div class="section-kicker">Admin</div>
          <h1>Logs</h1>
          <p>
            Search recent backend log events and quickly include or exclude log levels while
            troubleshooting.
          </p>
        </div>

        <div class="hero-actions">
          <label class="auto-refresh-toggle" for="auto-refresh-toggle">
            <input
              id="auto-refresh-toggle"
              type="checkbox"
              [ngModel]="autoRefreshEnabled"
              (ngModelChange)="setAutoRefresh($event)"
            />
            <fa-icon [icon]="autoRefreshEnabled ? toggleOnIcon : toggleOffIcon"></fa-icon>
            <span>Auto-refresh</span>
          </label>

          <button class="btn btn-outline-secondary refresh-button" type="button" (click)="refresh()">
            <fa-icon [icon]="rotateIcon"></fa-icon>
            <span>Refresh</span>
          </button>
        </div>
      </section>

      <section class="filters-card helmos-card">
        <div class="filters-main">
          <div class="filter-group search-group">
            <label class="filter-label" for="logs-search">Search logs</label>
            <div class="search-row">
              <div class="search-input-wrap">
                <fa-icon class="search-icon" [icon]="searchIcon"></fa-icon>
                <input
                  id="logs-search"
                  class="form-control search-input"
                  [(ngModel)]="searchQuery"
                  placeholder="Search message, event, scope, or JSON context"
                  (keyup.enter)="applyFilters()"
                />
              </div>
              <button class="btn btn-light search-button" type="button" (click)="applyFilters()">Search</button>
            </div>
          </div>

          <div class="filter-group time-group">
            <label class="filter-label" for="time-range">Time range</label>
            <select id="time-range" class="form-select" [(ngModel)]="timeRange" (ngModelChange)="applyFilters()">
              <option *ngFor="let option of timeRangeOptions" [value]="option.value">{{ option.label }}</option>
            </select>
          </div>

          <div class="filter-group scope-group">
            <label class="filter-label" for="scope-filter">Scope</label>
            <select
              id="scope-filter"
              class="form-select"
              [(ngModel)]="selectedScope"
              (ngModelChange)="applyFilters()"
            >
              <option value="">All scopes</option>
              <option *ngFor="let scope of availableScopes" [value]="scope">{{ scope }}</option>
            </select>
          </div>
        </div>

        <div class="quick-filters">
          <div class="filter-label">Quick filters</div>
          <div class="chip-row">
            <button
              *ngFor="let level of levelOrder"
              type="button"
              class="quick-filter-chip"
              [class.quick-filter-active]="isLevelSelected(level)"
              [class.quick-filter-info]="level === 'info'"
              [class.quick-filter-warn]="level === 'warn'"
              [class.quick-filter-error]="level === 'error'"
              (click)="toggleLevel(level)"
            >
              <fa-icon [icon]="checkIcon"></fa-icon>
              <span>{{ levelLabel(level) }}</span>
              <span class="chip-count">{{ levelCount(level) }}</span>
            </button>
          </div>
        </div>
      </section>

      <section class="summary-grid">
        <article class="summary-card helmos-card">
          <div class="section-kicker">Matching logs</div>
          <strong>{{ snapshot?.summary?.matchingLogs ?? 0 }}</strong>
          <span>Returned from the current filter set</span>
        </article>

        <article class="summary-card helmos-card">
          <div class="section-kicker">Info</div>
          <strong>{{ snapshot?.summary?.filtered?.info ?? 0 }}</strong>
          <span>{{ snapshot?.summary?.stored?.info ?? 0 }} stored</span>
        </article>

        <article class="summary-card helmos-card">
          <div class="section-kicker">Warnings</div>
          <strong>{{ snapshot?.summary?.filtered?.warn ?? 0 }}</strong>
          <span>{{ snapshot?.summary?.stored?.warn ?? 0 }} stored</span>
        </article>

        <article class="summary-card helmos-card">
          <div class="section-kicker">Errors</div>
          <strong>{{ snapshot?.summary?.filtered?.error ?? 0 }}</strong>
          <span>{{ snapshot?.summary?.stored?.error ?? 0 }} stored</span>
        </article>
      </section>

      <section *ngIf="loadError" class="state-card helmos-card" role="alert">
        <div class="section-kicker">Connection issue</div>
        <h2>Log data is temporarily unavailable</h2>
        <p>{{ loadError }}</p>
        <button class="btn btn-primary" type="button" (click)="refresh()">Retry</button>
      </section>

      <section *ngIf="!loadError" class="results-card helmos-card">
        <div class="results-header">
          <div>
            <div class="section-kicker">Recent entries</div>
            <h2>Search results</h2>
          </div>
          <div *ngIf="loading" class="loading-copy">Refreshing…</div>
        </div>

        <div *ngIf="!loading && logs.length === 0" class="empty-copy">
          No log entries match the current filters.
        </div>

        <div *ngIf="logs.length > 0" class="table-wrap">
          <table class="logs-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Level</th>
                <th>Scope</th>
                <th>Event</th>
                <th>Message</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody *ngFor="let log of logs; trackBy: trackByLogId">
                <tr>
                  <td>{{ formatTimestamp(log.createdAt) }}</td>
                  <td>
                    <span class="level-pill" [class]="'level-pill level-' + log.level">{{ log.level }}</span>
                  </td>
                  <td>{{ log.scope }}</td>
                  <td>{{ log.event }}</td>
                  <td>{{ log.message }}</td>
                  <td>
                    <button class="context-button" type="button" (click)="toggleContext(log.id)">
                      <fa-icon [icon]="chevronDownIcon" [class.context-open]="isContextExpanded(log.id)"></fa-icon>
                      <span>{{ isContextExpanded(log.id) ? 'Hide context' : 'Show context' }}</span>
                    </button>
                  </td>
                </tr>
                <tr *ngIf="isContextExpanded(log.id)" class="context-row">
                  <td colspan="6">
                    <pre>{{ stringifyContext(log.context) }}</pre>
                  </td>
                </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .logs-shell {
        padding: 92px 1rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .logs-hero,
      .filters-card,
      .results-card,
      .state-card {
        padding: 1rem 1.1rem;
      }

      .logs-hero {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }

      .logs-hero h1,
      .results-header h2,
      .state-card h2 {
        margin: 0.25rem 0 0.35rem;
        font-size: clamp(1.8rem, 2vw, 2.3rem);
        letter-spacing: -0.03em;
      }

      .logs-hero p,
      .state-card p {
        max-width: 52rem;
        margin: 0;
        color: var(--helmos-muted);
      }

      .refresh-button,
      .search-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .hero-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .auto-refresh-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.72rem 1rem;
        border: 1px solid var(--helmos-border);
        border-radius: 999px;
        background: rgba(247, 249, 252, 0.9);
        color: var(--helmos-text);
        cursor: pointer;
        font-weight: 600;
      }

      .auto-refresh-toggle input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .auto-refresh-toggle fa-icon {
        font-size: 1.15rem;
        color: #356489;
      }

      .filters-card {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: end;
      }

      .filters-main {
        display: grid;
        grid-template-columns: minmax(0, 1.7fr) minmax(220px, 0.7fr) minmax(220px, 0.7fr);
        gap: 1rem;
        flex: 1;
      }

      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .filter-label,
      .section-kicker {
        font-size: 0.77rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #356489;
      }

      .search-row {
        display: flex;
        gap: 0.75rem;
      }

      .search-input-wrap {
        position: relative;
        flex: 1;
      }

      .search-icon {
        position: absolute;
        left: 0.95rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--helmos-muted);
      }

      .search-input {
        min-height: 3rem;
        padding-left: 2.6rem;
        border-radius: 0.9rem;
      }

      .time-group .form-select {
        min-height: 3rem;
        border-radius: 0.9rem;
      }

      .scope-group .form-select {
        min-height: 3rem;
        border-radius: 0.9rem;
      }

      .quick-filters {
        min-width: 310px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
        justify-content: flex-end;
      }

      .quick-filter-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.7rem 1rem;
        border-radius: 999px;
        border: 1px solid var(--helmos-border);
        background: rgba(247, 249, 252, 0.9);
        color: var(--helmos-text);
      }

      .quick-filter-chip fa-icon {
        opacity: 0.45;
      }

      .quick-filter-active fa-icon {
        opacity: 1;
      }

      .quick-filter-info.quick-filter-active {
        background: rgba(31, 157, 104, 0.08);
        border-color: rgba(31, 157, 104, 0.18);
      }

      .quick-filter-warn.quick-filter-active {
        background: rgba(217, 164, 65, 0.12);
        border-color: rgba(217, 164, 65, 0.24);
      }

      .quick-filter-error.quick-filter-active {
        background: rgba(220, 79, 79, 0.1);
        border-color: rgba(220, 79, 79, 0.18);
      }

      .chip-count {
        color: var(--helmos-muted);
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
      }

      .summary-card {
        padding: 1rem 1.1rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-height: 8rem;
      }

      .summary-card strong {
        font-size: 2rem;
        letter-spacing: -0.04em;
      }

      .summary-card span {
        color: var(--helmos-muted);
      }

      .results-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 0.85rem;
        border-bottom: 1px solid rgba(219, 228, 238, 0.95);
      }

      .results-header h2 {
        font-size: 1.65rem;
      }

      .loading-copy,
      .empty-copy {
        color: var(--helmos-muted);
      }

      .empty-copy {
        padding: 1.25rem 0 0.25rem;
      }

      .table-wrap {
        overflow-x: auto;
      }

      .logs-table {
        width: 100%;
        border-collapse: collapse;
      }

      .logs-table th,
      .logs-table td {
        padding: 0.9rem 0.75rem;
        border-bottom: 1px solid rgba(219, 228, 238, 0.95);
        vertical-align: top;
        text-align: left;
      }

      .logs-table th {
        color: #5f7595;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .logs-table tbody tr:hover td {
        background: rgba(248, 251, 255, 0.65);
      }

      .level-pill {
        display: inline-flex;
        min-width: 6rem;
        justify-content: center;
        padding: 0.35rem 0.8rem;
        border-radius: 999px;
        border: 1px solid transparent;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: lowercase;
      }

      .level-info {
        color: #0b7c63;
        background: rgba(31, 157, 104, 0.08);
        border-color: rgba(31, 157, 104, 0.18);
      }

      .level-warn {
        color: #9a6d17;
        background: rgba(217, 164, 65, 0.12);
        border-color: rgba(217, 164, 65, 0.24);
      }

      .level-error {
        color: #b23b3b;
        background: rgba(220, 79, 79, 0.1);
        border-color: rgba(220, 79, 79, 0.18);
      }

      .context-button {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.55rem 0.9rem;
        border-radius: 999px;
        border: 1px solid var(--helmos-border);
        background: rgba(247, 249, 252, 0.9);
        color: inherit;
      }

      .context-open {
        transform: rotate(180deg);
      }

      .context-row td {
        background: rgba(247, 249, 252, 0.84);
      }

      .context-row pre {
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        color: #31435d;
        font-size: 0.84rem;
      }

      @media (max-width: 1199.98px) {
        .filters-card,
        .filters-main {
          grid-template-columns: 1fr;
          display: grid;
        }

        .quick-filters {
          min-width: 0;
        }

        .chip-row {
          justify-content: flex-start;
        }
      }

      @media (max-width: 991.98px) {
        .summary-grid {
          grid-template-columns: 1fr;
        }

        .logs-hero {
          flex-direction: column;
        }
      }

      @media (max-width: 767.98px) {
        .search-row {
          flex-direction: column;
        }
      }
    `
  ]
})
export class AdminLogsScreenComponent implements OnInit, OnDestroy {
  readonly shell = {
    productName: 'HelmOS'
  };
  readonly searchIcon = faMagnifyingGlass;
  readonly rotateIcon = faRotateRight;
  readonly toggleOnIcon = faToggleOn;
  readonly toggleOffIcon = faToggleOff;
  readonly checkIcon = faCheck;
  readonly chevronDownIcon = faChevronDown;
  readonly levelOrder: LogLevel[] = ['info', 'warn', 'error'];
  readonly timeRangeOptions: Array<{ value: LogTimeRange; label: string }> = [
    { value: '15m', label: 'Last 15 minutes' },
    { value: '30m', label: 'Last 30 minutes' },
    { value: '1h', label: 'Last hour' },
    { value: '6h', label: 'Last 6 hours' },
    { value: '24h', label: 'Last 24 hours' }
  ];

  loading = false;
  loadError = '';
  searchQuery = '';
  timeRange: LogTimeRange = '30m';
  selectedScope = '';
  autoRefreshEnabled = false;
  selectedLevels: LogLevel[] = ['info', 'warn', 'error'];
  snapshot: AdminLogsSnapshot | null = null;
  logs: AdminLogRecord[] = [];
  expandedContextIds = new Set<string>();
  private autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly autoRefreshMs = 120_000;

  private readonly adminLogsService = inject(AdminLogsService);

  ngOnInit(): void {
    void this.refresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.loadError = '';

    try {
      const snapshot = await this.adminLogsService.listLogs({
        query: this.searchQuery,
        timeRange: this.timeRange,
        levels: this.selectedLevels,
        scope: this.selectedScope
      });

      this.snapshot = snapshot;
      this.logs = [...snapshot.logs];
      this.selectedScope = this.resolveSelectedScope(snapshot);
      this.expandedContextIds = new Set(
        [...this.expandedContextIds].filter((logId) => this.logs.some((log) => log.id === logId))
      );
    } catch (error) {
      this.snapshot = null;
      this.logs = [];
      this.loadError = error instanceof Error ? error.message : 'Something went wrong while loading logs.';
    } finally {
      this.loading = false;
    }
  }

  applyFilters(): void {
    void this.refresh();
  }

  setAutoRefresh(enabled: boolean): void {
    this.autoRefreshEnabled = enabled;

    if (enabled) {
      this.startAutoRefresh();
      return;
    }

    this.stopAutoRefresh();
  }

  toggleLevel(level: LogLevel): void {
    if (this.isLevelSelected(level)) {
      if (this.selectedLevels.length === 1) {
        return;
      }

      this.selectedLevels = this.selectedLevels.filter((entry) => entry !== level);
    } else {
      this.selectedLevels = [...this.selectedLevels, level];
    }

    void this.refresh();
  }

  isLevelSelected(level: LogLevel): boolean {
    return this.selectedLevels.includes(level);
  }

  levelLabel(level: LogLevel): string {
    return level === 'warn' ? 'Warn' : `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
  }

  levelCount(level: LogLevel): number {
    return this.snapshot?.summary?.filtered?.[level] ?? 0;
  }

  toggleContext(logId: string): void {
    const next = new Set(this.expandedContextIds);

    if (next.has(logId)) {
      next.delete(logId);
    } else {
      next.add(logId);
    }

    this.expandedContextIds = next;
  }

  isContextExpanded(logId: string): boolean {
    return this.expandedContextIds.has(logId);
  }

  stringifyContext(context: Record<string, unknown>): string {
    return JSON.stringify(context ?? {}, null, 2);
  }

  get availableScopes(): string[] {
    return this.snapshot?.availableScopes ?? [];
  }

  formatTimestamp(value: string): string {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  trackByLogId(_index: number, log: AdminLogRecord): string {
    return log.id;
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.autoRefreshTimer = setInterval(() => {
      void this.refresh();
    }, this.autoRefreshMs);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshTimer != null) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  private resolveSelectedScope(snapshot: AdminLogsSnapshot): string {
    if (snapshot.filters.scope && snapshot.availableScopes.includes(snapshot.filters.scope)) {
      return snapshot.filters.scope;
    }

    return snapshot.filters.scope ?? '';
  }
}
