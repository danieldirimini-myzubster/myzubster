import {
  clearBrowserAuth,
  getAuthSessions,
  logoutCurrentSession,
  refreshAuthSession,
  revokeAuthSession
} from './authSessions';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('loads sessions with cookie credentials and bearer fallback', async () => {
  localStorage.setItem('myzubster-token', 'token-123');
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, sessions: [{ id: 'session-1', current: true }] })
  });

  await expect(getAuthSessions()).resolves.toEqual(expect.objectContaining({ success: true }));
  expect(global.fetch).toHaveBeenCalledWith('/api/auth/me/sessions', expect.objectContaining({
    credentials: 'same-origin',
    headers: expect.objectContaining({ Authorization: 'Bearer token-123' })
  }));
});

test('encodes a session id before revocation', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

  await revokeAuthSession('device/session 1');

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/auth/me/sessions/device%2Fsession%201',
    expect.objectContaining({ method: 'DELETE' })
  );
});

test('preserves the structured server error for the account UI', async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({
      request_id: 'request-123',
      error: { code: 'SESSION_REVOKED', message: 'Sessione revocata' }
    })
  });

  await expect(getAuthSessions()).rejects.toMatchObject({
    message: 'Sessione revocata',
    status: 401,
    code: 'SESSION_REVOKED',
    requestId: 'request-123'
  });
});

test('logout is a POST and local cleanup removes every legacy token', async () => {
  for (const key of ['myzubster-token', 'token', 'accessToken', 'myzubster-user', 'myzubster-identity-provider', 'myzubster-metaverse-character-id']) {
    localStorage.setItem(key, 'value');
  }
  sessionStorage.setItem('token', 'value');
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

  await logoutCurrentSession();
  clearBrowserAuth();

  expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.getItem('token')).toBeNull();
});

test('refresh rotates the server cookie and replaces the migration access token', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { token: 'rotated-access-token' } })
  });

  await refreshAuthSession();

  expect(global.fetch).toHaveBeenCalledWith('/api/auth/refresh', expect.objectContaining({
    method: 'POST',
    credentials: 'same-origin',
    body: '{}',
    headers: expect.objectContaining({ 'Content-Type': 'application/json' })
  }));
  expect(localStorage.getItem('myzubster-token')).toBe('rotated-access-token');
});

