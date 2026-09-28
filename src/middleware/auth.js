const jwt = require('jsonwebtoken');
const {
  requestId,
  tokenCredentialFromRequest,
  validateSession
} = require('../services/authSessionService');
const {
  isTrustedMutationRequest,
  rejectCsrf
} = require('./csrf');

function authError(req, res, code, message) {
  return res.status(401).json({
    success: false,
    request_id: requestId(req),
    error: { code, message }
  });
}

exports.authenticate = async (req, res, next) => {
  try {
    const credentials = tokenCredentialFromRequest(req);
    const token = credentials.token;
    if (!token) {
      return authError(
        req,
        res,
        'AUTH_TOKEN_MISSING',
        'Token di autenticazione mancante o non valido'
      );
    }

    if (credentials.source === 'cookie' && !isTrustedMutationRequest(req)) {
      return rejectCsrf(req, res);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await validateSession(decoded);
    if (!session) {
      return authError(
        req,
        res,
        'AUTH_SESSION_REVOKED',
        'Sessione scaduta o revocata'
      );
    }

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.username = decoded.username;
    req.authSessionId = decoded.sid || null;
    req.authSession = session;
    req.authTokenSource = credentials.source;

    return next();
  } catch (error) {
    console.warn('[auth] rejected token', {
      requestId: requestId(req),
      reason: error?.name || 'TokenError'
    });
    return authError(
      req,
      res,
      error?.name === 'TokenExpiredError' ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID',
      'Token non valido o scaduto'
    );
  }
};

// Anonymous requests remain guests. If a caller supplies a token, validate it
// exactly like a protected route so an invalid token never downgrades silently.
exports.optionalAuthenticate = async (req, res, next) => {
  if (!tokenCredentialFromRequest(req).token) return next();
  return exports.authenticate(req, res, next);
};

// Middleware per verificare il ruolo admin
exports.isAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Permessi insufficienti. Richiesto ruolo admin.'
    });
  }
  next();
};


