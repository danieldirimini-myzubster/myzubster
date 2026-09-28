import {
  clearBrowserAuth,
  refreshAuthSession,
  storedToken
} from './authSessions';

const REFRESHABLE_AUTH_CODES = new Set([
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_INVALID',
  'AUTH_TOKEN_MISSING'
]);

export const AUTH_EXPIRED_EVENT = 'myzubster:auth-expired';

let refreshInFlight = null;

function requestPath(input) {
  if (typeof input === 'string') return input;
  return input?.url || '';
}

function isAuthControlRequest(input) {
  const value = requestPath(input);
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const pathname = new URL(value, origin).pathname;
    return pathname === '/api/auth/refresh' || pathname === '/api/auth/logout';
  } catch (_error) {
    return false;
  }
}

function requestOptions(options = {}) {
  const headers = new Headers(options.headers || {});
  const token = storedToken();

  // During the migration window, always replace a stale caller-provided bearer
  // token with the latest token produced by a successful refresh. Cookies remain
  // the long-term transport and are sent on every same-origin request.
  if (token) headers.set('Authorization', `Bearer ${token}`);
  else headers.delete('Authorization');

  return {
    ...options,
    credentials: 'same-origin',
    headers
  };
}

async function authenticationCode(response) {
  if (response.status !== 401 || typeof response.clone !== 'function') return '';
  try {
    const payload = await response.clone().json();
    return payload?.error?.code || payload?.code || '';
  } catch (_error) {
    return '';
  }
}

function refreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = refreshAuthSession().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function notifyAuthenticationExpired(error) {
  clearBrowserAuth();
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
    detail: {
      code: error?.code || 'AUTH_REFRESH_INVALID',
      requestId: error?.requestId || null
    }
  }));
}

/**
 * Same-origin fetch wrapper for authenticated application APIs.
 *
 * A request is retried exactly once when the API reports an access-token error.
 * Concurrent failures share one refresh operation, preventing reuse of a
 * single-use refresh token. Revoked sessions are deliberately not refreshed.
 */
export async function authenticatedFetch(input, options = {}) {
  const response = await fetch(input, requestOptions(options));
  if (response.status !== 401 || isAuthControlRequest(input)) return response;

  const code = await authenticationCode(response);
  if (!REFRESHABLE_AUTH_CODES.has(code)) return response;

  try {
    await refreshOnce();
  } catch (error) {
    if (error?.status === 401) {
      notifyAuthenticationExpired(error);
      return response;
    }
    throw error;
  }

  return fetch(input, requestOptions(options));
}

export { REFRESHABLE_AUTH_CODES };

