import {
  AUTH_ERROR_KEY,
  AUTH_SESSION_KEY,
  AUTH_TOKEN_KEY,
  captureAuthTokenFromUrl,
  readAuthConfig
} from './bootstrap-auth';

describe('captureAuthTokenFromUrl', () => {
  afterEach(() => {
    localStorage.clear();
    delete (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__;
  });

  it('stores a valid callback token before the app boots and strips it from the URL', () => {
    const calls: unknown[][] = [];
    const historyStub: Pick<History, 'replaceState'> = {
      replaceState: (...args: unknown[]) => {
        calls.push(args);
      }
    };
    const token = [
      btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })),
      btoa(
        JSON.stringify({
          userid: 'life2-user-1',
          accountId: 'life2-account-1',
          email: 'ralfepoisson@gmail.com',
          displayName: 'Ralfe Poisson',
          exp: Math.floor(Date.now() / 1000) + 3600
        })
      ),
      'signature'
    ].join('.');

    captureAuthTokenFromUrl({
      href: `http://localhost:4200/#/auth/callback?token=${encodeURIComponent(token)}`,
      origin: 'http://localhost:4200',
      pathname: '/',
      search: '',
      hash: `#/auth/callback?token=${encodeURIComponent(token)}`
    } as Location, historyStub);

    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe(token);
    expect(JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) ?? '{}')).toMatchObject({
      email: 'ralfepoisson@gmail.com',
      displayName: 'Ralfe Poisson',
      appRole: 'ADMIN'
    });
    expect(localStorage.getItem(AUTH_ERROR_KEY)).toBeNull();
    expect(calls).toEqual([[{}, '', '/#/auth/callback']]);
  });

  it('records an auth error and ignores an invalid token payload', () => {
    const calls: unknown[][] = [];
    const historyStub: Pick<History, 'replaceState'> = {
      replaceState: (...args: unknown[]) => {
        calls.push(args);
      }
    };
    const token = [
      btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })),
      btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })),
      'signature'
    ].join('.');

    captureAuthTokenFromUrl({
      href: `http://localhost:4200/#/auth/callback?token=${encodeURIComponent(token)}`,
      origin: 'http://localhost:4200',
      pathname: '/',
      search: '',
      hash: `#/auth/callback?token=${encodeURIComponent(token)}`
    } as Location, historyStub);

    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_ERROR_KEY)).toContain('missing the required identity claims');
    expect(calls).toEqual([[{}, '', '/#/auth/callback']]);
  });
});

describe('readAuthConfig', () => {
  afterEach(() => {
    delete (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__;
  });

  it('falls back to the local auth-service host defaults when runtime config is absent', () => {
    expect(readAuthConfig()).toMatchObject({
      authServiceSignInUrl: 'http://auth-service.localhost:46138/',
      authServiceApplicationId: '04adc1d7-7475-4b28-67b2-63e24308a786'
    });
  });

  it('uses injected runtime config for app and api urls', () => {
    (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__ = {
      authServiceSignInUrl: 'https://auth.life-sqrd.com/',
      authServiceApplicationId: 'public-app-id',
      authServiceSignOutUrl: 'https://auth.life-sqrd.com/logout',
      appBaseUrl: 'https://helm-os.ai/app/',
      apiBaseUrl: 'https://api.helm-os.ai'
    };

    expect(readAuthConfig()).toMatchObject({
      authServiceSignInUrl: 'https://auth.life-sqrd.com/',
      authServiceApplicationId: 'public-app-id',
      authServiceSignOutUrl: 'https://auth.life-sqrd.com/logout',
      appBaseUrl: 'https://helm-os.ai/app/',
      apiBaseUrl: 'https://api.helm-os.ai'
    });
  });
});
