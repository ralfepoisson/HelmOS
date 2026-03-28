import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { AUTH_ERROR_KEY, AUTH_RETURN_PATH_KEY, AUTH_SESSION_KEY, AUTH_TOKEN_KEY } from './bootstrap-auth';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  beforeEach(async () => {
    localStorage.clear();
    (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__ = {
      authServiceSignInUrl: 'https://auth.life-sqrd.com/',
      authServiceApplicationId: 'public-app-id'
    };

    await TestBed.configureTestingModule({
      providers: [provideRouter([])]
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__;
  });

  it('defaults the return path to root when none is stored', () => {
    const service = TestBed.inject(AuthService);

    expect(service.consumeReturnPath()).toBe('/');
  });

  it('redirects non-admin users to root', async () => {
    const service = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    vi.spyOn(service, 'ensureAuthenticated').mockResolvedValue(true);
    vi.spyOn(service, 'isAdmin').mockReturnValue(false);

    const allowed = await service.ensureAdmin('/admin/agents', router);

    expect(allowed).toBe(false);
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/');
  });

  it('clears the stored return path after reading it', () => {
    const service = TestBed.inject(AuthService);
    localStorage.setItem(AUTH_RETURN_PATH_KEY, '/strategy-copilot/my-business-ideas');

    expect(service.consumeReturnPath()).toBe('/strategy-copilot/my-business-ideas');
    expect(localStorage.getItem(AUTH_RETURN_PATH_KEY)).toBeNull();
  });

  it('routes sign-in to the auth service with applicationId and redirect', () => {
    const service = TestBed.inject(AuthService);
    const navigateSpy = vi.spyOn(service as AuthService & { navigateTo: (url: string) => void }, 'navigateTo');

    service.redirectToSignIn();

    expect(navigateSpy).toHaveBeenCalledWith(
      `https://auth.life-sqrd.com/?applicationId=public-app-id&redirect=${encodeURIComponent(
        `${window.location.origin}#/auth/callback`
      )}`
    );
  });

  it('clears stored auth state and routes to the signed-out page', () => {
    const service = TestBed.inject(AuthService);
    const navigateSpy = vi.spyOn(service as AuthService & { navigateTo: (url: string) => void }, 'navigateTo');
    localStorage.setItem(AUTH_TOKEN_KEY, 'jwt-token');
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({
        userId: 'user-1',
        accountId: 'account-1',
        email: 'user@example.com',
        displayName: 'User Example',
        avatarUrl: null,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        appRole: 'USER'
      })
    );
    localStorage.setItem(AUTH_RETURN_PATH_KEY, '/strategy-copilot');
    localStorage.setItem(AUTH_ERROR_KEY, 'Previous auth error');

    service.signOut();

    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_RETURN_PATH_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_ERROR_KEY)).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(`${window.location.origin}/#/signed-out`);
  });
});
