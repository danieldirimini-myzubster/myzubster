'use strict';

const {
  createZorgaxAccessMiddleware
} = require('../src/middleware/zorgaxAccess');

function responseMock() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

describe('Zorgax access degradation', () => {
  test('base chat middleware falls back to FREE when access lookup is unavailable', async () => {
    const { loadZorgaxAccess } = createZorgaxAccessMiddleware({
      getAccessFn: async () => {
        throw new Error('temporary entitlement outage');
      }
    });

    const req = { userId: 'user-1' };
    const res = responseMock();
    const next = jest.fn();

    await loadZorgaxAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.payload).toBeNull();
    expect(req.zorgaxAccess.plan).toBe('free');
    expect(req.zorgaxAccess.source).toBe('DEGRADED_FREE');
    expect(req.zorgaxPolicy.chat).toBe(true);
    expect(req.zorgaxPolicy.workspace).toBe(false);
    expect(req.zorgaxPolicy.directApi).toBe(false);
    expect(req.zorgaxAccessDegraded).toBe(true);
  });

  test('paid-plan guard remains fail-closed when access lookup is unavailable', async () => {
    const { requireZorgaxPlan } = createZorgaxAccessMiddleware({
      getAccessFn: async () => {
        throw new Error('temporary entitlement outage');
      }
    });

    const req = { userId: 'user-1' };
    const res = responseMock();
    const next = jest.fn();

    await requireZorgaxPlan('pro')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.payload).toEqual({
      ok: false,
      error: 'Controllo accesso Zorgax non disponibile'
    });
  });
});
