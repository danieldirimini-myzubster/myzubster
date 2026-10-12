'use strict';

jest.mock('../src/models/PaymentIntent');
jest.mock('../src/models/ZorgaxPurchase', () => ({
  ZorgaxPurchase: { findOne: jest.fn() }
}));
jest.mock('../src/services/zorgaxEntitlementService', () => ({ listEntitlements: jest.fn() }));

const PaymentIntent = require('../src/models/PaymentIntent');
const { ZorgaxPurchase } = require('../src/models/ZorgaxPurchase');
const { listEntitlements } = require('../src/services/zorgaxEntitlementService');
const { getPaymentReceipt } = require('../src/services/zorgaxBillingService');

describe('Zorgax payment receipts', () => {
  test('builds an owner-scoped technical receipt from verified server records', async () => {
    const verifiedAt = new Date('2026-08-31T12:00:00Z');
    PaymentIntent.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({
      intentId: 'zorgax_receipt', ownerId: 'owner-1', purpose: 'zorgax:zorgax-pro-monthly', asset: 'BTC',
      status: 'CONFIRMED', txId: 'd'.repeat(64), confirmedAt: verifiedAt,
      metadata: { zorgax: { plan: 'pro', destination: 'bc1qdest', cryptoAmount: '0.00014728', priceEur: 9.9, quoteSource: 'quote-test', quoteObservedAt: verifiedAt, confirmations: 1, verifier: 'btc-test' } },
      updatedAt: verifiedAt
    }) });
    ZorgaxPurchase.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({
      purchaseId: 'purchase-1', ownerId: 'owner-1', paymentIntentId: 'zorgax_receipt', status: 'CREDITED', creditedAt: verifiedAt,
      entitlement: { tier: 'PRO' }
    }) });
    listEntitlements.mockResolvedValue([{ sourcePurchaseId: 'purchase-1', status: 'ACTIVE', startsAt: verifiedAt, endsAt: new Date('2026-09-30T12:00:00Z') }]);

    const receipt = await getPaymentReceipt({ ownerId: 'owner-1', intentId: 'zorgax_receipt' });

    expect(PaymentIntent.findOne).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner-1', status: 'CONFIRMED', purpose: /^zorgax:/ }));
    expect(receipt).toMatchObject({ documentType: 'PAYMENT_RECEIPT', fiscalInvoice: false, plan: 'pro' });
    expect(receipt.payment.paymentReference).toBe('d'.repeat(64));
    expect(receipt.access.status).toBe('ACTIVE');
  });
});
