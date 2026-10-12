'use strict';

jest.mock('../src/models/PaymentIntent');

const PaymentIntent = require('../src/models/PaymentIntent');
const { getPaymentIntent, PLANS } = require('../src/services/zorgaxMonetizationService');

describe('Zorgax payment intent expiry', () => {
  test('marks an expired pending intent as EXPIRED when read', async () => {
    const intent = {
      _id: 'mongo-id', intentId: 'zorgax_expired', ownerId: 'owner-1', purpose: 'zorgax:zorgax-pro-monthly', asset: 'BTC', amountMinor: 10000,
      status: 'AWAITING_PAYMENT', txId: null, metadata: { zorgax: { plan: 'pro', priceEur: PLANS.pro.priceEur, cryptoAmount: '0.0001', destination: 'bc1qdest' } },
      expiresAt: new Date(Date.now() - 1000), save: jest.fn().mockResolvedValue(undefined)
    };
    PaymentIntent.findOne.mockResolvedValue(intent);

    const result = await getPaymentIntent({ ownerId: 'owner-1', intentId: 'zorgax_expired' });
    expect(result.settlementStatus).toBe('EXPIRED');
    expect(intent.status).toBe('EXPIRED');
    expect(intent.save).toHaveBeenCalled();
  });
});
