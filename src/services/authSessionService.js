'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AuthSession = require('../models/AuthSession');

const SESSION_COOKIE = 'myzubster_session';
const REFRESH_COOKIE = 'myzubster_refresh';
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_USED_REFRESH_TOKENS = 50;

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET non configurato');
  return process.env.JWT_SECRET;
}

function ttlSeconds() {
  const configured = Number(process.env.AUTH_SESSION_TTL_SECONDS);
  if (!Number.isFinite(configured) || configured < 300) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.floor(configured), MAX_TTL_SECONDS);
}

function accessTokenTtlSeconds() {
  const configured = Number(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS);
  if (!Number.isFinite(configured) || configured < 60) return ttlSeconds();
  return Math.min(Math.floor(configured), ttlSeconds());
}

function requestId(req) {
  if (req.requestId) return req.requestId;
  const supplied = String(req.get?.('x-request-id') || '').trim();
  req.requestId = /^[a-zA-Z0-9._:-]{8,120}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
  return req.requestId;
}

function requestIp(req) {
  const forwarded = String(req.get?.('x-forwarded-for') || '')
    .split(',')[0]
    .trim();
  return forwarded || req.socket?.remoteAddress || '';
}

function hashIp(req) {
  const value = requestIp(req);
  if (!value) return null;
  const salt = process.env.SESSION_IP_HASH_SECRET || jwtSecret();
  return crypto.createHmac('sha256', salt).update(value).digest('hex');
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    sameSite: 'lax',
    path: '/',
    maxAge: accessTokenTtlSeconds() * 1000
  };
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: ttlSeconds() * 1000
  };
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function setSessionCookies(res, session) {
  setSessionCookie(res, session.token);
  if (session.refreshToken) setRefreshCookie(res, session.refreshToken);
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    sameSite: 'lax',
    path: '/'
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    sameSite: 'lax',
    path: '/api/auth'
  });
}

function clearSessionCookies(res) {
  clearSessionCookie(res);
  clearRefreshCookie(res);
}

function cookieToken(req) {
  const header = String(req.headers?.cookie || '');
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function namedCookie(req, cookieName) {
  const header = String(req.headers?.cookie || '');
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === cookieName) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function refreshTokenFromRequest(req) {
  return namedCookie(req, REFRESH_COOKIE);
}

function tokenFromRequest(req) {
  const authHeader = String(req.headers?.authorization || '');
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return cookieToken(req);
}

function refreshTokenSecret() {
  return process.env.REFRESH_TOKEN_HASH_SECRET || jwtSecret();
}

function hashRefreshToken(token) {
  return crypto.createHmac('sha256', refreshTokenSecret()).update(token).digest('hex');
}

function newRefreshToken(sessionId) {
  return `myzr.${sessionId}.${crypto.randomBytes(32).toString('base64url')}`;
}

function refreshSessionId(token) {
  const match = /^myzr\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,})$/i.exec(String(token || ''));
  return match ? match[1] : null;
}

function issueAccessToken(user, sessionId) {
  return jwt.sign({
    userId: String(user._id),
    username: user.username,
    role: user.role,
    sid: sessionId
  }, jwtSecret(), {
    expiresIn: accessTokenTtlSeconds(),
    jwtid: crypto.randomUUID()
  });
}

class RefreshTokenError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RefreshTokenError';
    this.code = code;
  }
}

function publicSession(session, currentSessionId) {
  return {
    id: session.sessionId,
    current: session.sessionId === currentSessionId,
    device: session.userAgent || 'Unknown device',
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt
  };
}

async function issueSession(user, req, { SessionModel = AuthSession } = {}) {
  const sessionId = crypto.randomUUID();
  const seconds = ttlSeconds();
  const expiresAt = new Date(Date.now() + seconds * 1000);
  const token = issueAccessToken(user, sessionId);
  const refreshToken = newRefreshToken(sessionId);

  await SessionModel.create({
    sessionId,
    userId: user._id,
    userAgent: String(req?.get?.('user-agent') || 'Unknown device').slice(0, 500),
    ipHash: req ? hashIp(req) : null,
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshTokenVersion: 0,
    expiresAt
  });

  return { token, refreshToken, sessionId, expiresAt };
}

async function rotateRefreshToken(refreshToken, { SessionModel = AuthSession } = {}) {
  const sessionId = refreshSessionId(refreshToken);
  if (!sessionId) {
    throw new RefreshTokenError('AUTH_REFRESH_INVALID', 'Refresh token non valido');
  }

  const now = new Date();
  const presentedHash = hashRefreshToken(refreshToken);
  const nextRefreshToken = newRefreshToken(sessionId);
  const nextHash = hashRefreshToken(nextRefreshToken);
  const session = await SessionModel.findOneAndUpdate(
    {
      sessionId,
      refreshTokenHash: presentedHash,
      revokedAt: null,
      expiresAt: { $gt: now }
    },
    {
      $set: {
        refreshTokenHash: nextHash,
        refreshRotatedAt: now,
        lastSeenAt: now
      },
      $inc: { refreshTokenVersion: 1 },
      $push: {
        usedRefreshTokenHashes: {
          $each: [presentedHash],
          $slice: -MAX_USED_REFRESH_TOKENS
        }
      }
    },
    { new: true }
  );

  if (session) return { session, refreshToken: nextRefreshToken };

  const replayQuery = SessionModel.findOne({
    sessionId,
    revokedAt: null,
    expiresAt: { $gt: now },
    usedRefreshTokenHashes: presentedHash
  });
  const replaySession = typeof replayQuery?.lean === 'function'
    ? await replayQuery.lean()
    : await replayQuery;

  if (replaySession) {
    await SessionModel.updateOne(
      { sessionId, revokedAt: null },
      { $set: { revokedAt: now, revokedReason: 'refresh-token-replay' } }
    );
    throw new RefreshTokenError(
      'AUTH_REFRESH_REPLAY',
      'Refresh token gi� utilizzato; sessione revocata'
    );
  }

  throw new RefreshTokenError('AUTH_REFRESH_INVALID', 'Refresh token non valido o scaduto');
}

async function revokeRefreshSession(refreshToken, reason = 'logout', { SessionModel = AuthSession } = {}) {
  const sessionId = refreshSessionId(refreshToken);
  if (!sessionId) return null;
  const tokenHash = hashRefreshToken(refreshToken);
  return SessionModel.findOneAndUpdate(
    {
      sessionId,
      revokedAt: null,
      $or: [
        { refreshTokenHash: tokenHash },
        { usedRefreshTokenHashes: tokenHash }
      ]
    },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
    { new: true }
  );
}

async function validateSession(decoded, { SessionModel = AuthSession } = {}) {
  if (!decoded?.sid) {
    return process.env.REQUIRE_SERVER_SESSION === 'true'
      ? null
      : { legacy: true };
  }

  const query = SessionModel.findOne({
    sessionId: decoded.sid,
    userId: decoded.userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  });
  const session = typeof query?.lean === 'function' ? await query.lean() : await query;
  if (!session) return null;

  const lastSeen = new Date(session.lastSeenAt || 0).getTime();
  if (Date.now() - lastSeen > 5 * 60 * 1000 && typeof SessionModel.updateOne === 'function') {
    await SessionModel.updateOne(
      { sessionId: decoded.sid, revokedAt: null },
      { $set: { lastSeenAt: new Date() } }
    );
  }

  return session;
}

async function listUserSessions(userId, currentSessionId, { SessionModel = AuthSession } = {}) {
  const query = SessionModel.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  });
  const sorted = typeof query?.sort === 'function' ? query.sort({ lastSeenAt: -1 }) : query;
  const sessions = typeof sorted?.lean === 'function' ? await sorted.lean() : await sorted;
  return (sessions || []).map(session => publicSession(session, currentSessionId));
}

async function revokeUserSession(userId, sessionId, reason = 'user-revoked', { SessionModel = AuthSession } = {}) {
  return SessionModel.findOneAndUpdate(
    { userId, sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
    { new: true }
  );
}

module.exports = {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  requestId,
  ttlSeconds,
  accessTokenTtlSeconds,
  sessionCookieOptions,
  refreshCookieOptions,
  setSessionCookie,
  setRefreshCookie,
  setSessionCookies,
  clearSessionCookie,
  clearRefreshCookie,
  clearSessionCookies,
  tokenFromRequest,
  refreshTokenFromRequest,
  hashRefreshToken,
  refreshSessionId,
  issueAccessToken,
  issueSession,
  rotateRefreshToken,
  revokeRefreshSession,
  validateSession,
  listUserSessions,
  revokeUserSession,
  RefreshTokenError
};

