'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax verifier failure behavior', () => {
  test('verification occurs before entitlement activation', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/services/zorgaxUnifiedCheckoutService.js'),
      'utf8'
    );

    const verifyPos = source.indexOf('await verifySettlement');
    const activateCallPos = source.indexOf('return activate(intent, verification)');
    const entitlementPos = source.indexOf('await grantPurchaseEntitlement');

    expect(verifyPos).toBeGreaterThan(-1);
    expect(activateCallPos).toBeGreaterThan(verifyPos);
    expect(entitlementPos).toBeGreaterThan(-1);
  });
});
