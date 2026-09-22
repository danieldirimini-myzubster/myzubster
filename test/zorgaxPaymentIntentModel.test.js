'use strict';

const ZorgaxPaymentIntent = require('../src/models/ZorgaxPaymentIntent');
const PaymentIntent = require('../src/models/PaymentIntent');

describe('ZorgaxPaymentIntent compatibility model', () => {
  test('is an alias of the shared PaymentIntent model', () => {
    expect(ZorgaxPaymentIntent).toBe(PaymentIntent);
  });

  test('requires the shared server-side payment coordinates', () => {
    const validation = new ZorgaxPaymentIntent({
      intentId: 'zorgax_test',
      ownerId: 'owner-1'
    }).validateSync();

    expect(validation).toBeDefined();

    expect(validation.errors.purpose).toBeDefined();
    expect(validation.errors.asset).toBeDefined();
    expect(validation.errors.network).toBeDefined();
    expect(validation.errors.amountMinor).toBeDefined();
    expect(validation.errors.paymentReference).toBeDefined();
    expect(validation.errors.expiresAt).toBeDefined();

    expect(validation.errors.plan).toBeUndefined();
    expect(validation.errors.destination).toBeUndefined();
  });
});
