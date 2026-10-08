'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax payment intent lifecycle', () => {
  test('uses the shared PaymentIntent lifecycle states', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/models/PaymentIntent.js'), 'utf8');
    for (const state of ['PENDING', 'AWAITING_PAYMENT', 'SUBMITTED', 'CONFIRMED', 'EXPIRED']) {
      expect(source).toContain(`'${state}'`);
    }
  });
});
