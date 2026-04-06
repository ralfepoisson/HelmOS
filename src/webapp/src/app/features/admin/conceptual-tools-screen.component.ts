import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import {
  ConceptualToolRecord,
  ConceptualToolsAdminService,
  ConceptualToolStatus,
} from './conceptual-tools-admin.service';

type FilterValue = 'all' | 'active' | 'inactive';
type FormMode = 'create' | 'edit';

interface ConceptualToolDraft {
  id: string | null;
  name: string;
  category: string;
  purpose: string;
  whenToUse: string;
  whenNotToUse: string;
  instructions: string;
  expectedEffect: string;
  status: 'active' | 'inactive';
  version: number;
}

@Component({
  selector: 'app-conceptual-tools-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      [surfaceLabel]="'Reasoning artefacts'"
      [saveStatus]="loading ? 'Refreshing conceptual tools…' : 'Conceptual tools ready'"
      [showWorkspaceSwitcher]="false"
    />

    <main class="tools-shell container-fluid">
      <section class="hero-card helmos-card">
        <div>
          <div class="section-kicker">Admin</div>
          <h1>Conceptual Tools</h1>
          <p>
            Manage reusable reasoning primitives that can later be assembled into structured runtime
            JSON for Idea Refinement and other agent workflows.
          </p>
        </div>

        <div class="hero-actions">
          <button class="btn btn-primary" type="button" (click)="openCreateForm()">+ Conceptual Tool</button>
        </div>
      </section>

      <section class="summary-row">
        <article class="summary-card helmos-card">
          <div class="section-kicker">Total</div>
          <strong>{{ tools.length }}</strong>
          <span>Persisted tools</span>
        </article>
        <article class="summary-card helmos-card">
          <div class="section-kicker">Active</div>
          <strong>{{ activeCount }}</strong>
          <span>Available for future runtime assembly</span>
        </article>
        <article class="summary-card helmos-card">
          <div class="section-kicker">Categories</div>
          <strong>{{ categoryCount }}</strong>
          <span>Reasoning groupings currently represented</span>
        </article>
      </section>

      <section class="toolbar-card helmos-card">
        <div class="filter-group" role="tablist" aria-label="Conceptual tool status filters">
          <button
            *ngFor="let option of filterOptions"
            type="button"
            class="filter-pill"
            [class.filter-pill-active]="selectedFilter === option.value"
            (click)="setFilter(option.value)"
          >
            {{ option.label }}
          </button>
        </div>

        <p class="toolbar-copy">List view covers metadata, current activation state, and direct edit access.</p>
      </section>

      <section *ngIf="message" class="state-card helmos-card state-card-success" role="status">
        {{ message }}
      </section>

      <section *ngIf="errorMessage" class="state-card helmos-card" role="alert">
        <div class="section-kicker">Connection issue</div>
        <h2>Conceptual tools are temporarily unavailable</h2>
        <p>{{ errorMessage }}</p>
        <button class="btn btn-primary" type="button" (click)="loadTools()">Retry</button>
      </section>

      <section *ngIf="loading" class="state-card helmos-card">Loading conceptual tools…</section>

      <section *ngIf="!loading && !errorMessage && filteredTools.length === 0" class="state-card helmos-card">
        <div class="section-kicker">Empty state</div>
        <h2>No conceptual tools match this view</h2>
        <p>Create the first tool or switch the filter to inspect the rest of the catalogue.</p>
      </section>

      <section *ngIf="filteredTools.length > 0" class="table-card helmos-card">
        <div class="table-header">
          <div>
            <div class="section-kicker">Catalogue</div>
            <h2>Managed reasoning tools</h2>
          </div>
        </div>

        <div class="table-wrap">
          <table class="tools-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Version</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let tool of filteredTools">
                <td>
                  <div class="cell-title">{{ tool.name }}</div>
                  <div class="secondary-copy">{{ tool.purpose }}</div>
                </td>
                <td>{{ tool.category }}</td>
                <td>
                  <span class="status-pill" [class.status-pill-inactive]="tool.status === 'INACTIVE'">
                    {{ tool.status === 'ACTIVE' ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td>v{{ tool.version }}</td>
                <td>{{ formatDate(tool.updatedAt) }}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn btn-sm btn-light" type="button" (click)="openEditForm(tool)">Edit</button>
                    <button
                      class="btn btn-sm btn-outline-secondary"
                      type="button"
                      (click)="toggleStatus(tool)"
                    >
                      {{ tool.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div *ngIf="showForm" class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="tool-form-title">
        <button class="modal-backdrop" type="button" aria-label="Close" (click)="closeForm()"></button>
        <section class="modal-card helmos-card">
          <div class="form-header">
            <div>
              <div class="section-kicker">Configuration</div>
              <h2 id="tool-form-title">
                {{ formMode === 'create' ? 'Create conceptual tool' : 'Edit conceptual tool' }}
              </h2>
            </div>
            <button class="btn btn-light" type="button" (click)="closeForm()">Close</button>
          </div>

          <form class="tool-form" (ngSubmit)="submitForm()">
            <div class="grid-two">
              <label class="field-group">
                <span class="field-label">Name</span>
                <input class="form-control" [(ngModel)]="draft.name" name="name" required maxlength="200" />
              </label>

              <label class="field-group">
                <span class="field-label">Category</span>
                <input
                  class="form-control"
                  [(ngModel)]="draft.category"
                  name="category"
                  required
                  maxlength="100"
                  placeholder="transformative"
                />
              </label>
            </div>

            <label class="field-group">
              <span class="field-label">Purpose</span>
              <textarea class="form-control" [(ngModel)]="draft.purpose" name="purpose" rows="3" required></textarea>
            </label>

            <div class="grid-two">
              <label class="field-group">
                <span class="field-label">When to use</span>
                <textarea
                  class="form-control"
                  [(ngModel)]="draft.whenToUse"
                  name="whenToUse"
                  rows="4"
                  placeholder="One signal per line"
                ></textarea>
              </label>

              <label class="field-group">
                <span class="field-label">When not to use</span>
                <textarea
                  class="form-control"
                  [(ngModel)]="draft.whenNotToUse"
                  name="whenNotToUse"
                  rows="4"
                  placeholder="One constraint per line"
                ></textarea>
              </label>
            </div>

            <label class="field-group">
              <span class="field-label">Instructions</span>
              <textarea
                class="form-control"
                [(ngModel)]="draft.instructions"
                name="instructions"
                rows="5"
                placeholder="One step per line"
              ></textarea>
            </label>

            <label class="field-group">
              <span class="field-label">Expected effect</span>
              <textarea
                class="form-control"
                [(ngModel)]="draft.expectedEffect"
                name="expectedEffect"
                rows="3"
                required
              ></textarea>
            </label>

            <div class="grid-two">
              <label class="field-group">
                <span class="field-label">Status</span>
                <select class="form-select" [(ngModel)]="draft.status" name="status">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label class="field-group">
                <span class="field-label">Version</span>
                <input
                  class="form-control"
                  [(ngModel)]="draft.version"
                  name="version"
                  min="1"
                  step="1"
                  type="number"
                  required
                />
              </label>
            </div>

            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="saving">
                {{ saving ? 'Saving…' : formMode === 'create' ? 'Create tool' : 'Save changes' }}
              </button>
              <button class="btn btn-outline-secondary" type="button" (click)="closeForm()" [disabled]="saving">
                Cancel
              </button>
              <span *ngIf="formError" class="form-error">{{ formError }}</span>
            </div>
          </form>
        </section>
      </div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .tools-shell {
        padding: 92px 1rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .hero-card,
      .toolbar-card,
      .table-card,
      .state-card {
        padding: 1rem 1.1rem;
      }

      .hero-card,
      .toolbar-card,
      .table-header,
      .form-header {
        display: flex;
        gap: 1rem;
        justify-content: space-between;
        align-items: flex-start;
      }

      .summary-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .summary-card {
        padding: 1rem 1.1rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .filter-group {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .filter-pill {
        border: 1px solid rgba(31, 111, 235, 0.16);
        background: rgba(234, 242, 255, 0.65);
        color: var(--helmos-text);
        border-radius: 999px;
        padding: 0.45rem 0.8rem;
        font-size: 0.85rem;
        font-weight: 700;
      }

      .filter-pill-active {
        background: rgba(31, 111, 235, 0.14);
        border-color: rgba(31, 111, 235, 0.32);
      }

      .toolbar-copy,
      .secondary-copy,
      p,
      .summary-card span {
        color: var(--helmos-muted);
      }

      .section-kicker,
      .field-label {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--helmos-muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      h1,
      h2 {
        margin: 0.25rem 0 0.35rem;
        letter-spacing: -0.03em;
      }

      .table-wrap {
        overflow-x: auto;
      }

      .tools-table {
        width: 100%;
        border-collapse: collapse;
      }

      .tools-table th,
      .tools-table td {
        padding: 0.85rem 0.75rem;
        border-top: 1px solid rgba(214, 223, 233, 0.9);
        vertical-align: top;
      }

      .tools-table thead th {
        border-top: 0;
        color: var(--helmos-muted);
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .cell-title {
        font-weight: 700;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.25rem 0.6rem;
        background: rgba(19, 159, 103, 0.12);
        color: #0f6f4b;
        font-weight: 700;
        font-size: 0.78rem;
      }

      .status-pill-inactive {
        background: rgba(118, 134, 156, 0.14);
        color: #526176;
      }

      .row-actions,
      .tool-form,
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }

      .grid-two {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .modal-shell {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        z-index: 1200;
      }

      .modal-backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        background: rgba(15, 23, 42, 0.38);
      }

      .modal-card {
        position: relative;
        width: min(880px, calc(100vw - 2rem));
        max-height: calc(100vh - 3rem);
        overflow: auto;
        padding: 1rem 1.1rem;
      }

      .form-error {
        color: #b42318;
        font-weight: 600;
      }

      .state-card-success {
        border-color: rgba(19, 159, 103, 0.24);
      }

      @media (max-width: 920px) {
        .summary-row,
        .grid-two {
          grid-template-columns: 1fr;
        }

        .hero-card,
        .toolbar-card,
        .form-header {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class ConceptualToolsScreenComponent implements OnInit {
  readonly shell = inject(WorkspaceShellService);
  private readonly service = inject(ConceptualToolsAdminService);

  readonly filterOptions: Array<{ value: FilterValue; label: string }> = [
    { value: 'all', label: 'All tools' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  tools: ConceptualToolRecord[] = [];
  selectedFilter: FilterValue = 'all';
  loading = false;
  saving = false;
  message: string | null = null;
  errorMessage: string | null = null;
  showForm = false;
  formMode: FormMode = 'create';
  formError: string | null = null;
  draft: ConceptualToolDraft = this.createEmptyDraft();

  get filteredTools(): ConceptualToolRecord[] {
    if (this.selectedFilter === 'all') {
      return this.tools;
    }

    const desiredStatus = this.selectedFilter === 'active' ? 'ACTIVE' : 'INACTIVE';
    return this.tools.filter((tool) => tool.status === desiredStatus);
  }

  get activeCount(): number {
    return this.tools.filter((tool) => tool.status === 'ACTIVE').length;
  }

  get categoryCount(): number {
    return new Set(this.tools.map((tool) => tool.category)).size;
  }

  ngOnInit(): void {
    void this.loadTools();
  }

  async loadTools(): Promise<void> {
    this.loading = true;
    this.errorMessage = null;

    try {
      this.tools = await this.service.listConceptualTools();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to load conceptual tools.';
    } finally {
      this.loading = false;
    }
  }

  setFilter(value: FilterValue): void {
    this.selectedFilter = value;
  }

  openCreateForm(): void {
    this.formMode = 'create';
    this.formError = null;
    this.draft = this.createEmptyDraft();
    this.showForm = true;
  }

  openEditForm(tool: ConceptualToolRecord): void {
    this.formMode = 'edit';
    this.formError = null;
    this.draft = this.toDraft(tool);
    this.showForm = true;
  }

  closeForm(): void {
    if (this.saving) {
      return;
    }

    this.showForm = false;
    this.formError = null;
  }

  async submitForm(): Promise<void> {
    this.saving = true;
    this.formError = null;

    try {
      const payload = {
        name: this.draft.name.trim(),
        category: this.draft.category.trim(),
        purpose: this.draft.purpose.trim(),
        whenToUse: this.draft.whenToUse,
        whenNotToUse: this.draft.whenNotToUse,
        instructions: this.draft.instructions,
        expectedEffect: this.draft.expectedEffect.trim(),
        status: this.draft.status,
        version: Number(this.draft.version),
      };

      if (this.formMode === 'create') {
        const created = await this.service.createConceptualTool(payload);
        this.tools = this.sortTools([created, ...this.tools]);
        this.message = `Created "${created.name}".`;
      } else if (this.draft.id) {
        const updated = await this.service.updateConceptualTool(this.draft.id, payload);
        this.tools = this.sortTools(this.tools.map((tool) => (tool.id === updated.id ? updated : tool)));
        this.message = `Saved "${updated.name}".`;
      }

      this.showForm = false;
    } catch (error) {
      this.formError = error instanceof Error ? error.message : 'Unable to save the conceptual tool.';
    } finally {
      this.saving = false;
    }
  }

  async toggleStatus(tool: ConceptualToolRecord): Promise<void> {
    try {
      const nextStatus: ConceptualToolStatus = tool.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const updated = await this.service.updateConceptualTool(tool.id, {
        status: nextStatus === 'ACTIVE' ? 'active' : 'inactive',
      });

      this.tools = this.sortTools(this.tools.map((entry) => (entry.id === updated.id ? updated : entry)));
      this.message = `${updated.name} is now ${updated.status === 'ACTIVE' ? 'active' : 'inactive'}.`;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to update the conceptual tool status.';
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  private toDraft(tool: ConceptualToolRecord): ConceptualToolDraft {
    return {
      id: tool.id,
      name: tool.name,
      category: tool.category,
      purpose: tool.purpose,
      whenToUse: tool.whenToUse.join('\n'),
      whenNotToUse: tool.whenNotToUse.join('\n'),
      instructions: tool.instructions.join('\n'),
      expectedEffect: tool.expectedEffect,
      status: tool.status === 'ACTIVE' ? 'active' : 'inactive',
      version: tool.version,
    };
  }

  private createEmptyDraft(): ConceptualToolDraft {
    return {
      id: null,
      name: '',
      category: '',
      purpose: '',
      whenToUse: '',
      whenNotToUse: '',
      instructions: '',
      expectedEffect: '',
      status: 'active',
      version: 1,
    };
  }

  private sortTools(records: ConceptualToolRecord[]): ConceptualToolRecord[] {
    return [...records].sort((left, right) => {
      if (left.status !== right.status) {
        return left.status.localeCompare(right.status);
      }

      const categoryResult = left.category.localeCompare(right.category);
      if (categoryResult !== 0) {
        return categoryResult;
      }

      return left.name.localeCompare(right.name);
    });
  }
}
