import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { AdminLogsScreenComponent } from './admin-logs-screen.component';
import { AdminLogsService, AdminLogsSnapshot } from './admin-logs.service';

function buildSnapshot(logs: AdminLogsSnapshot['logs'], overrides: Partial<AdminLogsSnapshot> = {}): AdminLogsSnapshot {
  return {
    availableLevels: ['info', 'warn', 'error'],
    availableScopes: ['all', 'admin', 'agentic-layer'],
    filters: {
      query: '',
      timeRange: '30m',
      levels: ['info', 'warn', 'error'],
      scope: 'all'
    },
    summary: {
      matchingLogs: logs.length,
      filtered: {
        info: logs.filter((log) => log.level === 'info').length,
        warn: logs.filter((log) => log.level === 'warn').length,
        error: logs.filter((log) => log.level === 'error').length
      },
      stored: { info: 10, warn: 2, error: 1 }
    },
    logs,
    ...overrides
  };
}

describe('AdminLogsScreenComponent', () => {
  const listLogs = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();

    await TestBed.configureTestingModule({
      imports: [AdminLogsScreenComponent],
      providers: [
        provideRouter([]),
        {
          provide: WorkspaceShellService,
          useValue: {
            productName: 'HelmOS'
          }
        },
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => true,
            getProfileInitials: () => 'RP',
            getProfileName: () => 'Ralfe Poisson',
            getProfileRoleLabel: () => 'Admin',
            signOut: vi.fn()
          }
        },
        {
          provide: AdminLogsService,
          useValue: {
            listLogs
          }
        }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders every log entry returned after a refresh updates the snapshot', async () => {
    listLogs
      .mockResolvedValueOnce(
        buildSnapshot([
          {
            id: 'log-1',
            level: 'info',
            scope: 'admin',
            event: 'get_admin_agents_200',
            message: 'GET /api/admin/agents responded with 200',
            context: { path: '/api/admin/agents' },
            createdAt: '2026-04-03T08:34:39.392Z'
          }
        ])
      )
      .mockResolvedValueOnce(
        buildSnapshot([
          {
            id: 'log-2',
            level: 'info',
            scope: 'admin',
            event: 'get_admin_logs_200',
            message: 'GET /api/admin/logs responded with 200',
            context: { path: '/api/admin/logs' },
            createdAt: '2026-04-03T08:34:50.262Z'
          },
          {
            id: 'log-1',
            level: 'info',
            scope: 'admin',
            event: 'get_admin_agents_200',
            message: 'GET /api/admin/agents responded with 200',
            context: { path: '/api/admin/agents' },
            createdAt: '2026-04-03T08:34:39.392Z'
          }
        ])
      );

    const fixture = TestBed.createComponent(AdminLogsScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(visibleLogRows(fixture.nativeElement as HTMLElement)).toHaveLength(1);

    await fixture.componentInstance.refresh();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rowTexts = visibleLogRows(fixture.nativeElement as HTMLElement).map((row) => row.textContent ?? '');
    expect(rowTexts).toHaveLength(2);
    expect(rowTexts.some((text) => text.includes('get_admin_logs_200'))).toBe(true);
    expect(rowTexts.some((text) => text.includes('get_admin_agents_200'))).toBe(true);
  });

  it('sends the selected scope when filters are applied', async () => {
    listLogs.mockResolvedValue(
      buildSnapshot([], {
        filters: {
          query: '',
          timeRange: '30m',
          levels: ['info', 'warn', 'error'],
          scope: 'admin'
        }
      })
    );

    const fixture = TestBed.createComponent(AdminLogsScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const select = host.querySelector('#scope-filter') as HTMLSelectElement | null;
    expect(select).toBeTruthy();

    select!.value = 'admin';
    select!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(listLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scope: 'admin'
      })
    );
  });

  it('refreshes every two minutes while auto-refresh is enabled', async () => {
    vi.useFakeTimers();
    listLogs.mockResolvedValue(buildSnapshot([]));

    const fixture = TestBed.createComponent(AdminLogsScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const toggle = host.querySelector('#auto-refresh-toggle') as HTMLInputElement | null;
    expect(toggle).toBeTruthy();

    toggle!.click();
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(120_000);
    await fixture.whenStable();

    expect(listLogs).toHaveBeenCalledTimes(2);
  });
});

function visibleLogRows(host: HTMLElement): HTMLTableRowElement[] {
  return Array.from(host.querySelectorAll('tbody tr'))
    .filter((row) => !row.classList.contains('context-row'))
    .map((row) => row as HTMLTableRowElement);
}
