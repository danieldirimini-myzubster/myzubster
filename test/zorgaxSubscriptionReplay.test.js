'use strict';

jest.mock('../src/models/ZorgaxPurchase', () => ({
  ZorgaxPurchase: {
    findOne: jest.fn(),
    create: jest.fn()
  },
  PURCHASE_STATUSES: {
    PENDING: 'PENDING',
    CREDITED: 'CREDITED'
  }
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
  beforeEach(() => {
    jest.clearAllMocks();

    grantPurchaseEntitlement.mockResolvedValue({
      entitlement: {
        startsAt: new Date('2026-09-01T00:00:00Z'),
        endsAt: new Date('2026-10-01T00:00:00Z')
      }
    });
  });

  test('reuses the existing purchase for a concurrent retry by the same owner', async () => {
    const existing = {
      _id: 'purchase-mongo-id',
      purchaseId: 'zpur-existing',
      ownerId: 'owner-1',
      creditedAt: new Date('2026-09-01T00:00:00Z')
    };

    ZorgaxPurchase.findOne.mockResolvedValue(existing);

    const result = await recordVerifiedPayment({
      ownerId: 'owner-1',
      planId: 'pro',
      asset: 'BTC',
      paymentReference: verification.paymentReference,
      verification
    });

    expect(ZorgaxPurchase.create).not.toHaveBeenCalled();

    expect(grantPurchaseEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        purchaseId: 'zpur-existing'
      })
    );

    expect(result).toEqual(expect.objectContaining({
      _id: 'purchase-mongo-id',
      ownerId: 'owner-1',
      plan: 'pro',
      asset: 'BTC',
      access: expect.objectContaining({
        status: 'ACTIVE'
      })
    }));
  });

  test('never lets another owner reuse the same payment reference', async () => {
    ZorgaxPurchase.findOne.mockResolvedValue({
      _id: 'purchase-mongo-id',
      purchaseId: 'zpur-existing',
      ownerId: 'owner-2',
      creditedAt: new Date('2026-09-01T00:00:00Z')
    });

    await expect(recordVerifiedPayment({
      ownerId: 'owner-1',
      planId: 'pro',
      asset: 'BTC',
      paymentReference: verification.paymentReference,
      verification
    })).rejects.toThrow('Pagamento già utilizzato');

    expect(ZorgaxPurchase.create).not.toHaveBeenCalled();
    expect(grantPurchaseEntitlement).not.toHaveBeenCalled();
  });
});
