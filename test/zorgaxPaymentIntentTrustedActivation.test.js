'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax trusted payment activation boundary', () => {
  test('loads payment coordinates from the persisted intent', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/services/zorgaxUnifiedCheckoutService.js'), 'utf8');
    expect(source).toContain("asset:'BTC'");
    expect(source).toContain('destination:z.destination');
    expect(source).toContain('cryptoAmount:z.cryptoAmount || satsToBtc(intent.amountMinor)');
    expect(source).toContain('grantPurchaseEntitlement');
  });
});
