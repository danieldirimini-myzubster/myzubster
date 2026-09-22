'use strict';

const PaymentIntent = require('../src/models/PaymentIntent');
const { publicIntent } = require('../src/services/zorgaxUnifiedCheckoutService');

describe('Zorgax payment intent lifecycle', () => {
  test('uses the shared PaymentIntent lifecycle states', () => {
    expect(PaymentIntent.PAYMENT_INTENT_STATES).toEqual(
      expect.arrayContaining([
        'PENDING',
        'AWAITING_PAYMENT',
        'SUBMITTED',
        'CONFIRMED',
        'EXPIRED',
        'FAILED',
        'CANCELLED'
      ])
    );
  });

  test('maps shared lifecycle states to public Zorgax settlement states', () => {
    const base = {
      intentId: 'zorgax_state',
      ownerId: 'owner-1',
      asset: 'BTC',
      amountMinor: 10000,
      expiresAt: new Date(Date.now() + 60000),
      metadata: {
        zorgax: {
          plan: 'pro',
          priceEur: 9.9,
          cryptoAmount: '0.0001'
        }
      }
    };

    expect(publicIntent({ ...base, status: 'AWAITING_PAYMENT' }).settlementStatus).toBe('PENDING');
    expect(publicIntent({ ...base, status: 'SUBMITTED' }).settlementStatus).toBe('PENDING');
    expect(publicIntent({ ...base, status: 'CONFIRMED' }).settlementStatus).toBe('VERIFIED');
    expect(publicIntent({ ...base, status: 'EXPIRED' }).settlementStatus).toBe('EXPIRED');
  });
});
