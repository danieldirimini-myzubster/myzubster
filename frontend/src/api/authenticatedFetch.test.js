import {
  AUTH_EXPIRED_EVENT,
  authenticatedFetch
} from './authenticatedFetch';

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(async () => payload),
    clone: () => jsonResponse(status, payload)
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('sends same-origin cookies and the migration bearer token', async () => {
  localStorage.setItem('myzubster-token', 'access-1');
  global.fetch.mockResolvedValue(jsonResponse(200, { success: true }));

  await authenticatedFetch('/api/metaverse/profile');

  const options = global.fetch.mock.calls[0][1];
  expect(options.credentials).toBe('same-origin');
  expect(options.headers.get('Authorization')).toBe('Bearer access-1');
});

test('refreshes an expired access token and retries exactly once with the new token', async () => {
  localStorage.setItem('myzubster-token', 'expired-access');
  global.fetch
    .mockResolvedValueOnce(jsonResponse(401, {
      error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Expired' }
    }))
    .mockResolvedValueOnce(jsonResponse(200, {
      success: true,
      data: { token: 'rotated-access' }
    }))
    .mockResolvedValueOnce(jsonResponse(200, { success: true }));

  const response = await authenticatedFetch('/api/metaverse/profile');

  expect(response.status).toBe(200);
  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(global.fetch.mock.calls[1][0]).toBe('/api/auth/refresh');
  expect(global.fetch.mock.calls[2][1].headers.get('Authorization')).toBe('Bearer rotated-access');
});

test('deduplicates concurrent refresh attempts for single-use refresh tokens', async () => {
  localStorage.setItem('myzubster-token', 'expired-access');
  let protectedCalls = 0;
  let refreshCalls = 0;

  global.fetch.mockImplementation(async (input) => {
    if (input === '/api/auth/refresh') {
      refreshCalls += 1;
      return jsonResponse(200, { success: true, data: { token: 'rotated-access' } });
    }
    protectedCalls += 1;
    if (protectedCalls <= 2) {
      return jsonResponse(401, { error: { code: 'AUTH_TOKEN_EXPIRED' } });
    }
    return jsonResponse(200, { success: true });
  });

  const [first, second] = await Promise.all([
    authenticatedFetch('/api/metaverse/profile'),
    authenticatedFetch('/api/metaverse/rooms')
  ]);

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(refreshCalls).toBe(1);
  expect(protectedCalls).toBe(4);
});

test('does not refresh a session that the server has revoked', async () => {
  global.fetch.mockResolvedValue(jsonResponse(401, {
    error: { code: 'AUTH_SESSION_REVOKED' }
  }));

  const response = await authenticatedFetch('/api/metaverse/profile');

  expect(response.status).toBe(401);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('clears migration credentials and emits an event after terminal refresh failure', async () => {
  localStorage.setItem('myzubster-token', 'expired-access');
  const listener = jest.fn();
  window.addEventListener(AUTH_EXPIRED_EVENT, listener);
  global.fetch
    .mockResolvedValueOnce(jsonResponse(401, {
      error: { code: 'AUTH_TOKEN_EXPIRED' }
    }))
    .mockResolvedValueOnce(jsonResponse(401, {
      request_id: 'refresh-request-1',
      error: { code: 'AUTH_REFRESH_INVALID', message: 'Invalid refresh token' }
    }));

  const response = await authenticatedFetch('/api/metaverse/profile');

  expect(response.status).toBe(401);
  expect(localStorage.getItem('myzubster-token')).toBeNull();
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.calls[0][0].detail).toEqual({
    code: 'AUTH_REFRESH_INVALID',
    requestId: 'refresh-request-1'
  });
  window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
});

