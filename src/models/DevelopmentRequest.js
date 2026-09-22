'use strict';

const mongoose = require('mongoose');

const DEVELOPMENT_REQUEST_STATUSES = Object.freeze([
  'DRAFT',
  'OPEN',
  'IN_PROGRESS',
  'SUBMITTED',
  'VERIFIED',
  'REJECTED',
  'CANCELLED'
]);

const knowledgeRefSchema = new mongoose.Schema({
  contributionId: {
    type: String,
    required: true
  },
  contentHash: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    required: true,
    min: 1
  },
  title: {
    type: String,
    required: true,
    maxlength: 180
  }
}, { _id: false });

const evidenceItemSchema = new mongoose.Schema({
  requirement: {
    type: String,
    required: true,
    maxlength: 1000
  },
  reference: {
    type: String,
    required: true,
    maxlength: 500
  }
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  evidence: {
    type: [evidenceItemSchema],
    default: []
  },
  submittedBy: {
    type: String,
    default: null
  },
  evidenceRefs: [{
    type: String,
    maxlength: 500
  }],
  commitRefs: [{
    type: String,
    maxlength: 500
  }],
  notes: {
    type: String,
    default: '',
    maxlength: 4000
  },
  submittedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  reviewerId: {
    type: String,
    default: null
  },
  decision: {
    type: String,
    enum: ['VERIFY', 'REJECT'],
    default: null
  },
  notes: {
    type: String,
    default: '',
    maxlength: 4000
  },
  reviewedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const developmentRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  requestHash: {
    type: String,
    required: true,
    index: true
  },

  createdBy: {
    type: String,
    required: true,
    index: true
  },

  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 180
  },

  description: {
    type: String,
    default: '',
    maxlength: 8000
  },

  knowledgeRefs: {
    type: [knowledgeRefSchema],
    required: true,
    validate: {
      validator: value =>
        Array.isArray(value) &&
        value.length >= 1 &&
        value.length <= 20,
      message:
        'DevelopmentRequest requires 1-20 verified knowledge references'
    }
  },

  requirements: [{
    type: String,
    maxlength: 1000
  }],

  acceptanceTests: [{
    type: String,
    maxlength: 1000
  }],

  evidenceRequired: [{
    type: String,
    maxlength: 1000
  }],

  status: {
    type: String,
    enum: DEVELOPMENT_REQUEST_STATUSES,
    default: 'DRAFT',
    index: true
  },

  assigneeId: {
    type: String,
    default: null,
    index: true
  },

  openedAt: {
    type: Date,
    default: null
  },

  claimedAt: {
    type: Date,
    default: null
  },

  submission: {
    type: submissionSchema,
    default: () => ({})
  },

  review: {
    type: reviewSchema,
    default: () => ({})
  },

  // Deliberately optional. Development work exists independently
  // from GitHub issues, bounty funding and settlement.
  bountyReference: {
    type: String,
    default: null,
    maxlength: 500
  }
}, {
  timestamps: true
});

developmentRequestSchema.index(
  { createdBy: 1, requestHash: 1 },
  {
    unique: true,
    name: 'development_request_creator_hash_unique'
  }
);

developmentRequestSchema.index({
  status: 1,
  createdAt: -1
});

developmentRequestSchema.index({
  assigneeId: 1,
  status: 1
});

const DevelopmentRequest =
  mongoose.models.DevelopmentRequest ||
  mongoose.model(
    'DevelopmentRequest',
    developmentRequestSchema
  );

DevelopmentRequest.STATUSES =
  DEVELOPMENT_REQUEST_STATUSES;

module.exports = DevelopmentRequest;
