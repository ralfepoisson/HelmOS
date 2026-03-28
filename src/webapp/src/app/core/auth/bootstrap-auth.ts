export const AUTH_TOKEN_KEY = 'helmos.auth.token';
export const AUTH_SESSION_KEY = 'helmos.auth.session';
export const AUTH_RETURN_PATH_KEY = 'helmos.auth.returnPath';
export const AUTH_ERROR_KEY = 'helmos.auth.error';
const DEV_AUTH_SERVICE_APPLICATION_ID = '04adc1d7-7475-4b28-67b2-63e24308a786';

export type AppRole = 'ADMIN' | 'USER';

export interface StoredAuthSession {
  userId: string;
  accountId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  expiresAt: number;
  appRole: AppRole;
}

export interface AuthRuntimeConfig {
  authServiceSignInUrl: string;
  authServiceApplicationId: string;
  authServiceSignOutUrl: string;
  appBaseUrl: string;
  apiBaseUrl: string;
  adminEmails: string[];
}

interface CallbackTokenExtraction {
  token: string | null;
  nextUrl: string | null;
}

function coerceClaimValue(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${value}`;
    }
  }

  return null;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

export function readAuthConfig(): AuthRuntimeConfig {
  const globalConfig = (window as typeof window & {
    __HELMOS_CONFIG__?: Partial<AuthRuntimeConfig>;
  }).__HELMOS_CONFIG__;
  const appBaseUrl = globalConfig?.appBaseUrl?.trim() || `${window.location.origin}/`;
  const adminEmails =
    globalConfig?.adminEmails?.map((entry) => entry.trim().toLowerCase()).filter(Boolean) ?? [];

  return {
    authServiceSignInUrl: globalConfig?.authServiceSignInUrl?.trim() || 'http://auth-service.localhost:46138/',
    authServiceApplicationId: globalConfig?.authServiceApplicationId?.trim() || DEV_AUTH_SERVICE_APPLICATION_ID,
    authServiceSignOutUrl: globalConfig?.authServiceSignOutUrl?.trim() || 'http://localhost:63431/logout',
    appBaseUrl,
    apiBaseUrl: globalConfig?.apiBaseUrl?.trim() || window.location.origin,
    adminEmails: adminEmails.length > 0 ? adminEmails : ['ralfepoisson@gmail.com']
  };
}

export function getAppRoleForEmail(email: string | null | undefined, config = readAuthConfig()): AppRole {
  return email && config.adminEmails.includes(email.trim().toLowerCase()) ? 'ADMIN' : 'USER';
}

export function parseTokenToSession(token: string, config = readAuthConfig()): StoredAuthSession {
  const [, payloadSegment] = token.split('.');
  if (!payloadSegment) {
    throw new Error('The auth token is malformed.');
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(decodeBase64Url(payloadSegment)) as Record<string, unknown>;
  } catch {
    throw new Error('The auth token could not be decoded.');
  }

  const userId = coerceClaimValue(payload, ['userid', 'userId', 'sub']);
  const accountId = coerceClaimValue(payload, ['accountId', 'accountid', 'tenantId', 'tenantid']);
  const expiresAt = Number(payload['exp']);

  if (!userId || !accountId || !Number.isFinite(expiresAt)) {
    throw new Error('The auth token is missing the required identity claims.');
  }

  if (expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error('The auth token has expired.');
  }

  const email = coerceClaimValue(payload, ['email']) ?? `${userId}@life2.local`;

  return {
    userId,
    accountId,
    email,
    displayName: coerceClaimValue(payload, ['displayName', 'name']),
    avatarUrl: coerceClaimValue(payload, ['avatarUrl', 'picture']),
    expiresAt,
    appRole: getAppRoleForEmail(email, config)
  };
}

export function loadStoredSession(): StoredAuthSession | null {
  const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
  const storedSession = localStorage.getItem(AUTH_SESSION_KEY);

  if (!storedToken || !storedSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedSession) as StoredAuthSession;
    if (!parsed || parsed.expiresAt <= Math.floor(Date.now() / 1000)) {
      clearStoredAuth();
      return null;
    }
    return parsed;
  } catch {
    clearStoredAuth();
    return null;
  }
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_RETURN_PATH_KEY);
}

export function captureAuthTokenFromUrl(
  location = window.location,
  history: Pick<History, 'replaceState'> = window.history
): void {
  const extracted = extractCallbackToken(location);
  const token = extracted.token;

  if (!token) {
    loadStoredSession();
    return;
  }

  try {
    const session = parseTokenToSession(token);
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(AUTH_ERROR_KEY);
  } catch (error) {
    clearStoredAuth();
    localStorage.setItem(
      AUTH_ERROR_KEY,
      error instanceof Error ? error.message : 'The auth token could not be processed.'
    );
  }

  history.replaceState({}, '', extracted.nextUrl || '/');
}

function extractCallbackToken(location: Location): CallbackTokenExtraction {
  const url = new URL(location.href);
  const directToken = url.searchParams.get('token');
  if (directToken) {
    url.searchParams.delete('token');
    return {
      token: directToken,
      nextUrl: `${url.pathname}${url.search}${url.hash}` || '/'
    };
  }

  const rawHash = location.hash || '';
  const hashWithoutPrefix = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const queryIndex = hashWithoutPrefix.indexOf('?');
  if (queryIndex === -1) {
    return { token: null, nextUrl: null };
  }

  const hashPath = hashWithoutPrefix.slice(0, queryIndex);
  const hashQuery = new URLSearchParams(hashWithoutPrefix.slice(queryIndex + 1));
  const hashToken = hashQuery.get('token');
  if (!hashToken) {
    return { token: null, nextUrl: null };
  }

  hashQuery.delete('token');
  const nextHash = hashQuery.size > 0 ? `#${hashPath}?${hashQuery.toString()}` : `#${hashPath}`;

  return {
    token: hashToken,
    nextUrl: `${location.pathname}${location.search}${nextHash}`
  };
}

export function getProfileInitials(session: StoredAuthSession | null): string {
  const label = session?.displayName?.trim() || session?.email?.trim() || 'User';
  const words = label.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((entry) => entry.charAt(0).toUpperCase())
    .join('');
}
