'use strict';

const ZorgaxPaymentIntent = require('../src/models/ZorgaxPaymentIntent');

describe('Zorgax payment intent replay protection', () => {
  test('declares a unique partial transaction index', () => {
    const indexes = ZorgaxPaymentIntent.schema.indexes();
    const replayIndex = indexes.find(([fields]) => fields.asset === 1 && fields.network === 1 && fields.txId === 1);
    expect(replayIndex).toBeDefined();
    expect(replayIndex[1]).toEqual(expect.objectContaining({
      unique: true,
      partialFilterExpression: { txId: { $type: 'string' } }
    }));
  });
});
