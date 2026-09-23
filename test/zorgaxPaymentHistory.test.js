'use strict';

jest.mock('../src/models/PaymentIntent', () => ({
  find: jest.fn()
}));

const PaymentIntent = require('../src/models/PaymentIntent');
const { listPaymentIntents } = require('../src/services/zorgaxLegacyMonetizationService');

describe('Zorgax payment history', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns only owner-scoped public payment details and tracking state', async () => {
    const row = {
      intentId: 'zorgax_history',
      ownerId: 'owner-1',
      purpose: 'zorgax:zorgax-pro',
      asset: 'BTC',
      amountMinor: 14728,
      status: 'SUBMITTED',
      txId: 'e'.repeat(64),
      submittedAt: new Date('2026-09-01T12:00:00Z'),
      expiresAt: new Date('2026-09-01T13:00:00Z'),
      metadata: {
        zorgax: {
          plan: 'pro',
          priceEur: 9.9,
          cryptoAmount: '0.00014728',
          eurPerCoin: 67219,
          quoteObservedAt: new Date('2026-09-01T11:55:00Z'),
          quoteSource: 'test',
          destination: 'bc1qdest',
          renew: false,
          checkAttempts: 2,
          lastError: 'Conferme blockchain insufficienti'
        }
      }
    };

    const lean = jest.fn().mockResolvedValue([row]);
    const limit = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit });

    PaymentIntent.find.mockReturnValue({ sort });

    const history = await listPaymentIntents({
      ownerId: 'owner-1',
      limit: 10
    });

    expect(PaymentIntent.find).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      purpose: /^zorgax:/
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      intentId: 'zorgax_history',
      settlementStatus: 'PENDING',
      tracking: {
        automatic: true,
        checkAttempts: 2
      }
    });
    expect(history[0].plan.id).toBe('pro');
    expect(history[0].ownerId).toBeUndefined();
  });
});
