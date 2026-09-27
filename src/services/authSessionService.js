'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AuthSession = require('../models/AuthSession');

const SESSION_COOKIE = 'myzubster_session';
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_TTL_SECONDS = 30 * 24 * 60 * 60;

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET non configurato');
  return process.env.JWT_SECRET;
}

function ttlSeconds() {
  const configured = Number(process.env.AUTH_SESSION_TTL_SECONDS);
  if (!Number.isFinite(configured) || configured < 300) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.floor(configured), MAX_TTL_SECONDS);
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
    maxAge: ttlSeconds() * 1000
  };
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    sameSite: 'lax',
    path: '/'
  });
}

function cookieToken(req) {
  const header = String(req.headers?.cookie || '');
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function tokenFromRequest(req) {
  const authHeader = String(req.headers?.authorization || '');
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return cookieToken(req);
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
  const token = jwt.sign({
    userId: String(user._id),
    username: user.username,
    role: user.role,
    sid: sessionId
  }, jwtSecret(), {
    expiresIn: seconds,
    jwtid: crypto.randomUUID()
  });

  await SessionModel.create({
    sessionId,
    userId: user._id,
    userAgent: String(req?.get?.('user-agent') || 'Unknown device').slice(0, 500),
    ipHash: req ? hashIp(req) : null,
    expiresAt
  });

  return { token, sessionId, expiresAt };
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
  requestId,
  ttlSeconds,
  sessionCookieOptions,
  setSessionCookie,
  clearSessionCookie,
  tokenFromRequest,
  issueSession,
  validateSession,
  listUserSessions,
  revokeUserSession
};
