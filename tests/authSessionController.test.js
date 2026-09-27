'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'auth-session-controller-test-secret';

jest.mock('../src/models/AuthSession', () => ({
  findOneAndUpdate: jest.fn()
}));

const jwt = require('jsonwebtoken');
const AuthSession = require('../src/models/AuthSession');
const authSessionController = require('../src/controllers/authSessionController');
const { SESSION_COOKIE } = require('../src/services/authSessionService');

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
