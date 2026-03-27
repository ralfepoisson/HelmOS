import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { AUTH_RETURN_PATH_KEY } from './bootstrap-auth';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      providers: [provideRouter([])]
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
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
});
