'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'auth-middleware-session-test-secret';

jest.mock('../src/models/AuthSession', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn()
}));

const jwt = require('jsonwebtoken');
const AuthSession = require('../src/models/AuthSession');
const { authenticate } = require('../src/middleware/auth');
const { SESSION_COOKIE } = require('../src/services/authSessionService');

function response() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function request(token, source = 'bearer') {
  const headers = source === 'cookie'
    ? { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` }
    : { authorization: `Bearer ${token}` };
  return {
    headers,
    socket: { remoteAddress: '127.0.0.1' },
    get(name) {
      return headers[String(name).toLowerCase()];
    }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.REQUIRE_SERVER_SESSION;
});

test.each(['bearer', 'cookie'])('authenticate accepts an active %s session', async source => {
  const token = jwt.sign(
    { userId: 'user-1', username: 'daniel', role: 'user', sid: 'session-1' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
  AuthSession.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      sessionId: 'session-1',
      userId: 'user-1',
      lastSeenAt: new Date()
    })
  });
  const req = request(token, source);
  const res = response();
  const next = jest.fn();

  await authenticate(req, res, next);

  expect(next).toHaveBeenCalledTimes(1);
  expect(req.userId).toBe('user-1');
  expect(req.authSessionId).toBe('session-1');
  expect(res.status).not.toHaveBeenCalled();
});

test('authenticate rejects a JWT after its server session is revoked', async () => {
  const token = jwt.sign(
    { userId: 'user-1', role: 'user', sid: 'session-revoked' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
  AuthSession.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue(null)
  });
  const req = request(token);
  const res = response();
  const next = jest.fn();

  await authenticate(req, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: false,
    request_id: expect.any(String),
    error: {
      code: 'AUTH_SESSION_REVOKED',
      message: 'Sessione scaduta o revocata'
    }
  }));
});

test('authenticate returns a stable public error for an expired token', async () => {
  const token = jwt.sign(
    { userId: 'user-1', role: 'user', sid: 'session-expired' },
    process.env.JWT_SECRET,
    { expiresIn: -1 }
  );
  const req = request(token);
  const res = response();
  const next = jest.fn();
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});

  await authenticate(req, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    error: {
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Token non valido o scaduto'
    }
  }));
  warning.mockRestore();
});
