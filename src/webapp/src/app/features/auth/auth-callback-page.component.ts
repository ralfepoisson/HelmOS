import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-auth-callback-page',
  standalone: true,
  template: `
    <main class="auth-status-shell">
      <section class="auth-status-card">
        <p class="auth-kicker">Auth</p>
        <h1>Completing sign-in</h1>
        <p>HelmOS is finalising your session and routing you back into the workspace.</p>
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
        width: min(32rem, 100%);
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
    `
  ]
})
export class AuthCallbackPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    void this.router.navigateByUrl(this.auth.isAuthenticated() ? this.auth.consumeReturnPath() : '/signed-out');
  }
}
