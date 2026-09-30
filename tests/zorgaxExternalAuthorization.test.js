'use strict';

const {
  DATA_CLASSES,
  EGRESS,
  evaluateEgress
} = require('../src/services/zorgaxPrivacyPolicyService');

describe('Zorgax external processing authorization', () => {
  test('PUBLIC alone is not sufficient for external egress', () => {
    const decision = evaluateEgress({
      content: 'Documentazione pubblica di Node.js',
      declaredClassification: DATA_CLASSES.PUBLIC,
      destination: EGRESS.WEB_SEARCH
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('external_processing_not_authorized');
  });

  test('PUBLIC plus trusted external authorization permits web search', () => {
    const decision = evaluateEgress({
      content: 'Documentazione pubblica di Node.js',
      declaredClassification: DATA_CLASSES.PUBLIC,
      destination: EGRESS.WEB_SEARCH,
      externalProcessingAllowed: true
    });

    expect(decision.allowed).toBe(true);
  });

  test('PII remains blocked even with external authorization', () => {
    const decision = evaluateEgress({
      content: 'Cerca mario.rossi@example.com',
      declaredClassification: DATA_CLASSES.PUBLIC,
      destination: EGRESS.WEB_SEARCH,
      externalProcessingAllowed: true
    });

    expect(decision.classification).toBe(DATA_CLASSES.PII);
    expect(decision.allowed).toBe(false);
  });

  test('secret remains blocked even with external authorization', () => {
    const decision = evaluateEgress({
      content: 'password=super-secret-value',
      declaredClassification: DATA_CLASSES.PUBLIC,
      destination: EGRESS.WEB_SEARCH,
      externalProcessingAllowed: true
    });

    expect(decision.classification).toBe(DATA_CLASSES.CONFIDENTIAL);
    expect(decision.allowed).toBe(false);
  });

  test('LOCAL_ONLY may still use loopback Ollama without external authorization', () => {
    const decision = evaluateEgress({
      content: 'internal project notes',
      declaredClassification: DATA_CLASSES.INTERNAL,
      destination: EGRESS.LOCAL_OLLAMA
    });

    expect(decision.allowed).toBe(true);
  });
});
