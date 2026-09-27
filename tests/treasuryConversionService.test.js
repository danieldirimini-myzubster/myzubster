'use strict';

const {
  ALLOWED_PURPOSE,
  publicItem
} = require('../src/services/treasuryConversionService');

describe('treasuryConversionService', () => {
  test('is restricted to bounty settlement purpose', () => {
    expect(ALLOWED_PURPOSE).toBe('BOUNTY_SETTLEMENT');
  });

  test('publicItem exposes settlement proof but not private provider references', () => {
    const row = {
      _id: 'conversion-1',
      purpose: 'BOUNTY_SETTLEMENT',
      bountyId: null,
      provider: 'SimpleSwap',

      providerReference: 'PRIVATE-ORDER-REFERENCE',

      source: {
        asset: 'BTC',
        amount: '0.000464',
        txId: '2ea0bc209a2d5bcfbf520f830f1a39dee0691e47c461afc316e5aeb2e83cdd2d'
      },

      target: {
        asset: 'ETH',
        network: 'ethereum-mainnet',
        amount: '0.014355678390291923',
        txId: '0x62b58e69931ef6046d8f68df39c118fe0b1fc7234b88c780d26a8b53fdcddcc6'
      },

      state: 'CONVERSION_COMPLETED',

      verification: {
        status: 'VERIFIED',
        sourceReference: 'PRIVATE-VERIFICATION-REFERENCE',
        verifiedAt: new Date('2026-09-27T00:00:00Z')
      },

      recordedAt: new Date('2026-09-27T00:00:00Z')
    };

    const item = publicItem(row);

    expect(item.purpose).toBe('BOUNTY_SETTLEMENT');
    expect(item.source.asset).toBe('BTC');
    expect(item.source.amount).toBe('0.000464');

    expect(item.target.asset).toBe('ETH');
    expect(item.target.amount).toBe('0.014355678390291923');
    expect(item.state).toBe('CONVERSION_COMPLETED');
    expect(item.verification.status).toBe('VERIFIED');

    expect(item.providerReference).toBeUndefined();
    expect(item.verification.sourceReference).toBeUndefined();
  });
});
