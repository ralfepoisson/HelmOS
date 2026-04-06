import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faCircleQuestion,
  faPaperPlane,
  faSpinner,
  faTriangleExclamation,
  faXmark
} from '@fortawesome/free-solid-svg-icons';

import { AuthService } from '../../core/auth/auth.service';
import { SupportSessionService } from './support-session.service';

@Component({
  selector: 'app-help-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, FaIconComponent],
  template: `
    <ng-container *ngIf="shouldRender()">
      <button
        *ngIf="!support.isOpen()"
        type="button"
        class="help-trigger"
        aria-label="Open help and support"
        (click)="openWidget()"
      >
        <fa-icon [icon]="questionIcon"></fa-icon>
        <span *ngIf="support.latestTicket() as latestTicket" class="trigger-badge">{{ latestTicket.ticketKey }}</span>
      </button>

      <section *ngIf="support.isOpen()" class="help-panel helmos-card" aria-live="polite">
        <header class="panel-header">
          <div>
            <div class="panel-kicker">Inline help</div>
            <h2>Help Desk</h2>
            <p>Ask how to use the platform or report something broken.</p>
          </div>
          <button type="button" class="icon-button" aria-label="Close support panel" (click)="support.close()">
            <fa-icon [icon]="closeIcon"></fa-icon>
          </button>
        </header>

        <div *ngIf="support.latestTicket() as latestTicket" class="ticket-banner">
          <strong>{{ latestTicket.ticketKey }}</strong>
          <span>{{ latestTicket.status }}</span>
        </div>

        <div *ngIf="support.errorMessage()" class="error-banner" role="alert">
          <fa-icon [icon]="warningIcon"></fa-icon>
          <span>{{ support.errorMessage() }}</span>
        </div>

        <section class="message-stream">
          <article
            *ngFor="let message of support.messages()"
            class="message-row"
            [class.message-row-user]="message.senderType === 'USER'"
          >
            <div class="message-label">{{ message.senderType === 'USER' ? 'You' : 'Help Desk' }}</div>
            <div class="message-bubble">{{ message.messageText }}</div>
          </article>

          <article *ngIf="support.isLoading()" class="message-row">
            <div class="message-label">Help Desk</div>
            <div class="message-bubble message-bubble-loading">
              <fa-icon [icon]="spinnerIcon" animation="spin"></fa-icon>
              <span>Working on it…</span>
            </div>
          </article>

          <article *ngIf="support.messages().length === 0 && !support.isLoading()" class="empty-state">
            <strong>Need help?</strong>
            <span>Ask a product question or describe the issue and I’ll gather support context.</span>
          </article>
        </section>

        <div class="quick-actions">
          <button type="button" class="btn btn-light btn-sm" (click)="usePrompt('How do I use this page?')">
            Ask about this page
          </button>
          <button type="button" class="btn btn-light btn-sm" (click)="usePrompt('Report a bug: this page is not working.')">
            Report a bug
          </button>
        </div>

        <footer class="composer">
          <textarea
            class="form-control"
            rows="3"
            [(ngModel)]="draftMessage"
            [disabled]="support.isLoading()"
            placeholder="Ask a question or describe the issue."
          ></textarea>
          <div class="composer-actions">
            <span class="composer-copy">
              Any remediation remains advisory-only until a human reviews it.
            </span>
            <button
              type="button"
              class="btn btn-primary send-button"
              [disabled]="support.isLoading() || !draftMessage.trim()"
              (click)="sendMessage()"
            >
              <fa-icon [icon]="sendIcon"></fa-icon>
              <span>{{ support.isLoading() ? 'Sending…' : 'Send' }}</span>
            </button>
          </div>
        </footer>
      </section>
    </ng-container>
  `,
  styles: [
    `
      :host {
        position: fixed;
        right: 1rem;
        bottom: 1rem;
        z-index: 1080;
      }

      .help-trigger {
        width: 3.4rem;
        height: 3.4rem;
        border: 0;
        border-radius: 999px;
        background: linear-gradient(135deg, #1f6feb, #1652ad);
        color: #fff;
        box-shadow: 0 18px 48px rgba(31, 111, 235, 0.26);
        position: relative;
      }

      .trigger-badge {
        position: absolute;
        right: calc(100% + 0.5rem);
        top: 50%;
        transform: translateY(-50%);
        border-radius: 999px;
        background: rgba(23, 34, 53, 0.96);
        color: #fff;
        padding: 0.3rem 0.55rem;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .help-panel {
        width: min(380px, calc(100vw - 2rem));
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .panel-header,
      .composer-actions {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .panel-kicker,
      .message-label {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--helmos-muted);
        font-size: 0.7rem;
        font-weight: 700;
      }

      .panel-header h2,
      .panel-header p {
        margin: 0;
      }

      .panel-header p,
      .composer-copy,
      .empty-state span {
        color: var(--helmos-muted);
        font-size: 0.84rem;
      }

      .icon-button {
        width: 2.2rem;
        height: 2.2rem;
        border: 0;
        border-radius: 999px;
        background: rgba(234, 242, 255, 0.9);
        color: var(--helmos-text);
      }

      .ticket-banner,
      .error-banner,
      .message-bubble,
      .empty-state {
        border-radius: 1rem;
        padding: 0.8rem 0.9rem;
      }

      .ticket-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        background: rgba(234, 242, 255, 0.96);
        color: var(--helmos-text);
      }

      .error-banner {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        background: rgba(255, 240, 240, 0.96);
        color: #9f1239;
      }

      .message-stream {
        max-height: min(52vh, 420px);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
        padding-right: 0.1rem;
      }

      .message-row {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .message-row-user {
        align-items: flex-end;
      }

      .message-row-user .message-bubble {
        background: #172235;
        color: #fff;
      }

      .message-bubble {
        background: rgba(247, 249, 252, 0.96);
        border: 1px solid var(--helmos-border);
        white-space: pre-wrap;
      }

      .message-bubble-loading {
        display: flex;
        gap: 0.55rem;
        align-items: center;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        background: rgba(247, 249, 252, 0.96);
        border: 1px dashed var(--helmos-border-strong);
      }

      .quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .composer {
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
      }

      .send-button {
        display: inline-flex;
        gap: 0.45rem;
        align-items: center;
      }

      @media (max-width: 767.98px) {
        :host {
          right: 0.75rem;
          bottom: 0.75rem;
          left: 0.75rem;
        }

        .help-panel {
          width: 100%;
        }

        .trigger-badge {
          display: none;
        }
      }
    `
  ]
})
export class HelpWidgetComponent implements OnInit {
  readonly support = inject(SupportSessionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly questionIcon = faCircleQuestion;
  readonly sendIcon = faPaperPlane;
  readonly closeIcon = faXmark;
  readonly spinnerIcon = faSpinner;
  readonly warningIcon = faTriangleExclamation;

  readonly shouldRender = computed(() => this.auth.isAuthenticated() && !this.router.url.startsWith('/auth'));
  draftMessage = '';

  async ngOnInit(): Promise<void> {
    await this.support.initialize();
  }

  openWidget(): void {
    if (!this.support.isOpen()) {
      this.support.toggleOpen();
    }
  }

  usePrompt(value: string): void {
    this.draftMessage = value;
  }

  async sendMessage(): Promise<void> {
    const next = this.draftMessage.trim();
    if (!next) {
      return;
    }
    this.draftMessage = '';
    await this.support.sendMessage(next);
  }
}
