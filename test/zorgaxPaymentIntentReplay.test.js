'use strict';

const ZorgaxPaymentIntent = require('../src/models/ZorgaxPaymentIntent');
const PaymentIntent = require('../src/models/PaymentIntent');

describe('Zorgax payment intent replay protection', () => {
  test('uses the shared PaymentIntent model', () => {
    expect(ZorgaxPaymentIntent).toBe(PaymentIntent);
  });

  test('declares a unique payment reference index', () => {
    const indexes = PaymentIntent.schema.indexes();

    const replayIndex = indexes.find(
      ([fields]) => fields.paymentReference === 1
    );

    expect(replayIndex).toBeDefined();
    expect(replayIndex[1]).toEqual(
      expect.objectContaining({
        unique: true
      })
    );
  });

  test('declares a unique blockchain transaction index', () => {
    const indexes = PaymentIntent.schema.indexes();

    const txIndex = indexes.find(
      ([fields]) =>
        fields.asset === 1 &&
        fields.network === 1 &&
        fields.txId === 1
    );

    expect(txIndex).toBeDefined();
    expect(txIndex[1]).toEqual(
      expect.objectContaining({
        unique: true,
        partialFilterExpression: {
          txId: { $type: 'string' }
        }
      })
    );
  });
});
