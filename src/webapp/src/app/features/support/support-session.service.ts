import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { SupportApiService } from './support-api.service';
import { SupportConversationMessage, SupportConversationState, SupportTicketSummary } from './support.models';
import { SupportTelemetryService } from './support-telemetry.service';

const STORAGE_KEY = 'helmos.support.session.v1';

interface PersistedSupportState {
  sessionKey: string;
  open: boolean;
  messages: SupportConversationMessage[];
  tickets: SupportTicketSummary[];
}

@Injectable({
  providedIn: 'root'
})
export class SupportSessionService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(SupportApiService);
  private readonly telemetry = inject(SupportTelemetryService);

  private initialized = false;
  private readonly sessionKeyState = signal<string>(this.loadPersistedState()?.sessionKey ?? this.createSessionKey());
  private readonly openState = signal<boolean>(this.loadPersistedState()?.open ?? false);
  private readonly messagesState = signal<SupportConversationMessage[]>(this.loadPersistedState()?.messages ?? []);
  private readonly ticketsState = signal<SupportTicketSummary[]>(this.loadPersistedState()?.tickets ?? []);
  private readonly conversationState = signal<SupportConversationState['conversation'] | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly isOpen = this.openState.asReadonly();
  readonly isLoading = this.loadingState.asReadonly();
  readonly errorMessage = this.errorState.asReadonly();
  readonly conversation = this.conversationState.asReadonly();
  readonly messages = computed(() => this.messagesState());
  readonly tickets = computed(() => this.ticketsState());
  readonly latestTicket = computed(() => this.ticketsState()[0] ?? null);

  async initialize(): Promise<void> {
    this.telemetry.initialize();
    if (this.initialized || !this.auth.isAuthenticated()) {
      return;
    }

    this.initialized = true;
    try {
      this.loadingState.set(true);
      const current = await this.api.getCurrentConversation(this.sessionKeyState());
      if (current) {
        this.conversationState.set(current.conversation);
        this.messagesState.set(current.messages);
        this.ticketsState.set(current.tickets);
        this.persist();
      }
    } catch (error) {
      this.errorState.set(error instanceof Error ? error.message : 'Failed to load support conversation.');
    } finally {
      this.loadingState.set(false);
    }
  }

  toggleOpen(): void {
    this.openState.update((value) => !value);
    this.telemetry.trackEvent('support_widget_toggle', this.openState() ? 'open' : 'close');
    this.persist();
  }

  close(): void {
    this.openState.set(false);
    this.persist();
  }

  async sendMessage(messageText: string): Promise<void> {
    const trimmed = messageText.trim();
    if (!trimmed || this.loadingState()) {
      return;
    }

    try {
      this.loadingState.set(true);
      this.errorState.set(null);
      this.telemetry.trackEvent('support_message_sent', trimmed.startsWith('report') ? 'bug-report' : 'message');
      const response = await this.api.sendMessage({
        sessionKey: this.sessionKeyState(),
        messageText: trimmed,
        clientContext: this.telemetry.captureContext(this.router.url, trimmed)
      });
      this.conversationState.set(response.conversation);
      this.messagesState.set(response.messages);
      if (response.ticket) {
        this.ticketsState.set([response.ticket, ...this.ticketsState().filter((entry) => entry.id !== response.ticket!.id)]);
      }
      this.persist();
    } catch (error) {
      this.errorState.set(error instanceof Error ? error.message : 'Failed to send your support message.');
    } finally {
      this.loadingState.set(false);
    }
  }

  private loadPersistedState(): PersistedSupportState | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PersistedSupportState;
    } catch {
      return null;
    }
  }

  private persist(): void {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sessionKey: this.sessionKeyState(),
        open: this.openState(),
        messages: this.messagesState(),
        tickets: this.ticketsState()
      } satisfies PersistedSupportState)
    );
  }

  private createSessionKey(): string {
    return `support-${Math.random().toString(36).slice(2, 10)}`;
  }
}
