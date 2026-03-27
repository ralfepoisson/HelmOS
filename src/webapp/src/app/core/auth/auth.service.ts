import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  AUTH_ERROR_KEY,
  AUTH_RETURN_PATH_KEY,
  AUTH_SESSION_KEY,
  AUTH_TOKEN_KEY,
  AuthRuntimeConfig,
  StoredAuthSession,
  clearStoredAuth,
  getProfileInitials,
  loadStoredSession,
  readAuthConfig
} from './bootstrap-auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly config: AuthRuntimeConfig = readAuthConfig();
  private readonly sessionState = signal<StoredAuthSession | null>(loadStoredSession());

  session(): StoredAuthSession | null {
    const restored = loadStoredSession();
    if (restored?.expiresAt !== this.sessionState()?.expiresAt) {
      this.sessionState.set(restored);
    }
    return this.sessionState();
  }

  getAccessToken(): string | null {
    return this.session() ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  }

  isAuthenticated(): boolean {
    return this.session() !== null;
  }

  isAdmin(): boolean {
    return this.session()?.appRole === 'ADMIN';
  }

  getProfileInitials(): string {
    return getProfileInitials(this.session());
  }

  getProfileName(): string {
    return this.session()?.displayName || this.session()?.email || 'Guest';
  }

  getProfileRoleLabel(): string {
    return this.isAdmin() ? 'Admin' : 'Member';
  }

  getLastAuthError(): string | null {
    return localStorage.getItem(AUTH_ERROR_KEY);
  }

  async ensureAuthenticated(targetUrl: string): Promise<boolean> {
    if (this.isAuthenticated()) {
      return true;
    }

    localStorage.setItem(AUTH_RETURN_PATH_KEY, targetUrl);
    this.redirectToSignIn();
    return false;
  }

  async ensureAdmin(targetUrl: string, router: Router): Promise<boolean> {
    if (!(await this.ensureAuthenticated(targetUrl))) {
      return false;
    }

    if (this.isAdmin()) {
      return true;
    }

    await router.navigateByUrl('/');
    return false;
  }

  redirectToSignIn(): void {
    const callbackUrl = `${normalizeAppBaseUrl(this.config.appBaseUrl)}#/auth/callback`;
    const signInUrl = new URL(`${normalizeBaseUrl(this.config.apiBaseUrl)}/api/auth/sign-in`);
    signInUrl.searchParams.set('redirect', callbackUrl);
    this.navigateTo(signInUrl.toString());
  }

  redirectToSignedOut(): void {
    this.navigateTo(`${normalizeAppBaseUrl(this.config.appBaseUrl)}/#/signed-out`);
  }

  signOut(reason?: string | null): void {
    clearStoredAuth();
    localStorage.removeItem(AUTH_ERROR_KEY);
    if (reason) {
      localStorage.setItem(AUTH_ERROR_KEY, reason);
    }
    this.sessionState.set(null);
    this.redirectToSignedOut();
  }

  handleUnauthorized(): void {
    clearStoredAuth();
    localStorage.setItem(AUTH_ERROR_KEY, 'Your session expired. Please sign in again.');
    this.sessionState.set(null);
  }

  consumeReturnPath(): string {
    const stored = localStorage.getItem(AUTH_RETURN_PATH_KEY) || '/';
    localStorage.removeItem(AUTH_RETURN_PATH_KEY);
    return stored;
  }

  clearAuthError(): void {
    localStorage.removeItem(AUTH_ERROR_KEY);
  }

  private navigateTo(url: string): void {
    window.location.assign(url);
  }
}

function normalizeAppBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
