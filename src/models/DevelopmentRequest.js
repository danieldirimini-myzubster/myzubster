'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');
const statuses = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED', 'REJECTED'];
const ref = new mongoose.Schema({ contributionId: { type: String, required: true }, version: { type: String, required: true }, contentHash: { type: String, required: true }, title: { type: String, required: true } }, { _id: false });
const schema = new mongoose.Schema({
  requestId: { type: String, unique: true, default: () => `dev_${crypto.randomUUID()}` },
  digest: { type: String, required: true, unique: true },
  creatorId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  knowledgeRefs: { type: [ref], required: true },
  status: { type: String, enum: statuses, default: 'DRAFT', index: true },
  claimantId: { type: String, default: null },
  deliveryEvidence: { type: String, default: null },
  reviewerId: { type: String, default: null },
  reviewNotes: { type: String, default: null },
  openedAt: Date, claimedAt: Date, submittedAt: Date, reviewedAt: Date
}, { timestamps: true });
module.exports = mongoose.models.DevelopmentRequest || mongoose.model('DevelopmentRequest', schema);
