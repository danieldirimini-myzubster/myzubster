'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax trusted payment activation boundary', () => {
  test('loads verification coordinates from the persisted unified intent', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/services/zorgaxUnifiedCheckoutService.js'),
      'utf8'
    );

    expect(source).toContain("paymentReference:intent.txId");
    expect(source).toContain("destination:z.destination");
    expect(source).toMatch(/cryptoAmount:z\.cryptoAmount\s*\|\|\s*satsToBtc\(intent\.amountMinor\)/);
    expect(source).toContain('await verifySettlement');
    expect(source).toContain('await grantPurchaseEntitlement');
  });
});
