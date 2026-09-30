'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  sanitizeAuditEvent,
  assertNoRawContent,
  appendPrivacyAudit
} = require('../src/services/zorgaxPrivacyAuditService');

describe('Zorgax privacy audit service', () => {
  let dir;
  let auditPath;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'zorgax-privacy-audit-')
    );
    auditPath = path.join(dir, 'audit.jsonl');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('keeps only the privacy metadata allowlist', () => {
    const result = sanitizeAuditEvent({
      schema: 'zorgax-privacy-v1',
      timestamp: '2026-09-30T00:00:00.000Z',
      purpose: 'assistant',
      contentDigest: 'abc123',
      contentLength: 42,
      classification: 'PII',
      processingMode: 'LOCAL_ONLY',
      destination: 'local-ollama',
      allowed: true,
      reason: 'local_only',
      sensitiveTypes: ['email'],
      unexpected: 'must disappear'
    });

    expect(result).not.toHaveProperty('unexpected');
    expect(result).not.toHaveProperty('content');
    expect(result).not.toHaveProperty('prompt');
    expect(result).not.toHaveProperty('history');
  });

  test('explicitly refuses raw-content fields', () => {
    expect(() =>
      assertNoRawContent({
        contentDigest: 'abc',
        prompt: 'private.person@example.com'
      })
    ).toThrow(/refuses raw field/i);

    expect(() =>
      assertNoRawContent({
        contentDigest: 'abc',
        history: [{ content: 'secret' }]
      })
    ).toThrow(/refuses raw field/i);
  });

  test('persists one JSONL event without sensitive raw content', () => {
    const rawSensitive = 'private.person@example.com';

    appendPrivacyAudit(
      {
        schema: 'zorgax-privacy-v1',
        timestamp: '2026-09-30T00:00:00.000Z',
        purpose: 'assistant',
        contentDigest: 'deadbeef',
        contentLength: rawSensitive.length,
        classification: 'PII',
        processingMode: 'LOCAL_ONLY',
        destination: 'local-ollama',
        allowed: true,
        reason: 'privacy_local_only',
        sensitiveTypes: ['email']
      },
      { path: auditPath }
    );

    const stored = fs.readFileSync(auditPath, 'utf8');

    expect(stored).toContain('"contentDigest":"deadbeef"');
    expect(stored).toContain('"classification":"PII"');
    expect(stored).not.toContain(rawSensitive);
    expect(stored).not.toContain('"prompt"');
    expect(stored).not.toContain('"history"');

    const mode = fs.statSync(auditPath).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  test('appends rather than overwriting previous decisions', () => {
    const event = {
      contentDigest: 'abc',
      contentLength: 3,
      classification: 'INTERNAL',
      processingMode: 'LOCAL_ONLY',
      destination: 'local-ollama',
      allowed: true,
      reason: 'local_only',
      sensitiveTypes: []
    };

    appendPrivacyAudit(event, { path: auditPath });
    appendPrivacyAudit(
      { ...event, contentDigest: 'def' },
      { path: auditPath }
    );

    const lines = fs
      .readFileSync(auditPath, 'utf8')
      .trim()
      .split('\n');

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).contentDigest).toBe('abc');
    expect(JSON.parse(lines[1]).contentDigest).toBe('def');
  });
});
