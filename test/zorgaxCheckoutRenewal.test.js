'use strict';

jest.mock('../src/models/PaymentIntent');
jest.mock('../src/models/ZorgaxPurchase', () => ({
  ZorgaxPurchase: {
    create: jest.fn()
  },
  PURCHASE_STATUSES: {
    PENDING: 'PENDING',
    CREDITED: 'CREDITED'
  }
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
    ZorgaxPurchase.create.mockImplementation(async (document) => ({ ...document }));
  });

  test('persists renewal intent in unified checkout metadata', async () => {
    const intent = await createCheckoutIntent({
      ownerId: 'owner-1',
      planId: 'pro',
      asset: 'BTC',
      renew: true
    });

    expect(PaymentIntent.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-1',
      metadata: expect.objectContaining({
        zorgax: expect.objectContaining({
          plan: 'pro',
          renew: true
        })
      })
    }));

    expect(ZorgaxPurchase.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-1',
      metadata: expect.objectContaining({
        plan: 'pro',
        renew: true
      })
    }));

    expect(intent.renewal).toBe(true);
  });

  test('normal checkout persists renew false without legacy subscription lookup', async () => {
    const intent = await createCheckoutIntent({
      ownerId: 'owner-1',
      planId: 'developer',
      asset: 'BTC',
      renew: false
    });

    expect(PaymentIntent.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        zorgax: expect.objectContaining({
          plan: 'developer',
          renew: false
        })
      })
    }));

    expect(ZorgaxPurchase.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        plan: 'developer',
        renew: false
      })
    }));

    expect(intent.renewal).toBe(false);
  });
});
