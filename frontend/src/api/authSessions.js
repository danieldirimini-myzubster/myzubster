const TOKEN_KEYS = ['myzubster-token', 'token', 'accessToken'];

function storedToken() {
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return sessionStorage.getItem('token') || '';
}

function authHeaders() {
  const token = storedToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function authRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload.error?.message || payload.message || `Authentication request failed (${response.status})`
    );
    error.status = response.status;
    error.code = payload.error?.code;
    error.requestId = payload.request_id;
    throw error;
  }
  return payload;
}

export function getCurrentAccount() {
  return authRequest('/api/auth/me');
}

export function getAuthSessions() {
  return authRequest('/api/auth/me/sessions');
}

export function revokeAuthSession(sessionId) {
  return authRequest(`/api/auth/me/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE'
  });
}

export function logoutCurrentSession() {
  return authRequest('/api/auth/logout', { method: 'POST' });
}

export async function refreshAuthSession() {
  const payload = await authRequest('/api/auth/refresh', {
    method: 'POST',
    body: '{}'
  });
  if (payload.data?.token) localStorage.setItem('myzubster-token', payload.data.token);
  return payload;
}

export function clearBrowserAuth() {
  for (const key of TOKEN_KEYS) localStorage.removeItem(key);
  localStorage.removeItem('myzubster-user');
  localStorage.removeItem('myzubster-identity-provider');
  localStorage.removeItem('myzubster-metaverse-character-id');
  sessionStorage.removeItem('token');
}

export { authHeaders, storedToken };

