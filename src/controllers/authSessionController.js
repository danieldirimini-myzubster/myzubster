'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  requestId,
  clearSessionCookies,
  setSessionCookies,
  listUserSessions,
  revokeUserSession,
  tokenFromRequest,
  refreshTokenFromRequest,
  issueAccessToken,
  rotateRefreshToken,
  revokeRefreshSession
} = require('../services/authSessionService');

function success(res, req, data = {}) {
  return res.json({ success: true, request_id: requestId(req), ...data });
}

function error(res, req, status, code, message) {
  return res.status(status).json({
    success: false,
    request_id: requestId(req),
    error: { code, message }
  });
}

exports.getSessions = async (req, res) => {
  try {
    const sessions = await listUserSessions(req.userId, req.authSessionId);
    return success(res, req, { sessions });
  } catch (_error) {
    return error(res, req, 500, 'SESSION_LIST_FAILED', 'Impossibile leggere le sessioni attive');
  }
};

exports.revokeSession = async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    const revoked = await revokeUserSession(req.userId, sessionId);
    if (!revoked) {
      return error(res, req, 404, 'SESSION_NOT_FOUND', 'Sessione non trovata o gi� revocata');
    }
    if (sessionId === req.authSessionId) clearSessionCookies(res);
    return success(res, req, { revoked_session_id: sessionId });
  } catch (_error) {
    return error(res, req, 500, 'SESSION_REVOKE_FAILED', 'Impossibile revocare la sessione');
  }
};

exports.logout = async (req, res) => {
  const token = tokenFromRequest(req);
  const refreshToken = refreshTokenFromRequest(req);
  let decoded = null;

  if (token) {
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_error) {
      // Logout is intentionally idempotent: an expired, malformed or already
      // revoked browser session must still be able to clear its HttpOnly cookie.
    }
  }

  try {
    if (decoded?.userId && decoded?.sid) {
      await revokeUserSession(decoded.userId, decoded.sid, 'logout');
    } else if (refreshToken) {
      await revokeRefreshSession(refreshToken, 'logout');
    }
    clearSessionCookies(res);
    return success(res, req, { logged_out: true });
  } catch (_error) {
    clearSessionCookies(res);
    return error(res, req, 500, 'LOGOUT_FAILED', 'Logout non completato');
  }
};

exports.refresh = async (req, res) => {
  const refreshToken = refreshTokenFromRequest(req);
  if (!refreshToken) {
    return error(res, req, 401, 'AUTH_REFRESH_MISSING', 'Refresh token mancante');
  }

  try {
    const rotated = await rotateRefreshToken(refreshToken);
    const user = await User.findById(rotated.session.userId).select('username role');
    if (!user) {
      await revokeUserSession(rotated.session.userId, rotated.session.sessionId, 'user-not-found');
      clearSessionCookies(res);
      return error(res, req, 401, 'AUTH_REFRESH_INVALID', 'Sessione non valida');
    }

    const session = {
      token: issueAccessToken(user, rotated.session.sessionId),
      refreshToken: rotated.refreshToken,
      sessionId: rotated.session.sessionId,
      expiresAt: rotated.session.expiresAt
    };
    setSessionCookies(res, session);
    return success(res, req, {
      data: {
        token: session.token,
        session: {
          id: session.sessionId,
          expiresAt: session.expiresAt
        }
      }
    });
  } catch (refreshError) {
    const replay = refreshError?.code === 'AUTH_REFRESH_REPLAY';
    if (replay || refreshError?.code === 'AUTH_REFRESH_INVALID') clearSessionCookies(res);
    if (refreshError?.code) {
      return error(res, req, 401, refreshError.code, refreshError.message);
    }
    return error(res, req, 500, 'AUTH_REFRESH_FAILED', 'Sessione non rinnovata');
  }
};

