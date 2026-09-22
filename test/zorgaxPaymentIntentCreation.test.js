'use strict';

jest.mock('../src/models/PaymentIntent', () => ({
  create: jest.fn()
}));

jest.mock('../src/models/ZorgaxPurchase', () => ({
  ZorgaxPurchase: {
    create: jest.fn()
  },
  PURCHASE_STATUSES: {
    PENDING: 'PENDING',
    CREDITED: 'CREDITED'
  }
}));

jest.mock('../src/services/zorgaxQuoteService', () => ({
  quotePlan: jest.fn()
}));

const PaymentIntent = require('../src/models/PaymentIntent');
const { ZorgaxPurchase } = require('../src/models/ZorgaxPurchase');
const { quotePlan } = require('../src/services/zorgaxQuoteService');
const { createCheckoutIntent } = require('../src/services/zorgaxMonetizationService');

describe('Zorgax payment intent creation', () => {
  const previousWallet = process.env.ZORGAX_WALLET_BTC;

  afterAll(() => {
    if (previousWallet === undefined) delete process.env.ZORGAX_WALLET_BTC;
    else process.env.ZORGAX_WALLET_BTC = previousWallet;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    quotePlan.mockResolvedValue({
      cryptoAmount: '0.0001',
      eurPerCoin: 99000,
      observedAt: new Date('2026-08-31T12:00:00Z'),
      source: 'test-provider'
    });

    PaymentIntent.create.mockImplementation(async value => ({ ...value }));
    ZorgaxPurchase.create.mockImplementation(async value => ({ ...value }));
  });

  test('persists quote, owner, destination and expiry server-side', async () => {
    process.env.ZORGAX_WALLET_BTC = 'bc1qserverdestination';

    const intent = await createCheckoutIntent({
      ownerId: 'owner-1',
      planId: 'pro',
      asset: 'BTC'
    });

    expect(PaymentIntent.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-1',
      asset: 'BTC',
      network: 'bitcoin',
      status: 'AWAITING_PAYMENT',
      expiresAt: expect.any(Date),
      metadata: expect.objectContaining({
        zorgax: expect.objectContaining({
          plan: 'pro',
          destination: 'bc1qserverdestination',
          cryptoAmount: '0.0001'
        })
      })
    }));

    expect(ZorgaxPurchase.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-1',
      status: 'PENDING',
      paymentIntentId: expect.stringMatching(/^zorgax_/),
      metadata: expect.objectContaining({
        plan: 'pro',
        cryptoAmount: '0.0001',
        destination: 'bc1qserverdestination'
      })
    }));

    expect(intent.plan.id).toBe('pro');
    expect(intent.destination).toBe('bc1qserverdestination');
    expect(intent.quote.cryptoAmount).toBe('0.0001');
    expect(intent.settlementStatus).toBe('PENDING');
  });
});
