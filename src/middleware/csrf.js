'use strict';

const { requestId } = require('../services/authSessionService');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeOrigin(value) {
  try {
    return new URL(String(value || '')).origin;
  } catch (_error) {
    return '';
  }
}

function configuredOrigins() {
  const values = [
    process.env.AUTH_TRUSTED_ORIGINS,
    process.env.FRONTEND_URL,
    process.env.PUBLIC_APP_URL,
    process.env.GATEWAY_PUBLIC_URL
  ];
  const origins = new Set();
  for (const value of values) {
    for (const item of String(value || '').split(',')) {
      const origin = normalizeOrigin(item.trim());
      if (origin) origins.add(origin);
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }
  return origins;
}

function targetOrigin(req) {
  const host = String(req.get?.('host') || req.headers?.host || '').trim();
  if (!host) return '';
  const forwarded = String(req.get?.('x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwarded || req.protocol || 'http';
  return normalizeOrigin(`${protocol}://${host}`);
}

function suppliedOrigin(req) {
  const origin = normalizeOrigin(req.get?.('origin') || req.headers?.origin);
  if (origin) return origin;
  return normalizeOrigin(req.get?.('referer') || req.headers?.referer);
}

function isTrustedMutationRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (SAFE_METHODS.has(method)) return true;

  const fetchSite = String(req.get?.('sec-fetch-site') || req.headers?.['sec-fetch-site'] || '')
    .trim()
    .toLowerCase();
  if (fetchSite === 'cross-site') return false;

  const origin = suppliedOrigin(req);
  if (origin) {
    const trusted = configuredOrigins();
    const target = targetOrigin(req);
    if (target) trusted.add(target);
    return trusted.has(origin);
  }

  // Browser mutation requests normally include Origin and Fetch Metadata.
  // Requests with neither are retained for CLI/server clients during the
  // bearer-token migration; they do not gain access to HttpOnly cookies.
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
}

function rejectCsrf(req, res) {
  return res.status(403).json({
    success: false,
    request_id: requestId(req),
    error: {
      code: 'AUTH_CSRF_REJECTED',
      message: 'Origine della richiesta non autorizzata'
    }
  });
}

function requireTrustedOrigin(req, res, next) {
  if (isTrustedMutationRequest(req)) return next();
  return rejectCsrf(req, res);
}

module.exports = {
  SAFE_METHODS,
  normalizeOrigin,
  configuredOrigins,
  targetOrigin,
  suppliedOrigin,
  isTrustedMutationRequest,
  rejectCsrf,
  requireTrustedOrigin
};

