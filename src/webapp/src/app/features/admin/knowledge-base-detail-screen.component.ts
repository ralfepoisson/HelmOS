import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import {
  KnowledgeBaseAdminService,
  KnowledgeBaseDetail,
  KnowledgeBaseFileDetail,
  KnowledgeBaseFileRecord
} from './knowledge-base-admin.service';

@Component({
  selector: 'app-knowledge-base-detail-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      [surfaceLabel]="'Knowledge base detail'"
      [saveStatus]="loading ? 'Refreshing knowledge base…' : 'Knowledge base ready'"
      [showWorkspaceSwitcher]="false"
    />

    <main class="kb-shell container-fluid">
      <section class="hero-card helmos-card">
        <div>
          <a class="back-link" routerLink="/admin/knowledge-bases">← Back to knowledge bases</a>
          <div class="section-kicker">Admin</div>
          <h1>{{ knowledgeBase?.name || 'Knowledge Base' }}</h1>
          <p>{{ knowledgeBase?.description || 'No description yet.' }}</p>
        </div>

        <div class="hero-meta" *ngIf="knowledgeBase">
          <span class="status-pill" [class.status-pill-archived]="knowledgeBase.status === 'ARCHIVED'">
            {{ knowledgeBase.status }}
          </span>
          <div class="meta-copy">Files: {{ knowledgeBase.fileCount }}</div>
          <div class="meta-copy">Embeddings: {{ knowledgeBase.embeddingCount }}</div>
        </div>
      </section>

      <section *ngIf="message" class="state-card helmos-card state-card-success">{{ message }}</section>
      <section *ngIf="errorMessage" class="state-card helmos-card" role="alert">{{ errorMessage }}</section>
      <section *ngIf="loading" class="state-card helmos-card">Loading knowledge base details…</section>

      <section *ngIf="knowledgeBase" class="content-grid">
        <article class="upload-card helmos-card">
          <div class="section-kicker">Upload</div>
          <h2>Add a new file</h2>
          <p>Allowed formats are validated before queueing. Tags are optional and comma-separated.</p>

          <div class="field-group">
            <span class="field-label">File</span>
            <input type="file" class="form-control" (change)="onFileSelected($event)" />
          </div>

          <label class="field-group">
            <span class="field-label">Tags</span>
            <input class="form-control" [(ngModel)]="tagInput" placeholder="sales, onboarding, product-brief" />
          </label>

          <label class="field-group">
            <span class="field-label">Source type</span>
            <input class="form-control" [(ngModel)]="sourceType" placeholder="upload" />
          </label>

          <div class="form-actions">
            <button class="btn btn-primary" type="button" [disabled]="uploading || !selectedFile" (click)="uploadSelectedFile()">
              {{ uploading ? 'Uploading…' : 'Upload and queue processing' }}
            </button>
            <span class="helper-copy" *ngIf="selectedFile">
              {{ selectedFile.name }} · {{ formatBytes(selectedFile.size) }}
            </span>
          </div>
        </article>

        <article class="files-card helmos-card">
          <div class="files-header">
            <div>
              <div class="section-kicker">Files</div>
              <h2>Registered assets</h2>
            </div>
            <button class="btn btn-outline-secondary" type="button" (click)="loadKnowledgeBase()">Refresh</button>
          </div>

          <div *ngIf="knowledgeBase.files.length === 0" class="empty-copy">
            No files uploaded yet. Use the upload panel to seed this knowledge base.
          </div>

          <div class="file-list" *ngIf="knowledgeBase.files.length > 0">
            <button
              type="button"
              class="file-row"
              *ngFor="let file of knowledgeBase.files"
              [class.file-row-active]="selectedFileDetail?.id === file.id"
              (click)="selectFile(file)"
            >
              <div class="file-row-top">
                <strong>{{ file.originalFilename }}</strong>
                <span class="processing-pill" [class]="'processing-pill processing-' + file.processingStatus.toLowerCase()">
                  {{ file.processingStatus }}
                </span>
              </div>
              <div class="secondary-copy">
                {{ file.mimeType }} · {{ formatBytes(file.fileSizeBytes) }} · {{ formatDate(file.submittedAt) }}
              </div>
              <div class="tag-row" *ngIf="file.tags.length > 0">
                <span class="tag-chip" *ngFor="let tag of file.tags">{{ tag }}</span>
              </div>
            </button>
          </div>
        </article>
      </section>

      <section *ngIf="selectedFileDetail" class="detail-card helmos-card">
        <div class="detail-header">
          <div>
            <div class="section-kicker">File detail</div>
            <h2>{{ selectedFileDetail.originalFilename }}</h2>
          </div>
          <button class="btn btn-outline-danger" type="button" (click)="deleteSelectedFile()">Delete file</button>
        </div>

        <div class="meta-grid">
          <div><span class="field-label">Status</span><div>{{ selectedFileDetail.processingStatus }}</div></div>
          <div><span class="field-label">Submitted</span><div>{{ formatDate(selectedFileDetail.submittedAt) }}</div></div>
          <div><span class="field-label">Submitted by</span><div>{{ selectedFileDetail.submittedBy?.displayName || selectedFileDetail.submittedBy?.email || 'Unknown' }}</div></div>
          <div><span class="field-label">Embeddings</span><div>{{ selectedFileDetail.embeddingCount }}</div></div>
        </div>

        <div *ngIf="selectedFileDetail.errorMessage" class="inline-error">
          {{ selectedFileDetail.errorMessage }}
        </div>

        <div *ngIf="selectedFileDetail.tags.length > 0" class="tag-row">
          <span class="tag-chip" *ngFor="let tag of selectedFileDetail.tags">{{ tag }}</span>
        </div>

        <div class="chunks-section">
          <div class="section-kicker">Chunk previews</div>
          <div *ngIf="selectedFileDetail.chunks.length === 0" class="secondary-copy">
            No chunks are available yet. The file may still be processing, unsupported in the current MVP, or failed extraction.
          </div>
          <div class="chunk-card" *ngFor="let chunk of selectedFileDetail.chunks">
            <div class="chunk-header">Chunk {{ chunk.chunkIndex + 1 }}</div>
            <p>{{ chunk.chunkSummary || chunk.chunkText }}</p>
          </div>
        </div>
      </section>
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

      .hero-card,
      .upload-card,
      .files-card,
      .detail-card,
      .state-card {
        padding: 1rem 1.1rem;
      }

      .hero-card,
      .detail-header,
      .files-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }

      .content-grid {
        display: grid;
        grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
        gap: 1rem;
      }

      .back-link {
        display: inline-block;
        margin-bottom: 0.6rem;
        color: var(--helmos-accent);
        text-decoration: none;
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

      p,
      .secondary-copy,
      .helper-copy,
      .meta-copy {
        color: var(--helmos-muted);
      }

      .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        margin-top: 0.9rem;
      }

      .form-actions,
      .tag-row {
        display: flex;
        gap: 0.55rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .files-card {
        min-height: 22rem;
      }

      .file-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .file-row {
        width: 100%;
        text-align: left;
        background: rgba(248, 251, 255, 0.8);
        border: 1px solid var(--helmos-border);
        border-radius: 1rem;
        padding: 0.9rem;
        color: inherit;
      }

      .file-row-active {
        border-color: rgba(31, 111, 235, 0.36);
        box-shadow: 0 12px 28px rgba(31, 111, 235, 0.1);
        background: rgba(255, 255, 255, 0.98);
      }

      .file-row-top,
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .processing-pill,
      .status-pill,
      .tag-chip {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.22rem 0.58rem;
        font-size: 0.74rem;
        font-weight: 700;
      }

      .status-pill,
      .processing-completed {
        color: var(--helmos-success);
        background: rgba(31, 157, 104, 0.12);
      }

      .status-pill-archived,
      .processing-failed {
        color: #b42318;
        background: rgba(180, 35, 24, 0.12);
      }

      .processing-queued,
      .processing-uploaded,
      .processing-processing {
        color: var(--helmos-accent);
        background: rgba(31, 111, 235, 0.12);
      }

      .processing-deleted {
        color: var(--helmos-warning);
        background: rgba(217, 164, 65, 0.16);
      }

      .tag-chip {
        background: rgba(31, 111, 235, 0.08);
        color: var(--helmos-accent);
      }

      .chunks-section {
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .chunk-card {
        border: 1px solid var(--helmos-border);
        border-radius: 1rem;
        padding: 0.85rem;
        background: rgba(248, 251, 255, 0.82);
      }

      .chunk-header {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--helmos-muted);
        margin-bottom: 0.35rem;
      }

      .inline-error {
        margin-top: 0.85rem;
        color: #b42318;
      }

      .state-card-success {
        border-color: rgba(31, 157, 104, 0.25);
      }

      @media (max-width: 991.98px) {
        .content-grid,
        .file-row-top,
        .meta-grid {
          grid-template-columns: 1fr;
        }

        .hero-card,
        .detail-header,
        .files-header {
          flex-direction: column;
        }
      }
    `
  ]
})
export class KnowledgeBaseDetailScreenComponent implements OnInit {
  readonly shell = inject(WorkspaceShellService);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(KnowledgeBaseAdminService);

  knowledgeBase: KnowledgeBaseDetail | null = null;
  selectedFileDetail: KnowledgeBaseFileDetail | null = null;
  loading = true;
  uploading = false;
  errorMessage = '';
  message = '';
  selectedFile: File | null = null;
  tagInput = '';
  sourceType = 'upload';

  async ngOnInit(): Promise<void> {
    await this.loadKnowledgeBase();
  }

  async loadKnowledgeBase(): Promise<void> {
    const knowledgeBaseId = this.route.snapshot.paramMap.get('id');
    if (!knowledgeBaseId) {
      this.errorMessage = 'Knowledge base id is missing from the route.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      this.knowledgeBase = await this.service.getKnowledgeBase(knowledgeBaseId);
      if (this.selectedFileDetail) {
        await this.selectFileById(this.selectedFileDetail.id);
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to load the knowledge base.';
    } finally {
      this.loading = false;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.selectedFile = input?.files?.[0] ?? null;
  }

  async uploadSelectedFile(): Promise<void> {
    if (!this.selectedFile || !this.knowledgeBase) {
      return;
    }

    this.uploading = true;
    this.errorMessage = '';
    this.message = '';

    try {
      const contentBase64 = await this.readFileAsBase64(this.selectedFile);
      await this.service.uploadFile({
        knowledgeBaseId: this.knowledgeBase.id,
        originalFilename: this.selectedFile.name,
        mimeType: this.selectedFile.type || 'application/octet-stream',
        contentBase64,
        sourceType: this.sourceType.trim() || 'upload',
        tags: this.tagInput
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      });

      this.selectedFile = null;
      this.tagInput = '';
      this.message = 'File uploaded and queued for processing.';
      await this.loadKnowledgeBase();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to upload the file.';
    } finally {
      this.uploading = false;
    }
  }

  async selectFile(file: KnowledgeBaseFileRecord): Promise<void> {
    await this.selectFileById(file.id);
  }

  async deleteSelectedFile(): Promise<void> {
    if (!this.selectedFileDetail) {
      return;
    }

    const confirmed = window.confirm(`Delete "${this.selectedFileDetail.originalFilename}" and all derived embeddings?`);
    if (!confirmed) {
      return;
    }

    try {
      await this.service.deleteFile(this.selectedFileDetail.id);
      this.message = `Deleted "${this.selectedFileDetail.originalFilename}".`;
      this.selectedFileDetail = null;
      await this.loadKnowledgeBase();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to delete the file.';
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  formatBytes(value: number): string {
    if (value < 1024) {
      return `${value} B`;
    }
    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    }
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  private async selectFileById(fileId: string): Promise<void> {
    try {
      this.selectedFileDetail = await this.service.getFile(fileId);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to load the file detail.';
    }
  }

  private async readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Unable to read "${file.name}".`));
      reader.onload = () => {
        const result = `${reader.result ?? ''}`;
        const separatorIndex = result.indexOf(',');
        resolve(separatorIndex >= 0 ? result.slice(separatorIndex + 1) : result);
      };
      reader.readAsDataURL(file);
    });
  }
}
