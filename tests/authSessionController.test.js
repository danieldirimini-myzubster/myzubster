'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'auth-session-controller-test-secret';

jest.mock('../src/models/AuthSession', () => ({
  findOneAndUpdate: jest.fn(),
  findOne: jest.fn(),
  updateOne: jest.fn()
}));

jest.mock('../src/models/User', () => ({
  findById: jest.fn()
}));

const jwt = require('jsonwebtoken');
const AuthSession = require('../src/models/AuthSession');
const User = require('../src/models/User');
const authSessionController = require('../src/controllers/authSessionController');
const { SESSION_COOKIE, REFRESH_COOKIE, issueSession } = require('../src/services/authSessionService');

function request(token = '') {
  const headers = token ? { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } : {};
  return {
    headers,
    params: {},
    socket: { remoteAddress: '127.0.0.1' },
    get(name) {
      return headers[String(name).toLowerCase()];
    }
  };
}

function response() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

test('logout revokes a valid server session and clears its HttpOnly cookie', async () => {
  const token = jwt.sign(
    { userId: 'user-1', sid: 'session-1' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
  AuthSession.findOneAndUpdate.mockResolvedValue({ sessionId: 'session-1' });
  const req = request(token);
  const res = response();

  await authSessionController.logout(req, res);

  expect(AuthSession.findOneAndUpdate).toHaveBeenCalledWith(
    { userId: 'user-1', sessionId: 'session-1', revokedAt: null },
    { $set: { revokedAt: expect.any(Date), revokedReason: 'logout' } },
    { new: true }
  );
  expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, expect.objectContaining({
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  }));
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    logged_out: true
  }));
});

test('logout clears an expired or malformed cookie without requiring authentication', async () => {
  const req = request('not-a-valid-jwt');
  const res = response();

  await authSessionController.logout(req, res);

  expect(AuthSession.findOneAndUpdate).not.toHaveBeenCalled();
  expect(res.clearCookie).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    logged_out: true
  }));
});

test('refresh rotates the opaque token and returns a new access token without exposing the refresh token', async () => {
  const create = jest.fn().mockImplementation(async value => value);
  const issued = await issueSession(
    { _id: '507f1f77bcf86cd799439011', username: 'daniel', role: 'user' },
    request(),
    { SessionModel: { create } }
  );
  AuthSession.findOneAndUpdate.mockResolvedValue({
    sessionId: issued.sessionId,
    userId: '507f1f77bcf86cd799439011',
    expiresAt: issued.expiresAt
  });
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      username: 'daniel',
      role: 'user'
    })
  });
  const req = request();
  req.headers.cookie = `${REFRESH_COOKIE}=${encodeURIComponent(issued.refreshToken)}`;
  const res = response();

  await authSessionController.refresh(req, res);

  expect(res.status).not.toHaveBeenCalled();
  expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE, expect.any(String), expect.any(Object));
  expect(res.cookie).toHaveBeenCalledWith(REFRESH_COOKIE, expect.any(String), expect.objectContaining({
    httpOnly: true,
    path: '/api/auth'
  }));
  const payload = res.json.mock.calls[0][0];
  expect(payload.success).toBe(true);
  expect(payload.data.token).toEqual(expect.any(String));
  expect(JSON.stringify(payload)).not.toContain(issued.refreshToken);
  expect(payload.data.refreshToken).toBeUndefined();
});

test('refresh replay revokes the session and clears both cookies', async () => {
  const create = jest.fn().mockImplementation(async value => value);
  const issued = await issueSession(
    { _id: '507f1f77bcf86cd799439011', username: 'daniel', role: 'user' },
    request(),
    { SessionModel: { create } }
  );
  AuthSession.findOneAndUpdate.mockResolvedValue(null);
  AuthSession.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue({ sessionId: issued.sessionId })
  });
  AuthSession.updateOne.mockResolvedValue({ modifiedCount: 1 });
  const req = request();
  req.headers.cookie = `${REFRESH_COOKIE}=${encodeURIComponent(issued.refreshToken)}`;
  const res = response();

  await authSessionController.refresh(req, res);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    error: expect.objectContaining({ code: 'AUTH_REFRESH_REPLAY' })
  }));
  expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, expect.any(Object));
  expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, expect.objectContaining({ path: '/api/auth' }));
});

