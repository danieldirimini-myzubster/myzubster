'use strict';

const {
  DATA_CLASSES,
  PROCESSING_MODES,
  EGRESS,
  detectSensitiveData,
  classifyData,
  evaluateEgress,
  createAuditEvent
} = require('../src/services/zorgaxPrivacyPolicyService');

describe('Zorgax Enterprise Privacy Policy', () => {
  test('unclassified content fails closed to INTERNAL / LOCAL_ONLY', () => {
    const result = classifyData({
      content: 'Quarterly engineering notes'
    });

    expect(result.classification).toBe(DATA_CLASSES.INTERNAL);
    expect(result.source).toBe('default-internal');

    const decision = evaluateEgress({
      content: 'Quarterly engineering notes',
      destination: EGRESS.OPENAI
    });

    expect(decision.allowed).toBe(false);
    expect(decision.processingMode).toBe(PROCESSING_MODES.LOCAL_ONLY);
    expect(decision.reason).toBe('external_egress_denied');
  });

  test('explicit PUBLIC content requires trusted external authorization', () => {
    const denied = evaluateEgress({
      content: 'Public documentation about MyZubster',
      declaredClassification: DATA_CLASSES.PUBLIC,
      destination: EGRESS.OPENAI
    });

    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('external_processing_not_authorized');
    expect(denied.processingMode).toBe(PROCESSING_MODES.EXTERNAL_ALLOWED);

    const allowed = evaluateEgress({
      content: 'Public documentation about MyZubster',
      declaredClassification: DATA_CLASSES.PUBLIC,
      destination: EGRESS.OPENAI,
      externalProcessingAllowed: true
    });

    expect(allowed.allowed).toBe(true);
    expect(allowed.reason).toBe('external_processing_allowed');
    expect(allowed.processingMode).toBe(PROCESSING_MODES.EXTERNAL_ALLOWED);
  });

  test('PII overrides a declared PUBLIC classification', () => {
    const decision = evaluateEgress({
      content: 'Contact mario.rossi@example.com about the project',
      declaredClassification: DATA_CLASSES.PUBLIC,
      destination: EGRESS.OPENAI
    });

    expect(decision.allowed).toBe(false);
    expect(decision.classification).toBe(DATA_CLASSES.PII);
    expect(decision.reason).toBe('external_egress_denied');
  });

  test('Italian fiscal code is treated as PII', () => {
    const detection = detectSensitiveData(
      'Codice fiscale RSSMRA80A01H501U'
    );

    expect(detection.containsPii).toBe(true);
    expect(detection.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'italian_fiscal_code' })
      ])
    );
  });

  test('secrets force CONFIDENTIAL even when declared PUBLIC', () => {
    const decision = evaluateEgress({
      content: 'api_key=super-secret-value-123456',
      declaredClassification: DATA_CLASSES.PUBLIC,
      destination: EGRESS.PUBLIC_AI_GATEWAY
    });

    expect(decision.allowed).toBe(false);
    expect(decision.classification).toBe(DATA_CLASSES.CONFIDENTIAL);
  });

  test('LOCAL_ONLY data may be processed by explicitly local Ollama', () => {
    const decision = evaluateEgress({
      content: 'Internal company architecture',
      declaredClassification: DATA_CLASSES.CONFIDENTIAL,
      destination: EGRESS.LOCAL_OLLAMA
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('local_processing_allowed');
  });

  test('LOCAL_ONLY data cannot be sent to web search', () => {
    const decision = evaluateEgress({
      content: 'Internal acquisition plan',
      declaredClassification: DATA_CLASSES.INTERNAL,
      destination: EGRESS.WEB_SEARCH
    });

    expect(decision.allowed).toBe(false);
  });

  test('unknown destinations fail closed', () => {
    const decision = evaluateEgress({
      content: 'Public information',
      declaredClassification: DATA_CLASSES.PUBLIC,
      destination: 'unknown-provider'
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('unknown_destination');
  });

  test('privacy audit contains digest but not raw sensitive content', () => {
    const content = 'mario.rossi@example.com';
    const decision = evaluateEgress({
      content,
      destination: EGRESS.OPENAI
    });

    const event = createAuditEvent({
      decision,
      content
    });

    expect(event.schema).toBe('zorgax.privacy-audit.v1');
    expect(event.allowed).toBe(false);
    expect(event.classification).toBe(DATA_CLASSES.PII);
    expect(event.contentDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(event)).not.toContain(content);
  });
});
