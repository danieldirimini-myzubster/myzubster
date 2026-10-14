const crypto = require('crypto');
const mongoose = require('mongoose');
const MetaverseRateLimitBucket = require('../models/MetaverseRateLimitBucket');

const RATE_LIMIT_POLICIES = Object.freeze({
  join: Object.freeze({ limit: 10, windowMs: 60 * 1000 }),
  sync: Object.freeze({ limit: 90, windowMs: 60 * 1000 }),
  chat: Object.freeze({ limit: 12, windowMs: 10 * 1000 }),
  emote: Object.freeze({ limit: 20, windowMs: 10 * 1000 })
});

const localBuckets = new Map();

function databaseAvailable() {
  return mongoose.connection.readyState === 1;
}

function rateLimitSecret() {
  const configured = process.env.METAVERSE_RATE_LIMIT_SECRET
    || process.env.REALTIME_TOKEN_SECRET
    || process.env.JWT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Metaverse rate-limit secret is not configured');
  }
  return 'myzubster-metaverse-local-development';
}

function rateLimitKey(action, subject, now = new Date(), windowMs = RATE_LIMIT_POLICIES[action]?.windowMs) {
  if (!RATE_LIMIT_POLICIES[action] || !windowMs) throw new Error('Unknown metaverse rate-limit action');
  const bucket = Math.floor(now.getTime() / windowMs);
  return crypto.createHmac('sha256', rateLimitSecret())
    .update(`${action}:${String(subject || 'unknown')}:${bucket}`)
    .digest('hex');
}

function fixedWindowDecision({ count, limit, windowMs, now }) {
  const windowEndMs = (Math.floor(now.getTime() / windowMs) + 1) * windowMs;
  const allowed = count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterMs: allowed ? 0 : Math.max(1, windowEndMs - now.getTime())
  };
}

function claimLocalBucket({ key, limit, windowMs, now }) {
  const expiresAtMs = (Math.floor(now.getTime() / windowMs) + 2) * windowMs;
  const current = localBuckets.get(key);
  const count = (current?.count || 0) + 1;
  localBuckets.set(key, { count, expiresAtMs });

  if (localBuckets.size > 1000) {
    for (const [candidateKey, bucket] of localBuckets.entries()) {
      if (bucket.expiresAtMs <= now.getTime()) localBuckets.delete(candidateKey);
    }
  }

  return fixedWindowDecision({ count, limit, windowMs, now });
}

async function claimDatabaseBucket({ key, limit, windowMs, now }) {
  const expiresAt = new Date((Math.floor(now.getTime() / windowMs) + 2) * windowMs);
  let bucket;
  try {
    bucket = await MetaverseRateLimitBucket.findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    bucket = await MetaverseRateLimitBucket.findOneAndUpdate(
      { key },
      { $inc: { count: 1 } },
      { new: true }
    );
  }
  if (!bucket) throw new Error('Metaverse rate-limit bucket unavailable');
  return fixedWindowDecision({ count: bucket.count, limit, windowMs, now });
}

async function claimMetaverseRateLimit({ action, subject, now = new Date() }) {
  const policy = RATE_LIMIT_POLICIES[action];
  if (!policy) throw new Error('Unknown metaverse rate-limit action');
  const key = rateLimitKey(action, subject, now, policy.windowMs);
  const parameters = { key, ...policy, now };
  return databaseAvailable()
    ? claimDatabaseBucket(parameters)
    : claimLocalBucket(parameters);
}

function resetLocalRateLimitBuckets() {
  localBuckets.clear();
}

module.exports = {
  RATE_LIMIT_POLICIES,
  rateLimitKey,
  fixedWindowDecision,
  claimDatabaseBucket,
  claimMetaverseRateLimit,
  resetLocalRateLimitBuckets
};
