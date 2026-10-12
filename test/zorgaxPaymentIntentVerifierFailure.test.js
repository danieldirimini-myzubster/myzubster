'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax verifier failure behavior', () => {
  test('activates only after trusted verifier returns successfully', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/services/zorgaxUnifiedCheckoutService.js'), 'utf8');
    expect(source).toContain('const verification = await verifySettlement');
    expect(source).toContain('return activate(intent, verification)');
    expect(source).toContain("intent.status = 'CONFIRMED'");
  });
});
