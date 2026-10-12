'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax payment intent lifecycle', () => {
  test('defines the canonical shared payment-intent lifecycle', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/models/PaymentIntent.js'), 'utf8');
    for (const state of ['PENDING', 'AWAITING_PAYMENT', 'SUBMITTED', 'CONFIRMED', 'EXPIRED', 'FAILED', 'CANCELLED']) {
      expect(source).toContain(`'${state}'`);
    }
  });
});
