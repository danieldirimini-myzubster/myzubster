'use strict';

const TreasuryConversion = require('../models/TreasuryConversion');

const ALLOWED_PURPOSE = 'BOUNTY_SETTLEMENT';

function publicItem(row) {
  return {
    id: String(row._id),
    purpose: row.purpose,
    bountyId: row.bountyId ? String(row.bountyId) : null,
    provider: row.provider,

    source: {
      asset: row.source.asset,
      amount: row.source.amount,
      txId: row.source.txId
    },

    target: {
      asset: row.target.asset,
      network: row.target.network,
      amount: row.target.amount,
      txId: row.target.txId
    },

    state: row.state,

    verification: {
      status: row.verification?.status || 'PENDING',
      verifiedAt: row.verification?.verifiedAt || null
    },

    recordedAt: row.recordedAt
  };
}

async function buildConversionLayer() {
  const rows = await TreasuryConversion
    .find({ purpose: ALLOWED_PURPOSE })
    .sort({ recordedAt: -1 })
    .lean();

  return {
    configured: true,
    reason: null,
    items: rows.map(publicItem)
  };
}

module.exports = {
  ALLOWED_PURPOSE,
  buildConversionLayer,
  publicItem
};
