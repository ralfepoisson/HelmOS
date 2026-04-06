import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { AgentAdminService } from './agent-admin.service';
import { AgentTestingScreenComponent } from './agent-testing-screen.component';
import { AgentTestingService } from './agent-testing.service';

describe('AgentTestingScreenComponent', () => {
  const listAgents = vi.fn();
  const listFixtures = vi.fn();
  const listRuns = vi.fn();
  const getRun = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    listAgents.mockResolvedValue({
      gateway: {
        configured: true,
        status: 'online',
        message: 'ok',
        baseUrl: 'http://127.0.0.1:8000/api/v1',
        service: 'helmos-agent-gateway',
        checkedAt: '2026-04-03T08:10:00.000Z',
        agents: []
      },
      agents: [
        {
          id: 'agent-1',
          key: 'ideation',
          name: 'Ideation Agent',
          version: '1.0.0',
          description: 'Transforms founder input into structured idea briefs.',
          allowedTools: ['retrieval'],
          defaultModel: 'helmos-default',
          active: true,
          createdAt: '2026-04-03T08:00:00.000Z',
          updatedAt: '2026-04-03T08:05:00.000Z',
          promptConfig: {
            id: 'prompt-1',
            key: 'ideation.default',
            version: '1.0.0',
            promptTemplate: 'Prompt',
            configJson: {
              purpose: 'Transforms founder input into structured idea briefs.'
            },
            active: true,
            updatedAt: '2026-04-03T08:05:00.000Z'
          },
          runtime: {
            registered: true,
            name: 'Ideation Agent',
            version: '1.0.0',
            purpose: 'Transforms founder input into structured idea briefs.',
            allowedTools: ['retrieval']
          }
        },
        {
          id: 'agent-2',
          key: 'prospecting',
          name: 'Prospecting Agent',
          version: '1.0.0',
          description: 'Discovers and refines high-potential opportunity signals.',
          allowedTools: ['web_search'],
          defaultModel: 'helmos-default',
          active: true,
          createdAt: '2026-04-05T14:06:10.874Z',
          updatedAt: '2026-04-05T14:06:10.874Z',
          promptConfig: {
            id: 'prompt-2',
            key: 'prospecting-agent.default',
            version: '1.0.0',
            promptTemplate: 'Prompt',
            configJson: {
              purpose: 'Discovers and refines high-potential opportunity signals.'
            },
            active: true,
            updatedAt: '2026-04-05T14:06:10.874Z'
          },
          runtime: {
            registered: true,
            name: 'Prospecting Agent',
            version: '1.0.0',
            purpose: 'Discovers and refines high-potential opportunity signals.',
            allowedTools: ['web_search']
          }
        }
      ]
    });

    listFixtures.mockResolvedValue([
      {
        fixture_key: 'saas_b2b_finops_assistant',
        fixture_version: '1.0.0',
        fixture_class: 'regression',
        title: 'FinOps Copilot for small multi-cloud SaaS teams',
        applicable_agents: ['ideation'],
        min_turns: 20,
        max_turns: 24,
        scenario_dimensions: ['customer', 'pricing'],
        path: '/docs/agent_test_fixtures/regression/saas_b2b_finops_assistant.md'
      },
      {
        fixture_key: 'prospecting_operator_review',
        fixture_version: '1.0.0',
        fixture_class: 'strategy_review',
        title: 'Prospecting strategy review for fragmented service sectors',
        applicable_agents: ['prospecting'],
        min_turns: 10,
        max_turns: 16,
        scenario_dimensions: ['strategy', 'signal-quality'],
        path: '/docs/agent_test_fixtures/strategy_review/prospecting_operator_review.md'
      }
    ]);

    listRuns.mockResolvedValue([
      {
        id: 'run-1',
        suite_key: null,
        test_mode: 'single_agent_benchmark',
        target_agent_key: 'ideation',
        target_agent_version: '1.0.0',
        target_model_name: 'helmos-default',
        testing_agent_model_name: null,
        fixture_key: 'saas_b2b_finops_assistant',
        fixture_version: '1.0.0',
        rubric_version: 'ideation-core-v1',
        driver_version: 'scenario-driver-v1',
        status: 'completed',
        actual_turns: 4,
        min_turns: 20,
        max_turns: 30,
        overall_score: 56.88,
        aggregate_confidence: 0.3,
        verdict: 'REVIEW_REQUIRED',
        review_required: true,
        summary: 'ideation scored 56.88 with verdict REVIEW_REQUIRED.',
        operator_notes: 'debug',
        created_at: '2026-04-03T09:26:34.000Z',
        updated_at: '2026-04-03T10:34:43.000Z'
      }
    ]);

    getRun.mockResolvedValue({
      id: 'run-1',
      suite_key: null,
      test_mode: 'single_agent_benchmark',
      target_agent_key: 'ideation',
      target_agent_version: '1.0.0',
      target_model_name: 'helmos-default',
      testing_agent_model_name: null,
      fixture_key: 'saas_b2b_finops_assistant',
      fixture_version: '1.0.0',
      rubric_version: 'ideation-core-v1',
      driver_version: 'scenario-driver-v1',
      status: 'completed',
      actual_turns: 4,
      min_turns: 20,
      max_turns: 30,
      overall_score: 56.88,
      aggregate_confidence: 0.3,
      verdict: 'REVIEW_REQUIRED',
      review_required: true,
      summary: 'ideation scored 56.88 with verdict REVIEW_REQUIRED.',
      operator_notes: 'debug',
      created_at: '2026-04-03T09:26:34.000Z',
      updated_at: '2026-04-03T10:34:43.000Z',
      report_markdown: '# Agent Test Report\n\nDetected contradiction risk.',
      report_json: {
        summary: 'Detected contradiction risk.',
        hard_failures: [],
        quality_failures: [{ message: 'Too little customer evidence.' }],
        missed_opportunities: []
      },
      metadata_json: {
        operator_notes: 'debug',
        execution_completed: true
      },
      snapshots: [
        {
          id: 'snapshot-1',
          snapshot_type: 'fixture',
          source_ref: 'docs/agent_test_fixtures/regression/saas_b2b_finops_assistant.md',
          checksum: 'sha256:fixture',
          created_at: '2026-04-03T09:26:34.000Z',
          content_text: '## Business Idea\nAI FinOps copilot',
          content_json: { fixture_key: 'saas_b2b_finops_assistant' }
        }
      ],
      turns: [
        {
          id: 'turn-1',
          turn_index: 1,
          actor_type: 'driver',
          message_role: 'user',
          message_text: 'I want to build an AI FinOps copilot.',
          structured_payload: {},
          token_usage_json: {},
          metadata_json: { kind: 'initial_business_idea' },
          created_at: '2026-04-03T09:26:34.000Z'
        },
        {
          id: 'turn-2',
          turn_index: 2,
          actor_type: 'target_agent',
          message_role: 'assistant',
          message_text: 'Who specifically is feeling this pain?',
          structured_payload: { reply_to_user: { content: 'Who specifically is feeling this pain?' } },
          token_usage_json: {},
          metadata_json: { artifact: { title: 'Ideation Agent' } },
          created_at: '2026-04-03T09:27:00.000Z'
        }
      ],
      annotations: [
        {
          id: 'annotation-1',
          turn_index: 2,
          actor_type: 'target_agent',
          tag: 'strong_question_signal',
          severity: 'medium',
          confidence: 0.8,
          evidence_text: 'Asked about who feels the pain.',
          evidence_span: {},
          linked_scoring_dimensions: ['problem_clarity'],
          source_type: 'deterministic',
          metadata_json: {},
          created_at: '2026-04-03T09:27:00.000Z'
        }
      ],
      scores: [
        {
          id: 'score-1',
          layer_key: 'universal',
          dimension_key: 'problem_clarity',
          raw_score: 2,
          normalized_score: 0.67,
          weight_percent: 15,
          blocking: false,
          blocking_threshold: null,
          confidence: 0.7,
          evidence_turn_refs: [2],
          metadata_json: {},
          created_at: '2026-04-03T09:27:30.000Z'
        }
      ]
    });

    await TestBed.configureTestingModule({
      imports: [AgentTestingScreenComponent],
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
          provide: AgentAdminService,
          useValue: {
            listAgents
          }
        },
        {
          provide: AgentTestingService,
          useValue: {
            listFixtures,
            listRuns,
            getRun,
            createRun: vi.fn(),
            executeRun: vi.fn(),
            stopRun: vi.fn(),
            resumeRun: vi.fn(),
            deleteRun: vi.fn()
          }
        }
      ]
    }).compileComponents();
  });

  it('opens run detail sections in modals instead of inline cards', async () => {
    const fixture = TestBed.createComponent(AgentTestingScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await (fixture.componentInstance as unknown as { selectRun: (runId: string) => Promise<void> }).selectRun('run-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Transcript Review');
    expect(host.textContent).toContain('Detected contradiction risk.');
    expect(host.textContent).toContain('View execution report');
    expect(host.textContent).toContain('View transcript review');
    expect(host.textContent).toContain('View score evidence');
    expect(host.textContent).toContain('View snapshot artifacts');
    expect(host.textContent).not.toContain('# Agent Test Report');
    expect(host.textContent).not.toContain('I want to build an AI FinOps copilot.');
    expect(host.textContent).not.toContain('Who specifically is feeling this pain?');
    expect(host.textContent).not.toContain('strong_question_signal');
    expect(host.querySelector('[aria-label="Close detail modal"]')).toBeNull();
    expect(host.querySelector('[aria-label="Download full test report"]')).toBeTruthy();

    const reportButton = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('View execution report')
    );
    const transcriptButton = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('View transcript review')
    );
    const scoreButton = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('View score evidence')
    );
    const snapshotButton = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('View snapshot artifacts')
    );

    expect(reportButton).toBeTruthy();
    expect(transcriptButton).toBeTruthy();
    expect(scoreButton).toBeTruthy();
    expect(snapshotButton).toBeTruthy();

    reportButton?.click();
    fixture.detectChanges();

    expect(host.textContent).toContain('# Agent Test Report');
    expect(host.textContent).toContain('Execution Report');
    expect(host.querySelector('[aria-label="Close detail modal"]')).toBeTruthy();

    const closeButtons = Array.from(host.querySelectorAll('button')).filter((button) =>
      button.getAttribute('aria-label') === 'Close detail modal'
    );
    expect(closeButtons[0]).toBeTruthy();
    closeButtons[0]?.click();
    fixture.detectChanges();

    expect(host.textContent).not.toContain('# Agent Test Report');

    transcriptButton?.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Transcript Review');
    expect(host.textContent).toContain('I want to build an AI FinOps copilot.');
    expect(host.textContent).toContain('Who specifically is feeling this pain?');
    expect(host.textContent).toContain('strong_question_signal');
    expect(host.textContent).toContain('Download transcript');

    Array.from(host.querySelectorAll('button'))
      .find((button) => button.getAttribute('aria-label') === 'Close detail modal')
      ?.click();
    fixture.detectChanges();

    scoreButton?.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Score Evidence');
    expect(host.textContent).toContain('problem_clarity');
    expect(host.textContent).not.toContain('Download transcript');

    Array.from(host.querySelectorAll('button'))
      .find((button) => button.getAttribute('aria-label') === 'Close detail modal')
      ?.click();
    fixture.detectChanges();

    snapshotButton?.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Snapshot Artifacts');
    expect(host.textContent).toContain('AI FinOps copilot');
  });

  it('renders compact run rows with timestamps and verdict indicators', async () => {
    const fixture = TestBed.createComponent(AgentTestingScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const runCard = host.querySelector('.run-card') as HTMLElement | null;
    const timestamp = host.querySelector('.run-timestamp') as HTMLElement | null;
    const indicator = host.querySelector('.run-verdict-indicator') as HTMLElement | null;

    expect(runCard).toBeTruthy();
    expect(timestamp?.textContent?.trim().length).toBeGreaterThan(0);
    expect(indicator).toBeTruthy();
    expect(indicator?.classList.contains('run-verdict-indicator-review-required')).toBe(true);
    expect(indicator?.getAttribute('aria-label')).toBe('Review required');
    expect(runCard?.textContent).not.toContain('Single-agent benchmark');
    expect(runCard?.textContent).not.toContain('FinOps Copilot for small multi-cloud SaaS teams');
    expect(runCard?.textContent).not.toContain('helmos-default');
  });

  it('prepopulates min and max turns in the new run modal and submits them', async () => {
    const createRun = TestBed.inject(AgentTestingService).createRun as ReturnType<typeof vi.fn>;
    createRun.mockResolvedValue({
      id: 'run-2',
      suite_key: null,
      test_mode: 'single_agent_benchmark',
      target_agent_key: 'ideation',
      target_agent_version: '1.0.0',
      target_model_name: 'helmos-default',
      testing_agent_model_name: null,
      fixture_key: 'saas_b2b_finops_assistant',
      fixture_version: '1.0.0',
      rubric_version: 'ideation-core-v1',
      driver_version: 'scenario-driver-v1',
      status: 'draft',
      actual_turns: 0,
      min_turns: 24,
      max_turns: 36,
      overall_score: 0,
      aggregate_confidence: 0,
      verdict: 'PENDING',
      review_required: false,
      summary: 'Configured and ready to run.',
      operator_notes: null,
      created_at: '2026-04-06T08:00:00.000Z',
      updated_at: '2026-04-06T08:00:00.000Z'
    });

    const fixture = TestBed.createComponent(AgentTestingScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { openNewRunModal: () => void }).openNewRunModal();
    fixture.detectChanges();

    const minInput = fixture.debugElement.query(By.css('input[name="newRunMinTurns"]')).nativeElement as HTMLInputElement;
    const maxInput = fixture.debugElement.query(By.css('input[name="newRunMaxTurns"]')).nativeElement as HTMLInputElement;

    expect(minInput.value).toBe('20');
    expect(maxInput.value).toBe('30');

    minInput.value = '24';
    minInput.dispatchEvent(new Event('input'));
    maxInput.value = '36';
    maxInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await (fixture.componentInstance as unknown as { createDraftRun: () => Promise<void> }).createDraftRun();

    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        min_turns: 24,
        max_turns: 36
      })
    );
  });

  it('applies verdict-specific highlight styling to the run summary card', async () => {
    const fixture = TestBed.createComponent(AgentTestingScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await (fixture.componentInstance as unknown as { selectRun: (runId: string) => Promise<void> }).selectRun('run-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const reviewCard = host.querySelector('.detail-card-highlight') as HTMLElement | null;

    expect(reviewCard).toBeTruthy();
    expect(reviewCard?.classList.contains('detail-card-highlight-review-required')).toBe(true);
    expect(reviewCard?.classList.contains('detail-card-highlight-fail')).toBe(false);

    getRun.mockResolvedValue({
      id: 'run-1',
      suite_key: null,
      test_mode: 'single_agent_benchmark',
      target_agent_key: 'ideation',
      target_agent_version: '1.0.0',
      target_model_name: 'helmos-default',
      testing_agent_model_name: null,
      fixture_key: 'saas_b2b_finops_assistant',
      fixture_version: '1.0.0',
      rubric_version: 'ideation-core-v1',
      driver_version: 'scenario-driver-v1',
      status: 'completed',
      actual_turns: 4,
      min_turns: 20,
      max_turns: 30,
      overall_score: 29.94,
      aggregate_confidence: 0.3,
      verdict: 'FAIL',
      review_required: true,
      summary: 'ideation scored 29.94 with verdict FAIL.',
      operator_notes: 'debug',
      created_at: '2026-04-03T09:26:34.000Z',
      updated_at: '2026-04-03T10:34:43.000Z',
      report_markdown: '# Agent Test Report\n\nDetected contradiction risk.',
      report_json: {
        summary: 'Detected contradiction risk.',
        hard_failures: [],
        quality_failures: [{ message: 'Too little customer evidence.' }],
        missed_opportunities: []
      },
      metadata_json: {
        operator_notes: 'debug',
        execution_completed: true
      },
      snapshots: [],
      turns: [],
      annotations: [],
      scores: []
    });

    const failFixture = TestBed.createComponent(AgentTestingScreenComponent);
    failFixture.detectChanges();
    await failFixture.whenStable();
    failFixture.detectChanges();

    await (failFixture.componentInstance as unknown as { selectRun: (runId: string) => Promise<void> }).selectRun('run-1');
    failFixture.detectChanges();
    await failFixture.whenStable();
    failFixture.detectChanges();

    const failHost = failFixture.nativeElement as HTMLElement;
    const failCard = failHost.querySelector('.detail-card-highlight') as HTMLElement | null;

    expect(failCard?.classList.contains('detail-card-highlight-pending')).toBe(false);
    expect(failCard?.classList.contains('detail-card-highlight-review-required')).toBe(false);
    expect(failCard?.classList.contains('detail-card-highlight-fail')).toBe(true);

    getRun.mockResolvedValue({
      id: 'run-1',
      suite_key: null,
      test_mode: 'single_agent_benchmark',
      target_agent_key: 'ideation',
      target_agent_version: '1.0.0',
      target_model_name: 'helmos-default',
      testing_agent_model_name: null,
      fixture_key: 'saas_b2b_finops_assistant',
      fixture_version: '1.0.0',
      rubric_version: 'ideation-core-v1',
      driver_version: 'scenario-driver-v1',
      status: 'running',
      actual_turns: 0,
      min_turns: 20,
      max_turns: 30,
      overall_score: null,
      aggregate_confidence: null,
      verdict: 'PENDING',
      review_required: false,
      summary: 'Execution started.',
      operator_notes: 'debug',
      created_at: '2026-04-03T09:26:34.000Z',
      updated_at: '2026-04-03T10:34:43.000Z',
      report_markdown: null,
      report_json: null,
      metadata_json: {
        operator_notes: 'debug',
        execution_completed: false
      },
      snapshots: [],
      turns: [],
      annotations: [],
      scores: []
    });

    const pendingFixture = TestBed.createComponent(AgentTestingScreenComponent);
    pendingFixture.detectChanges();
    await pendingFixture.whenStable();
    pendingFixture.detectChanges();

    await (pendingFixture.componentInstance as unknown as { selectRun: (runId: string) => Promise<void> }).selectRun('run-1');
    pendingFixture.detectChanges();
    await pendingFixture.whenStable();
    pendingFixture.detectChanges();

    const pendingHost = pendingFixture.nativeElement as HTMLElement;
    const pendingCard = pendingHost.querySelector('.detail-card-highlight') as HTMLElement | null;
    const pendingSpinner = pendingHost.querySelector('.verdict-loading-spinner') as HTMLElement | null;

    expect(pendingCard?.classList.contains('detail-card-highlight-pending')).toBe(true);
    expect(pendingCard?.classList.contains('detail-card-highlight-review-required')).toBe(false);
    expect(pendingCard?.classList.contains('detail-card-highlight-fail')).toBe(false);
    expect(pendingSpinner).toBeTruthy();
    expect(pendingSpinner?.getAttribute('aria-label')).toBe('Pending evaluation in progress');

    getRun.mockResolvedValue({
      id: 'run-1',
      suite_key: null,
      test_mode: 'single_agent_benchmark',
      target_agent_key: 'ideation',
      target_agent_version: '1.0.0',
      target_model_name: 'helmos-default',
      testing_agent_model_name: null,
      fixture_key: 'saas_b2b_finops_assistant',
      fixture_version: '1.0.0',
      rubric_version: 'ideation-core-v1',
      driver_version: 'scenario-driver-v1',
      status: 'completed',
      actual_turns: 4,
      min_turns: 20,
      max_turns: 30,
      overall_score: 56.88,
      aggregate_confidence: 0.3,
      verdict: 'REVIEW_REQUIRED',
      review_required: true,
      summary: 'ideation scored 56.88 with verdict REVIEW_REQUIRED.',
      operator_notes: 'debug',
      created_at: '2026-04-03T09:26:34.000Z',
      updated_at: '2026-04-03T10:34:43.000Z',
      report_markdown: '# Agent Test Report\n\nDetected contradiction risk.',
      report_json: {
        summary: 'Detected contradiction risk.',
        hard_failures: [],
        quality_failures: [{ message: 'Too little customer evidence.' }],
        missed_opportunities: []
      },
      metadata_json: {
        operator_notes: 'debug',
        execution_completed: true
      },
      snapshots: [
        {
          id: 'snapshot-1',
          snapshot_type: 'fixture',
          source_ref: 'docs/agent_test_fixtures/regression/saas_b2b_finops_assistant.md',
          checksum: 'sha256:fixture',
          created_at: '2026-04-03T09:26:34.000Z',
          content_text: '## Business Idea\nAI FinOps copilot',
          content_json: { fixture_key: 'saas_b2b_finops_assistant' }
        }
      ],
      turns: [
        {
          id: 'turn-1',
          turn_index: 1,
          actor_type: 'driver',
          message_role: 'user',
          message_text: 'I want to build an AI FinOps copilot.',
          structured_payload: {},
          token_usage_json: {},
          metadata_json: { kind: 'initial_business_idea' },
          created_at: '2026-04-03T09:26:34.000Z'
        },
        {
          id: 'turn-2',
          turn_index: 2,
          actor_type: 'target_agent',
          message_role: 'assistant',
          message_text: 'Who specifically is feeling this pain?',
          structured_payload: { reply_to_user: { content: 'Who specifically is feeling this pain?' } },
          token_usage_json: {},
          metadata_json: { artifact: { title: 'Ideation Agent' } },
          created_at: '2026-04-03T09:27:00.000Z'
        }
      ],
      annotations: [
        {
          id: 'annotation-1',
          turn_index: 2,
          actor_type: 'target_agent',
          tag: 'strong_question_signal',
          severity: 'medium',
          confidence: 0.8,
          evidence_text: 'Asked about who feels the pain.',
          evidence_span: {},
          linked_scoring_dimensions: ['problem_clarity'],
          source_type: 'deterministic',
          metadata_json: {},
          created_at: '2026-04-03T09:27:00.000Z'
        }
      ],
      scores: [
        {
          id: 'score-1',
          layer_key: 'universal',
          dimension_key: 'problem_clarity',
          raw_score: 2,
          normalized_score: 0.67,
          weight_percent: 15,
          blocking: false,
          blocking_threshold: null,
          confidence: 0.7,
          evidence_turn_refs: [2],
          metadata_json: {},
          created_at: '2026-04-03T09:27:30.000Z'
        }
      ]
    });
  });

  it('renders every active agent returned by the backend registry, including prospecting', async () => {
    const fixture = TestBed.createComponent(AgentTestingScreenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Ideation Agent');
    expect(host.textContent).toContain('Prospecting Agent');
  });
});
