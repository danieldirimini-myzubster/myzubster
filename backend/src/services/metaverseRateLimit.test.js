const MetaverseRateLimitBucket = require('../models/MetaverseRateLimitBucket');
const {
  RATE_LIMIT_POLICIES,
  rateLimitKey,
  claimDatabaseBucket,
  claimMetaverseRateLimit,
  resetLocalRateLimitBuckets
} = require('./metaverseRateLimit');

describe('metaverse distributed rate-limit policy', () => {
  const originalSecret = process.env.METAVERSE_RATE_LIMIT_SECRET;

  beforeEach(() => {
    process.env.METAVERSE_RATE_LIMIT_SECRET = 'test-only-metaverse-rate-limit-secret';
    resetLocalRateLimitBuckets();
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.METAVERSE_RATE_LIMIT_SECRET;
    else process.env.METAVERSE_RATE_LIMIT_SECRET = originalSecret;
    resetLocalRateLimitBuckets();
  });

  test('defines bounded policies for all public mutation flows', () => {
    expect(RATE_LIMIT_POLICIES).toEqual({
      join: { limit: 10, windowMs: 60 * 1000 },
      sync: { limit: 90, windowMs: 60 * 1000 },
      chat: { limit: 12, windowMs: 10 * 1000 },
      emote: { limit: 20, windowMs: 10 * 1000 }
    });
  });

  test('stores only an opaque fixed-window key', () => {
    const subject = 'network:203.0.113.42';
    const first = rateLimitKey('join', subject, new Date('2026-10-13T10:00:20.000Z'));
    const sameWindow = rateLimitKey('join', subject, new Date('2026-10-13T10:00:59.999Z'));
    const nextWindow = rateLimitKey('join', subject, new Date('2026-10-13T10:01:00.000Z'));

    expect(first).toHaveLength(64);
    expect(first).not.toContain('203.0.113.42');
    expect(first).toBe(sameWindow);
    expect(first).not.toBe(nextWindow);
    expect(MetaverseRateLimitBucket.schema.path('subject')).toBeUndefined();
    expect(MetaverseRateLimitBucket.schema.path('action')).toBeUndefined();
  });

  test('rejects a burst and reports when the fixed window reopens', async () => {
    const now = new Date('2026-10-13T10:00:20.000Z');
    const policy = RATE_LIMIT_POLICIES.join;
    let decision;
    for (let index = 0; index < policy.limit; index += 1) {
      decision = await claimMetaverseRateLimit({ action: 'join', subject: 'network:test', now });
      expect(decision.allowed).toBe(true);
    }

    decision = await claimMetaverseRateLimit({ action: 'join', subject: 'network:test', now });
    expect(decision).toEqual({
      allowed: false,
      limit: policy.limit,
      remaining: 0,
      retryAfterMs: 40 * 1000
    });

    const reopened = await claimMetaverseRateLimit({
      action: 'join',
      subject: 'network:test',
      now: new Date('2026-10-13T10:01:00.000Z')
    });
    expect(reopened).toMatchObject({ allowed: true, remaining: policy.limit - 1 });
  });

  test('increments a shared MongoDB bucket atomically', async () => {
    const update = jest.spyOn(MetaverseRateLimitBucket, 'findOneAndUpdate')
      .mockResolvedValue({ count: RATE_LIMIT_POLICIES.chat.limit + 1 });
    const now = new Date('2026-10-13T10:00:04.000Z');
    const decision = await claimDatabaseBucket({
      key: 'a'.repeat(64),
      ...RATE_LIMIT_POLICIES.chat,
      now
    });

    expect(update).toHaveBeenCalledWith(
      { key: 'a'.repeat(64) },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date('2026-10-13T10:00:20.000Z') }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    expect(decision).toEqual({
      allowed: false,
      limit: RATE_LIMIT_POLICIES.chat.limit,
      remaining: 0,
      retryAfterMs: 6000
    });
    update.mockRestore();
  });

  test('declares a TTL index for automatic bucket cleanup', () => {
    const ttlIndex = MetaverseRateLimitBucket.schema.indexes()
      .find(([fields]) => fields.expiresAt === 1);
    expect(ttlIndex).toBeDefined();
    expect(ttlIndex[1].expireAfterSeconds).toBe(0);
  });
});
