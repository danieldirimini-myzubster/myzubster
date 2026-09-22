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

const KNOWLEDGE_SOURCE_TYPES = Object.freeze([
  'manual',
  'engineering',
  'document',
  'research',
  'runtime',
  'other'
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

function cleanEvidenceRefs(values) {
  if (!Array.isArray(values)) return [];

  return [...new Set(
    values
      .map(value => clean(value, 500))
      .filter(Boolean)
  )].slice(0, 20);
}

function normalizeKnowledgeContent(input = {}) {
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

function digestKnowledgeContent(input = {}) {
  return crypto
    .createHash('sha256')
    .update(stableJson(normalizeKnowledgeContent(input)))
    .digest('hex');
}

function normalizeKnowledgeInput(input = {}) {
  const content = normalizeKnowledgeContent(input);

  const rawSource =
    input.source && typeof input.source === 'object'
      ? input.source
      : {};

  const requestedSourceType =
    clean(rawSource.type || input.sourceType || 'manual', 40)
      .toLowerCase();

  const sourceType =
    KNOWLEDGE_SOURCE_TYPES.includes(requestedSourceType)
      ? requestedSourceType
      : 'other';

  return {
    ...content,

    source: {
      type: sourceType,
      reference:
        clean(
          rawSource.reference || input.sourceReference,
          500
        ) || null
    },

    evidenceRefs: cleanEvidenceRefs(input.evidenceRefs),

    supersedesContributionId:
      clean(input.supersedesContributionId, 200) || null
  };
}

function digestKnowledgePreview(preview) {
  return crypto
    .createHash('sha256')
    .update(stableJson(preview))
    .digest('hex');
}

function previewKnowledge(input = {}) {
  const preview = normalizeKnowledgeInput(input);

  const contentHash = digestKnowledgeContent(preview);
  const digest = digestKnowledgePreview(preview);

  return {
    preview,
    contentHash,
    digest,
    confirmation: `CONFERMA ${digest.slice(0, 8)}`,
    persistent_write_performed: false,
    visibility: 'INTERNAL',
    status: 'PREVIEW',
    next_status: 'PENDING_REVIEW'
  };
}

function assertConfirmedPreview({
  preview,
  digest,
  confirmation
}) {
  if (!preview || typeof preview !== 'object') {
    throw new Error('Preview conoscenza mancante');
  }

  const normalized = normalizeKnowledgeInput(preview);
  const expectedDigest = digestKnowledgePreview(normalized);
  const expectedContentHash =
    digestKnowledgeContent(normalized);

  const suppliedDigest = clean(digest, 128);
  const suppliedConfirmation = clean(confirmation, 128);

  const expectedConfirmation =
    `CONFERMA ${expectedDigest.slice(0, 8)}`;

  if (suppliedDigest !== expectedDigest) {
    throw new Error(
      'Digest conoscenza non valido o preview modificata'
    );
  }

  if (suppliedConfirmation !== expectedConfirmation) {
    throw new Error('Conferma esplicita non valida');
  }

  return {
    preview: normalized,
    digest: expectedDigest,
    contentHash: expectedContentHash,
    confirmation: expectedConfirmation
  };
}

async function maybeLean(query) {
  if (!query) return null;

  if (typeof query.lean === 'function') {
    return query.lean();
  }

  return query;
}

async function findExistingByAuthorHash({
  authorId,
  contentHash,
  KnowledgeModel
}) {
  if (typeof KnowledgeModel.findOne !== 'function') {
    return null;
  }

  return maybeLean(
    KnowledgeModel.findOne({
      authorId,
      contentHash
    })
  );
}

async function resolveVersion({
  preview,
  KnowledgeModel
}) {
  if (!preview.supersedesContributionId) {
    return 1;
  }

  if (typeof KnowledgeModel.findOne !== 'function') {
    throw new Error(
      'Versione precedente non verificabile'
    );
  }

  const previous = await maybeLean(
    KnowledgeModel.findOne({
      contributionId:
        preview.supersedesContributionId
    })
  );

  if (!previous) {
    throw new Error(
      'Conoscenza precedente non trovata'
    );
  }

  if (!VERIFIED_STATUSES.includes(previous.status)) {
    throw new Error(
      'Solo conoscenza verificata può essere superseded'
    );
  }

  const previousVersion =
    Math.max(1, Number(previous.version) || 1);

  return previousVersion + 1;
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

  const existing =
    await findExistingByAuthorHash({
      authorId: owner,
      contentHash: confirmed.contentHash,
      KnowledgeModel
    });

  if (existing) {
    return {
      contribution: existing,
      digest: confirmed.digest,
      contentHash: confirmed.contentHash,
      persisted: true,
      idempotent: true,
      rewardCreated: false,
      ledgerWritten: false,
      myzTransferred: false
    };
  }

  const version = await resolveVersion({
    preview: confirmed.preview,
    KnowledgeModel
  });

  const contributionId =
    `ZK-${crypto.randomUUID()
      .replace(/-/g, '')
      .slice(0, 20)}`;

  const document = {
    contributionId,
    authorId: owner,

    type: confirmed.preview.type,
    title: confirmed.preview.title,
    description: confirmed.preview.description,
    reference: confirmed.preview.reference,
    category: confirmed.preview.category,

    contentHash: confirmed.contentHash,
    version,
    supersedesContributionId:
      confirmed.preview.supersedesContributionId,

    source: confirmed.preview.source,
    evidenceRefs: confirmed.preview.evidenceRefs,

    visibility: 'INTERNAL',
    status: 'PENDING_REVIEW'
  };

  try {
    const contribution =
      await KnowledgeModel.create(document);

    return {
      contribution,
      digest: confirmed.digest,
      contentHash: confirmed.contentHash,
      persisted: true,
      idempotent: false,
      rewardCreated: false,
      ledgerWritten: false,
      myzTransferred: false
    };
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate =
        await findExistingByAuthorHash({
          authorId: owner,
          contentHash: confirmed.contentHash,
          KnowledgeModel
        });

      if (duplicate) {
        return {
          contribution: duplicate,
          digest: confirmed.digest,
          contentHash: confirmed.contentHash,
          persisted: true,
          idempotent: true,
          rewardCreated: false,
          ledgerWritten: false,
          myzTransferred: false
        };
      }
    }

    throw error;
  }
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function buildSearchFilter(
  query,
  { includeInternal = false } = {}
) {
  const text = clean(query, 200);

  const filter = {
    status: { $in: [...VERIFIED_STATUSES] }
  };

  if (includeInternal) {
    filter.$or = [
      {
        visibility: {
          $in: ['INTERNAL', 'PUBLIC']
        }
      },
      { visibility: { $exists: false } }
    ];
  } else {
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
      const rx =
        new RegExp(escapeRegex(term), 'i');

      return {
        $or: [
          { title: rx },
          { description: rx },
          { category: rx },
          { reference: rx },
          { evidenceRefs: rx },
          { 'source.reference': rx }
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
  const safeLimit =
    Math.max(
      1,
      Math.min(Number(limit) || 5, 20)
    );

  if (
    KnowledgeModel?.db &&
    Number(KnowledgeModel.db.readyState) !== 1
  ) {
    return [];
  }

  const filter =
    buildSearchFilter(
      query,
      { includeInternal }
    );

  return KnowledgeModel
    .find(filter)
    .sort({
      reviewedAt: -1,
      updatedAt: -1
    })
    .limit(safeLimit)
    .lean();
}

function effectiveVisibility(item = {}) {
  return item.visibility === 'PUBLIC'
    ? 'PUBLIC'
    : 'INTERNAL';
}

function publicKnowledge(item = {}) {
  return {
    id: item._id ? String(item._id) : null,

    contributionId:
      item.contributionId || null,

    contentHash:
      item.contentHash || null,

    version:
      Math.max(1, Number(item.version) || 1),

    supersedesContributionId:
      item.supersedesContributionId || null,

    type: item.type || null,
    title: item.title || '',
    description: item.description || '',
    reference: item.reference || null,
    category: item.category || null,

    source: {
      type: item.source?.type || 'manual',
      reference:
        item.source?.reference || null
    },

    evidenceRefs:
      Array.isArray(item.evidenceRefs)
        ? item.evidenceRefs
        : [],

    status: item.status || null,

    visibility:
      effectiveVisibility(item),

    reviewedAt:
      item.reviewedAt || null,

    publishedAt:
      item.publishedAt || null,

    updatedAt:
      item.updatedAt || null
  };
}

function buildKnowledgeContext(
  items = [],
  { includeInternal = false } = {}
) {
  const safe = items
    .filter(item =>
      VERIFIED_STATUSES.includes(item.status)
    )
    .filter(item => {
      const visibility =
        effectiveVisibility(item);

      return (
        visibility === 'PUBLIC' ||
        includeInternal
      );
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
      `version=${item.version}`,

      item.category
        ? `category=${item.category}`
        : '',

      item.source?.type
        ? `source=${item.source.type}`
        : '',

      item.source?.reference
        ? `source_reference=${item.source.reference}`
        : '',

      item.description,

      item.reference
        ? `reference=${item.reference}`
        : '',

      item.evidenceRefs.length
        ? `evidence=${item.evidenceRefs
            .slice(0, 5)
            .join(', ')}`
        : ''
    ]
      .filter(Boolean)
      .join('\n'))
  ].join('\n\n');
}

module.exports = {
  VERIFIED_STATUSES,
  KNOWLEDGE_VISIBILITIES,
  KNOWLEDGE_SOURCE_TYPES,

  stableJson,
  normalizeKnowledgeContent,
  digestKnowledgeContent,
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
