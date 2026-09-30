'use strict';

const {
  minimizeForExternalProcessing
} = require('../src/services/zorgaxPrivacyPolicyService');

describe('Zorgax external processing minimization', () => {
  test('normalizes and trims externally permitted text', () => {
    const result = minimizeForExternalProcessing(
      '   Public   documentation   about   Node.js   '
    );

    expect(result.text).toBe('Public documentation about Node.js');
    expect(result.changed).toBe(true);
  });

  test('enforces a bounded external payload length', () => {
    const result = minimizeForExternalProcessing('A'.repeat(20000), {
      maxChars: 4000
    });

    expect(result.text.length).toBeLessThanOrEqual(4000);
    expect(result.changed).toBe(true);
    expect(result.originalLength).toBe(20000);
    expect(result.outputLength).toBe(result.text.length);
  });

  test('redacts email addresses defensively', () => {
    const result = minimizeForExternalProcessing(
      'Public note contact mario.rossi@example.com for details'
    );

    expect(result.text).not.toContain('mario.rossi@example.com');
    expect(result.text).toContain('[REDACTED_EMAIL]');
    expect(result.redactions).toContain('email');
  });

  test('redacts secret assignments defensively', () => {
    const result = minimizeForExternalProcessing(
      'Public example api_key=super-secret-value-123456'
    );

    expect(result.text).not.toContain('super-secret-value-123456');
    expect(result.text).toContain('[REDACTED_SECRET]');
    expect(result.redactions).toContain('secret_assignment');
  });

  test('does not mutate the input value', () => {
    const input = 'Public documentation';
    const result = minimizeForExternalProcessing(input);

    expect(input).toBe('Public documentation');
    expect(result.text).toBe('Public documentation');
    expect(result.changed).toBe(false);
  });
});
