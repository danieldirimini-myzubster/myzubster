'use strict';

jest.mock('../src/models/PaymentIntent');
jest.mock('../src/models/ZorgaxPurchase', () => ({
  PURCHASE_STATUSES: { PENDING: 'PENDING', CREDITED: 'CREDITED' },
  ZorgaxPurchase: { create: jest.fn() }
}));
jest.mock('../src/services/zorgaxQuoteService', () => ({ quotePlan: jest.fn() }));

const PaymentIntent = require('../src/models/PaymentIntent');
const { ZorgaxPurchase } = require('../src/models/ZorgaxPurchase');
const { quotePlan } = require('../src/services/zorgaxQuoteService');
const { createCheckoutIntent } = require('../src/services/zorgaxMonetizationService');

describe('Zorgax payment intent creation', () => {
  const previousWallet = process.env.ZORGAX_WALLET_BTC;
  afterAll(() => { process.env.ZORGAX_WALLET_BTC = previousWallet; });

  test('persists quote, owner, destination and expiry server-side', async () => {
    process.env.ZORGAX_WALLET_BTC = 'bc1qserverdestination';
    quotePlan.mockResolvedValue({ cryptoAmount: '0.0001', eurPerCoin: 99000, observedAt: new Date().toISOString(), source: 'test-provider' });
    PaymentIntent.create.mockImplementation(async value => ({ ...value }));
    ZorgaxPurchase.create.mockResolvedValue({ purchaseId: 'purchase-1' });

    const intent = await createCheckoutIntent({ ownerId: 'owner-1', planId: 'pro', asset: 'BTC' });
    expect(PaymentIntent.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-1', purpose: 'zorgax:zorgax_pro_monthly', asset: 'BTC', network: 'bitcoin', amountMinor: 10000
    }));
    expect(PaymentIntent.create.mock.calls[0][0].metadata.zorgax).toMatchObject({ plan: 'pro', destination: 'bc1qserverdestination' });
    expect(ZorgaxPurchase.create).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner-1', status: 'PENDING' }));
    expect(intent.quote.cryptoAmount).toBe('0.0001');
    expect(intent.settlementStatus).toBe('PENDING');
  });
});
