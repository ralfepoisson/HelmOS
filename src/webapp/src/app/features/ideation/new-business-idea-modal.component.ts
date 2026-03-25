import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faAtom,
  faBoxesStacked,
  faBriefcase,
  faLayerGroup,
  faStore,
  faWandMagicSparkles
} from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

import { BusinessType } from './ideation.models';

interface BusinessTypeOption {
  value: BusinessType;
  label: string;
  caption: string;
  icon: IconDefinition;
}

export interface NewBusinessIdeaPayload {
  name: string;
  businessType: BusinessType;
}

@Component({
  selector: 'app-new-business-idea-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FaIconComponent],
  template: `
    <div class="modal-shell" role="presentation" (click)="requestClose()">
      <section
        class="idea-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-business-idea-title"
        (click)="$event.stopPropagation()"
      >
        <header class="modal-header">
          <div>
            <span class="modal-kicker">Create a business idea</span>
            <h2 id="new-business-idea-title" class="modal-title">Start a new strategy workspace</h2>
            <p class="modal-copy mb-0">
              Name the idea and pick the kind of business you want HelmOS to help shape.
            </p>
          </div>
          <button type="button" class="btn-close" aria-label="Close" [disabled]="saving" (click)="requestClose()"></button>
        </header>

        <div class="modal-body">
          <label class="form-label field-label" for="idea-name">Business idea name</label>
          <input
            id="idea-name"
            type="text"
            class="form-control idea-name-input"
            [formControl]="nameControl"
            placeholder="Example: Northstar Ventures"
          />
          <div class="field-hint">This becomes the workspace title in the Strategy Copilot.</div>

          <div class="type-header">
            <span class="field-label">Business type</span>
            <span class="type-caption">Pick the closest fit for how this venture creates value.</span>
          </div>

          <div class="type-grid">
            <button
              *ngFor="let option of businessTypeOptions"
              type="button"
              class="type-card"
              [class.selected]="selectedBusinessType === option.value"
              (click)="selectBusinessType(option.value)"
            >
              <div class="type-icon">
                <fa-icon [icon]="option.icon"></fa-icon>
              </div>
              <div class="type-copy">
                <span class="type-label">{{ option.label }}</span>
                <span class="type-helper">{{ option.caption }}</span>
              </div>
            </button>
          </div>

          <div *ngIf="errorMessage" class="alert alert-danger modal-alert" role="alert">
            {{ errorMessage }}
          </div>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" [disabled]="saving" (click)="requestClose()">
            Cancel
          </button>
          <button type="button" class="btn btn-primary px-4" [disabled]="!canSave" (click)="submit()">
            {{ saving ? 'Creating...' : 'Create idea' }}
          </button>
        </footer>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 1080;
      }

      .modal-shell {
        position: absolute;
        inset: 0;
        background: rgba(11, 18, 32, 0.5);
        backdrop-filter: blur(8px);
        display: grid;
        place-items: center;
        padding: 1.25rem;
      }

      .idea-modal {
        width: min(760px, 100%);
        border-radius: 1.5rem;
        background:
          radial-gradient(circle at top right, rgba(31, 111, 235, 0.1), transparent 28%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 255, 1));
        border: 1px solid rgba(219, 228, 238, 0.95);
        box-shadow: 0 28px 70px rgba(11, 18, 32, 0.2);
      }

      .modal-header,
      .modal-body,
      .modal-footer {
        padding-inline: 1.5rem;
      }

      .modal-header {
        padding-top: 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }

      .modal-kicker {
        display: inline-block;
        font-size: 0.72rem;
        letter-spacing: 0.1em;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--helmos-accent);
      }

      .modal-title {
        margin: 0.45rem 0 0.35rem;
        font-size: clamp(1.55rem, 3vw, 2rem);
        font-weight: 700;
        letter-spacing: -0.03em;
      }

      .modal-copy,
      .field-hint,
      .type-caption,
      .type-helper {
        color: var(--helmos-muted);
      }

      .modal-body {
        padding-top: 0.75rem;
        padding-bottom: 1rem;
      }

      .field-label {
        display: inline-block;
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.6rem;
      }

      .idea-name-input {
        min-height: 3.25rem;
        border-radius: 1rem;
      }

      .field-hint {
        margin-top: 0.45rem;
        font-size: 0.88rem;
      }

      .type-header {
        margin-top: 1.35rem;
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.75rem;
      }

      .type-grid {
        margin-top: 0.85rem;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.9rem;
      }

      .type-card {
        border: 1px solid rgba(219, 228, 238, 0.95);
        border-radius: 1.1rem;
        background: rgba(255, 255, 255, 0.85);
        min-height: 132px;
        padding: 1rem;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        transition:
          transform 0.16s ease,
          border-color 0.16s ease,
          box-shadow 0.16s ease;
      }

      .type-card:hover {
        transform: translateY(-2px);
        border-color: rgba(31, 111, 235, 0.28);
        box-shadow: 0 12px 24px rgba(31, 111, 235, 0.08);
      }

      .type-card.selected {
        border-color: rgba(31, 111, 235, 0.45);
        background: linear-gradient(180deg, rgba(236, 243, 255, 0.96), rgba(255, 255, 255, 1));
        box-shadow: inset 0 0 0 1px rgba(31, 111, 235, 0.1);
      }

      .type-icon {
        width: 2.65rem;
        height: 2.65rem;
        border-radius: 0.9rem;
        display: grid;
        place-items: center;
        background: rgba(31, 111, 235, 0.08);
        color: var(--helmos-accent);
      }

      .type-copy {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .type-label {
        font-weight: 700;
        color: var(--helmos-text);
      }

      .type-helper {
        font-size: 0.88rem;
        line-height: 1.45;
      }

      .modal-alert {
        margin-top: 1rem;
        margin-bottom: 0;
      }

      .modal-footer {
        padding-bottom: 1.4rem;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      @media (max-width: 767.98px) {
        .type-grid {
          grid-template-columns: 1fr;
        }

        .type-header {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `
  ]
})
export class NewBusinessIdeaModalComponent {
  readonly businessTypeOptions: BusinessTypeOption[] = [
    {
      value: 'PRODUCT',
      label: 'Product',
      caption: 'A software or physical product customers adopt directly.',
      icon: faBoxesStacked
    },
    {
      value: 'SERVICE',
      label: 'Service',
      caption: 'An expertise-led offer delivered for clients or operators.',
      icon: faBriefcase
    },
    {
      value: 'RESEARCH_AND_DEVELOPMENT',
      label: 'R&D',
      caption: 'A research-heavy venture creating new IP, capability, or science.',
      icon: faAtom
    },
    {
      value: 'MARKETPLACE',
      label: 'Marketplace',
      caption: 'A two-sided platform matching supply and demand.',
      icon: faStore
    },
    {
      value: 'PLATFORM',
      label: 'Platform',
      caption: 'Core infrastructure others build on or operate through.',
      icon: faLayerGroup
    },
    {
      value: 'AGENCY',
      label: 'Agency',
      caption: 'A delivery-focused business blending strategy, creative, or execution.',
      icon: faWandMagicSparkles
    }
  ];

  readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(200)]
  });

  @Input() saving = false;
  @Input() errorMessage = '';

  @Output() readonly createIdea = new EventEmitter<NewBusinessIdeaPayload>();
  @Output() readonly close = new EventEmitter<void>();

  selectedBusinessType: BusinessType = 'PRODUCT';

  get canSave(): boolean {
    return this.nameControl.valid && !this.saving;
  }

  selectBusinessType(value: BusinessType): void {
    this.selectedBusinessType = value;
  }

  requestClose(): void {
    if (this.saving) {
      return;
    }

    this.close.emit();
  }

  submit(): void {
    this.nameControl.markAsTouched();

    if (!this.canSave) {
      return;
    }

    this.createIdea.emit({
      name: this.nameControl.getRawValue().trim(),
      businessType: this.selectedBusinessType
    });
  }
}
