'use strict';

jest.mock('../src/models/PaymentIntent');
jest.mock('../src/models/ZorgaxPurchase', () => ({
  PURCHASE_STATUSES: { PENDING: 'PENDING', CREDITED: 'CREDITED' },
  ZorgaxPurchase: { create: jest.fn() }
}));
jest.mock('../src/services/zorgaxQuoteService');

const PaymentIntent = require('../src/models/PaymentIntent');
const { ZorgaxPurchase } = require('../src/models/ZorgaxPurchase');
const { quotePlan } = require('../src/services/zorgaxQuoteService');
const { createCheckoutIntent } = require('../src/services/zorgaxLegacyMonetizationService');

describe('Zorgax checkout renewal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    quotePlan.mockResolvedValue({
      cryptoAmount: '0.00014728',
      eurPerCoin: 67219,
      observedAt: new Date('2026-08-31T12:00:00Z'),
      source: 'quote-test'
    });
    PaymentIntent.create.mockImplementation(async (document) => ({ ...document }));
    ZorgaxPurchase.create.mockResolvedValue({ purchaseId: 'purchase-1' });
  });

  test('persists the server-owned renewal flag in the unified checkout records', async () => {
    const intent = await createCheckoutIntent({ ownerId: 'owner-1', planId: 'pro', asset: 'BTC', renew: true });

    expect(PaymentIntent.create.mock.calls[0][0].metadata.zorgax.renew).toBe(true);
    expect(ZorgaxPurchase.create.mock.calls[0][0].metadata.renew).toBe(true);
    expect(intent.renewal).toBe(true);
  });

  test('records a normal checkout without renewal state', async () => {
    const intent = await createCheckoutIntent({ ownerId: 'owner-1', planId: 'developer', asset: 'BTC', renew: false });

    expect(PaymentIntent.create.mock.calls[0][0].metadata.zorgax.renew).toBe(false);
    expect(intent.renewal).toBe(false);
  });
});
