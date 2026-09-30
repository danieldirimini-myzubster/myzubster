import { authenticatedFetch } from '../api/authenticatedFetch';
import { probeMetaverseIdentity } from './metaverseIdentity';

jest.mock('../api/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn()
}));

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(async () => payload)
  };
}

beforeEach(() => {
  authenticatedFetch.mockReset();
});

test('recognizes an account from the cookie-backed server session', async () => {
  authenticatedFetch.mockResolvedValue(jsonResponse(200, {
    success: true,
    data: {
      user: { id: 'user-1', username: 'Daniel' },
      character: { id: 'character-1', characterName: 'MyZubster' }
    }
  }));

  await expect(probeMetaverseIdentity()).resolves.toEqual({
    authenticated: true,
    user: { id: 'user-1', username: 'Daniel' },
    character: { id: 'character-1', characterName: 'MyZubster' }
  });
  expect(authenticatedFetch).toHaveBeenCalledWith(
    '/api/auth/me',
    { cache: 'no-store' },
    { notifyOnFailure: false }
  );
});

test('treats a missing server session as an expected guest identity', async () => {
  authenticatedFetch.mockResolvedValue(jsonResponse(401, {
    error: { code: 'AUTH_TOKEN_MISSING' }
  }));

  await expect(probeMetaverseIdentity()).resolves.toEqual({
    authenticated: false,
    user: null,
    character: null
  });
});

test('preserves structured server errors when identity cannot be checked', async () => {
  authenticatedFetch.mockResolvedValue(jsonResponse(503, {
    request_id: 'identity-request-1',
    error: { code: 'IDENTITY_UNAVAILABLE', message: 'Identity service unavailable' }
  }));

  await expect(probeMetaverseIdentity()).rejects.toMatchObject({
    message: 'Identity service unavailable',
    status: 503,
    code: 'IDENTITY_UNAVAILABLE',
    requestId: 'identity-request-1'
  });
});

