'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'auth-session-service-test-secret';

const jwt = require('jsonwebtoken');
const {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  issueSession,
  listUserSessions,
  rotateRefreshToken,
  tokenFromRequest,
  refreshTokenFromRequest,
  validateSession
} = require('../src/services/authSessionService');

function request(headers = {}) {
  return {
    headers,
    socket: { remoteAddress: '127.0.0.1' },
    get(name) {
      return headers[String(name).toLowerCase()];
    }
  };
}

test('issueSession persists device metadata and signs a server-bound JWT', async () => {
  const create = jest.fn().mockImplementation(async value => value);
  const req = request({
    'user-agent': 'MyZubster Test Browser',
    'x-forwarded-for': '203.0.113.10, 10.0.0.1'
  });

  const issued = await issueSession(
    { _id: '507f1f77bcf86cd799439011', username: 'daniel', role: 'user' },
    req,
    { SessionModel: { create } }
  );

  const decoded = jwt.verify(issued.token, process.env.JWT_SECRET);
  expect(decoded.sid).toBe(issued.sessionId);
  expect(decoded.userId).toBe('507f1f77bcf86cd799439011');
  expect(create).toHaveBeenCalledWith(expect.objectContaining({
    sessionId: issued.sessionId,
    userAgent: 'MyZubster Test Browser',
    ipHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    refreshTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    refreshTokenVersion: 0,
    expiresAt: expect.any(Date)
  }));
  expect(issued.refreshToken).toMatch(new RegExp(`^myzr\\.${issued.sessionId}\\.`));
  expect(create.mock.calls[0][0].refreshTokenHash).not.toContain(issued.refreshToken);
});

test('rotateRefreshToken replaces the current hash atomically and retains a bounded replay history', async () => {
  const create = jest.fn().mockImplementation(async value => value);
  const issued = await issueSession(
    { _id: '507f1f77bcf86cd799439011', username: 'daniel', role: 'user' },
    request(),
    { SessionModel: { create } }
  );
  const stored = create.mock.calls[0][0];
  const SessionModel = {
    findOneAndUpdate: jest.fn().mockResolvedValue({
      sessionId: issued.sessionId,
      userId: '507f1f77bcf86cd799439011',
      expiresAt: issued.expiresAt
    })
  };

  const rotated = await rotateRefreshToken(issued.refreshToken, { SessionModel });

  expect(rotated.refreshToken).not.toBe(issued.refreshToken);
  expect(rotated.refreshToken).toMatch(new RegExp(`^myzr\\.${issued.sessionId}\\.`));
  expect(SessionModel.findOneAndUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionId: issued.sessionId,
      refreshTokenHash: stored.refreshTokenHash,
      revokedAt: null
    }),
    expect.objectContaining({
      $set: expect.objectContaining({ refreshTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
      $inc: { refreshTokenVersion: 1 },
      $push: {
        usedRefreshTokenHashes: {
          $each: [stored.refreshTokenHash],
          $slice: -50
        }
      }
    }),
    { new: true }
  );
});

test('rotateRefreshToken revokes the session when a consumed refresh token is replayed', async () => {
  const create = jest.fn().mockImplementation(async value => value);
  const issued = await issueSession(
    { _id: '507f1f77bcf86cd799439011', username: 'daniel', role: 'user' },
    request(),
    { SessionModel: { create } }
  );
  const SessionModel = {
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ sessionId: issued.sessionId })
    }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
  };

  await expect(rotateRefreshToken(issued.refreshToken, { SessionModel }))
    .rejects.toMatchObject({ code: 'AUTH_REFRESH_REPLAY' });
  expect(SessionModel.updateOne).toHaveBeenCalledWith(
    { sessionId: issued.sessionId, revokedAt: null },
    { $set: { revokedAt: expect.any(Date), revokedReason: 'refresh-token-replay' } }
  );
});

test('rotateRefreshToken rejects malformed values without querying the database', async () => {
  const SessionModel = { findOneAndUpdate: jest.fn() };
  await expect(rotateRefreshToken('not-a-refresh-token', { SessionModel }))
    .rejects.toMatchObject({ code: 'AUTH_REFRESH_INVALID' });
  expect(SessionModel.findOneAndUpdate).not.toHaveBeenCalled();
});

test('validateSession accepts an active session and rejects an unknown or revoked one', async () => {
  const active = {
    sessionId: 'session-1',
    userId: 'user-1',
    lastSeenAt: new Date()
  };
  const activeModel = {
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(active) }),
    updateOne: jest.fn()
  };
  await expect(validateSession(
    { sid: 'session-1', userId: 'user-1' },
    { SessionModel: activeModel }
  )).resolves.toEqual(active);

  const missingModel = {
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
  };
  await expect(validateSession(
    { sid: 'session-1', userId: 'user-1' },
    { SessionModel: missingModel }
  )).resolves.toBeNull();
});

test('legacy bearer tokens can be phased out with REQUIRE_SERVER_SESSION', async () => {
  delete process.env.REQUIRE_SERVER_SESSION;
  await expect(validateSession({ userId: 'legacy-user' })).resolves.toEqual({ legacy: true });

  process.env.REQUIRE_SERVER_SESSION = 'true';
  await expect(validateSession({ userId: 'legacy-user' })).resolves.toBeNull();
  delete process.env.REQUIRE_SERVER_SESSION;
});

test('tokenFromRequest accepts Authorization first and the secure session cookie second', () => {
  expect(tokenFromRequest(request({
    authorization: 'Bearer bearer-token',
    cookie: `${SESSION_COOKIE}=cookie-token`
  }))).toBe('bearer-token');

  expect(tokenFromRequest(request({
    cookie: `theme=dark; ${SESSION_COOKIE}=cookie%20token`
  }))).toBe('cookie token');

  expect(refreshTokenFromRequest(request({
    cookie: `${SESSION_COOKIE}=access; ${REFRESH_COOKIE}=refresh%20token`
  }))).toBe('refresh token');
});

test('listUserSessions marks only the current device', async () => {
  const sessions = [{
    sessionId: 'session-current',
    userAgent: 'Laptop',
    createdAt: new Date('2026-09-27T08:00:00Z'),
    lastSeenAt: new Date('2026-09-27T08:05:00Z'),
    expiresAt: new Date('2026-10-04T08:00:00Z')
  }];
  const SessionModel = {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(sessions)
      })
    })
  };

  await expect(listUserSessions('user-1', 'session-current', { SessionModel }))
    .resolves.toEqual([expect.objectContaining({
      id: 'session-current',
      current: true,
      device: 'Laptop'
    })]);
});

