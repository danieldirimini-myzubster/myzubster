'use strict';

jest.mock('../src/models/PaymentIntent', () => ({
  findOne: jest.fn()
}));

const PaymentIntent = require('../src/models/PaymentIntent');
const { getPaymentIntent } = require('../src/services/zorgaxMonetizationService');

describe('Zorgax payment intent expiry', () => {
  beforeEach(() => jest.clearAllMocks());

  test('marks an expired pending intent as EXPIRED when read', async () => {
    const intent = {
      _id: 'mongo-id',
      intentId: 'zorgax_expired',
      ownerId: 'owner-1',
      purpose: 'zorgax:zorgax-pro',
      asset: 'BTC',
      amountMinor: 10000,
      status: 'AWAITING_PAYMENT',
      txId: null,
      expiresAt: new Date(Date.now() - 1000),
      metadata: {
        zorgax: {
          plan: 'pro',
          priceEur: 9.9,
          cryptoAmount: '0.0001',
          eurPerCoin: 99000,
          quoteObservedAt: new Date(),
          quoteSource: 'test',
          destination: 'bc1qdest',
          renew: false
        }
      },
      save: jest.fn().mockResolvedValue(undefined)
    };

    PaymentIntent.findOne.mockResolvedValue(intent);

    const result = await getPaymentIntent({
      ownerId: 'owner-1',
      intentId: 'zorgax_expired'
    });

    expect(PaymentIntent.findOne).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      intentId: 'zorgax_expired',
      purpose: /^zorgax:/
    });

    expect(intent.status).toBe('EXPIRED');
    expect(intent.save).toHaveBeenCalledTimes(1);
    expect(result.settlementStatus).toBe('EXPIRED');
  });
});
