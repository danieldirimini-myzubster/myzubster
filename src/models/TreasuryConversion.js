'use strict';

const mongoose = require('mongoose');

const TreasuryConversionSchema = new mongoose.Schema({
  purpose: {
    type: String,
    enum: ['BOUNTY_SETTLEMENT'],
    required: true,
    default: 'BOUNTY_SETTLEMENT',
    index: true
  },

  bountyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bounty',
    index: true
  },

  provider: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },

  providerReference: {
    type: String,
    trim: true,
    maxlength: 320
  },

  source: {
    asset: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 16
    },
    amount: {
      type: String,
      required: true,
      trim: true
    },
    txId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 320
    }
  },

  target: {
    asset: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 16
    },
    network: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    amount: {
      type: String,
      required: true,
      trim: true
    },
    txId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 320
    }
  },

  state: {
    type: String,
    enum: [
      'CONVERSION_PENDING',
      'CONVERSION_COMPLETED',
      'CONVERSION_FAILED'
    ],
    required: true,
    default: 'CONVERSION_PENDING',
    index: true
  },

  verification: {
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    sourceReference: {
      type: String,
      trim: true,
      maxlength: 320
    },
    verifiedAt: {
      type: Date
    }
  },

  recordedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  versionKey: false
});

/*
 * A treasury conversion is evidence of MyZubster treasury activity.
 * It is not an order placed by a user and does not create a user
 * crypto balance or custodial account.
 */
TreasuryConversionSchema.index(
  { 'target.txId': 1 },
  { unique: true }
);

module.exports =
  mongoose.models.TreasuryConversion ||
  mongoose.model('TreasuryConversion', TreasuryConversionSchema);
