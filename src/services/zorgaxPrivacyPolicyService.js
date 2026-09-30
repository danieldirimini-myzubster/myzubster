'use strict';

const crypto = require('crypto');

const DATA_CLASSES = Object.freeze({
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
  CONFIDENTIAL: 'CONFIDENTIAL',
  PII: 'PII'
});

const PROCESSING_MODES = Object.freeze({
  EXTERNAL_ALLOWED: 'EXTERNAL_ALLOWED',
  LOCAL_ONLY: 'LOCAL_ONLY',
  DENY: 'DENY'
});

const EGRESS = Object.freeze({
  OPENAI: 'openai',
  PUBLIC_AI_GATEWAY: 'public-ai-gateway',
  WEB_SEARCH: 'web-search',
  LOCAL_OLLAMA: 'local-ollama'
});

const EXTERNAL_EGRESS = new Set([
  EGRESS.OPENAI,
  EGRESS.PUBLIC_AI_GATEWAY,
  EGRESS.WEB_SEARCH
]);

const PII_PATTERNS = Object.freeze([
  {
    type: 'email',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  },
  {
    type: 'ipv4',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/
  },
  {
    type: 'italian_fiscal_code',
    pattern: /\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/i
  },
  {
    type: 'iban',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/i
  },
  {
    type: 'payment_card_candidate',
    pattern: /\b(?:\d[ -]*?){13,19}\b/
  }
]);

const SECRET_PATTERNS = Object.freeze([
  {
    type: 'private_key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i
  },
  {
    type: 'bearer_token',
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i
  },
  {
    type: 'api_key_assignment',
    pattern: /\b(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*["']?[^\s"',;]{8,}/i
  }
]);

function normalizeText(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).join('\n');
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }

  return String(value || '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(normalizeText(value)).digest('hex');
}

function minimizeForExternalProcessing(value, { maxChars = 6000 } = {}) {
  const original = normalizeText(value);
  const originalLength = original.length;
  const redactions = new Set();

  /*
   * Defense in depth only.
   * This function does NOT downgrade PII/CONFIDENTIAL data to PUBLIC and
   * does NOT replace evaluateEgress(). Sensitive-data detection remains
   * authoritative for whether external processing is allowed.
   */
  let text = original;

  text = text.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    () => {
      redactions.add('email');
      return '[REDACTED_EMAIL]';
    }
  );

  text = text.replace(
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
    () => {
      redactions.add('bearer_token');
      return '[REDACTED_SECRET]';
    }
  );

  text = text.replace(
    /\b(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*["']?[^\s"',;]{8,}/gi,
    () => {
      redactions.add('secret_assignment');
      return '[REDACTED_SECRET]';
    }
  );

  text = text.replace(
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
    () => {
      redactions.add('private_key');
      return '[REDACTED_PRIVATE_KEY]';
    }
  );

  text = text.replace(/\s+/g, ' ').trim();

  const safeMaxChars = Math.max(
    1,
    Math.min(Number(maxChars) || 6000, 24000)
  );

  if (text.length > safeMaxChars) {
    text = text.slice(0, safeMaxChars);
  }

  return {
    text,
    changed: text !== original,
    originalLength,
    outputLength: text.length,
    redactions: [...redactions]
  };
}

function detectSensitiveData(value) {
  const text = normalizeText(value);
  const findings = [];

  for (const detector of PII_PATTERNS) {
    if (detector.pattern.test(text)) {
      findings.push({
        category: 'PII',
        type: detector.type
      });
    }
  }

  for (const detector of SECRET_PATTERNS) {
    if (detector.pattern.test(text)) {
      findings.push({
        category: 'SECRET',
        type: detector.type
      });
    }
  }

  return {
    containsPii: findings.some(item => item.category === 'PII'),
    containsSecret: findings.some(item => item.category === 'SECRET'),
    findings
  };
}

function normalizeClassification(value) {
  const classification = String(value || '').trim().toUpperCase();

  if (!Object.values(DATA_CLASSES).includes(classification)) {
    return null;
  }

  return classification;
}

function classifyData({ content, declaredClassification } = {}) {
  const declared = normalizeClassification(declaredClassification);
  const detection = detectSensitiveData(content);

  if (detection.containsSecret) {
    return {
      classification: DATA_CLASSES.CONFIDENTIAL,
      detection,
      source: 'automatic-secret-detection'
    };
  }

  if (detection.containsPii) {
    return {
      classification: DATA_CLASSES.PII,
      detection,
      source: 'automatic-pii-detection'
    };
  }

  if (declared) {
    return {
      classification: declared,
      detection,
      source: 'declared'
    };
  }

  /*
   * Fail closed:
   * unclassified enterprise data is not assumed public.
   */
  return {
    classification: DATA_CLASSES.INTERNAL,
    detection,
    source: 'default-internal'
  };
}

function processingModeFor(classification) {
  switch (classification) {
    case DATA_CLASSES.PUBLIC:
      return PROCESSING_MODES.EXTERNAL_ALLOWED;

    case DATA_CLASSES.INTERNAL:
    case DATA_CLASSES.CONFIDENTIAL:
    case DATA_CLASSES.PII:
      return PROCESSING_MODES.LOCAL_ONLY;

    default:
      return PROCESSING_MODES.DENY;
  }
}

function evaluateEgress({
  content,
  declaredClassification,
  destination,
  externalProcessingAllowed = false
} = {}) {
  const classificationResult = classifyData({
    content,
    declaredClassification
  });

  const classification = classificationResult.classification;
  const processingMode = processingModeFor(classification);
  const normalizedDestination = String(destination || '').trim().toLowerCase();

  if (!Object.values(EGRESS).includes(normalizedDestination)) {
    return {
      allowed: false,
      reason: 'unknown_destination',
      classification,
      processingMode,
      destination: normalizedDestination || null,
      detection: classificationResult.detection
    };
  }

  if (processingMode === PROCESSING_MODES.DENY) {
    return {
      allowed: false,
      reason: 'processing_denied',
      classification,
      processingMode,
      destination: normalizedDestination,
      detection: classificationResult.detection
    };
  }

  if (
    processingMode === PROCESSING_MODES.LOCAL_ONLY &&
    EXTERNAL_EGRESS.has(normalizedDestination)
  ) {
    return {
      allowed: false,
      reason: 'external_egress_denied',
      classification,
      processingMode,
      destination: normalizedDestination,
      detection: classificationResult.detection
    };
  }

  if (
    EXTERNAL_EGRESS.has(normalizedDestination) &&
    externalProcessingAllowed !== true
  ) {
    return {
      allowed: false,
      reason: 'external_processing_not_authorized',
      classification,
      processingMode,
      destination: normalizedDestination,
      detection: classificationResult.detection
    };
  }

  return {
    allowed: true,
    reason: normalizedDestination === EGRESS.LOCAL_OLLAMA
      ? 'local_processing_allowed'
      : 'external_processing_allowed',
    classification,
    processingMode,
    destination: normalizedDestination,
    detection: classificationResult.detection
  };
}

function createAuditEvent({
  decision,
  content,
  purpose = 'zorgax-ai-processing'
} = {}) {
  if (!decision || typeof decision.allowed !== 'boolean') {
    throw new Error('Privacy decision required');
  }

  /*
   * Deliberately stores metadata + digest only.
   * Raw content must never be included in the privacy audit event.
   */
  return {
    schema: 'zorgax.privacy-audit.v1',
    timestamp: new Date().toISOString(),
    purpose: String(purpose || 'zorgax-ai-processing').slice(0, 120),
    contentDigest: sha256(content),
    contentLength: Buffer.byteLength(normalizeText(content), 'utf8'),
    classification: decision.classification,
    processingMode: decision.processingMode,
    destination: decision.destination,
    allowed: decision.allowed,
    reason: decision.reason,
    sensitiveTypes: (decision.detection?.findings || []).map(item => item.type)
  };
}

module.exports = {
  DATA_CLASSES,
  PROCESSING_MODES,
  EGRESS,
  EXTERNAL_EGRESS,
  detectSensitiveData,
  classifyData,
  processingModeFor,
  evaluateEgress,
  minimizeForExternalProcessing,
  createAuditEvent,
  sha256
};
