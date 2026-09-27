'use strict';

const jwt = require('jsonwebtoken');
const {
  requestId,
  clearSessionCookie,
  listUserSessions,
  revokeUserSession,
  tokenFromRequest
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
      return error(res, req, 404, 'SESSION_NOT_FOUND', 'Sessione non trovata o già revocata');
    }
    if (sessionId === req.authSessionId) clearSessionCookie(res);
    return success(res, req, { revoked_session_id: sessionId });
  } catch (_error) {
    return error(res, req, 500, 'SESSION_REVOKE_FAILED', 'Impossibile revocare la sessione');
  }
};

exports.logout = async (req, res) => {
  const token = tokenFromRequest(req);
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
    }
    clearSessionCookie(res);
    return success(res, req, { logged_out: true });
  } catch (_error) {
    clearSessionCookie(res);
    return error(res, req, 500, 'LOGOUT_FAILED', 'Logout non completato');
  }
};
