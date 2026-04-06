import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { KnowledgeBaseAdminService, KnowledgeBaseSummary } from './knowledge-base-admin.service';

@Component({
  selector: 'app-knowledge-base-list-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      [surfaceLabel]="'Knowledge operations'"
      [saveStatus]="loading ? 'Refreshing knowledge bases…' : 'Knowledge base control ready'"
      [showWorkspaceSwitcher]="false"
    />

    <main class="kb-shell container-fluid">
      <section class="kb-hero helmos-card">
        <div>
          <div class="section-kicker">Admin</div>
          <h1>Knowledge Bases</h1>
          <p>
            Create logical retrieval partitions, review ingestion health, and manage the files that
            power agent-facing knowledge access.
          </p>
        </div>

        <div class="hero-actions">
          <button class="btn btn-primary" type="button" (click)="openCreateForm()">
            + Knowledge Base
          </button>
        </div>
      </section>

      <section class="summary-row">
        <article class="summary-card helmos-card">
          <div class="section-kicker">Knowledge bases</div>
          <strong>{{ knowledgeBases.length }}</strong>
          <span>Tracked logical partitions</span>
        </article>
        <article class="summary-card helmos-card">
          <div class="section-kicker">Files</div>
          <strong>{{ totalFiles }}</strong>
          <span>Uploaded across all knowledge bases</span>
        </article>
        <article class="summary-card helmos-card">
          <div class="section-kicker">Embeddings</div>
          <strong>{{ totalEmbeddings }}</strong>
          <span>Persisted searchable chunks</span>
        </article>
      </section>

      <section *ngIf="message" class="state-card helmos-card state-card-success" role="status">
        {{ message }}
      </section>

      <section *ngIf="errorMessage" class="state-card helmos-card" role="alert">
        <div class="section-kicker">Connection issue</div>
        <h2>Knowledge base data is temporarily unavailable</h2>
        <p>{{ errorMessage }}</p>
        <button class="btn btn-primary" type="button" (click)="loadKnowledgeBases()">Retry</button>
      </section>

      <section *ngIf="loading" class="state-card helmos-card">Loading knowledge bases…</section>

      <section *ngIf="!loading && !errorMessage && knowledgeBases.length === 0" class="state-card helmos-card">
        <div class="section-kicker">Empty state</div>
        <h2>No knowledge bases yet</h2>
        <p>Create the first knowledge base to start partitioning uploaded knowledge for your agents.</p>
        <button class="btn btn-primary" type="button" (click)="openCreateForm()">Create first knowledge base</button>
      </section>

      <section *ngIf="knowledgeBases.length > 0" class="table-card helmos-card">
        <div class="table-header">
          <div>
            <div class="section-kicker">Inventory</div>
            <h2>Current partitions</h2>
          </div>
          <a class="btn btn-outline-secondary" routerLink="/admin/knowledge-base-search">Open search</a>
        </div>

        <div class="table-wrap">
          <table class="kb-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Files</th>
                <th>Embeddings</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let knowledgeBase of knowledgeBases">
                <td>
                  <button type="button" class="link-button" (click)="openDetail(knowledgeBase.id)">
                    {{ knowledgeBase.name }}
                  </button>
                  <div class="secondary-copy">{{ knowledgeBase.description || 'No description yet.' }}</div>
                </td>
                <td>
                  <span class="status-pill" [class.status-pill-archived]="knowledgeBase.status === 'ARCHIVED'">
                    {{ knowledgeBase.status }}
                  </span>
                </td>
                <td>{{ knowledgeBase.fileCount }}</td>
                <td>{{ knowledgeBase.embeddingCount }}</td>
                <td>{{ formatDate(knowledgeBase.updatedAt) }}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn btn-sm btn-light" type="button" (click)="openEditForm(knowledgeBase)">Edit</button>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      type="button"
                      (click)="deleteKnowledgeBase(knowledgeBase)"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div *ngIf="showForm" class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="kb-form-title">
        <button class="modal-backdrop" type="button" aria-label="Close" (click)="cancelForm()"></button>
        <section class="modal-card helmos-card">
          <div class="form-header">
            <div>
              <div class="section-kicker">Configuration</div>
              <h2 id="kb-form-title">{{ formMode === 'create' ? 'Create knowledge base' : 'Edit knowledge base' }}</h2>
            </div>
            <button class="btn btn-light" type="button" (click)="cancelForm()">Close</button>
          </div>

          <form class="kb-form" (ngSubmit)="submitForm()">
            <label class="field-group">
              <span class="field-label">Name</span>
              <input class="form-control" [(ngModel)]="draft.name" name="name" required maxlength="200" />
            </label>

            <label class="field-group">
              <span class="field-label">Description</span>
              <textarea
                class="form-control"
                [(ngModel)]="draft.description"
                name="description"
                rows="3"
                placeholder="Explain what this knowledge base is intended to hold."
              ></textarea>
              <span class="field-help">
                Ownership and audit attribution are automatically derived from the logged-in admin.
              </span>
            </label>

            <label class="field-group">
              <span class="field-label">Status</span>
              <select class="form-select" [(ngModel)]="draft.status" name="status">
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>

            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="saving">
                {{ saving ? 'Saving…' : formMode === 'create' ? 'Create knowledge base' : 'Save changes' }}
              </button>
              <button class="btn btn-outline-secondary" type="button" (click)="cancelForm()" [disabled]="saving">
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

      .kb-shell {
        padding: 92px 1rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .kb-hero,
      .table-card,
      .state-card {
        padding: 1rem 1.1rem;
      }

      .kb-hero,
      .table-header,
      .form-header,
      .summary-row {
        display: flex;
        gap: 1rem;
      }

      .kb-hero,
      .table-header,
      .form-header {
        justify-content: space-between;
        align-items: flex-start;
      }

      .summary-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .summary-card {
        padding: 1rem 1.1rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      h1,
      h2 {
        margin: 0.25rem 0 0.35rem;
        letter-spacing: -0.03em;
      }

      p,
      .secondary-copy,
      .summary-card span {
        color: var(--helmos-muted);
      }

      .secondary-copy {
        font-size: 0.82rem;
        margin-top: 0.25rem;
      }

      .section-kicker,
      .field-label {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--helmos-muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .kb-form,
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .field-help {
        font-size: 0.82rem;
        color: var(--helmos-muted);
      }

      .kb-form {
        gap: 1rem;
      }

      .form-actions,
      .row-actions {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .form-error {
        color: #b42318;
        font-size: 0.9rem;
      }

      .modal-shell {
        position: fixed;
        inset: 0;
        z-index: 1200;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        isolation: isolate;
      }

      .modal-backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        background: rgba(15, 23, 42, 0.38);
        backdrop-filter: blur(4px);
        z-index: 0;
      }

      .modal-card {
        position: relative;
        z-index: 1;
        width: min(760px, 100%);
        max-height: calc(100vh - 3rem);
        overflow: auto;
        padding: 1.1rem 1.2rem 1.2rem;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 28px 70px rgba(15, 23, 42, 0.2);
      }

      .table-wrap {
        overflow-x: auto;
      }

      .kb-table {
        width: 100%;
        border-collapse: collapse;
      }

      .kb-table th,
      .kb-table td {
        padding: 0.85rem 0.75rem;
        border-top: 1px solid var(--helmos-border);
        vertical-align: top;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.25rem 0.6rem;
        font-size: 0.74rem;
        font-weight: 700;
        color: var(--helmos-success);
        background: rgba(31, 157, 104, 0.12);
      }

      .status-pill-archived {
        color: var(--helmos-warning);
        background: rgba(217, 164, 65, 0.16);
      }

      .link-button {
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--helmos-accent);
        font-weight: 700;
      }

      .state-card-success {
        border-color: rgba(31, 157, 104, 0.25);
      }

      @media (max-width: 991.98px) {
        .summary-row {
          grid-template-columns: 1fr;
        }

        .kb-hero,
        .table-header,
        .form-header {
          flex-direction: column;
        }

        .modal-shell {
          padding: 1rem;
          align-items: flex-start;
        }
      }
    `
  ]
})
export class KnowledgeBaseListScreenComponent implements OnInit {
  readonly shell = inject(WorkspaceShellService);
  private readonly service = inject(KnowledgeBaseAdminService);
  private readonly router = inject(Router);

  knowledgeBases: KnowledgeBaseSummary[] = [];
  loading = true;
  saving = false;
  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingId: string | null = null;
  message = '';
  errorMessage = '';
  formError = '';
  draft: {
    name: string;
    description: string;
    ownerType: string;
    ownerId: string;
    status: 'ACTIVE' | 'ARCHIVED';
  } = {
    name: '',
    description: '',
    ownerType: '',
    ownerId: '',
    status: 'ACTIVE'
  };

  get totalFiles(): number {
    return this.knowledgeBases.reduce((sum, item) => sum + item.fileCount, 0);
  }

  get totalEmbeddings(): number {
    return this.knowledgeBases.reduce((sum, item) => sum + item.embeddingCount, 0);
  }

  async ngOnInit(): Promise<void> {
    await this.loadKnowledgeBases();
  }

  async loadKnowledgeBases(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      this.knowledgeBases = await this.service.listKnowledgeBases();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to load knowledge bases.';
    } finally {
      this.loading = false;
    }
  }

  openCreateForm(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.formError = '';
    this.showForm = true;
    this.draft = { name: '', description: '', ownerType: '', ownerId: '', status: 'ACTIVE' };
  }

  openEditForm(knowledgeBase: KnowledgeBaseSummary): void {
    this.formMode = 'edit';
    this.editingId = knowledgeBase.id;
    this.formError = '';
    this.showForm = true;
    this.draft = {
      name: knowledgeBase.name,
      description: knowledgeBase.description ?? '',
      ownerType: knowledgeBase.ownerType ?? '',
      ownerId: knowledgeBase.ownerId ?? '',
      status: knowledgeBase.status
    };
  }

  cancelForm(): void {
    this.showForm = false;
    this.formError = '';
  }

  async submitForm(): Promise<void> {
    this.saving = true;
    this.formError = '';
    this.message = '';

    try {
      if (this.formMode === 'create') {
        await this.service.createKnowledgeBase({
          name: this.draft.name.trim(),
          description: this.draft.description.trim() || null,
          ownerType: this.draft.ownerType.trim() || null,
          ownerId: this.draft.ownerId.trim() || null,
          status: this.draft.status
        });
        this.message = 'Knowledge base created.';
      } else if (this.editingId) {
        await this.service.updateKnowledgeBase(this.editingId, {
          name: this.draft.name.trim(),
          description: this.draft.description.trim() || null,
          ownerType: this.draft.ownerType.trim() || null,
          ownerId: this.draft.ownerId.trim() || null,
          status: this.draft.status
        });
        this.message = 'Knowledge base updated.';
      }

      this.showForm = false;
      this.saving = false;
      void this.loadKnowledgeBases();
      return;
    } catch (error) {
      this.formError = error instanceof Error ? error.message : 'Unable to save the knowledge base.';
    } finally {
      this.saving = false;
    }
  }

  async deleteKnowledgeBase(knowledgeBase: KnowledgeBaseSummary): Promise<void> {
    const confirmed = window.confirm(
      `Delete "${knowledgeBase.name}" and all uploaded files and embeddings inside it? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    try {
      await this.service.deleteKnowledgeBase(knowledgeBase.id);
      this.message = `Deleted "${knowledgeBase.name}".`;
      await this.loadKnowledgeBases();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to delete the knowledge base.';
    }
  }

  openDetail(id: string): void {
    void this.router.navigate(['/admin/knowledge-bases', id]);
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }
}
