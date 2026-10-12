'use strict';

jest.mock('../src/models/ZorgaxPurchase', () => ({
  PURCHASE_STATUSES: { PENDING: 'PENDING', CREDITED: 'CREDITED' },
  ZorgaxPurchase: { findOne: jest.fn(), create: jest.fn() }
}));
jest.mock('../src/services/zorgaxEntitlementService', () => ({
  getAccess: jest.fn(),
  grantPurchaseEntitlement: jest.fn()
}));

const { ZorgaxPurchase } = require('../src/models/ZorgaxPurchase');
const { grantPurchaseEntitlement } = require('../src/services/zorgaxEntitlementService');
const { recordVerifiedPayment } = require('../src/services/zorgaxSubscriptionService');

const verification = {
  verified: true,
  verifier: 'btc-test',
  paymentReference: 'f'.repeat(64),
  confirmations: 1
};

describe('Zorgax subscription replay handling', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the existing activation for a concurrent retry by the same owner', async () => {
    const existing = { _id: 'purchase-1', purchaseId: 'purchase-1', ownerId: 'owner-1', creditedAt: new Date() };
    ZorgaxPurchase.findOne.mockResolvedValue(existing);
    grantPurchaseEntitlement.mockResolvedValue({ entitlement: { startsAt: new Date(), endsAt: new Date(Date.now() + 1000) } });

    await expect(recordVerifiedPayment({
      ownerId: 'owner-1', planId: 'pro', asset: 'BTC', paymentReference: verification.paymentReference, verification
    })).resolves.toMatchObject({ ownerId: 'owner-1', plan: 'pro', paymentReference: verification.paymentReference });

    expect(ZorgaxPurchase.create).not.toHaveBeenCalled();
    expect(grantPurchaseEntitlement).toHaveBeenCalled();
  });

  test('never lets another owner reuse the same payment reference', async () => {
    ZorgaxPurchase.findOne.mockResolvedValue({ ownerId: 'owner-2' });

    await expect(recordVerifiedPayment({
      ownerId: 'owner-1', planId: 'pro', asset: 'BTC', paymentReference: verification.paymentReference, verification
    })).rejects.toThrow('Pagamento già utilizzato');
  });
});
