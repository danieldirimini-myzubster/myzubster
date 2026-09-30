'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_AUDIT_PATH = '/var/log/myzubster/zorgax-privacy-audit.jsonl';

function getAuditPath() {
  return String(
    process.env.ZORGAX_PRIVACY_AUDIT_PATH || DEFAULT_AUDIT_PATH
  ).trim();
}

function sanitizeAuditEvent(event = {}) {
  return {
    schema: String(event.schema || 'zorgax-privacy-audit-v1'),
    timestamp: String(event.timestamp || new Date().toISOString()),
    purpose: String(event.purpose || 'zorgax-ai-processing'),
    contentDigest: String(event.contentDigest || ''),
    contentLength: Number(event.contentLength || 0),
    classification: String(event.classification || ''),
    processingMode: String(event.processingMode || ''),
    destination: String(event.destination || ''),
    allowed: Boolean(event.allowed),
    reason: String(event.reason || ''),
    sensitiveTypes: Array.isArray(event.sensitiveTypes)
      ? event.sensitiveTypes.map(String)
      : []
  };
}

function assertNoRawContent(event = {}) {
  const forbidden = [
    'content',
    'message',
    'prompt',
    'history',
    'raw',
    'text',
    'email',
    'token',
    'password',
    'secret'
  ];

  const keys = Object.keys(event).map(key => key.toLowerCase());

  for (const key of forbidden) {
    if (keys.includes(key)) {
      throw new Error(`Privacy audit refuses raw field: ${key}`);
    }
  }
}

function appendPrivacyAudit(event, options = {}) {
  assertNoRawContent(event);

  const sanitized = sanitizeAuditEvent(event);
  const auditPath = String(options.path || getAuditPath()).trim();

  if (!auditPath) {
    throw new Error('Privacy audit path missing');
  }

  const directory = path.dirname(auditPath);

  fs.mkdirSync(directory, {
    recursive: true,
    mode: 0o700
  });

  fs.appendFileSync(
    auditPath,
    `${JSON.stringify(sanitized)}\n`,
    {
      encoding: 'utf8',
      mode: 0o600
    }
  );

  fs.chmodSync(auditPath, 0o600);

  return sanitized;
}

module.exports = {
  DEFAULT_AUDIT_PATH,
  getAuditPath,
  sanitizeAuditEvent,
  assertNoRawContent,
  appendPrivacyAudit
};
