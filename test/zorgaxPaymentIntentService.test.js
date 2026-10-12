'use strict';

jest.mock('../src/models/PaymentIntent');
jest.mock('../src/models/ZorgaxPurchase', () => ({
  ZorgaxPurchase: { findOne: jest.fn() },
  PURCHASE_STATUSES: { PENDING: 'PENDING', CREDITED: 'CREDITED' }
}));
jest.mock('../src/services/zorgaxChainVerifierService');
jest.mock('../src/services/zorgaxEntitlementService', () => ({ grantPurchaseEntitlement: jest.fn() }));

const PaymentIntent = require('../src/models/PaymentIntent');
const { ZorgaxPurchase } = require('../src/models/ZorgaxPurchase');
const { verifySettlement } = require('../src/services/zorgaxChainVerifierService');
const { grantPurchaseEntitlement } = require('../src/services/zorgaxEntitlementService');
const { verifyAndActivatePaymentIntent } = require('../src/services/zorgaxPaymentIntentService');

describe('Zorgax persisted payment intent activation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ZorgaxPurchase.findOne.mockResolvedValue({
      purchaseId: 'purchase-1', productId: 'zorgax-pro-monthly', entitlement: { key: 'zorgax.access', tier: 'PRO', durationDays: 30 },
      save: jest.fn().mockResolvedValue(undefined)
    });
    grantPurchaseEntitlement.mockResolvedValue({ entitlement: { status: 'ACTIVE' } });
  });

  test('uses immutable server-side intent values for verification and activation', async () => {
    const intent = {
      intentId: 'zorgax_test', ownerId: 'owner-1', purpose: 'zorgax:zorgax-pro-monthly', asset: 'BTC', amountMinor: 7212,
      status: 'AWAITING_PAYMENT', txId: null, metadata: { zorgax: { plan: 'pro', destination: 'bc1qserverdestination', cryptoAmount: '0.00007212' } },
      expiresAt: new Date(Date.now() + 60000),
      save: jest.fn().mockResolvedValue(undefined)
    };
    PaymentIntent.findOne.mockResolvedValue(intent);
    verifySettlement.mockResolvedValue({ verified: true, paymentReference: 'a'.repeat(64), verifier: 'btc-test', confirmations: 1, amount: 0.00007212 });

    const result = await verifyAndActivatePaymentIntent({ ownerId: 'owner-1', intentId: 'zorgax_test', paymentReference: 'a'.repeat(64) });

    expect(verifySettlement).toHaveBeenCalledWith(expect.objectContaining({ asset: 'BTC', destination: 'bc1qserverdestination', cryptoAmount: '0.00007212' }));
    expect(grantPurchaseEntitlement).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner-1', tier: 'PRO' }));
    expect(intent.status).toBe('CONFIRMED');
    expect(intent.confirmedAt).toBeInstanceOf(Date);
    expect(result.access.status).toBe('ACTIVE');
  });

  test('expires stale intents before calling a verifier', async () => {
    const intent = {
      ownerId: 'owner-1', status: 'AWAITING_PAYMENT', txId: null, expiresAt: new Date(Date.now() - 1000),
      save: jest.fn().mockResolvedValue(undefined)
    };
    PaymentIntent.findOne.mockResolvedValue(intent);

    await expect(verifyAndActivatePaymentIntent({ ownerId: 'owner-1', intentId: 'expired', paymentReference: 'b'.repeat(64) })).rejects.toThrow('Payment intent scaduto');
    expect(verifySettlement).not.toHaveBeenCalled();
    expect(intent.status).toBe('EXPIRED');
  });

  test('returns an idempotent success for an already confirmed intent', async () => {
    PaymentIntent.findOne.mockResolvedValue({ intentId: 'used', status: 'CONFIRMED', metadata: { zorgax: { plan: 'pro' } } });
    await expect(verifyAndActivatePaymentIntent({ ownerId: 'owner-1', intentId: 'used', paymentReference: 'c'.repeat(64) }))
      .resolves.toMatchObject({ verified: true, plan: 'pro' });
    expect(verifySettlement).not.toHaveBeenCalled();
  });
});
