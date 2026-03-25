import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { BusinessIdeasApiService } from '../../core/services/business-ideas-api.service';
import { WorkspaceOption, WorkspaceShellService } from '../../core/services/workspace-shell.service';
import { BusinessType } from './ideation.models';

interface BusinessTypeChoice {
  value: BusinessType;
  label: string;
}

@Component({
  selector: 'app-new-idea-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      surfaceLabel="Strategy Copilot"
      [workspaces]="workspaces"
      [selectedWorkspaceId]="selectedWorkspaceId"
      [saveStatus]="shell.saveStatus"
      (workspaceChange)="handleWorkspaceSelection($event)"
    />

    <main class="new-idea-page">
      <section class="new-idea-shell">
        <section class="new-idea-form">
          <div class="form-copy">
            <p class="eyebrow">New Idea</p>
            <h1 class="question">What is the working title of the idea?</h1>
          </div>

          <div class="input-wrap">
            <input
              type="text"
              class="idea-input"
              [formControl]="nameControl"
              placeholder="Type the working title..."
              aria-label="Working title of the idea"
              (keydown.enter)="createBusinessIdea()"
            />
          </div>

          <div class="type-choice-group" aria-label="Business type">
            <button
              *ngFor="let choice of businessTypeChoices"
              type="button"
              class="type-chip"
              [class.selected]="selectedBusinessType === choice.value"
              (click)="selectBusinessType(choice.value)"
            >
              {{ choice.label }}
            </button>
          </div>

          <p *ngIf="errorMessage" class="error-message" role="alert">
            {{ errorMessage }}
          </p>

          <button type="button" class="create-button" [disabled]="!canCreate" (click)="createBusinessIdea()">
            {{ saving ? 'Creating...' : 'Create' }}
          </button>
        </section>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background:
          radial-gradient(circle at top, rgba(31, 111, 235, 0.12), transparent 34%),
          linear-gradient(180deg, #f7faff 0%, #fbfcff 52%, #f5f7fb 100%);
      }

      .new-idea-page {
        min-height: 100vh;
        padding: 68px 1.5rem 2rem;
        display: grid;
        place-items: center;
      }

      .new-idea-shell {
        width: min(720px, 100%);
        display: grid;
        place-items: center;
      }

      .new-idea-form {
        width: min(620px, 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
        text-align: center;
      }

      .form-copy {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }

      .eyebrow {
        margin: 0;
        color: var(--helmos-accent);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .question {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1.08;
        letter-spacing: -0.05em;
        font-weight: 700;
      }

      .input-wrap {
        width: 100%;
      }

      .idea-input {
        width: 100%;
        min-height: 4rem;
        border: 1px solid rgba(31, 111, 235, 0.14);
        border-radius: 999px;
        padding: 0 1.5rem;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 18px 40px rgba(17, 24, 39, 0.08);
        font-size: 1.1rem;
        text-align: center;
        transition:
          border-color 160ms ease,
          box-shadow 160ms ease,
          transform 160ms ease;
      }

      .idea-input:focus {
        outline: none;
        border-color: rgba(31, 111, 235, 0.42);
        box-shadow: 0 22px 44px rgba(31, 111, 235, 0.14);
        transform: translateY(-1px);
      }

      .type-choice-group {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.75rem;
      }

      .type-chip {
        border: 1px solid rgba(184, 198, 214, 0.95);
        border-radius: 999px;
        padding: 0.75rem 1.1rem;
        background: rgba(255, 255, 255, 0.88);
        color: var(--helmos-muted);
        font-size: 0.95rem;
        font-weight: 600;
        transition:
          border-color 160ms ease,
          background 160ms ease,
          color 160ms ease,
          box-shadow 160ms ease,
          transform 160ms ease;
      }

      .type-chip:hover {
        transform: translateY(-1px);
        border-color: rgba(31, 111, 235, 0.22);
        color: var(--helmos-text);
      }

      .type-chip.selected {
        border-color: rgba(31, 111, 235, 0.32);
        background: rgba(234, 242, 255, 0.98);
        color: var(--helmos-text);
        box-shadow: 0 12px 28px rgba(31, 111, 235, 0.12);
      }

      .error-message {
        margin: 0;
        color: #b42318;
        font-size: 0.94rem;
      }

      .create-button {
        min-width: 148px;
        min-height: 3.25rem;
        border: 0;
        border-radius: 999px;
        padding: 0 1.6rem;
        background: linear-gradient(135deg, #1f6feb 0%, #4b8bff 100%);
        color: #fff;
        font-size: 0.98rem;
        font-weight: 700;
        box-shadow: 0 18px 36px rgba(31, 111, 235, 0.24);
        transition:
          transform 160ms ease,
          box-shadow 160ms ease,
          opacity 160ms ease;
      }

      .create-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 22px 40px rgba(31, 111, 235, 0.28);
      }

      .create-button:disabled {
        opacity: 0.55;
        box-shadow: none;
        cursor: not-allowed;
      }

      @media (max-width: 767.98px) {
        .new-idea-page {
          padding-inline: 1rem;
        }

        .question {
          font-size: 1.9rem;
        }

        .idea-input {
          min-height: 3.5rem;
          font-size: 1rem;
          text-align: left;
        }
      }
    `
  ]
})
export class NewIdeaPageComponent {
  readonly businessTypeChoices: BusinessTypeChoice[] = [
    { value: 'PRODUCT', label: 'Product-based' },
    { value: 'SERVICE', label: 'Service-based' },
    { value: 'OTHER', label: 'Mixture' }
  ];

  readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(200)]
  });

  workspaces: WorkspaceOption[] = [];
  selectedWorkspaceId = '';
  selectedBusinessType: BusinessType = 'PRODUCT';
  saving = false;
  errorMessage = '';

  constructor(
    private readonly router: Router,
    private readonly businessIdeasApi: BusinessIdeasApiService,
    readonly shell: WorkspaceShellService
  ) {
    this.selectedWorkspaceId = this.shell.newIdeaOption.id;
    this.workspaces = this.shell.getDemoWorkspaces();
    void this.refreshWorkspaceOptions();
  }

  get canCreate(): boolean {
    return !this.saving && this.nameControl.valid;
  }

  selectBusinessType(businessType: BusinessType): void {
    this.selectedBusinessType = businessType;
  }

  async handleWorkspaceSelection(workspaceId: string): Promise<void> {
    this.selectedWorkspaceId = workspaceId;

    if (workspaceId === this.shell.newIdeaOption.id) {
      return;
    }

    await this.router.navigate(['/strategy-copilot/ideation'], {
      queryParams: { workspaceId }
    });
  }

  async createBusinessIdea(): Promise<void> {
    if (!this.canCreate) {
      this.nameControl.markAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    try {
      const createdIdea = await this.businessIdeasApi.createBusinessIdea({
        name: this.nameControl.getRawValue().trim(),
        businessType: this.selectedBusinessType
      });

      await this.router.navigate(['/strategy-copilot/ideation'], {
        queryParams: { workspaceId: createdIdea.workspaceOption.id },
        state: { createdIdea }
      });
    } catch {
      this.errorMessage = 'HelmOS could not create the business idea. Make sure the backend is running and try again.';
    } finally {
      this.saving = false;
    }
  }

  private async refreshWorkspaceOptions(): Promise<void> {
    try {
      const ideas = await this.businessIdeasApi.listBusinessIdeas();
      this.workspaces = [...ideas.map((idea) => ({ id: idea.id, name: idea.name })), this.shell.newIdeaOption];
    } catch {
      this.workspaces = this.shell.getDemoWorkspaces();
    }

    this.selectedWorkspaceId = this.shell.newIdeaOption.id;
  }
}
