import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import {
  AgentAdminRecord,
  AgentAdminService,
  AgentAdminSnapshot,
  AgentGatewayStatus,
  CreateAgentAdminPayload
} from './agent-admin.service';

interface EditableAgentRecord extends AgentAdminRecord {
  description: string;
  purpose: string;
  scopeNotes: string;
  defaultModel: string;
  selectedTools: string[];
  promptVersionText: string;
  promptRoleText: string;
  promptInstructionsText: string;
  promptConstraintsText: string;
  promptOutputFormatText: string;
  temperatureText: string;
  maxStepsText: string;
  timeoutSecondsText: string;
  retryPolicy: RetryPolicy;
  reasoningMode: ReasoningMode;
  promptConfigText: string;
  saving: boolean;
  saveError: string | null;
}

type LifecycleState = 'draft' | 'active';
type CreateIntent = 'draft' | 'register';
type ReasoningMode = 'light' | 'balanced' | 'deep';
type RetryPolicy = 'none' | 'standard' | 'aggressive';
type CreateFieldName =
  | 'key'
  | 'name'
  | 'version'
  | 'purpose'
  | 'promptVersionText'
  | 'promptRoleText'
  | 'promptInstructionsText'
  | 'promptConstraintsText'
  | 'promptOutputFormatText'
  | 'temperatureText'
  | 'maxStepsText'
  | 'timeoutSecondsText';

interface CreateAgentDraft {
  key: string;
  name: string;
  version: string;
  purpose: string;
  scopeNotes: string;
  defaultModel: string;
  selectedTools: string[];
  promptVersionText: string;
  promptRoleText: string;
  promptInstructionsText: string;
  promptConstraintsText: string;
  promptOutputFormatText: string;
  temperatureText: string;
  maxStepsText: string;
  timeoutSecondsText: string;
  retryPolicy: RetryPolicy;
  reasoningMode: ReasoningMode;
  lifecycleState: LifecycleState;
  showExecutionDetails: boolean;
  creating: boolean;
  createError: string | null;
  submitAttempted: boolean;
  lastAttemptMode: CreateIntent | null;
}

interface SelectOption {
  value: string;
  label: string;
  description: string;
}

interface ToolOption extends SelectOption {
  accessLabel: string;
  policyFlags: string[];
  scopePreview: string;
}

const MODEL_OPTIONS: SelectOption[] = [
  {
    value: 'helmos-default',
    label: 'HelmOS Default',
    description: 'General-purpose model alias for most specialist agents.'
  },
  {
    value: 'helmos-research',
    label: 'HelmOS Research',
    description: 'Research-oriented model alias for evidence-heavy work.'
  },
  {
    value: 'helmos-supervisor',
    label: 'HelmOS Supervisor',
    description: 'Supervisor-capable alias for higher-control workflows.'
  }
];

const TOOL_OPTIONS: ToolOption[] = [
  {
    value: 'retrieval',
    label: 'Retrieval',
    description: 'Semantic and structured retrieval against stored context.',
    accessLabel: 'Read context',
    policyFlags: ['Scoped indexes', 'Citation-safe'],
    scopePreview: 'Read access to approved embeddings, documents, and metadata stores.'
  },
  {
    value: 'web_search',
    label: 'Web Search',
    description: 'Controlled web search for fresh external information.',
    accessLabel: 'External read',
    policyFlags: ['Policy-gated', 'Freshness aware'],
    scopePreview: 'Read-only external lookup with policy controls and audit visibility.'
  },
  {
    value: 'object_storage',
    label: 'Object Storage',
    description: 'Read and write artifact files through controlled storage.',
    accessLabel: 'Read / write',
    policyFlags: ['Path scoped', 'Artifact retention'],
    scopePreview: 'Managed artifact access that can later support prefix-based write scopes.'
  },
  {
    value: 'log_analysis',
    label: 'Log Analysis',
    description: 'Structured investigation of bounded support logs and telemetry.',
    accessLabel: 'Read only',
    policyFlags: ['Bounded excerpts', 'Redaction aware'],
    scopePreview: 'Incident summaries, grouped errors, and request-scoped evidence without direct mutation.'
  },
  {
    value: 'communications',
    label: 'Communications',
    description: 'Email and calendar actions behind policy controls.',
    accessLabel: 'Actionable',
    policyFlags: ['Approval required', 'Audit trail'],
    scopePreview: 'Action-oriented channel access with future support for send, draft, and attendee policies.'
  }
];

const REASONING_OPTIONS: Array<{ value: ReasoningMode; label: string; description: string }> = [
  {
    value: 'light',
    label: 'Light',
    description: 'Fast execution for deterministic or tightly scoped work.'
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Default depth for most production specialists.'
  },
  {
    value: 'deep',
    label: 'Deep',
    description: 'Longer reasoning budget for complex judgement-heavy tasks.'
  }
];

const RETRY_OPTIONS: Array<{ value: RetryPolicy; label: string; description: string }> = [
  {
    value: 'none',
    label: 'No retries',
    description: 'Fail fast when the first execution attempt does not complete.'
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Retry transient failures once with the same plan.'
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'Allow multiple retries for flaky external dependencies.'
  }
];

@Component({
  selector: 'app-agent-admin-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      [surfaceLabel]="'Agent control plane'"
      [saveStatus]="saveStatusLabel"
      [showWorkspaceSwitcher]="false"
    />

    <main class="admin-shell container-fluid">
      <section class="admin-hero helmos-card">
        <div class="hero-copy">
          <span class="hero-kicker">Admin</span>
          <h1>Agent Admin</h1>
          <p>
            Manage the specialist registry that powers the agentic layer. This surface keeps the
            persisted agent definitions, prompt configuration, and live runtime registration in view
            together.
          </p>
        </div>

        <div class="hero-meta">
          <div class="hero-actions">
            <button class="btn btn-primary new-agent-button" type="button" (click)="openCreateModal()">
              + New Agent
            </button>
          </div>
          <div class="hero-stat-row">
            <div class="hero-stat">
              <span class="hero-stat-label">Persisted agents</span>
              <strong>{{ agents.length }}</strong>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-label">Runtime agents</span>
              <strong>{{ gateway?.agents?.length ?? 0 }}</strong>
            </div>
            <button
              type="button"
              class="hero-stat hero-stat-button"
              [attr.aria-expanded]="showGatewayDetails"
              [class.hero-stat-active]="showGatewayDetails"
              (click)="toggleGatewayDetails()"
            >
              <span class="hero-stat-label">Gateway</span>
              <strong [class.gateway-offline]="gateway?.status !== 'online'">{{ gatewayLabel }}</strong>
              <span class="hero-stat-action">{{ showGatewayDetails ? 'Hide details' : 'View details' }}</span>
            </button>
          </div>
        </div>
      </section>

      <section
        *ngIf="gateway && showGatewayDetails"
        class="gateway-card helmos-card"
        [class.gateway-card-offline]="gateway.status !== 'online'"
      >
        <div>
          <div class="section-kicker">Agent gateway link</div>
          <h2>{{ gateway.service ?? 'Agent gateway' }}</h2>
          <p class="mb-0">{{ gateway.message }}</p>
        </div>

        <dl class="gateway-details">
          <div>
            <dt>Status</dt>
            <dd>{{ gatewayLabel }}</dd>
          </div>
          <div>
            <dt>Base URL</dt>
            <dd>{{ gateway.baseUrl ?? 'Not configured' }}</dd>
          </div>
          <div>
            <dt>Checked</dt>
            <dd>{{ formatTimestamp(gateway.checkedAt) }}</dd>
          </div>
        </dl>
      </section>

      <section *ngIf="loadError" class="load-state-card helmos-card" role="alert" aria-live="polite">
        <div>
          <div class="section-kicker">Connection issue</div>
          <h2>Agent admin data is temporarily unavailable</h2>
          <p class="mb-0">
            {{ loadError }}
          </p>
        </div>

        <div class="load-state-actions">
          <button class="btn btn-primary" type="button" (click)="retryLoadAgents()">Retry</button>
          <span class="field-help">
            The new-agent modal is still available, but saving requires the admin API to be online.
          </span>
        </div>
      </section>

      <div *ngIf="loading" class="loading-state helmos-card">
        Loading agent registry data...
      </div>

      <section *ngIf="!loading && !loadError && agents.length === 0" class="empty-state-card helmos-card">
        <div>
          <div class="section-kicker">Registry empty</div>
          <h2>No specialists registered yet</h2>
          <p class="mb-0">
            Start with a draft specialist, review its prompt and permissions, then activate it when
            the configuration is ready.
          </p>
        </div>

        <div class="empty-state-actions">
          <button class="btn btn-primary" type="button" (click)="openCreateModal()">Register first agent</button>
          <span class="field-help">
            Use draft mode if you want to capture intent first and finalize runtime settings later.
          </span>
        </div>
      </section>

      <section *ngIf="!loading && agents.length > 0" class="agent-workspace">
        <aside class="agent-list-panel helmos-card" aria-label="Registered agents">
          <div class="agent-list-header">
            <div>
              <div class="section-kicker">Agent registry</div>
              <h2>Agents</h2>
            </div>
            <span class="agent-list-count">{{ agents.length }}</span>
          </div>

          <div class="agent-list">
            <button
              *ngFor="let agent of agents; trackBy: trackByAgentId"
              type="button"
              class="agent-list-item"
              [class.agent-list-item-active]="agent.id === selectedAgentId"
              (click)="selectAgent(agent.id)"
            >
              <div class="agent-list-item-top">
                <span class="agent-key">{{ agent.key }}</span>
                <span class="status-pill status-pill-compact" [class.status-pill-muted]="!agent.active">
                  {{ agent.active ? 'Active' : 'Draft' }}
                </span>
              </div>
              <strong>{{ agent.name }}</strong>
              <span class="field-help">{{ summarizeAgent(agent) }}</span>
              <div class="agent-list-item-meta">
                <span [class.runtime-missing]="!agent.runtime.registered">
                  {{ agent.runtime.registered ? 'Runtime ready' : 'Runtime missing' }}
                </span>
                <span>{{ agent.version }}</span>
              </div>
            </button>
          </div>
        </aside>

        <article *ngIf="selectedAgent as agent" class="agent-card helmos-card">
          <header class="agent-card-header">
            <div>
              <div class="agent-key">{{ agent.key }}</div>
              <h2>{{ agent.name }}</h2>
            </div>
            <div class="badge-row">
              <span class="status-pill" [class.status-pill-muted]="!agent.active">
                {{ agent.active ? 'Active' : 'Disabled' }}
              </span>
              <span class="status-pill" [class.status-pill-warning]="!agent.runtime.registered">
                {{ agent.runtime.registered ? 'Runtime registered' : 'Missing from runtime' }}
              </span>
            </div>
          </header>

          <section class="create-section">
            <div class="section-heading">
              <div>
                <div class="section-kicker">Identity & Scope</div>
                <h3>Keep the agent role explicit</h3>
              </div>
            </div>

            <div class="agent-grid-fields compact-grid">
              <label class="field-block">
                <span>Name</span>
                <input [(ngModel)]="agent.name" class="form-control" [name]="'name-' + agent.id" />
              </label>

              <label class="field-block">
                <span>Version</span>
                <input [(ngModel)]="agent.version" class="form-control" [name]="'version-' + agent.id" />
              </label>

              <label class="field-block field-wide">
                <span>Purpose / Primary objective</span>
                <textarea
                  [(ngModel)]="agent.purpose"
                  class="form-control"
                  rows="2"
                  [name]="'purpose-' + agent.id"
                ></textarea>
              </label>

              <label class="field-block field-wide">
                <span>Scope notes</span>
                <textarea
                  [(ngModel)]="agent.scopeNotes"
                  class="form-control"
                  rows="2"
                  [name]="'scope-' + agent.id"
                ></textarea>
              </label>
            </div>
          </section>

          <section class="create-section">
            <div class="section-heading">
              <div>
                <div class="section-kicker">Model & Execution</div>
                <h3>Keep runtime behavior aligned with creation settings</h3>
              </div>
            </div>

            <div class="agent-grid-fields compact-grid execution-grid">
              <label class="field-block">
                <span>Lifecycle state</span>
                <select
                  class="form-select"
                  [ngModel]="agent.active ? 'active' : 'draft'"
                  (ngModelChange)="setAgentLifecycle(agent, $event)"
                  [name]="'lifecycle-' + agent.id"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </label>

              <label class="field-block">
                <span>Default model</span>
                <select [(ngModel)]="agent.defaultModel" class="form-select" [name]="'model-' + agent.id">
                  <option value="">No default model</option>
                  <option *ngFor="let model of modelOptions" [value]="model.value">{{ model.label }}</option>
                </select>
                <span class="field-help">{{ describeModel(agent.defaultModel) }}</span>
              </label>

              <label class="field-block">
                <span>Temperature</span>
                <input
                  #temperatureInput
                  [(ngModel)]="agent.temperatureText"
                  class="form-control"
                  [name]="'temperature-' + agent.id"
                />
              </label>

              <label class="field-block">
                <span>Max steps</span>
                <input #maxStepsInput [(ngModel)]="agent.maxStepsText" class="form-control" [name]="'max-steps-' + agent.id" />
              </label>

              <label class="field-block">
                <span>Timeout (seconds)</span>
                <input
                  #timeoutInput
                  [(ngModel)]="agent.timeoutSecondsText"
                  class="form-control"
                  [name]="'timeout-' + agent.id"
                />
              </label>

              <label class="field-block">
                <span>Retry policy</span>
                <select [(ngModel)]="agent.retryPolicy" class="form-select" [name]="'retry-' + agent.id">
                  <option *ngFor="let policy of retryOptions" [value]="policy.value">{{ policy.label }}</option>
                </select>
              </label>

              <label class="field-block">
                <span>Reasoning mode</span>
                <select [(ngModel)]="agent.reasoningMode" class="form-select" [name]="'reasoning-' + agent.id">
                  <option *ngFor="let mode of reasoningOptions" [value]="mode.value">{{ mode.label }}</option>
                </select>
              </label>
            </div>
          </section>

          <section class="create-section">
            <div class="section-heading">
              <div>
                <div class="section-kicker">Tool Permissions</div>
                <h3>Keep permissions aligned with the registered specialist</h3>
              </div>
            </div>

            <label class="field-block">
              <span class="field-help">Select the infrastructure capabilities this agent is permitted to use.</span>
              <div class="choice-grid">
                <label *ngFor="let tool of toolOptions" class="choice-card">
                  <div class="choice-card-top">
                    <input
                      type="checkbox"
                      [checked]="hasSelection(agent.selectedTools, tool.value)"
                      (change)="toggleSelection(agent.selectedTools, tool.value, isChecked($event))"
                      [name]="'tool-' + agent.id + '-' + tool.value"
                    />
                    <span class="choice-title">{{ tool.label }}</span>
                  </div>
                  <span class="choice-description">{{ tool.description }}</span>
                </label>
              </div>
            </label>
          </section>

          <section class="prompt-panel">
            <div class="panel-heading">
              <div>
                <div class="section-kicker">Prompt configuration</div>
                <h3>{{ agent.promptConfig?.key ?? agent.key + '.default' }}</h3>
                <p class="field-help prompt-copy">
                  These are the same structured execution settings used when the agent was first
                  created.
                </p>
              </div>
            </div>

            <div class="agent-grid-fields compact-grid">
              <label class="field-block">
                <span>Prompt version</span>
                <input
                  [(ngModel)]="agent.promptVersionText"
                  class="form-control"
                  [name]="'prompt-version-' + agent.id"
                />
              </label>

              <label class="field-block field-wide">
                <span>Role / Persona</span>
                <textarea
                  [(ngModel)]="agent.promptRoleText"
                  class="form-control"
                  rows="3"
                  [name]="'prompt-role-' + agent.id"
                ></textarea>
              </label>

              <label class="field-block field-wide">
                <span>Task Instructions</span>
                <textarea
                  [(ngModel)]="agent.promptInstructionsText"
                  class="form-control"
                  rows="4"
                  [name]="'prompt-instructions-' + agent.id"
                ></textarea>
              </label>

              <label class="field-block">
                <span>Constraints</span>
                <textarea
                  [(ngModel)]="agent.promptConstraintsText"
                  class="form-control"
                  rows="4"
                  [name]="'prompt-constraints-' + agent.id"
                ></textarea>
              </label>

              <label class="field-block">
                <span>Output Format</span>
                <textarea
                  [(ngModel)]="agent.promptOutputFormatText"
                  class="form-control"
                  rows="4"
                  [name]="'prompt-output-' + agent.id"
                ></textarea>
              </label>

              <label class="field-block field-wide">
                <span>Additional structured config (JSON)</span>
                <textarea
                  [(ngModel)]="agent.promptConfigText"
                  class="form-control code-field"
                  rows="5"
                  [name]="'prompt-json-' + agent.id"
                ></textarea>
              </label>
            </div>
          </section>

          <section class="runtime-panel">
            <div class="section-kicker">Runtime view</div>
            <p class="runtime-copy">
              {{ agent.runtime.purpose ?? 'No runtime descriptor is currently available for this agent.' }}
            </p>
            <div class="runtime-meta">
              <span>Runtime name: {{ agent.runtime.name ?? 'Unavailable' }}</span>
              <span>Runtime version: {{ agent.runtime.version ?? 'Unavailable' }}</span>
              <span>Runtime tools: {{ joinTools(agent.runtime.allowedTools) }}</span>
            </div>
          </section>

          <footer class="agent-card-footer">
            <div class="agent-footnote">
              <span *ngIf="selectedAgentLoadingId === agent.id">Loading agent details...</span>
              <span *ngIf="selectedAgentLoadError && selectedAgentId === agent.id" class="save-error">
                {{ selectedAgentLoadError }}
              </span>
              <span *ngIf="selectedAgentLoadingId !== agent.id && !(selectedAgentLoadError && selectedAgentId === agent.id)">
              Last updated {{ formatTimestamp(agent.updatedAt) }}
              </span>
            </div>
            <div class="footer-actions">
              <div *ngIf="agent.saveError" class="save-error">{{ agent.saveError }}</div>
              <button
                class="btn btn-primary"
                type="button"
                [disabled]="agent.saving"
                (click)="saveAgent(agent, { temperatureText: temperatureInput.value, maxStepsText: maxStepsInput.value, timeoutSecondsText: timeoutInput.value })"
              >
                {{ agent.saving ? 'Saving...' : 'Save agent' }}
              </button>
            </div>
          </footer>
        </article>
      </section>
    </main>

    <div *ngIf="createModalOpen" class="modal-backdrop" (click)="closeCreateModal()"></div>
    <section
      *ngIf="createModalOpen"
      class="agent-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-agent-title"
      aria-describedby="new-agent-description"
    >
      <div class="agent-modal-card helmos-card">
        <div class="create-card-header">
          <div>
            <div class="section-kicker">Create agent</div>
            <h2 id="new-agent-title">Register a new specialist</h2>
            <p id="new-agent-description" class="mb-0">
              Define the specialist identity, execution defaults, permissions, and launch-ready
              prompt in one reviewable flow.
            </p>
          </div>
          <button class="btn btn-outline-secondary modal-close" type="button" (click)="closeCreateModal()">
            Close
          </button>
        </div>

        <div class="form-intro-band">
          <div>
            <span class="hero-stat-label">Lifecycle</span>
            <strong>{{ createDraft.lifecycleState === 'active' ? 'Active' : 'Draft' }}</strong>
            <p class="mb-0 field-help">
              Draft agents are saved for review without being treated as production-ready.
            </p>
          </div>
          <div class="segmented-control" role="radiogroup" aria-label="Lifecycle state">
            <label class="segment-option" [class.segment-option-active]="createDraft.lifecycleState === 'draft'">
              <input
                type="radio"
                name="create-lifecycle"
                value="draft"
                [(ngModel)]="createDraft.lifecycleState"
              />
              <span>Draft</span>
            </label>
            <label class="segment-option" [class.segment-option-active]="createDraft.lifecycleState === 'active'">
              <input
                type="radio"
                name="create-lifecycle"
                value="active"
                [(ngModel)]="createDraft.lifecycleState"
              />
              <span>Active</span>
            </label>
          </div>
        </div>

        <section class="create-section">
          <div class="section-heading">
            <div>
              <div class="section-kicker">1. Identity & Scope</div>
              <h3>Make the agent legible at a glance</h3>
            </div>
            <p class="field-help section-copy">
              Put the role, naming, and operating scope up front so reviewers understand what this
              specialist exists to do before they inspect its prompt.
            </p>
          </div>

          <div class="agent-grid-fields compact-grid">
            <label class="field-block">
              <div class="field-label-row">
                <span>Agent key</span>
                <span class="required-indicator">Required</span>
              </div>
              <input
                [(ngModel)]="createDraft.key"
                class="form-control"
                name="create-key"
                placeholder="research-analyst"
                [class.is-invalid]="isCreateFieldInvalid('key', activeReviewMode)"
                [class.is-valid]="showCreateFieldValid('key', activeReviewMode)"
                [attr.aria-invalid]="isCreateFieldInvalid('key', activeReviewMode)"
              />
              <span class="field-help">Use lowercase letters, numbers, hyphens, or underscores.</span>
              <span *ngIf="isCreateFieldInvalid('key', activeReviewMode)" class="validation-error">
                Enter a stable machine key such as <code>research-analyst</code>.
              </span>
            </label>

            <label class="field-block">
              <div class="field-label-row">
                <span>Display name</span>
                <span class="required-indicator">Required</span>
              </div>
              <input
                [(ngModel)]="createDraft.name"
                class="form-control"
                name="create-name"
                placeholder="Research Analyst"
                [class.is-invalid]="isCreateFieldInvalid('name', activeReviewMode)"
                [class.is-valid]="showCreateFieldValid('name', activeReviewMode)"
              />
              <span class="field-help">Shown in the admin registry and future assignment surfaces.</span>
              <span *ngIf="isCreateFieldInvalid('name', activeReviewMode)" class="validation-error">
                Add a clear human-readable name.
              </span>
            </label>

            <label class="field-block">
              <div class="field-label-row">
                <span>Agent version</span>
                <span class="required-indicator" [class.optional-indicator]="activeReviewMode === 'draft'">
                  {{ activeReviewMode === 'draft' ? 'Defaulted' : 'Required' }}
                </span>
              </div>
              <input
                [(ngModel)]="createDraft.version"
                class="form-control"
                name="create-version"
                placeholder="1.0.0"
                [class.is-invalid]="isCreateFieldInvalid('version', activeReviewMode)"
                [class.is-valid]="showCreateFieldValid('version', activeReviewMode)"
              />
              <span class="field-help">Use semantic versioning for registry clarity and rollout tracking.</span>
              <span *ngIf="isCreateFieldInvalid('version', activeReviewMode)" class="validation-error">
                Use semantic versioning such as <code>1.0.0</code>.
              </span>
            </label>

            <label class="field-block field-wide">
              <div class="field-label-row">
                <span>Purpose / Primary objective</span>
                <span class="required-indicator">Required</span>
              </div>
              <textarea
                [(ngModel)]="createDraft.purpose"
                class="form-control"
                rows="2"
                name="create-purpose"
                placeholder="Summarise evidence, identify gaps, and return decision-ready research notes for product founders."
                [class.is-invalid]="isCreateFieldInvalid('purpose', activeReviewMode)"
                [class.is-valid]="showCreateFieldValid('purpose', activeReviewMode)"
              ></textarea>
              <span class="field-help">This is the primary objective shown in review summaries and saved with the agent definition.</span>
              <span *ngIf="isCreateFieldInvalid('purpose', activeReviewMode)" class="validation-error">
                State the agent's primary objective in one concise sentence.
              </span>
            </label>

            <label class="field-block field-wide">
              <div class="field-label-row">
                <span>Scope notes</span>
                <span class="optional-indicator">Optional</span>
              </div>
              <textarea
                [(ngModel)]="createDraft.scopeNotes"
                class="form-control"
                rows="2"
                name="create-scope"
                placeholder="Focus on B2B SaaS research. Escalate legal or compliance interpretations to a human reviewer."
              ></textarea>
              <span class="field-help">Use this to clarify boundaries, escalation expectations, or excluded work.</span>
            </label>
          </div>
        </section>

        <section class="create-section">
          <div class="section-heading">
            <div>
              <div class="section-kicker">2. Model & Execution</div>
              <h3>Set predictable runtime behaviour</h3>
            </div>
            <p class="field-help section-copy">
              Start with safe defaults, then open the advanced controls only if this specialist needs
              tighter execution tuning.
            </p>
          </div>

          <div class="agent-grid-fields compact-grid">
            <label class="field-block">
              <div class="field-label-row">
                <span>Default model</span>
                <span class="optional-indicator">Optional</span>
              </div>
              <select [(ngModel)]="createDraft.defaultModel" class="form-select" name="create-model">
                <option value="">No default model</option>
                <option *ngFor="let model of modelOptions" [value]="model.value">{{ model.label }}</option>
              </select>
              <span class="field-help">{{ describeModel(createDraft.defaultModel) }}</span>
            </label>

            <label class="field-block">
              <div class="field-label-row">
                <span>Prompt version</span>
                <span class="required-indicator" [class.optional-indicator]="activeReviewMode === 'draft'">
                  {{ activeReviewMode === 'draft' ? 'Defaulted' : 'Required' }}
                </span>
              </div>
              <input
                [(ngModel)]="createDraft.promptVersionText"
                class="form-control"
                name="create-prompt-version"
                placeholder="1.0.0"
                [class.is-invalid]="isCreateFieldInvalid('promptVersionText', activeReviewMode)"
                [class.is-valid]="showCreateFieldValid('promptVersionText', activeReviewMode)"
              />
              <span class="field-help">Tracks the initial prompt package saved with this agent.</span>
              <span *ngIf="isCreateFieldInvalid('promptVersionText', activeReviewMode)" class="validation-error">
                Use semantic versioning such as <code>1.0.0</code>.
              </span>
            </label>
          </div>

          <details class="execution-details" [open]="createDraft.showExecutionDetails">
            <summary>Execution controls</summary>

            <div class="agent-grid-fields compact-grid execution-grid">
              <label class="field-block">
                <div class="field-label-row">
                  <span>Temperature</span>
                  <span class="required-indicator" [class.optional-indicator]="activeReviewMode === 'draft'">
                    {{ activeReviewMode === 'draft' ? 'Defaulted' : 'Required' }}
                  </span>
                </div>
                <input
                  [(ngModel)]="createDraft.temperatureText"
                  class="form-control"
                  name="create-temperature"
                  placeholder="0.2"
                  inputmode="decimal"
                  [class.is-invalid]="isCreateFieldInvalid('temperatureText', activeReviewMode)"
                  [class.is-valid]="showCreateFieldValid('temperatureText', activeReviewMode)"
                />
                <span class="field-help">Use lower values for steadier enterprise behaviour.</span>
                <span *ngIf="isCreateFieldInvalid('temperatureText', activeReviewMode)" class="validation-error">
                  Enter a value between <code>0.0</code> and <code>2.0</code>.
                </span>
              </label>

              <label class="field-block">
                <div class="field-label-row">
                  <span>Max steps</span>
                  <span class="required-indicator" [class.optional-indicator]="activeReviewMode === 'draft'">
                    {{ activeReviewMode === 'draft' ? 'Defaulted' : 'Required' }}
                  </span>
                </div>
                <input
                  [(ngModel)]="createDraft.maxStepsText"
                  class="form-control"
                  name="create-max-steps"
                  placeholder="8"
                  inputmode="numeric"
                  [class.is-invalid]="isCreateFieldInvalid('maxStepsText', activeReviewMode)"
                  [class.is-valid]="showCreateFieldValid('maxStepsText', activeReviewMode)"
                />
                <span class="field-help">Cap multi-step reasoning or tool loops before they expand.</span>
                <span *ngIf="isCreateFieldInvalid('maxStepsText', activeReviewMode)" class="validation-error">
                  Enter a whole number between <code>1</code> and <code>50</code>.
                </span>
              </label>

              <label class="field-block">
                <div class="field-label-row">
                  <span>Timeout (seconds)</span>
                  <span class="required-indicator" [class.optional-indicator]="activeReviewMode === 'draft'">
                    {{ activeReviewMode === 'draft' ? 'Defaulted' : 'Required' }}
                  </span>
                </div>
                <input
                  [(ngModel)]="createDraft.timeoutSecondsText"
                  class="form-control"
                  name="create-timeout"
                  placeholder="180"
                  inputmode="numeric"
                  [class.is-invalid]="isCreateFieldInvalid('timeoutSecondsText', activeReviewMode)"
                  [class.is-valid]="showCreateFieldValid('timeoutSecondsText', activeReviewMode)"
                />
                <span class="field-help">Protects queue time and keeps runaway tasks bounded.</span>
                <span *ngIf="isCreateFieldInvalid('timeoutSecondsText', activeReviewMode)" class="validation-error">
                  Enter a whole number between <code>15</code> and <code>1800</code>.
                </span>
              </label>

              <label class="field-block">
                <div class="field-label-row">
                  <span>Retry policy</span>
                  <span class="optional-indicator">Defaulted</span>
                </div>
                <select [(ngModel)]="createDraft.retryPolicy" class="form-select" name="create-retry-policy">
                  <option *ngFor="let policy of retryOptions" [value]="policy.value">{{ policy.label }}</option>
                </select>
                <span class="field-help">{{ describeRetryPolicy(createDraft.retryPolicy) }}</span>
              </label>

              <label class="field-block">
                <div class="field-label-row">
                  <span>Reasoning mode</span>
                  <span class="optional-indicator">Defaulted</span>
                </div>
                <select [(ngModel)]="createDraft.reasoningMode" class="form-select" name="create-reasoning-mode">
                  <option *ngFor="let mode of reasoningOptions" [value]="mode.value">{{ mode.label }}</option>
                </select>
                <span class="field-help">{{ describeReasoningMode(createDraft.reasoningMode) }}</span>
              </label>
            </div>
          </details>
        </section>

        <section class="create-section">
          <div class="section-heading">
            <div>
              <div class="section-kicker">3. Tool Permissions</div>
              <h3>Show what the specialist can touch</h3>
            </div>
            <p class="field-help section-copy">
              Each permission card includes current access intent and placeholders for future
              read/write scopes or policy flags.
            </p>
          </div>

          <div class="tool-permission-grid">
            <label *ngFor="let tool of toolOptions" class="tool-permission-card" [class.tool-permission-card-active]="hasSelection(createDraft.selectedTools, tool.value)">
              <div class="tool-card-header">
                <div class="choice-card-top">
                  <input
                    type="checkbox"
                    [checked]="hasSelection(createDraft.selectedTools, tool.value)"
                    (change)="toggleSelection(createDraft.selectedTools, tool.value, isChecked($event))"
                    [name]="'create-tool-' + tool.value"
                  />
                  <span class="choice-title">{{ tool.label }}</span>
                </div>
                <span class="tool-access-pill">{{ tool.accessLabel }}</span>
              </div>
              <span class="choice-description">{{ tool.description }}</span>
              <div class="tool-detail-block">
                <span class="tool-detail-label">Scope preview</span>
                <span class="field-help">{{ tool.scopePreview }}</span>
              </div>
              <div class="tool-flag-row">
                <span *ngFor="let flag of tool.policyFlags" class="tool-flag">{{ flag }}</span>
              </div>
            </label>
          </div>
        </section>

        <section class="create-section">
          <div class="section-heading">
            <div>
              <div class="section-kicker">4. Prompt Configuration</div>
              <h3>Split the system prompt into reviewable parts</h3>
            </div>
            <p class="field-help section-copy">
              Structured sections make the prompt easier to scan, safer to review, and simpler to
              evolve over time.
            </p>
          </div>

          <div class="agent-grid-fields compact-grid">
            <label class="field-block field-wide">
              <div class="field-label-row">
                <span>Role / Persona</span>
                <span class="required-indicator" [class.optional-indicator]="activeReviewMode === 'draft'">
                  {{ activeReviewMode === 'draft' ? 'Recommended' : 'Required' }}
                </span>
              </div>
              <textarea
                [(ngModel)]="createDraft.promptRoleText"
                class="form-control"
                rows="3"
                name="create-prompt-role"
                placeholder="You are a rigorous research specialist operating inside the HelmOS control plane. Work clearly, cite evidence, and surface uncertainty early."
                [class.is-invalid]="isCreateFieldInvalid('promptRoleText', activeReviewMode)"
                [class.is-valid]="showCreateFieldValid('promptRoleText', activeReviewMode)"
              ></textarea>
              <span class="field-help">Describe the role, tone, and operating persona the model should adopt.</span>
              <span *ngIf="isCreateFieldInvalid('promptRoleText', activeReviewMode)" class="validation-error">
                Describe the role or persona this specialist should embody.
              </span>
            </label>

            <label class="field-block field-wide">
              <div class="field-label-row">
                <span>Task Instructions</span>
                <span class="required-indicator" [class.optional-indicator]="activeReviewMode === 'draft'">
                  {{ activeReviewMode === 'draft' ? 'Recommended' : 'Required' }}
                </span>
              </div>
              <textarea
                [(ngModel)]="createDraft.promptInstructionsText"
                class="form-control"
                rows="4"
                name="create-prompt-tasks"
                placeholder="1. Understand the input request. 2. Gather the strongest available evidence. 3. Summarise findings, key assumptions, and next actions."
                [class.is-invalid]="isCreateFieldInvalid('promptInstructionsText', activeReviewMode)"
                [class.is-valid]="showCreateFieldValid('promptInstructionsText', activeReviewMode)"
              ></textarea>
              <span class="field-help">Capture the work sequence, priorities, or decision logic this agent should follow.</span>
              <span *ngIf="isCreateFieldInvalid('promptInstructionsText', activeReviewMode)" class="validation-error">
                Add the main task instructions the agent should follow.
              </span>
            </label>

            <label class="field-block">
              <div class="field-label-row">
                <span>Constraints</span>
                <span class="required-indicator" [class.optional-indicator]="activeReviewMode === 'draft'">
                  {{ activeReviewMode === 'draft' ? 'Recommended' : 'Required' }}
                </span>
              </div>
              <textarea
                [(ngModel)]="createDraft.promptConstraintsText"
                class="form-control"
                rows="4"
                name="create-prompt-constraints"
                placeholder="Do not invent sources. Escalate legal, regulatory, or irreversible actions. Stay within assigned tools and approved scope."
                [class.is-invalid]="isCreateFieldInvalid('promptConstraintsText', activeReviewMode)"
                [class.is-valid]="showCreateFieldValid('promptConstraintsText', activeReviewMode)"
              ></textarea>
              <span class="field-help">Make safety rules, boundaries, and escalation criteria explicit.</span>
              <span *ngIf="isCreateFieldInvalid('promptConstraintsText', activeReviewMode)" class="validation-error">
                Add operating constraints or escalation rules.
              </span>
            </label>

            <label class="field-block">
              <div class="field-label-row">
                <span>Output Format</span>
                <span class="required-indicator" [class.optional-indicator]="activeReviewMode === 'draft'">
                  {{ activeReviewMode === 'draft' ? 'Recommended' : 'Required' }}
                </span>
              </div>
              <textarea
                [(ngModel)]="createDraft.promptOutputFormatText"
                class="form-control"
                rows="4"
                name="create-prompt-output"
                placeholder="Return: Executive summary, evidence table, confidence level, open questions, and recommended next step."
                [class.is-invalid]="isCreateFieldInvalid('promptOutputFormatText', activeReviewMode)"
                [class.is-valid]="showCreateFieldValid('promptOutputFormatText', activeReviewMode)"
              ></textarea>
              <span class="field-help">Describe the structure the user or workflow should reliably receive back.</span>
              <span *ngIf="isCreateFieldInvalid('promptOutputFormatText', activeReviewMode)" class="validation-error">
                Explain the expected response format.
              </span>
            </label>
          </div>
        </section>

        <section class="create-section review-section">
          <div class="section-heading">
            <div>
              <div class="section-kicker">5. Validation / Review</div>
              <h3>Review before you commit the registry record</h3>
            </div>
            <p class="field-help section-copy">
              This summary helps reviewers confirm the agent intent, runtime posture, and missing
              setup before saving.
            </p>
          </div>

          <div class="review-grid">
            <div class="review-card">
              <span class="review-label">Prompt key</span>
              <strong>{{ promptConfigKeyLabel }}</strong>
              <span class="field-help">Generated from the agent key and stored with the first prompt version.</span>
            </div>

            <div class="review-card">
              <span class="review-label">Lifecycle state</span>
              <strong>{{ createDraft.lifecycleState === 'active' ? 'Active on create' : 'Saved as draft' }}</strong>
              <span class="field-help">
                {{ createDraft.lifecycleState === 'active'
                  ? 'Will be persisted as enabled if validation passes.'
                  : 'Will be persisted inactive for later refinement.' }}
              </span>
            </div>

            <div class="review-card">
              <span class="review-label">Tool permissions</span>
              <strong>{{ selectedToolCount }} selected</strong>
              <span class="field-help">{{ selectedToolSummary }}</span>
            </div>

            <div class="review-card">
              <span class="review-label">Execution defaults</span>
              <strong>{{ createDraft.reasoningMode | titlecase }} reasoning</strong>
              <span class="field-help">
                {{ createDraft.temperatureText }} temperature, {{ createDraft.maxStepsText }} max steps,
                {{ createDraft.timeoutSecondsText }}s timeout
              </span>
            </div>
          </div>

          <div class="review-validation" [class.review-validation-clear]="activeReviewIssues.length === 0">
            <div>
              <div class="review-label">Validation status</div>
              <strong>
                {{ activeReviewIssues.length === 0
                  ? (createDraft.lifecycleState === 'active' ? 'Ready to register' : 'Ready to save as draft')
                  : 'Needs attention' }}
              </strong>
            </div>

            <ul *ngIf="activeReviewIssues.length > 0" class="review-issue-list">
              <li *ngFor="let issue of activeReviewIssues">{{ issue }}</li>
            </ul>

            <p *ngIf="activeReviewIssues.length === 0" class="field-help mb-0">
              {{ createDraft.lifecycleState === 'active'
                ? 'All required registration fields look complete.'
                : 'This draft contains the minimum information needed for a safe handoff.' }}
            </p>
          </div>
        </section>

        <footer class="create-actions review-footer">
          <div class="footer-review-copy">
            <div *ngIf="createDraft.createError" class="save-error">{{ createDraft.createError }}</div>
            <span *ngIf="!createDraft.createError" class="field-help">
              Save a draft for later refinement, or register immediately when the validation panel is clear.
            </span>
          </div>

          <div class="modal-actions">
            <button class="btn btn-outline-secondary" type="button" (click)="closeCreateModal()">Cancel</button>
            <button class="btn btn-outline-primary" type="button" [disabled]="createDraft.creating" (click)="createAgent('draft')">
              {{ createDraft.creating && createDraft.lastAttemptMode === 'draft' ? 'Saving draft...' : 'Save Draft' }}
            </button>
            <button class="btn btn-primary" type="button" [disabled]="createDraft.creating" (click)="createAgent('register')">
              {{ createDraft.creating && createDraft.lastAttemptMode === 'register' ? 'Registering...' : 'Register Agent' }}
            </button>
          </div>
        </footer>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .admin-shell {
        padding: 92px 1rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .admin-hero,
      .gateway-card,
      .loading-state,
      .agent-card {
        padding: 1.25rem;
      }

      .admin-hero {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(250px, 0.8fr);
        gap: 1.5rem;
        align-items: start;
      }

      .hero-kicker,
      .section-kicker,
      .hero-stat-label,
      .field-block span:first-child,
      dt {
        display: block;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
        color: var(--helmos-muted);
      }

      h1,
      h2,
      h3 {
        margin: 0;
        letter-spacing: -0.03em;
      }

      .hero-copy h1 {
        margin-top: 0.4rem;
        font-size: clamp(1.9rem, 2.8vw, 2.6rem);
      }

      .hero-copy p,
      .gateway-card p,
      .runtime-copy {
        color: var(--helmos-muted);
        max-width: 56rem;
      }

      .hero-stat {
        border-radius: 1rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(248, 251, 255, 0.85);
        padding: 1rem;
      }

      .hero-stat strong {
        display: block;
        margin-top: 0.35rem;
        font-size: 1.1rem;
      }

      .gateway-offline {
        color: #b45309;
      }

      .gateway-card {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(250px, 0.8fr);
        gap: 1rem;
        align-items: start;
      }

      .prompt-panel,
      .runtime-panel,
      .create-section,
      .form-intro-band {
        border-radius: 1rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(248, 251, 255, 0.86);
      }

      .gateway-card-offline {
        border-color: rgba(217, 164, 65, 0.35);
        background: linear-gradient(180deg, rgba(255, 248, 235, 0.92), rgba(255, 255, 255, 0.96));
      }

      .gateway-details {
        display: grid;
        gap: 0.75rem;
        margin: 0;
      }

      .gateway-details div {
        padding: 0.85rem 0.9rem;
        background: rgba(248, 251, 255, 0.84);
        border-radius: 0.9rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      dd {
        margin: 0.2rem 0 0;
        font-weight: 600;
      }

      .loading-state {
        color: var(--helmos-muted);
      }

      .load-state-card,
      .empty-state-card {
        padding: 1.25rem;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .load-state-card {
        border: 1px solid rgba(180, 35, 24, 0.18);
        background: linear-gradient(180deg, rgba(254, 242, 242, 0.94), rgba(255, 255, 255, 0.98));
      }

      .empty-state-card {
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: linear-gradient(180deg, rgba(248, 251, 255, 0.92), rgba(255, 255, 255, 0.98));
      }

      .load-state-actions,
      .empty-state-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .create-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .agent-card {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .agent-card-header,
      .agent-card-footer,
      .panel-heading,
      .section-heading,
      .tool-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .agent-key {
        color: var(--helmos-accent);
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .agent-card-header h2 {
        margin-top: 0.25rem;
        font-size: 1.3rem;
      }

      .badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        justify-content: flex-end;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.4rem 0.7rem;
        border-radius: 999px;
        background: #edf9f2;
        color: #18794e;
        font-size: 0.75rem;
        font-weight: 700;
      }

      .status-pill-muted {
        background: #eef3f8;
        color: var(--helmos-muted);
      }

      .status-pill-warning {
        background: #fff5e8;
        color: #b45309;
      }

      .agent-grid-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
      }

      .compact-grid {
        gap: 0.9rem 1rem;
      }

      .field-block {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .field-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .field-help,
      .validation-error {
        font-size: 0.8rem;
        line-height: 1.45;
      }

      .field-help {
        color: var(--helmos-muted);
      }

      .validation-error,
      .save-error {
        color: #b42318;
      }

      .required-indicator,
      .optional-indicator {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 700;
      }

      .required-indicator {
        color: #0f766e;
      }

      .optional-indicator {
        color: var(--helmos-muted);
      }

      .field-wide {
        grid-column: 1 / -1;
      }

      .choice-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.75rem;
      }

      .choice-card,
      .tool-permission-card,
      .review-card {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.8rem 0.9rem;
        border-radius: 0.9rem;
        border: 1px solid rgba(219, 228, 238, 0.95);
        background: rgba(255, 255, 255, 0.92);
      }

      .choice-card-top {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }

      .choice-title {
        font-weight: 700;
        color: var(--helmos-ink);
      }

      .choice-description,
      .prompt-copy {
        margin: 0;
      }

      .choice-description {
        font-size: 0.78rem;
        color: var(--helmos-muted);
      }

      .prompt-panel,
      .runtime-panel,
      .create-section,
      .form-intro-band {
        padding: 1rem;
      }

      .panel-heading h3,
      .section-heading h3 {
        margin-top: 0.25rem;
        font-size: 1rem;
      }

      .section-heading {
        padding-bottom: 0.9rem;
        margin-bottom: 1rem;
        border-bottom: 1px solid rgba(219, 228, 238, 0.85);
      }

      .section-copy {
        max-width: 32rem;
        margin: 0;
      }

      .runtime-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      .runtime-meta span,
      .agent-footnote,
      .review-label {
        font-size: 0.8rem;
        color: var(--helmos-muted);
      }

      .code-field {
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
      }

      .footer-actions {
        display: flex;
        align-items: center;
        gap: 0.8rem;
      }

      .create-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
      }

      .review-footer {
        padding-top: 1rem;
        border-top: 1px solid rgba(219, 228, 238, 0.85);
      }

      .modal-actions {
        display: flex;
        gap: 0.75rem;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.32);
        backdrop-filter: blur(4px);
        z-index: 1040;
      }

      .agent-modal {
        position: fixed;
        inset: 0;
        z-index: 1050;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
      }

      .agent-modal-card {
        width: min(1080px, 100%);
        max-height: calc(100vh - 3rem);
        overflow: auto;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        box-shadow: 0 28px 70px rgba(15, 23, 42, 0.22);
      }

      .form-intro-band {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .segmented-control {
        display: inline-flex;
        gap: 0.5rem;
        padding: 0.25rem;
        border-radius: 999px;
        background: rgba(226, 232, 240, 0.58);
      }

      .segment-option {
        position: relative;
        display: inline-flex;
        align-items: center;
        cursor: pointer;
      }

      .segment-option input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .segment-option span {
        display: inline-flex;
        align-items: center;
        padding: 0.55rem 0.95rem;
        border-radius: 999px;
        font-weight: 700;
        color: var(--helmos-muted);
      }

      .segment-option-active span {
        background: #fff;
        color: var(--helmos-ink);
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
      }

      .execution-details {
        margin-top: 1rem;
        border-top: 1px solid rgba(219, 228, 238, 0.85);
        padding-top: 1rem;
      }

      .execution-details summary {
        cursor: pointer;
        font-weight: 700;
        color: var(--helmos-ink);
      }

      .execution-grid {
        margin-top: 1rem;
      }

      .tool-permission-grid,
      .review-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.85rem;
      }

      .tool-permission-card {
        gap: 0.7rem;
        cursor: pointer;
      }

      .tool-permission-card-active {
        border-color: rgba(32, 129, 226, 0.45);
        box-shadow: 0 10px 24px rgba(32, 129, 226, 0.08);
      }

      .tool-access-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.3rem 0.55rem;
        border-radius: 999px;
        background: rgba(226, 232, 240, 0.7);
        color: var(--helmos-muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .tool-detail-label {
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 700;
        color: var(--helmos-muted);
      }

      .tool-flag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .tool-flag {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.55rem;
        border-radius: 999px;
        background: rgba(248, 250, 252, 1);
        border: 1px solid rgba(219, 228, 238, 0.95);
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--helmos-muted);
      }

      .review-card strong,
      .review-validation strong {
        color: var(--helmos-ink);
      }

      .review-validation {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 1rem;
        padding: 0.95rem 1rem;
        border-radius: 0.95rem;
        border: 1px solid rgba(180, 35, 24, 0.18);
        background: rgba(254, 242, 242, 0.7);
      }

      .review-validation-clear {
        border-color: rgba(24, 121, 78, 0.18);
        background: rgba(237, 249, 242, 0.8);
      }

      .review-issue-list {
        margin: 0;
        padding-left: 1.1rem;
        color: #7f1d1d;
      }

      .review-issue-list li + li {
        margin-top: 0.35rem;
      }

      @media (max-width: 991.98px) {
        .admin-hero,
        .gateway-card,
        .form-intro-band,
        .review-validation,
        .load-state-card,
        .empty-state-card {
          grid-template-columns: 1fr;
          flex-direction: column;
        }

      }

      @media (max-width: 767.98px) {
        .admin-shell {
          padding-inline: 0.75rem;
        }

        .agent-grid-fields {
          grid-template-columns: 1fr;
        }

        .agent-card-header,
        .agent-card-footer,
        .panel-heading,
        .create-card-header,
        .section-heading,
        .tool-card-header {
          flex-direction: column;
        }

        .footer-actions,
        .create-actions {
          width: 100%;
          flex-direction: column;
          align-items: stretch;
        }

        .modal-actions {
          width: 100%;
          flex-direction: column;
        }

        .segment-option span {
          width: 100%;
          justify-content: center;
        }
      }
    `
  ]
})
export class AgentAdminScreenComponent implements OnInit {
  readonly shell: WorkspaceShellService;
  private readonly changeDetector: ChangeDetectorRef;
  readonly modelOptions = MODEL_OPTIONS;
  readonly toolOptions = TOOL_OPTIONS;
  readonly reasoningOptions = REASONING_OPTIONS;
  readonly retryOptions = RETRY_OPTIONS;

  loading = true;
  loadError: string | null = null;
  gateway: AgentGatewayStatus | null = null;
  agents: EditableAgentRecord[] = [];
  selectedAgentId: string | null = null;
  selectedAgentLoadError: string | null = null;
  selectedAgentLoadingId: string | null = null;
  showGatewayDetails = false;
  createDraft = this.buildCreateDraft();
  createModalOpen = false;
  saveStatusLabel = 'Admin controls ready';

  constructor(
    changeDetector: ChangeDetectorRef,
    shell: WorkspaceShellService,
    private readonly agentAdminService: AgentAdminService
  ) {
    this.changeDetector = changeDetector;
    this.shell = shell;
  }

  get gatewayLabel(): string {
    if (!this.gateway) {
      return this.loadError ? 'Unavailable' : 'Loading';
    }

    if (this.gateway.status === 'online') {
      return 'Online';
    }

    if (this.gateway.status === 'offline') {
      return 'Offline';
    }

    return 'Not configured';
  }

  get promptConfigKeyLabel(): string {
    const key = this.createDraft.key.trim();
    return key ? `${key}.default` : 'Prompt key will be generated from the agent key';
  }

  get activeReviewMode(): CreateIntent {
    return this.createDraft.lifecycleState === 'active' ? 'register' : 'draft';
  }

  get activeReviewIssues(): string[] {
    return this.getCreateValidationIssues(this.activeReviewMode);
  }

  get selectedToolCount(): number {
    return this.createDraft.selectedTools.length;
  }

  get selectedToolSummary(): string {
    if (this.createDraft.selectedTools.length === 0) {
      return 'No tools selected. This agent will operate without infrastructure capabilities.';
    }

    return this.createDraft.selectedTools
      .map((toolKey) => this.toolOptions.find((tool) => tool.value === toolKey)?.label ?? toolKey)
      .join(', ');
  }

  get selectedAgent(): EditableAgentRecord | null {
    if (!this.selectedAgentId) {
      return this.agents[0] ?? null;
    }

    return this.agents.find((agent) => agent.id === this.selectedAgentId) ?? this.agents[0] ?? null;
  }

  async ngOnInit(): Promise<void> {
    await this.loadAgents();
  }

  trackByAgentId(_: number, agent: EditableAgentRecord): string {
    return agent.id;
  }

  selectAgent(agentId: string): void {
    this.selectedAgentId = agentId;
    this.selectedAgentLoadError = null;
    void this.hydrateSelectedAgent(agentId);
  }

  setAgentLifecycle(agent: EditableAgentRecord, value: LifecycleState): void {
    agent.active = value === 'active';
  }

  toggleGatewayDetails(): void {
    this.showGatewayDetails = !this.showGatewayDetails;
  }

  joinTools(tools: string[]): string {
    return tools.length > 0 ? tools.join(', ') : 'None';
  }

  summarizeAgent(agent: EditableAgentRecord): string {
    return agent.description.split('\n')[0]?.trim() || 'No summary captured yet.';
  }

  describeModel(value: string | null | undefined): string {
    const option = this.modelOptions.find((entry) => entry.value === value);
    return option?.description ?? 'Choose the model alias this agent should request by default.';
  }

  describeRetryPolicy(value: RetryPolicy): string {
    return this.retryOptions.find((option) => option.value === value)?.description ?? '';
  }

  describeReasoningMode(value: ReasoningMode): string {
    return this.reasoningOptions.find((option) => option.value === value)?.description ?? '';
  }

  hasSelection(selectedValues: string[], value: string): boolean {
    return selectedValues.includes(value);
  }

  isChecked(event: Event): boolean {
    return (event.target as HTMLInputElement | null)?.checked === true;
  }

  toggleSelection(selectedValues: string[], value: string, checked: boolean): void {
    const index = selectedValues.indexOf(value);

    if (checked && index === -1) {
      selectedValues.push(value);
      return;
    }

    if (!checked && index >= 0) {
      selectedValues.splice(index, 1);
    }
  }

  formatTimestamp(value: string | null | undefined): string {
    if (!value) {
      return 'Unavailable';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
    }).format(date);
  }

  isCreateFieldInvalid(fieldName: CreateFieldName, mode: CreateIntent): boolean {
    if (!this.createDraft.submitAttempted) {
      return false;
    }

    return !this.isCreateFieldValid(fieldName, mode);
  }

  showCreateFieldValid(fieldName: CreateFieldName, mode: CreateIntent): boolean {
    if (!this.createDraft.submitAttempted) {
      return false;
    }

    return this.isCreateFieldValid(fieldName, mode);
  }

  async saveAgent(
    agent: EditableAgentRecord,
    latestFields?: Partial<Pick<EditableAgentRecord, 'temperatureText' | 'maxStepsText' | 'timeoutSecondsText'>>
  ): Promise<void> {
    agent.saveError = null;
    agent.saving = true;

    try {
      if (latestFields) {
        agent.temperatureText = latestFields.temperatureText ?? agent.temperatureText;
        agent.maxStepsText = latestFields.maxStepsText ?? agent.maxStepsText;
        agent.timeoutSecondsText = latestFields.timeoutSecondsText ?? agent.timeoutSecondsText;
      }

      const payload = this.buildUpdatePayload(agent);
      const updated = await this.agentAdminService.updateAgent(agent.id, payload);
      const index = this.agents.findIndex((entry) => entry.id === agent.id);
      if (index >= 0) {
        this.agents[index] = this.toEditableRecord(updated);
        this.selectedAgentId = this.agents[index].id;
      }
      this.saveStatusLabel = `Saved ${updated.name}`;
    } catch (error) {
      agent.saveError = this.toErrorMessage(error);
    } finally {
      agent.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  async createAgent(intent: CreateIntent): Promise<void> {
    this.createDraft.createError = null;
    this.createDraft.submitAttempted = true;
    this.createDraft.lastAttemptMode = intent;
    this.createDraft.lifecycleState = intent === 'register' ? 'active' : 'draft';

    const issues = this.getCreateValidationIssues(intent);
    if (issues.length > 0) {
      this.createDraft.createError = 'Resolve the highlighted fields before continuing.';
      this.changeDetector.detectChanges();
      return;
    }

    this.createDraft.creating = true;

    try {
      const payload = this.buildCreatePayload(this.createDraft, intent);
      const created = await this.agentAdminService.createAgent(payload);
      this.agents = [this.toEditableRecord(created), ...this.agents];
      this.selectedAgentId = created.id;
      this.closeCreateModal();
      this.saveStatusLabel = intent === 'register' ? `Registered ${created.name}` : `Saved draft ${created.name}`;
    } catch (error) {
      this.createDraft.createError = this.toErrorMessage(error);
    } finally {
      this.createDraft.creating = false;
      this.changeDetector.detectChanges();
    }
  }

  openCreateModal(): void {
    this.createDraft = this.buildCreateDraft();
    this.createModalOpen = true;
  }

  retryLoadAgents(): void {
    void this.loadAgents();
  }

  closeCreateModal(): void {
    this.createModalOpen = false;
    this.createDraft = this.buildCreateDraft();
  }

  private async loadAgents(): Promise<void> {
    this.loading = true;
    this.loadError = null;

    try {
      const snapshot = await this.agentAdminService.listAgents();
      this.applySnapshot(snapshot);
    } catch (error) {
      this.loadError = this.toErrorMessage(error);
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  private applySnapshot(snapshot: AgentAdminSnapshot): void {
    this.gateway = snapshot.gateway;
    this.agents = snapshot.agents.map((agent) => this.toEditableRecord(agent));
    this.selectedAgentId =
      this.agents.find((agent) => agent.id === this.selectedAgentId)?.id ?? this.agents[0]?.id ?? null;
    this.selectedAgentLoadError = null;
    if (this.selectedAgentId) {
      void this.hydrateSelectedAgent(this.selectedAgentId);
    }
  }

  private async hydrateSelectedAgent(agentId: string): Promise<void> {
    this.selectedAgentLoadingId = agentId;

    try {
      const detailedAgent = await this.agentAdminService.getAgent(agentId);

      if (this.selectedAgentId !== agentId) {
        return;
      }

      const index = this.agents.findIndex((agent) => agent.id === agentId);
      if (index >= 0) {
        this.agents[index] = this.toEditableRecord(detailedAgent);
      } else {
        this.agents = [this.toEditableRecord(detailedAgent), ...this.agents];
      }

      this.selectedAgentLoadError = null;
    } catch (error) {
      if (this.selectedAgentId === agentId) {
        this.selectedAgentLoadError = this.toErrorMessage(error);
      }
    } finally {
      if (this.selectedAgentLoadingId === agentId) {
        this.selectedAgentLoadingId = null;
      }
      this.changeDetector.detectChanges();
    }
  }

  private toEditableRecord(agent: AgentAdminRecord): EditableAgentRecord {
    const configJson = this.asRecord(agent.promptConfig?.configJson);
    const descriptionFields = this.extractDescriptionFields(agent.description);
    const promptSections = this.extractPromptSections(agent.promptConfig?.promptTemplate, configJson);

    return {
      ...agent,
      description: agent.description ?? '',
      purpose: this.readString(configJson['purpose']) || descriptionFields.purpose,
      scopeNotes: this.readString(configJson['scopeNotes']) || descriptionFields.scopeNotes,
      defaultModel: agent.defaultModel ?? '',
      selectedTools: [...agent.allowedTools],
      promptVersionText: agent.promptConfig?.version ?? '1.0.0',
      promptRoleText: promptSections.rolePersona,
      promptInstructionsText: promptSections.taskInstructions,
      promptConstraintsText: promptSections.constraints,
      promptOutputFormatText: promptSections.outputFormat,
      temperatureText: this.toNumericText(configJson['temperature'], '0.2'),
      maxStepsText: this.toNumericText(configJson['maxSteps'], '8'),
      timeoutSecondsText: this.toNumericText(configJson['timeoutSeconds'], '180'),
      retryPolicy: this.asRetryPolicy(configJson['retryPolicy']),
      reasoningMode: this.asReasoningMode(configJson['reasoningMode']),
      promptConfigText: JSON.stringify(this.extractAdditionalPromptConfig(configJson), null, 2),
      saving: false,
      saveError: null
    };
  }

  private buildCreateDraft(): CreateAgentDraft {
    return {
      key: '',
      name: '',
      version: '1.0.0',
      purpose: '',
      scopeNotes: '',
      defaultModel: 'helmos-default',
      selectedTools: [],
      promptVersionText: '1.0.0',
      promptRoleText: '',
      promptInstructionsText: '',
      promptConstraintsText: '',
      promptOutputFormatText: '',
      temperatureText: '0.2',
      maxStepsText: '8',
      timeoutSecondsText: '180',
      retryPolicy: 'standard',
      reasoningMode: 'balanced',
      lifecycleState: 'active',
      showExecutionDetails: false,
      creating: false,
      createError: null,
      submitAttempted: false,
      lastAttemptMode: null
    };
  }

  private buildCreatePayload(draft: CreateAgentDraft, intent: CreateIntent): CreateAgentAdminPayload {
    const version = draft.version.trim() || '1.0.0';
    const promptVersion = draft.promptVersionText.trim() || '1.0.0';

    return {
      key: draft.key.trim(),
      name: draft.name.trim(),
      version,
      description: this.composeDescription(draft),
      allowedTools: [...draft.selectedTools],
      defaultModel: draft.defaultModel?.trim() || null,
      active: intent === 'register',
      promptConfig: {
        key: `${draft.key.trim()}.default`,
        version: promptVersion,
        promptTemplate: this.composePromptTemplate(draft, intent),
        configJson: this.buildCreatePromptConfig(draft, intent)
      }
    };
  }

  private buildUpdatePayload(agent: EditableAgentRecord) {
    const promptVersion = agent.promptVersionText.trim();
    const promptKey = agent.promptConfig?.key ?? `${agent.key}.default`;
    const payload: {
      name: string;
      version: string;
      description: string | null;
      allowedTools: string[];
      defaultModel: string | null;
      active: boolean;
      promptConfig?: {
        key: string;
        version: string;
        promptTemplate: string;
        configJson: Record<string, unknown>;
      };
    } = {
      name: agent.name.trim(),
      version: agent.version.trim(),
      description: this.composeDescriptionFromFields(agent),
      allowedTools: [...agent.selectedTools],
      defaultModel: agent.defaultModel?.trim() || null,
      active: agent.active
    };

    if (promptVersion) {
      payload.promptConfig = {
        key: promptKey,
        version: promptVersion,
        promptTemplate: this.composePromptTemplateFromFields(agent),
        configJson: this.buildEditPromptConfig(agent)
      };
    }

    return payload;
  }

  private getCreateValidationIssues(mode: CreateIntent): string[] {
    const issues: string[] = [];

    if (!this.isCreateFieldValid('key', mode)) {
      issues.push('Add a valid agent key.');
    }

    if (!this.isCreateFieldValid('name', mode)) {
      issues.push('Add a display name.');
    }

    if (!this.isCreateFieldValid('purpose', mode)) {
      issues.push('Describe the primary objective.');
    }

    if (mode === 'register') {
      if (!this.isCreateFieldValid('version', mode)) {
        issues.push('Use a valid agent version.');
      }

      if (!this.isCreateFieldValid('promptVersionText', mode)) {
        issues.push('Use a valid prompt version.');
      }

      if (!this.isCreateFieldValid('promptRoleText', mode)) {
        issues.push('Complete the role / persona section.');
      }

      if (!this.isCreateFieldValid('promptInstructionsText', mode)) {
        issues.push('Complete the task instructions section.');
      }

      if (!this.isCreateFieldValid('promptConstraintsText', mode)) {
        issues.push('Complete the constraints section.');
      }

      if (!this.isCreateFieldValid('promptOutputFormatText', mode)) {
        issues.push('Complete the output format section.');
      }

      if (!this.isCreateFieldValid('temperatureText', mode)) {
        issues.push('Set a valid temperature.');
      }

      if (!this.isCreateFieldValid('maxStepsText', mode)) {
        issues.push('Set a valid max steps value.');
      }

      if (!this.isCreateFieldValid('timeoutSecondsText', mode)) {
        issues.push('Set a valid timeout.');
      }
    }

    return issues;
  }

  private isCreateFieldValid(fieldName: CreateFieldName, mode: CreateIntent): boolean {
    const valueMap: Record<CreateFieldName, string> = {
      key: this.createDraft.key.trim(),
      name: this.createDraft.name.trim(),
      version: this.createDraft.version.trim(),
      purpose: this.createDraft.purpose.trim(),
      promptVersionText: this.createDraft.promptVersionText.trim(),
      promptRoleText: this.createDraft.promptRoleText.trim(),
      promptInstructionsText: this.createDraft.promptInstructionsText.trim(),
      promptConstraintsText: this.createDraft.promptConstraintsText.trim(),
      promptOutputFormatText: this.createDraft.promptOutputFormatText.trim(),
      temperatureText: this.createDraft.temperatureText.trim(),
      maxStepsText: this.createDraft.maxStepsText.trim(),
      timeoutSecondsText: this.createDraft.timeoutSecondsText.trim()
    };

    if (fieldName === 'key') {
      return /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(valueMap.key);
    }

    if (fieldName === 'name' || fieldName === 'purpose') {
      return valueMap[fieldName].length > 0;
    }

    if (fieldName === 'version' || fieldName === 'promptVersionText') {
      if (mode === 'draft' && valueMap[fieldName].length === 0) {
        return true;
      }

      return /^\d+\.\d+\.\d+$/.test(valueMap[fieldName]);
    }

    if (
      fieldName === 'promptRoleText' ||
      fieldName === 'promptInstructionsText' ||
      fieldName === 'promptConstraintsText' ||
      fieldName === 'promptOutputFormatText'
    ) {
      if (mode === 'draft') {
        return true;
      }

      return valueMap[fieldName].length > 0;
    }

    if (fieldName === 'temperatureText') {
      if (mode === 'draft' && valueMap.temperatureText.length === 0) {
        return true;
      }

      const numericValue = Number(valueMap.temperatureText);
      return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 2;
    }

    if (fieldName === 'maxStepsText') {
      if (mode === 'draft' && valueMap.maxStepsText.length === 0) {
        return true;
      }

      const numericValue = Number(valueMap.maxStepsText);
      return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 50;
    }

    if (fieldName === 'timeoutSecondsText') {
      if (mode === 'draft' && valueMap.timeoutSecondsText.length === 0) {
        return true;
      }

      const numericValue = Number(valueMap.timeoutSecondsText);
      return Number.isInteger(numericValue) && numericValue >= 15 && numericValue <= 1800;
    }

    const fieldValue = valueMap[fieldName] as string;
    return fieldValue.length > 0;
  }

  private composeDescription(draft: CreateAgentDraft): string {
    const sections = [`Purpose: ${draft.purpose.trim()}`];
    const scopeNotes = draft.scopeNotes.trim();

    if (scopeNotes) {
      sections.push(`Scope: ${scopeNotes}`);
    }

    return sections.join('\n\n');
  }

  private composeDescriptionFromFields(source: { purpose: string; scopeNotes: string }): string | null {
    const purpose = source.purpose.trim();
    const scopeNotes = source.scopeNotes.trim();
    const sections: string[] = [];

    if (purpose) {
      sections.push(`Purpose: ${purpose}`);
    }

    if (scopeNotes) {
      sections.push(`Scope: ${scopeNotes}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : null;
  }

  private composePromptTemplate(draft: CreateAgentDraft, intent: CreateIntent): string {
    if (intent === 'draft') {
      return [
        'Role / Persona:',
        draft.promptRoleText.trim() || `Draft specialist definition for ${draft.name.trim() || 'this agent'}.`,
        '',
        'Task Instructions:',
        draft.promptInstructionsText.trim() ||
          `Primary objective: ${draft.purpose.trim()}. This draft is incomplete and should be reviewed before activation.`,
        '',
        'Constraints:',
        draft.promptConstraintsText.trim() ||
          'Do not operate as a production agent until the draft configuration has been completed and approved.',
        '',
        'Output Format:',
        draft.promptOutputFormatText.trim() ||
          'Return a short readiness note listing missing configuration and recommended next edits.'
      ].join('\n');
    }

    return [
      'Role / Persona:',
      draft.promptRoleText.trim(),
      '',
      'Task Instructions:',
      draft.promptInstructionsText.trim(),
      '',
      'Constraints:',
      draft.promptConstraintsText.trim(),
      '',
      'Output Format:',
      draft.promptOutputFormatText.trim()
    ].join('\n');
  }

  private buildCreatePromptConfig(draft: CreateAgentDraft, intent: CreateIntent): Record<string, unknown> {
    const temperature = this.parseNumberInput(draft.temperatureText, 0.2);
    const maxSteps = this.parseIntegerInput(draft.maxStepsText, 8);
    const timeoutSeconds = this.parseIntegerInput(draft.timeoutSecondsText, 180);

    return {
      purpose: draft.purpose.trim(),
      scopeNotes: draft.scopeNotes.trim() || null,
      lifecycleState: intent === 'register' ? 'active' : 'draft',
      reasoningMode: draft.reasoningMode,
      retryPolicy: draft.retryPolicy,
      temperature,
      maxSteps,
      timeoutSeconds,
      promptSections: {
        rolePersona: draft.promptRoleText.trim(),
        taskInstructions: draft.promptInstructionsText.trim(),
        constraints: draft.promptConstraintsText.trim(),
        outputFormat: draft.promptOutputFormatText.trim()
      },
      toolPermissions: draft.selectedTools.map((toolKey) => {
        const tool = this.toolOptions.find((entry) => entry.value === toolKey);

        return {
          key: toolKey,
          label: tool?.label ?? toolKey,
          access: tool?.accessLabel ?? 'Configured',
          scopePreview: tool?.scopePreview ?? '',
          policyFlags: tool?.policyFlags ?? []
        };
      })
    };
  }

  private composePromptTemplateFromFields(source: {
    promptRoleText: string;
    promptInstructionsText: string;
    promptConstraintsText: string;
    promptOutputFormatText: string;
  }): string {
    return [
      'Role / Persona:',
      source.promptRoleText.trim(),
      '',
      'Task Instructions:',
      source.promptInstructionsText.trim(),
      '',
      'Constraints:',
      source.promptConstraintsText.trim(),
      '',
      'Output Format:',
      source.promptOutputFormatText.trim()
    ].join('\n');
  }

  private buildEditPromptConfig(agent: EditableAgentRecord): Record<string, unknown> {
    const additionalConfig = this.parsePromptConfigJson(agent.promptConfigText);

    return {
      ...additionalConfig,
      purpose: agent.purpose.trim(),
      scopeNotes: agent.scopeNotes.trim() || null,
      lifecycleState: agent.active ? 'active' : 'draft',
      reasoningMode: agent.reasoningMode,
      retryPolicy: agent.retryPolicy,
      temperature: this.parseNumberInput(agent.temperatureText, 0.2),
      maxSteps: this.parseIntegerInput(agent.maxStepsText, 8),
      timeoutSeconds: this.parseIntegerInput(agent.timeoutSecondsText, 180),
      promptSections: {
        rolePersona: agent.promptRoleText.trim(),
        taskInstructions: agent.promptInstructionsText.trim(),
        constraints: agent.promptConstraintsText.trim(),
        outputFormat: agent.promptOutputFormatText.trim()
      },
      toolPermissions: agent.selectedTools.map((toolKey) => {
        const tool = this.toolOptions.find((entry) => entry.value === toolKey);

        return {
          key: toolKey,
          label: tool?.label ?? toolKey,
          access: tool?.accessLabel ?? 'Configured',
          scopePreview: tool?.scopePreview ?? '',
          policyFlags: tool?.policyFlags ?? []
        };
      })
    };
  }

  private extractDescriptionFields(description: string | null | undefined): { purpose: string; scopeNotes: string } {
    const value = description?.trim() ?? '';

    if (!value) {
      return { purpose: '', scopeNotes: '' };
    }

    const purposeMatch = value.match(/Purpose:\s*([\s\S]*?)(?:\n\s*\nScope:|$)/i);
    const scopeMatch = value.match(/Scope:\s*([\s\S]*?)$/i);

    return {
      purpose: purposeMatch?.[1]?.trim() ?? '',
      scopeNotes: scopeMatch?.[1]?.trim() ?? ''
    };
  }

  private extractPromptSections(
    promptTemplate: string | null | undefined,
    configJson: Record<string, unknown>
  ): { rolePersona: string; taskInstructions: string; constraints: string; outputFormat: string } {
    const promptSections = this.asRecord(configJson['promptSections']);

    const fromConfig = {
      rolePersona: this.readString(promptSections['rolePersona']),
      taskInstructions: this.readString(promptSections['taskInstructions']),
      constraints: this.readString(promptSections['constraints']),
      outputFormat: this.readString(promptSections['outputFormat'])
    };

    if (fromConfig.rolePersona || fromConfig.taskInstructions || fromConfig.constraints || fromConfig.outputFormat) {
      return fromConfig;
    }

    return {
      rolePersona: this.extractPromptSection(promptTemplate, 'Role / Persona'),
      taskInstructions: this.extractPromptSection(promptTemplate, 'Task Instructions'),
      constraints: this.extractPromptSection(promptTemplate, 'Constraints'),
      outputFormat: this.extractPromptSection(promptTemplate, 'Output Format')
    };
  }

  private extractPromptSection(template: string | null | undefined, heading: string): string {
    const value = template?.trim() ?? '';

    if (!value) {
      return '';
    }

    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionPattern = new RegExp(`${escapedHeading}:\\n([\\s\\S]*?)(?:\\n\\n(?:Role \\/ Persona|Task Instructions|Constraints|Output Format):|$)`);
    return value.match(sectionPattern)?.[1]?.trim() ?? '';
  }

  private extractAdditionalPromptConfig(configJson: Record<string, unknown>): Record<string, unknown> {
    const {
      purpose,
      scopeNotes,
      lifecycleState,
      reasoningMode,
      retryPolicy,
      temperature,
      maxSteps,
      timeoutSeconds,
      promptSections,
      toolPermissions,
      ...additionalConfig
    } = configJson;

    void purpose;
    void scopeNotes;
    void lifecycleState;
    void reasoningMode;
    void retryPolicy;
    void temperature;
    void maxSteps;
    void timeoutSeconds;
    void promptSections;
    void toolPermissions;

    return additionalConfig;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private toNumericText(value: unknown, fallback: string): string {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
  }

  private asRetryPolicy(value: unknown): RetryPolicy {
    return value === 'none' || value === 'standard' || value === 'aggressive' ? value : 'standard';
  }

  private asReasoningMode(value: unknown): ReasoningMode {
    return value === 'light' || value === 'balanced' || value === 'deep' ? value : 'balanced';
  }

  private parsePromptConfigJson(value: string): Record<string, unknown> {
    const trimmed = value.trim();

    if (!trimmed) {
      return {};
    }

    const parsed = JSON.parse(trimmed);

    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Prompt config JSON must be an object.');
    }

    return parsed as Record<string, unknown>;
  }

  private parseNumberInput(value: string, fallback: number): number {
    const trimmed = value.trim();

    if (!trimmed) {
      return fallback;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private parseIntegerInput(value: string, fallback: number): number {
    const trimmed = value.trim();

    if (!trimmed) {
      return fallback;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.error ?? error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Something went wrong while talking to the admin API.';
  }
}
