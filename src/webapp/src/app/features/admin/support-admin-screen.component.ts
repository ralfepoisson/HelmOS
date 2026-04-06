import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';
import {
  AdminSupportConversationDetail,
  AdminSupportConversationSummary,
  AdminSupportTicketDetail,
  AdminSupportTicketSummary,
  SupportAdminService
} from './support-admin.service';

@Component({
  selector: 'app-support-admin-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      [surfaceLabel]="'Support operations'"
      [saveStatus]="loading ? 'Refreshing support activity…' : 'Support dashboard ready'"
      [showWorkspaceSwitcher]="false"
    />

    <main class="support-shell container-fluid">
      <section class="hero helmos-card">
        <div>
          <div class="section-kicker">Admin</div>
          <h1>Support Dashboard</h1>
          <p>Review Help Desk interactions, support tickets, investigations, and human review decisions.</p>
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <span>Conversations</span>
            <strong>{{ conversations.length }}</strong>
          </div>
          <div class="hero-stat">
            <span>Tickets</span>
            <strong>{{ tickets.length }}</strong>
          </div>
        </div>
      </section>

      <section class="layout-grid">
        <article class="list-panel helmos-card">
          <div class="tab-row">
            <button type="button" class="tab-button" [class.tab-button-active]="activeTab === 'conversations'" (click)="activeTab = 'conversations'">
              Help Desk Interactions
            </button>
            <button type="button" class="tab-button" [class.tab-button-active]="activeTab === 'tickets'" (click)="activeTab = 'tickets'">
              Support Tickets
            </button>
          </div>

          <div *ngIf="loading" class="state-card">Loading support data…</div>
          <div *ngIf="errorMessage" class="state-card state-card-error">{{ errorMessage }}</div>

          <div *ngIf="activeTab === 'conversations'" class="list-stack">
            <button
              *ngFor="let conversation of conversations"
              type="button"
              class="list-item"
              [class.list-item-active]="selectedConversation?.id === conversation.id"
              (click)="selectConversation(conversation)"
            >
              <strong>{{ conversation.user?.displayName || conversation.user?.email || conversation.userId }}</strong>
              <span>{{ conversation.lastRoute || 'No route recorded' }}</span>
              <small>{{ conversation.messageCount }} messages · {{ conversation.ticketCount }} tickets</small>
            </button>
          </div>

          <div *ngIf="activeTab === 'tickets'" class="list-stack">
            <button
              *ngFor="let ticket of tickets"
              type="button"
              class="list-item"
              [class.list-item-active]="selectedTicket?.id === ticket.id"
              (click)="selectTicket(ticket)"
            >
              <strong>{{ ticket.ticketKey }}</strong>
              <span>{{ ticket.title }}</span>
              <small>{{ ticket.status }} · {{ ticket.priority }} · {{ ticket.category }}</small>
            </button>
          </div>
        </article>

        <article class="detail-panel helmos-card" *ngIf="activeTab === 'conversations'">
          <ng-container *ngIf="selectedConversation; else conversationPlaceholder">
            <div class="section-kicker">Conversation</div>
            <h2>{{ selectedConversation.user?.displayName || selectedConversation.user?.email || selectedConversation.userId }}</h2>
            <p class="muted-copy">{{ selectedConversation.lastRoute || 'No route captured' }}</p>
            <div class="timeline">
              <article *ngFor="let message of selectedConversation.messages" class="timeline-item">
                <div class="timeline-meta">{{ message.senderType }} · {{ formatDate(message.createdAt) }}</div>
                <div class="timeline-body">{{ message.messageText }}</div>
              </article>
            </div>
          </ng-container>
          <ng-template #conversationPlaceholder>
            <div class="empty-state">Select a Help Desk interaction to inspect the transcript.</div>
          </ng-template>
        </article>

        <article class="detail-panel helmos-card" *ngIf="activeTab === 'tickets'">
          <ng-container *ngIf="selectedTicket; else ticketPlaceholder">
            <div class="section-kicker">Ticket</div>
            <h2>{{ selectedTicket.ticketKey }}</h2>
            <p class="muted-copy">{{ selectedTicket.title }}</p>
            <div class="badge-row">
              <span class="status-pill">{{ selectedTicket.status }}</span>
              <span class="status-pill">{{ selectedTicket.priority }}</span>
              <span class="status-pill">{{ selectedTicket.category }}</span>
            </div>

            <div class="action-row">
              <button class="btn btn-primary btn-sm" type="button" (click)="investigateSelectedTicket()" [disabled]="ticketActionLoading">
                {{ ticketActionLoading ? 'Running…' : 'Run Investigation' }}
              </button>
              <button class="btn btn-outline-success btn-sm" type="button" (click)="reviewSelectedTicket('approve')">Approve</button>
              <button class="btn btn-outline-danger btn-sm" type="button" (click)="reviewSelectedTicket('reject')">Reject</button>
            </div>

            <section class="detail-section">
              <h3>Reported issue</h3>
              <p>{{ selectedTicket.description }}</p>
            </section>

            <section class="detail-section">
              <h3>Proposed remediation</h3>
              <textarea class="form-control" rows="4" [(ngModel)]="recommendationDraft"></textarea>
              <textarea class="form-control mt-2" rows="3" [(ngModel)]="humanNotesDraft" placeholder="Human review notes"></textarea>
              <button class="btn btn-light btn-sm mt-2" type="button" (click)="reviewSelectedTicket('edit')">Save notes</button>
            </section>

            <section class="detail-section">
              <h3>Technical context</h3>
              <pre>{{ selectedTicket.technicalContext | json }}</pre>
            </section>

            <section class="detail-section" *ngIf="selectedTicket.investigations.length > 0">
              <h3>Investigations</h3>
              <article *ngFor="let investigation of selectedTicket.investigations" class="timeline-item">
                <div class="timeline-meta">{{ investigation.classification }} · {{ investigation.confidenceLabel || 'Unknown confidence' }}</div>
                <div class="timeline-body">
                  <strong>{{ investigation.issueSummary || 'No summary' }}</strong>
                  <p>{{ investigation.likelyRootCause }}</p>
                  <p>{{ investigation.recommendedRemediation }}</p>
                </div>
              </article>
            </section>

            <section class="detail-section" *ngIf="selectedTicket.events.length > 0">
              <h3>Audit trail</h3>
              <article *ngFor="let event of selectedTicket.events" class="timeline-item">
                <div class="timeline-meta">{{ event.eventType }} · {{ formatDate(event.createdAt) }}</div>
                <div class="timeline-body">{{ event.comment || 'No comment' }}</div>
              </article>
            </section>
          </ng-container>
          <ng-template #ticketPlaceholder>
            <div class="empty-state">Select a support ticket to review evidence and recommendations.</div>
          </ng-template>
        </article>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .support-shell {
        padding: 92px 1rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .hero,
      .list-panel,
      .detail-panel {
        padding: 1rem 1.1rem;
      }

      .hero,
      .hero-stats,
      .tab-row,
      .action-row,
      .badge-row {
        display: flex;
        gap: 0.75rem;
      }

      .hero,
      .action-row {
        justify-content: space-between;
        align-items: flex-start;
      }

      .hero-stats {
        align-items: stretch;
      }

      .hero-stat {
        min-width: 7rem;
        border-radius: 1rem;
        border: 1px solid var(--helmos-border);
        padding: 0.8rem 0.9rem;
        display: flex;
        flex-direction: column;
      }

      .layout-grid {
        display: grid;
        grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
        gap: 1rem;
      }

      .tab-button {
        border: 0;
        border-radius: 999px;
        padding: 0.55rem 0.9rem;
        background: rgba(247, 249, 252, 0.96);
        color: var(--helmos-muted);
        font-weight: 700;
      }

      .tab-button-active {
        background: rgba(234, 242, 255, 0.98);
        color: var(--helmos-text);
      }

      .list-stack,
      .timeline {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 1rem;
      }

      .list-item,
      .timeline-item,
      .empty-state,
      .state-card {
        border-radius: 1rem;
        border: 1px solid var(--helmos-border);
        padding: 0.85rem 0.95rem;
        background: rgba(247, 249, 252, 0.9);
      }

      .list-item {
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .list-item-active {
        border-color: rgba(31, 111, 235, 0.38);
        background: rgba(234, 242, 255, 0.98);
      }

      .timeline-meta,
      .section-kicker,
      .muted-copy,
      .list-item small,
      .list-item span {
        color: var(--helmos-muted);
      }

      .section-kicker {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .detail-section {
        margin-top: 1rem;
      }

      .detail-section h3 {
        font-size: 0.92rem;
        margin-bottom: 0.45rem;
      }

      .status-pill {
        border-radius: 999px;
        background: rgba(234, 242, 255, 0.98);
        padding: 0.3rem 0.65rem;
        font-size: 0.76rem;
        font-weight: 700;
      }

      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 0.78rem;
      }

      @media (max-width: 991.98px) {
        .layout-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class SupportAdminScreenComponent implements OnInit {
  readonly shell = inject(WorkspaceShellService);
  private readonly supportAdmin = inject(SupportAdminService);

  loading = false;
  ticketActionLoading = false;
  errorMessage: string | null = null;
  activeTab: 'conversations' | 'tickets' = 'conversations';
  conversations: AdminSupportConversationSummary[] = [];
  tickets: AdminSupportTicketSummary[] = [];
  selectedConversation: AdminSupportConversationDetail | null = null;
  selectedTicket: AdminSupportTicketDetail | null = null;
  recommendationDraft = '';
  humanNotesDraft = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    try {
      this.loading = true;
      this.errorMessage = null;
      const [conversations, tickets] = await Promise.all([
        this.supportAdmin.listConversations(),
        this.supportAdmin.listTickets()
      ]);
      this.conversations = conversations;
      this.tickets = tickets;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load support admin data.';
    } finally {
      this.loading = false;
    }
  }

  async selectConversation(conversation: AdminSupportConversationSummary): Promise<void> {
    this.selectedConversation = await this.supportAdmin.getConversation(conversation.id);
  }

  async selectTicket(ticket: AdminSupportTicketSummary): Promise<void> {
    this.selectedTicket = await this.supportAdmin.getTicket(ticket.id);
    this.recommendationDraft = this.selectedTicket.proposedFix || '';
    this.humanNotesDraft = this.selectedTicket.recommendations[0]?.humanNotes || '';
  }

  async investigateSelectedTicket(): Promise<void> {
    if (!this.selectedTicket) {
      return;
    }
    this.ticketActionLoading = true;
    await this.supportAdmin.investigateTicket(this.selectedTicket.id);
    await this.selectTicket(this.selectedTicket);
    await this.load();
    this.ticketActionLoading = false;
  }

  async reviewSelectedTicket(action: 'approve' | 'reject' | 'edit'): Promise<void> {
    if (!this.selectedTicket) {
      return;
    }
    await this.supportAdmin.reviewTicket(this.selectedTicket.id, {
      action,
      recommendationText: this.recommendationDraft,
      humanNotes: this.humanNotesDraft
    });
    await this.selectTicket(this.selectedTicket);
    await this.load();
  }

  formatDate(value: string | null): string {
    if (!value) {
      return 'Unknown time';
    }
    return new Date(value).toLocaleString();
  }
}
