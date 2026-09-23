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
  verifyAndActivatePaymentIntent,
  refreshPaymentIntent
} = require('../src/services/zorgaxUnifiedCheckoutService');

function paymentIntent(overrides = {}) {
  const baseZorgax = {
    plan: 'pro',
    destination: 'bc1qserverdestination',
    cryptoAmount: '0.00007212',
    confirmations: 0,
    checkAttempts: 0
  };

  return {
    intentId: 'zorgax_monitor',
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
        ...baseZorgax,
        ...(overrides.metadata?.zorgax || {})
      }
    },
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
    metadata: {
      zorgax: {
        ...baseZorgax,
        ...(overrides.metadata?.zorgax || {})
      }
    }
  };
}

function purchase() {
  return {
    purchaseId: 'zpur-monitor',
    ownerId: 'owner-1',
    productId: 'zorgax-pro',
    paymentIntentId: 'zorgax_monitor',
    status: 'PENDING',
    creditedAt: null,
    entitlement: {
      key: 'zorgax.access',
      tier: 'PRO',
      durationDays: 30
    },
    save: jest.fn().mockResolvedValue(undefined)
  };
}

describe('Zorgax automatic payment monitoring', () => {
  beforeEach(() => jest.clearAllMocks());

  test('persists a valid TXID when confirmations are still insufficient', async () => {
    const intent = paymentIntent();
    const txid = 'a'.repeat(64);

    PaymentIntent.findOne.mockResolvedValue(intent);

    verifySettlement.mockRejectedValue(
      new Error('Conferme blockchain insufficienti')
    );

    const result = await verifyAndActivatePaymentIntent({
      ownerId: 'owner-1',
      intentId: 'zorgax_monitor',
      paymentReference: txid
    });

    expect(intent.txId).toBe(txid);
    expect(intent.status).toBe('SUBMITTED');
    expect(intent.submittedAt).toBeInstanceOf(Date);

    expect(intent.metadata.zorgax.checkAttempts).toBe(1);
    expect(intent.metadata.zorgax.nextCheckAt).toBeInstanceOf(Date);
    expect(intent.metadata.zorgax.lastError)
      .toMatch(/Conferme blockchain insufficienti/);

    expect(result).toMatchObject({
      settlementStatus: 'PENDING',
      pending: true,
      automaticMonitoring: true,
      paymentReference: txid
    });

    expect(ZorgaxPurchase.findOne).not.toHaveBeenCalled();
  });

  test('refreshes a persisted TXID and activates access after confirmation', async () => {
    const txid = 'b'.repeat(64);

    const intent = paymentIntent({
      txId: txid,
      status: 'SUBMITTED',
      submittedAt: new Date()
    });

    const linkedPurchase = purchase();

    PaymentIntent.findOne.mockResolvedValue(intent);
    ZorgaxPurchase.findOne.mockResolvedValue(linkedPurchase);

    verifySettlement.mockResolvedValue({
      verified: true,
      paymentReference: txid,
      confirmations: 2,
      verifier: 'btc-test'
    });

    grantPurchaseEntitlement.mockResolvedValue({
      status: 'ACTIVE'
    });

    const result = await refreshPaymentIntent({
      ownerId: 'owner-1',
      intentId: 'zorgax_monitor'
    });

    expect(verifySettlement).toHaveBeenCalledWith({
      asset: 'BTC',
      paymentReference: txid,
      destination: 'bc1qserverdestination',
      cryptoAmount: '0.00007212'
    });

    expect(intent.status).toBe('CONFIRMED');
    expect(intent.confirmedAt).toBeInstanceOf(Date);

    expect(linkedPurchase.status).toBe('CREDITED');
    expect(linkedPurchase.creditedAt).toBeInstanceOf(Date);

    expect(result).toMatchObject({
      settlementStatus: 'VERIFIED',
      pending: false,
      verified: true,
      access: { status: 'ACTIVE' }
    });
  });

  test('allows confirmation after quote expiry when the TXID was submitted in time', async () => {
    const txid = 'c'.repeat(64);
    const expiresAt = new Date(Date.now() - 5000);

    const intent = paymentIntent({
      txId: txid,
      status: 'SUBMITTED',
      submittedAt: new Date(expiresAt.getTime() - 1000),
      expiresAt
    });

    const linkedPurchase = purchase();

    PaymentIntent.findOne.mockResolvedValue(intent);
    ZorgaxPurchase.findOne.mockResolvedValue(linkedPurchase);

    verifySettlement.mockResolvedValue({
      verified: true,
      paymentReference: txid,
      confirmations: 3,
      verifier: 'btc-test'
    });

    grantPurchaseEntitlement.mockResolvedValue({
      status: 'ACTIVE'
    });

    const result = await refreshPaymentIntent({
      ownerId: 'owner-1',
      intentId: 'zorgax_monitor'
    });

    expect(verifySettlement).toHaveBeenCalled();
    expect(intent.status).toBe('CONFIRMED');
    expect(result.settlementStatus).toBe('VERIFIED');
  });
});
