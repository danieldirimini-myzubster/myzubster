'use strict';

jest.mock('../src/models/PaymentIntent', () => ({
  findOne: jest.fn()
}));

jest.mock('../src/models/ZorgaxPurchase', () => ({
  ZorgaxPurchase: {
    findOne: jest.fn()
  },
  PURCHASE_STATUSES: {
    PENDING: 'PENDING',
    CREDITED: 'CREDITED'
  }
}));

jest.mock('../src/services/zorgaxChainVerifierService', () => ({
  verifySettlement: jest.fn()
}));

jest.mock('../src/services/zorgaxEntitlementService', () => ({
  grantPurchaseEntitlement: jest.fn()
}));

const PaymentIntent = require('../src/models/PaymentIntent');
const { ZorgaxPurchase } = require('../src/models/ZorgaxPurchase');
const { verifySettlement } = require('../src/services/zorgaxChainVerifierService');
const { grantPurchaseEntitlement } = require('../src/services/zorgaxEntitlementService');
const {
  verifyAndActivatePaymentIntent
} = require('../src/services/zorgaxUnifiedCheckoutService');

describe('Zorgax persisted payment intent activation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('uses immutable server-side intent values for verification and activation', async () => {
    const txid = 'a'.repeat(64);

    const intent = {
      intentId: 'zorgax_test',
      ownerId: 'owner-1',
      purpose: 'zorgax:zorgax-pro',
      asset: 'BTC',
      network: 'bitcoin',
      amountMinor: 7212,
      txId: null,
      status: 'AWAITING_PAYMENT',
      submittedAt: null,
      confirmedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      metadata: {
        zorgax: {
          plan: 'pro',
          destination: 'bc1qserverdestination',
          cryptoAmount: '0.00007212',
          confirmations: 0,
          checkAttempts: 0
        }
      },
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined)
    };

    const purchase = {
      purchaseId: 'zpur-test',
      ownerId: 'owner-1',
      productId: 'zorgax-pro',
      paymentIntentId: 'zorgax_test',
      status: 'PENDING',
      creditedAt: null,
      entitlement: {
        key: 'zorgax.access',
        tier: 'PRO',
        durationDays: 30
      },
      save: jest.fn().mockResolvedValue(undefined)
    };

    PaymentIntent.findOne.mockResolvedValue(intent);
    ZorgaxPurchase.findOne.mockResolvedValue(purchase);

    verifySettlement.mockResolvedValue({
      verified: true,
      paymentReference: txid,
      verifier: 'btc-test',
      confirmations: 1,
      amount: 0.00007212
    });

    grantPurchaseEntitlement.mockResolvedValue({
      status: 'ACTIVE'
    });

    const result = await verifyAndActivatePaymentIntent({
      ownerId: 'owner-1',
      intentId: 'zorgax_test',
      paymentReference: txid
    });

    expect(PaymentIntent.findOne).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      intentId: 'zorgax_test',
      purpose: /^zorgax:/
    });

    expect(verifySettlement).toHaveBeenCalledWith({
      asset: 'BTC',
      paymentReference: txid,
      destination: 'bc1qserverdestination',
      cryptoAmount: '0.00007212'
    });

    expect(ZorgaxPurchase.findOne).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      paymentIntentId: 'zorgax_test'
    });

    expect(grantPurchaseEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        purchaseId: 'zpur-test',
        productId: 'zorgax-pro',
        entitlementKey: 'zorgax.access',
        tier: 'PRO'
      })
    );

    expect(intent.txId).toBe(txid);
    expect(intent.status).toBe('CONFIRMED');
    expect(intent.confirmedAt).toBeInstanceOf(Date);

    expect(purchase.status).toBe('CREDITED');
    expect(purchase.creditedAt).toBeInstanceOf(Date);

    expect(result).toMatchObject({
      intentId: 'zorgax_test',
      settlementStatus: 'VERIFIED',
      pending: false,
      verified: true,
      plan: 'pro',
      access: { status: 'ACTIVE' }
    });
  });

  test('expires stale intents before calling a verifier', async () => {
    const intent = {
      intentId: 'expired',
      ownerId: 'owner-1',
      purpose: 'zorgax:zorgax-pro',
      status: 'AWAITING_PAYMENT',
      txId: null,
      expiresAt: new Date(Date.now() - 1000),
      metadata: { zorgax: { plan: 'pro' } },
      save: jest.fn().mockResolvedValue(undefined)
    };

    PaymentIntent.findOne.mockResolvedValue(intent);

    await expect(
      verifyAndActivatePaymentIntent({
        ownerId: 'owner-1',
        intentId: 'expired',
        paymentReference: 'b'.repeat(64)
      })
    ).rejects.toThrow('Payment intent scaduto');

    expect(verifySettlement).not.toHaveBeenCalled();
    expect(intent.status).toBe('EXPIRED');
    expect(intent.save).toHaveBeenCalledTimes(1);
  });

  test('treats an already confirmed intent as an idempotent verified result', async () => {
    const intent = {
      intentId: 'used',
      ownerId: 'owner-1',
      purpose: 'zorgax:zorgax-pro',
      status: 'CONFIRMED',
      txId: 'c'.repeat(64),
      expiresAt: new Date(Date.now() + 60000),
      metadata: {
        zorgax: {
          plan: 'pro'
        }
      },
      save: jest.fn()
    };

    PaymentIntent.findOne.mockResolvedValue(intent);

    const result = await verifyAndActivatePaymentIntent({
      ownerId: 'owner-1',
      intentId: 'used',
      paymentReference: 'c'.repeat(64)
    });

    expect(result).toMatchObject({
      intentId: 'used',
      settlementStatus: 'VERIFIED',
      pending: false,
      verified: true,
      plan: 'pro'
    });

    expect(verifySettlement).not.toHaveBeenCalled();
    expect(ZorgaxPurchase.findOne).not.toHaveBeenCalled();
    expect(intent.save).not.toHaveBeenCalled();
  });
});
