'use strict';

const crypto = require('crypto');
const KnowledgeContribution = require('../models/knowledgeContributionModel');

const VERIFIED_STATUSES = Object.freeze([
  'APPROVED',
  'REWARD_ELIGIBLE',
  'REWARDED'
]);

const KNOWLEDGE_VISIBILITIES = Object.freeze([
  'INTERNAL',
  'PUBLIC'
]);

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function digestKnowledgePreview(preview) {
  return crypto
    .createHash('sha256')
    .update(stableJson(preview))
    .digest('hex');
}

function normalizeKnowledgeInput(input = {}) {
  const title = clean(input.title, 180);

  if (title.length < 3) {
    throw new Error('Titolo conoscenza non valido');
  }

  return {
    type: clean(input.type || 'zorgax_knowledge', 80) || 'zorgax_knowledge',
    title,
    description: clean(input.description, 4000),
    reference: clean(input.reference, 500) || null,
    category: clean(input.category, 80) || 'general'
  };
}

function previewKnowledge(input = {}) {
  const preview = normalizeKnowledgeInput(input);
  const digest = digestKnowledgePreview(preview);

  return {
    preview,
    digest,
    confirmation: `CONFERMA ${digest.slice(0, 8)}`,
    persistent_write_performed: false,
    visibility: 'INTERNAL',
    status: 'PREVIEW',
    next_status: 'PENDING_REVIEW'
  };
}

function assertConfirmedPreview({ preview, digest, confirmation }) {
  if (!preview || typeof preview !== 'object') {
    throw new Error('Preview conoscenza mancante');
  }

  const normalized = normalizeKnowledgeInput(preview);
  const expectedDigest = digestKnowledgePreview(normalized);
  const suppliedDigest = clean(digest, 128);
  const suppliedConfirmation = clean(confirmation, 128);
  const expectedConfirmation = `CONFERMA ${expectedDigest.slice(0, 8)}`;

  if (suppliedDigest !== expectedDigest) {
    throw new Error('Digest conoscenza non valido o preview modificata');
  }

  if (suppliedConfirmation !== expectedConfirmation) {
    throw new Error('Conferma esplicita non valida');
  }

  return {
    preview: normalized,
    digest: expectedDigest,
    confirmation: expectedConfirmation
  };
}

async function commitKnowledgeCandidate({
  authorId,
  preview,
  digest,
  confirmation,
  KnowledgeModel = KnowledgeContribution
}) {
  const owner = clean(authorId, 200);

  if (!owner) {
    throw new Error('Utente autenticato obbligatorio');
  }

  const confirmed = assertConfirmedPreview({
    preview,
    digest,
    confirmation
  });

  const contributionId =
    `ZK-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

  const contribution = await KnowledgeModel.create({
    contributionId,
    authorId: owner,
    ...confirmed.preview,
    visibility: 'INTERNAL',
    status: 'PENDING_REVIEW'
  });

  return {
    contribution,
    digest: confirmed.digest,
    persisted: true,
    rewardCreated: false,
    ledgerWritten: false,
    myzTransferred: false
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchFilter(query, { includeInternal = false } = {}) {
  const text = clean(query, 200);

  const filter = {
    status: { $in: [...VERIFIED_STATUSES] }
  };

  if (includeInternal) {
    // Legacy verified records without visibility remain INTERNAL.
    filter.$or = [
      { visibility: { $in: ['INTERNAL', 'PUBLIC'] } },
      { visibility: { $exists: false } }
    ];
  } else {
    // Public retrieval is fail-closed.
    filter.visibility = 'PUBLIC';
  }

  const terms = [...new Set(
    text
      .split(/\s+/)
      .map(term => term.trim())
      .filter(term => term.length >= 2)
      .slice(0, 6)
  )];

  if (terms.length) {
    filter.$and = terms.map(term => {
      const rx = new RegExp(escapeRegex(term), 'i');

      return {
        $or: [
          { title: rx },
          { description: rx },
          { category: rx },
          { reference: rx }
        ]
      };
    });
  }

  return filter;
}

async function searchVerifiedKnowledge({
  query,
  limit = 5,
  includeInternal = false,
  KnowledgeModel = KnowledgeContribution
}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 20));

  // Do not make assistant replies depend on Mongo buffering when storage
  // is unavailable. Injected models used by tests do not have db.
  if (
    KnowledgeModel?.db &&
    Number(KnowledgeModel.db.readyState) !== 1
  ) {
    return [];
  }

  const filter = buildSearchFilter(query, { includeInternal });

  return KnowledgeModel
    .find(filter)
    .sort({ reviewedAt: -1, updatedAt: -1 })
    .limit(safeLimit)
    .lean();
}

function effectiveVisibility(item = {}) {
  return item.visibility === 'PUBLIC' ? 'PUBLIC' : 'INTERNAL';
}

function publicKnowledge(item = {}) {
  return {
    id: item._id ? String(item._id) : null,
    contributionId: item.contributionId || null,
    type: item.type || null,
    title: item.title || '',
    description: item.description || '',
    reference: item.reference || null,
    category: item.category || null,
    status: item.status || null,
    visibility: effectiveVisibility(item),
    reviewedAt: item.reviewedAt || null,
    publishedAt: item.publishedAt || null,
    updatedAt: item.updatedAt || null
  };
}

function buildKnowledgeContext(
  items = [],
  { includeInternal = false } = {}
) {
  const safe = items
    .filter(item => VERIFIED_STATUSES.includes(item.status))
    .filter(item => {
      const visibility = effectiveVisibility(item);
      return visibility === 'PUBLIC' || includeInternal;
    })
    .map(publicKnowledge);

  if (!safe.length) return '';

  return [
    'INTERNAL VERIFIED KNOWLEDGE:',
    'Treat this as reviewed first-party MyZubster knowledge. Do not present INTERNAL items as public documentation.',
    ...safe.map((item, index) => [
      `[K${index + 1}] ${item.title}`,
      `status=${item.status}`,
      `visibility=${item.visibility}`,
      item.category ? `category=${item.category}` : '',
      item.description,
      item.reference ? `reference=${item.reference}` : ''
    ].filter(Boolean).join('\n'))
  ].join('\n\n');
}

module.exports = {
  VERIFIED_STATUSES,
  KNOWLEDGE_VISIBILITIES,
  stableJson,
  digestKnowledgePreview,
  normalizeKnowledgeInput,
  previewKnowledge,
  assertConfirmedPreview,
  commitKnowledgeCandidate,
  buildSearchFilter,
  searchVerifiedKnowledge,
  effectiveVisibility,
  publicKnowledge,
  buildKnowledgeContext
};
