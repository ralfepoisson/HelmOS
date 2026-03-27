import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faRotateRight, faSpinner, faUserAstronaut } from '@fortawesome/free-solid-svg-icons';

import { ChatMessage } from './ideation.models';

@Component({
  selector: 'app-agent-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, FaIconComponent],
  template: `
    <aside class="chat-panel">
      <header class="chat-header">
        <div class="chat-title-wrap">
          <div>
            <span class="chat-kicker">Persistent collaborator</span>
            <div class="chat-title-row">
              <div class="agent-avatar" aria-hidden="true">
                <fa-icon [icon]="userAstronautIcon"></fa-icon>
              </div>
              <h2 class="chat-title">{{ title }}</h2>
            </div>
            <p class="chat-subtitle mb-0">{{ subtitle }}</p>
          </div>
        </div>
        <span class="agent-presence">Live</span>
      </header>

      <section #messageHistoryRef class="message-history">
        <article
          *ngFor="let message of visibleMessages; let messageIndex = index; trackBy: trackByMessageId"
          class="message-bubble"
          [class.agent-message]="message.role === 'agent'"
          [class.user-message]="message.role === 'user'"
          [class.retryable-message]="isRetryableMessage(message, messageIndex)"
        >
          <div class="message-meta">
            <span class="message-author">{{ message.author }}</span>
            <span>{{ message.timestamp }}</span>
          </div>
          <p class="message-copy mb-0">{{ message.content }}</p>
          <button
            *ngIf="isRetryableMessage(message, messageIndex)"
            type="button"
            class="retry-message-button"
            [disabled]="isSending"
            aria-label="Resend last message"
            title="Resend last message"
            (click)="resendLastMessage.emit()"
          >
            <fa-icon [icon]="rotateRightIcon"></fa-icon>
          </button>
        </article>

        <article *ngIf="isSending" class="message-bubble agent-message pending-agent-message" aria-live="polite">
          <div class="message-meta">
            <span class="message-author">HelmOS Agent</span>
            <span>Thinking...</span>
          </div>
          <div class="pending-agent-copy">
            <span class="pending-agent-spinner" aria-hidden="true">
              <fa-icon [icon]="spinnerIcon"></fa-icon>
            </span>
            <span>Thinking...</span>
          </div>
        </article>
      </section>

      <footer class="chat-input-wrap" [class.awaiting-first-send]="!hasSentFirstMessage">
        <textarea
          #chatInput
          [(ngModel)]="draftMessage"
          class="form-control chat-input"
          rows="3"
          [placeholder]="placeholder"
          (keydown)="handleComposerKeydown($event)"
        ></textarea>
        <div class="d-flex justify-content-between align-items-center mt-3 gap-3">
          <span class="input-hint">
            {{ isSending ? 'The agent is working through the request...' : 'The agent updates the workspace as the conversation evolves.' }}
          </span>
          <button type="button" class="btn btn-primary px-3" [disabled]="!canSend" (click)="sendMessage()">
            {{ isSending ? 'Working...' : 'Send' }}
          </button>
        </div>
      </footer>
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .chat-panel {
        height: calc(100vh - 104px);
        min-height: 720px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: sticky;
        top: 68px;
        background:
          radial-gradient(circle at top right, rgba(139, 92, 246, 0.16), transparent 34%),
          linear-gradient(180deg, rgba(252, 250, 255, 0.98), rgba(246, 241, 255, 0.98));
        border-left: 1px solid rgba(173, 145, 255, 0.32);
      }

      .chat-header,
      .chat-input-wrap {
        padding: 1rem 1rem 0;
      }

      .chat-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        padding-top: 1.1rem;
      }

      .chat-title-wrap {
        display: flex;
        align-items: flex-start;
        gap: 0.8rem;
      }

      .chat-title-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0.3rem 0 0.15rem;
      }

      .agent-avatar {
        width: 2.85rem;
        height: 2.85rem;
        border-radius: 0.85rem;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 52%, #c084fc 100%);
        color: #fff;
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        box-shadow: 0 10px 22px rgba(124, 58, 237, 0.24);
      }

      .chat-kicker {
        display: inline-block;
        color: #7c3aed;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
      }

      .chat-title {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
      }

      .chat-subtitle,
      .input-hint {
        color: var(--helmos-muted);
        font-size: 0.84rem;
      }

      .agent-presence {
        border-radius: 999px;
        background: rgba(124, 58, 237, 0.1);
        color: #7c3aed;
        font-size: 0.77rem;
        font-weight: 700;
        padding: 0.45rem 0.7rem;
      }

      .message-history {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 0.75rem 1rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .message-bubble {
        max-width: 92%;
        border-radius: 1rem;
        padding: 0.9rem 1rem;
        border: 1px solid var(--helmos-border);
        position: relative;
      }

      .agent-message {
        background: linear-gradient(180deg, rgba(245, 239, 255, 0.96), rgba(251, 249, 255, 0.98));
        border-color: rgba(173, 145, 255, 0.34);
        align-self: flex-start;
      }

      .user-message {
        background: #fff;
        align-self: flex-end;
      }

      .message-meta {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.35rem;
        color: var(--helmos-muted);
        font-size: 0.76rem;
      }

      .message-author {
        font-weight: 700;
        color: var(--helmos-text);
      }

      .message-copy {
        line-height: 1.6;
      }

      .retryable-message {
        padding-bottom: 2.45rem;
      }

      .retry-message-button {
        position: absolute;
        right: 0.8rem;
        bottom: 0.75rem;
        width: 2rem;
        height: 2rem;
        border: 0;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(124, 58, 237, 0.12);
        color: #7c3aed;
        opacity: 0;
        pointer-events: none;
        transform: translateY(2px);
        transition:
          opacity 140ms ease,
          transform 140ms ease,
          background-color 140ms ease;
      }

      .retryable-message:hover .retry-message-button,
      .retryable-message:focus-within .retry-message-button,
      .retry-message-button:focus-visible {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }

      .retry-message-button:hover:not(:disabled),
      .retry-message-button:focus-visible {
        background: rgba(124, 58, 237, 0.2);
      }

      .retry-message-button:disabled {
        opacity: 0.45;
      }

      .pending-agent-message {
        min-height: 6.4rem;
      }

      .pending-agent-copy {
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        color: var(--helmos-text);
      }

      .pending-agent-spinner {
        display: inline-grid;
        place-items: center;
        width: 1.8rem;
        height: 1.8rem;
        border-radius: 999px;
        background: rgba(124, 58, 237, 0.1);
        color: #7c3aed;
        animation: spin 0.95s linear infinite;
      }

      .chat-input-wrap {
        border-top: 1px solid var(--helmos-border);
        padding-bottom: 1rem;
        background: rgba(255, 255, 255, 0.97);
      }

      .awaiting-first-send {
        animation: composePulse 1.05s ease-in-out infinite;
        position: relative;
      }

      .chat-input {
        min-height: 92px;
        border-radius: 1rem;
        resize: none;
        border-color: rgba(173, 145, 255, 0.34);
        background: linear-gradient(180deg, rgba(255, 255, 255, 1), rgba(250, 247, 255, 1));
      }

      .chat-input:focus {
        border-color: rgba(124, 58, 237, 0.55);
        box-shadow: 0 0 0 0.25rem rgba(124, 58, 237, 0.14);
      }

      .chat-input-wrap .btn-primary {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        border-color: #7c3aed;
        box-shadow: 0 10px 20px rgba(124, 58, 237, 0.18);
      }

      .chat-input-wrap.awaiting-first-send .btn-primary:not(:disabled) {
        animation: sendPulse 0.95s ease-in-out infinite;
      }

      @keyframes composePulse {
        0%,
        100% {
          box-shadow:
            inset 0 0 0 1px rgba(124, 58, 237, 0.22),
            0 -8px 24px rgba(124, 58, 237, 0.08);
        }

        40% {
          box-shadow:
            inset 0 0 0 1px rgba(124, 58, 237, 0.5),
            0 -18px 38px rgba(124, 58, 237, 0.18),
            0 0 0 8px rgba(196, 181, 253, 0.22);
        }

        75% {
          box-shadow:
            inset 0 0 0 1px rgba(168, 85, 247, 0.52),
            0 -12px 30px rgba(124, 58, 237, 0.14),
            0 0 0 4px rgba(216, 180, 254, 0.16);
        }
      }

      @keyframes sendPulse {
        0%,
        100% {
          box-shadow:
            0 10px 20px rgba(124, 58, 237, 0.18),
            0 0 0 0 rgba(139, 92, 246, 0.42);
        }

        50% {
          box-shadow:
            0 16px 28px rgba(124, 58, 237, 0.26),
            0 0 0 12px rgba(139, 92, 246, 0);
        }
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 1199.98px) {
        .chat-panel {
          position: static;
          height: auto;
          min-height: 560px;
          border-left: 0;
          border-top: 1px solid rgba(219, 228, 238, 0.95);
        }
      }
    `
  ]
})
export class AgentChatPanelComponent implements OnChanges, AfterViewInit {
  readonly userAstronautIcon = faUserAstronaut;
  readonly rotateRightIcon = faRotateRight;
  readonly spinnerIcon = faSpinner;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) subtitle!: string;
  @Input({ required: true }) placeholder!: string;
  @Input({ required: true }) messages: ChatMessage[] = [];
  @Input() isSending = false;
  @Input() resendAvailable = false;
  @Output() readonly messageSend = new EventEmitter<string>();
  @Output() readonly resendLastMessage = new EventEmitter<void>();
  @ViewChild('chatInput') chatInputRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('messageHistoryRef') messageHistoryRef?: ElementRef<HTMLElement>;

  draftMessage = '';
  hasSentFirstMessage = false;
  visibleMessages: ChatMessage[] = [];

  get canSend(): boolean {
    return this.draftMessage.trim().length > 0 && !this.isSending;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages']) {
      this.visibleMessages = [...this.messages];
      this.queueScrollToBottom();
    }

    if (changes['isSending']) {
      this.queueScrollToBottom();
    }
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.chatInputRef?.nativeElement.focus();
      this.scrollToBottom();
    });
  }

  sendMessage(): void {
    if (!this.canSend) {
      return;
    }

    const outgoingMessage = this.draftMessage.trim();
    this.visibleMessages = [
      ...this.visibleMessages,
      {
        id: this.visibleMessages.length + 1,
        role: 'user',
        author: 'You',
        content: outgoingMessage,
        timestamp: 'Now'
      }
    ];
    this.hasSentFirstMessage = true;
    this.draftMessage = '';
    this.queueScrollToBottom();
    this.messageSend.emit(outgoingMessage);
  }

  trackByMessageId(_: number, message: ChatMessage): number {
    return message.id;
  }

  handleComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.sendMessage();
  }

  isRetryableMessage(message: ChatMessage, messageIndex: number): boolean {
    if (!this.resendAvailable || message.role !== 'user') {
      return false;
    }

    const latestUserIndex = [...this.visibleMessages]
      .map((entry, index) => ({ entry, index }))
      .reverse()
      .find(({ entry }) => entry.role === 'user')?.index;

    return latestUserIndex === messageIndex;
  }

  private queueScrollToBottom(): void {
    queueMicrotask(() => this.scrollToBottom());
  }

  private scrollToBottom(): void {
    const messageHistory = this.messageHistoryRef?.nativeElement;
    if (!messageHistory) {
      return;
    }

    messageHistory.scrollTop = messageHistory.scrollHeight;
  }
}
