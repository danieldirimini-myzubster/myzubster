const mongoose = require('mongoose');

const knowledgeContributionSchema = new mongoose.Schema({
  contributionId: { type: String, required: true, unique: true, index: true },
  authorId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  reference: { type: String, default: null },
  pilotId: { type: String, default: null, index: true },
  category: { type: String, default: null },
  visibility: {
    type: String,
    enum: ['INTERNAL', 'PUBLIC'],
    default: 'INTERNAL',
    index: true
  },
  publishedAt: { type: Date, default: null },
  publishedBy: { type: String, default: null },

  // Canonical content identity. This hashes the normalized knowledge content,
  // not mutable review/reward metadata.
  contentHash: { type: String, default: null, index: true },

  // Version lineage.
  version: { type: Number, default: 1, min: 1 },
  supersedesContributionId: { type: String, default: null, index: true },

  // Provenance describing where this knowledge candidate came from.
  source: {
    type: {
      type: String,
      enum: ['manual', 'engineering', 'document', 'research', 'runtime', 'other'],
      default: 'manual'
    },
    reference: { type: String, default: null, maxlength: 500 }
  },

  // References such as commits, tests, documents, evidence hashes or URLs.
  evidenceRefs: [{
    type: String,
    maxlength: 500
  }],
  status: {
    type: String,
    enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REWARD_ELIGIBLE', 'REWARDED'],
    default: 'PENDING_REVIEW',
    index: true,
  },
  reviewerId: { type: String, default: null },
  reviewNotes: { type: String, default: null },
  reputationPoints: { type: Number, default: 0, min: 0 },
  rewardId: { type: String, default: null, index: true },
  ledgerReference: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  rewardedAt: { type: Date, default: null },
}, { timestamps: true });

knowledgeContributionSchema.index({ authorId: 1, pilotId: 1, createdAt: -1 });
knowledgeContributionSchema.index({ status: 1, visibility: 1, reviewedAt: -1 });

knowledgeContributionSchema.index(
  { authorId: 1, contentHash: 1 },
  {
    unique: true,
    partialFilterExpression: { contentHash: { $type: 'string' } },
    name: 'knowledge_author_content_unique'
  }
);

module.exports = mongoose.model('KnowledgeContribution', knowledgeContributionSchema);
