const mongoose = require('mongoose');

const marketplaceHandoverSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceListing', required: true, index: true },
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  method: { type: String, enum: ['HAND_DELIVERY'], default: 'HAND_DELIVERY' },
  state: {
    type: String,
    enum: ['ACCEPTED', 'HANDED_OVER', 'RECEIVED', 'RECORDED'],
    default: 'ACCEPTED',
    index: true
  },
  acceptedAt: { type: Date, default: Date.now },
  handedOverAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
  recordedAt: { type: Date, default: null },
  evidenceClassification: {
    evidenceClass: {
      type: String,
      enum: ['PUBLIC', 'RESTRICTED', 'PARTICIPANT_ONLY', 'EPHEMERAL'],
      default: 'PARTICIPANT_ONLY',
      required: true
    },
    purpose: {
      type: String,
      default: 'kefir_hand_delivery_evidence'
    },
    disclosureAudience: {
      type: [String],
      default: ['donor', 'recipient']
    },
    containsDirectIdentifier: {
      type: Boolean,
      default: false
    },
    containsPseudonymousIdentifier: {
      type: Boolean,
      default: true
    },
    containsLocation: {
      type: Boolean,
      default: false
    },
    containsPaymentMetadata: {
      type: Boolean,
      default: false
    },
    researchEligible: {
      type: Boolean,
      default: false
    },
    publicAnchoringAllowed: {
      type: Boolean,
      default: false
    }
  },

  blockchainCommitment: {
    schema: { type: String, default: null },
    algorithm: { type: String, default: null },
    hash: { type: String, default: null },
    preparedAt: { type: Date, default: null },
    network: { type: String, default: null },
    txId: { type: String, default: null },
    anchoredAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null }
  }
}, { timestamps: true });

marketplaceHandoverSchema.index({ listingId: 1, recipientId: 1 }, { unique: true });

module.exports = mongoose.models.MarketplaceHandover || mongoose.model('MarketplaceHandover', marketplaceHandoverSchema);
