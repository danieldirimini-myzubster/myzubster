'use strict';

const mongoose = require('mongoose');
const TreasuryConversion = require('../src/models/TreasuryConversion');

const TARGET_TX =
  '0x62b58e69931ef6046d8f68df39c118fe0b1fc7234b88c780d26a8b53fdcddcc6';

const document = {
  purpose: 'BOUNTY_SETTLEMENT',
  provider: 'SimpleSwap',

  source: {
    asset: 'BTC',
    amount: '0.000464',
    txId: '2ea0bc209a2d5bcfbf520f830f1a39dee0691e47c461afc316e5aeb2e83cdd2d'
  },

  target: {
    asset: 'ETH',
    network: 'ethereum-mainnet',
    amount: '0.014355678390291923',
    txId: TARGET_TX
  },

  state: 'CONVERSION_COMPLETED',

  verification: {
    status: 'VERIFIED',
    sourceReference: `ethereum-mainnet:tx:${TARGET_TX}`,
    verifiedAt: new Date()
  },

  recordedAt: new Date()
};

async function main() {
  const commit = process.argv.includes('--commit');

  const candidate = new TreasuryConversion(document);
  await candidate.validate();

  console.log(commit ? 'MODE: COMMIT' : 'MODE: DRY-RUN');
  console.log(JSON.stringify(document, null, 2));

  if (!commit) {
    console.log('DRY-RUN OK — no database write performed');
    return;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI or MONGO_URI is required');
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000
  });

  const existing = await TreasuryConversion.findOne({
    'target.txId': TARGET_TX
  }).lean();

  if (existing) {
    console.log('IDEMPOTENT REPLAY — conversion already recorded');
    console.log(JSON.stringify({
      id: String(existing._id),
      purpose: existing.purpose,
      state: existing.state,
      source: existing.source,
      target: existing.target,
      verificationStatus: existing.verification?.status
    }, null, 2));
    return;
  }

  const created = await TreasuryConversion.create(document);

  console.log('RECORDED');
  console.log(JSON.stringify({
    id: String(created._id),
    purpose: created.purpose,
    state: created.state,
    source: created.source,
    target: created.target,
    verificationStatus: created.verification?.status
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
