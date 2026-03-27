import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-auth-status-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="auth-status-shell">
      <section class="auth-status-card">
        <p class="auth-kicker">Signed out</p>
        <h1>You have been signed out</h1>
        <p class="auth-copy">
          Your HelmOS session token has been removed from this browser. Sign in again whenever you are ready to return to your workspace.
        </p>
        <p *ngIf="authError" class="auth-error">{{ authError }}</p>
        <button class="btn btn-primary" type="button" (click)="signIn()">Sign In Again</button>
      </section>
    </main>
  `,
  styles: [
    `
      .auth-status-shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
        background: radial-gradient(circle at top, rgba(31, 111, 235, 0.12), transparent 45%), #f7f9fc;
      }

      .auth-status-card {
        width: min(34rem, 100%);
        padding: 2rem;
        border-radius: 1.5rem;
        background: #fff;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
      }

      .auth-kicker {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #1f6feb;
      }

      .auth-copy {
        color: #526074;
      }

      .auth-error {
        margin: 1rem 0;
        padding: 0.85rem 1rem;
        border-radius: 1rem;
        background: #fff1f2;
        color: #be123c;
      }
    `
  ]
})
export class AuthStatusPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl(this.auth.consumeReturnPath());
    }
  }

  get authError(): string | null {
    return this.auth.getLastAuthError();
  }

  signIn(): void {
    this.auth.clearAuthError();
    this.auth.redirectToSignIn();
  }
}
