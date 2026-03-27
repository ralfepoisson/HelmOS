import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

import { AuthService } from '../auth/auth.service';
import { WorkspaceOption } from '../services/workspace-shell.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [CommonModule, FormsModule, FaIconComponent, RouterLink, RouterLinkActive],
  template: `
    <nav class="top-nav navbar navbar-expand border-bottom">
      <div class="container-fluid px-3 px-lg-4 gap-3">
        <a routerLink="/" class="d-flex align-items-center gap-3 brand-cluster brand-home-link" aria-label="Go to home">
          <img class="brand-mark" src="media/HelmOS-logo-icon-small.png" alt="HelmOS logo" />
          <div>
            <div class="brand-name">{{ productName }}</div>
            <div class="brand-tagline">{{ surfaceLabel }}</div>
          </div>
        </a>

        <div class="toolbar-cluster">
          <div *ngIf="showWorkspaceSwitcher" class="workspace-switcher d-none d-md-flex align-items-center gap-2">
            <span class="text-uppercase switcher-label" style="width:110px">Business idea</span>
            <div class="workspace-select-wrap">
              <select
                class="form-select form-select-sm workspace-select"
                [ngModel]="selectedWorkspaceId"
                [ngModelOptions]="{ standalone: true }"
                aria-label="Business idea switcher"
                (change)="workspaceChange.emit($any($event.target).value)"
              >
                <option *ngFor="let workspace of workspaces" [value]="workspace.id">
                  {{ workspace.name }}
                </option>
              </select>
              <fa-icon class="workspace-chevron" [icon]="chevronDown"></fa-icon>
            </div>
          </div>
        </div>

        <div class="ms-auto d-flex align-items-center gap-3">
          <div class="save-indicator">
            <span class="save-dot"></span>
            <span>{{ saveStatus }}</span>
          </div>
          <div class="primary-nav" aria-label="Primary">
            <a
              routerLink="/strategy-copilot"
              class="primary-nav-link"
              [class.primary-nav-link-active]="isStrategyCopilotSection"
            >
              Strategy Copilot
            </a>
          </div>
          <div *ngIf="resolvedShowAdminMenu" class="admin-menu" [class.open]="adminMenuOpen">
            <button
              type="button"
              class="admin-trigger"
              [class.admin-trigger-active]="isAdminSection"
              aria-haspopup="menu"
              [attr.aria-expanded]="adminMenuOpen"
              (click)="toggleAdminMenu()"
            >
              <span>Admin</span>
              <fa-icon class="admin-chevron" [icon]="chevronDown"></fa-icon>
            </button>

            <div *ngIf="adminMenuOpen" class="admin-panel helmos-card" role="menu">
              <a
                routerLink="/admin/agents"
                routerLinkActive="admin-link-active"
                class="admin-link"
                role="menuitem"
                (click)="closeAdminMenu()"
              >
                <span class="admin-link-title">Agent Admin</span>
                <span class="admin-link-copy">Manage specialist registry, prompts, and runtime alignment.</span>
              </a>
              <a
                routerLink="/admin/logs"
                routerLinkActive="admin-link-active"
                class="admin-link"
                role="menuitem"
                (click)="closeAdminMenu()"
              >
                <span class="admin-link-title">Logs</span>
                <span class="admin-link-copy">Search backend events, errors, and request context.</span>
              </a>
            </div>
          </div>
          <div class="profile-pill">
            <div class="profile-avatar">{{ resolvedProfileInitials }}</div>
            <div class="d-none d-lg-block">
              <div class="profile-name">{{ resolvedProfileName }}</div>
              <div class="profile-role">{{ resolvedProfileRoleLabel }}</div>
            </div>
            <button type="button" class="sign-out-button" (click)="signOut()">Sign Out</button>
          </div>
        </div>
      </div>
    </nav>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .top-nav {
        height: 68px;
        background: rgba(255, 255, 255, 0.82);
        backdrop-filter: blur(16px);
        border-color: rgba(219, 228, 238, 0.95) !important;
        position: fixed;
        inset: 0 0 auto 0;
        z-index: 1030;
      }

      .brand-mark {
        width: 2.25rem;
        height: 2.25rem;
        object-fit: contain;
        flex: 0 0 auto;
      }

      .brand-home-link {
        color: inherit;
        text-decoration: none;
      }

      .brand-name {
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .brand-tagline,
      .profile-role,
      .switcher-label {
        font-size: 0.75rem;
        color: var(--helmos-muted);
      }

      .toolbar-cluster {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 0 1 auto;
      }

      .primary-nav {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .primary-nav-link {
        display: inline-flex;
        align-items: center;
        min-height: 2.35rem;
        padding: 0.45rem 0.95rem;
        border-radius: 999px;
        border: 1px solid transparent;
        color: var(--helmos-muted);
        font-size: 0.85rem;
        font-weight: 700;
        text-decoration: none;
        transition:
          color 160ms ease,
          border-color 160ms ease,
          background 160ms ease,
          box-shadow 160ms ease;
      }

      .primary-nav-link:hover,
      .primary-nav-link-active {
        color: var(--helmos-text);
        border-color: rgba(31, 111, 235, 0.2);
        background: rgba(234, 242, 255, 0.92);
        box-shadow: 0 10px 24px rgba(21, 36, 64, 0.06);
      }

      .switcher-label {
        letter-spacing: 0.08em;
        font-weight: 700;
      }

      .workspace-select {
        min-width: 220px;
        border-radius: 999px;
        background: var(--helmos-surface-alt);
        padding-right: 2.2rem;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
      }

      .workspace-switcher {
        flex: 0 1 320px;
      }

      .workspace-select-wrap,
      .admin-menu {
        position: relative;
      }

      .workspace-chevron,
      .admin-chevron {
        position: absolute;
        top: 50%;
        right: 0.85rem;
        transform: translateY(-50%);
        color: var(--helmos-muted);
        font-size: 0.8rem;
        pointer-events: none;
      }

      .admin-trigger {
        position: relative;
        min-width: 116px;
        border: 1px solid var(--helmos-border);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.95);
        color: var(--helmos-text);
        font-size: 0.82rem;
        font-weight: 700;
        padding: 0.48rem 2.15rem 0.48rem 0.95rem;
        transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
      }

      .admin-trigger:hover,
      .admin-trigger-active,
      .open .admin-trigger {
        border-color: rgba(31, 111, 235, 0.28);
        box-shadow: 0 10px 24px rgba(21, 36, 64, 0.08);
        background: rgba(234, 242, 255, 0.92);
      }

      .admin-panel {
        position: absolute;
        top: calc(100% + 0.6rem);
        right: 0;
        width: 286px;
        padding: 0.4rem;
        border-radius: 1rem;
      }

      .admin-link {
        display: block;
        text-decoration: none;
        border-radius: 0.85rem;
        padding: 0.8rem 0.9rem;
        color: inherit;
        transition: background 160ms ease;
      }

      .admin-link:hover,
      .admin-link-active {
        background: var(--helmos-accent-soft);
      }

      .admin-link-title {
        display: block;
        font-size: 0.92rem;
        font-weight: 700;
      }

      .admin-link-copy {
        display: block;
        margin-top: 0.2rem;
        color: var(--helmos-muted);
        font-size: 0.77rem;
        line-height: 1.45;
      }

      .save-indicator {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.45rem 0.85rem;
        border-radius: 999px;
        background: #f4fbf8;
        color: var(--helmos-success);
        font-size: 0.82rem;
        font-weight: 600;
      }

      .save-dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        background: currentColor;
      }

      .profile-pill {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.25rem 0.4rem 0.25rem 0.25rem;
        border: 1px solid var(--helmos-border);
        border-radius: 999px;
        background: var(--helmos-surface);
        padding-right: 20px;
      }

      .profile-avatar {
        width: 2.1rem;
        height: 2.1rem;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #1f6feb 0%, #68a0ff 100%);
        color: #fff;
        font-weight: 700;
        font-size: 0.78rem;
      }

      .profile-name {
        font-size: 0.86rem;
        font-weight: 700;
      }

      .sign-out-button {
        border: 0;
        background: transparent;
        color: var(--helmos-muted);
        font-size: 0.8rem;
        font-weight: 700;
        padding: 0.35rem 0.6rem;
        border-radius: 999px;
        transition:
          color 160ms ease,
          background 160ms ease;
      }

      .sign-out-button:hover {
        color: var(--helmos-text);
        background: var(--helmos-accent-soft);
      }

      @media (max-width: 991.98px) {
        .toolbar-cluster {
          margin-left: auto;
        }

        .admin-trigger {
          min-width: 96px;
        }
      }

      @media (max-width: 767.98px) {
        .top-nav {
          height: auto;
          min-height: 68px;
        }

        .brand-cluster {
          min-width: 0;
        }

        .toolbar-cluster {
          order: 3;
          width: 100%;
          justify-content: flex-start;
          padding-bottom: 0.65rem;
        }

        .admin-panel {
          left: 0;
          right: auto;
          width: min(286px, calc(100vw - 2rem));
        }

        .save-indicator {
          padding-inline: 0.7rem;
        }
      }
    `
  ]
})
export class TopNavComponent {
  readonly chevronDown = faChevronDown;
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  @Input({ required: true }) productName!: string;
  @Input() surfaceLabel = 'Strategy workspace';
  @Input() workspaces: WorkspaceOption[] = [];
  @Input() selectedWorkspaceId = '';
  @Input({ required: true }) saveStatus!: string;
  @Input() showWorkspaceSwitcher = true;
  @Input() showAdminMenu?: boolean;
  @Input() profileInitials?: string;
  @Input() profileName?: string;
  @Input() profileRoleLabel?: string;
  @Output() readonly workspaceChange = new EventEmitter<string>();

  adminMenuOpen = false;

  get isAdminSection(): boolean {
    return this.router.url.startsWith('/admin');
  }

  get isStrategyCopilotSection(): boolean {
    return this.router.url.startsWith('/strategy-copilot');
  }

  get resolvedShowAdminMenu(): boolean {
    return this.showAdminMenu ?? this.auth.isAdmin();
  }

  get resolvedProfileInitials(): string {
    return this.profileInitials ?? this.auth.getProfileInitials();
  }

  get resolvedProfileName(): string {
    return this.profileName ?? this.auth.getProfileName();
  }

  get resolvedProfileRoleLabel(): string {
    return this.profileRoleLabel ?? this.auth.getProfileRoleLabel();
  }

  toggleAdminMenu(): void {
    this.adminMenuOpen = !this.adminMenuOpen;
  }

  closeAdminMenu(): void {
    this.adminMenuOpen = false;
  }

  signOut(): void {
    this.closeAdminMenu();
    this.auth.signOut();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeAdminMenu();
    }
  }
}
