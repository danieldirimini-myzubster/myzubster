'use strict';

jest.mock('../src/models/PaymentIntent');

const PaymentIntent = require('../src/models/PaymentIntent');
const { listPaymentIntents } = require('../src/services/zorgaxLegacyMonetizationService');

describe('Zorgax payment history', () => {
  test('returns only owner-scoped public payment details and tracking state', async () => {
    const limit = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{
      intentId: 'zorgax_history', ownerId: 'owner-1', purpose: 'zorgax:zorgax-pro-monthly', asset: 'BTC', amountMinor: 14728,
      status: 'SUBMITTED', txId: 'e'.repeat(64), submittedAt: new Date(), metadata: { zorgax: { plan: 'pro', priceEur: 9.9, cryptoAmount: '0.00014728', destination: 'bc1qdest', checkAttempts: 2, lastError: 'Conferme blockchain insufficienti' } },
      expiresAt: new Date()
    }]) });
    const sort = jest.fn().mockReturnValue({ limit });
    PaymentIntent.find.mockReturnValue({ sort });

    const history = await listPaymentIntents({ ownerId: 'owner-1', limit: 10 });

    expect(PaymentIntent.find).toHaveBeenCalledWith({ ownerId: 'owner-1', purpose: /^zorgax:/ });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ intentId: 'zorgax_history', settlementStatus: 'PENDING', tracking: { automatic: true, checkAttempts: 2 } });
    expect(history[0].ownerId).toBeUndefined();
  });
});
