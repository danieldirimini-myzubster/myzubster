'use strict';

const crypto = require('crypto');

const DevelopmentRequest =
  require('../models/DevelopmentRequest');

const KnowledgeContribution =
  require('../models/knowledgeContributionModel');

const {
  VERIFIED_STATUSES,
  stableJson
} = require('./zorgaxKnowledgeService');

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function cleanList(values, maxItems = 30, maxLength = 1000) {
  if (!Array.isArray(values)) return [];

  return [...new Set(
    values
      .map(value => clean(value, maxLength))
      .filter(Boolean)
  )].slice(0, maxItems);
}

function normalizeDevelopmentRequestInput(input = {}) {
  const title = clean(input.title, 180);

  if (title.length < 3) {
    throw new Error(
      'Titolo DevelopmentRequest non valido'
    );
  }

  const knowledgeContributionIds =
    cleanList(
      input.knowledgeContributionIds,
      20,
      200
    );

  if (!knowledgeContributionIds.length) {
    throw new Error(
      'Almeno una Knowledge verificata è obbligatoria'
    );
  }

  const requirements =
    cleanList(input.requirements, 30, 1000);

  const acceptanceTests =
    cleanList(input.acceptanceTests, 30, 1000);

  const evidenceRequired =
    cleanList(input.evidenceRequired, 30, 1000);

  if (!requirements.length) {
    throw new Error(
      'Almeno un requisito è obbligatorio'
    );
  }

  if (!acceptanceTests.length) {
    throw new Error(
      'Almeno un acceptance test è obbligatorio'
    );
  }

  if (!evidenceRequired.length) {
    throw new Error(
      'Almeno una evidenza richiesta è obbligatoria'
    );
  }

  return {
    title,
    description:
      clean(input.description, 8000),

    knowledgeContributionIds,
    requirements,
    acceptanceTests,
    evidenceRequired
  };
}

async function resolveQuery(query) {
  if (
    query &&
    typeof query.lean === 'function'
  ) {
    return query.lean();
  }

  return query;
}

async function loadVerifiedKnowledgeRefs(
  contributionIds,
  KnowledgeModel = KnowledgeContribution
) {
  const ids =
    cleanList(contributionIds, 20, 200);

  if (!ids.length) {
    throw new Error(
      'Knowledge references mancanti'
    );
  }

  const docs = await resolveQuery(
    KnowledgeModel.find({
      contributionId: { $in: ids },
      status: { $in: [...VERIFIED_STATUSES] }
    })
  );

  const byId = new Map(
    (docs || []).map(item => [
      item.contributionId,
      item
    ])
  );

  const missing =
    ids.filter(id => !byId.has(id));

  if (missing.length) {
    throw new Error(
      `Knowledge non verificata o non trovata: ${missing.join(', ')}`
    );
  }

  return ids.map(id => {
    const item = byId.get(id);

    if (!item.contentHash) {
      throw new Error(
        `Knowledge ${id} non possiede contentHash`
      );
    }

    return {
      contributionId:
        item.contributionId,

      contentHash:
        item.contentHash,

      version:
        Math.max(1, Number(item.version) || 1),

      title:
        clean(item.title, 180)
    };
  });
}

function digestDevelopmentRequest(preview) {
  return crypto
    .createHash('sha256')
    .update(stableJson(preview))
    .digest('hex');
}

async function previewDevelopmentRequest({
  input,
  KnowledgeModel = KnowledgeContribution
}) {
  const normalized =
    normalizeDevelopmentRequestInput(input);

  const knowledgeRefs =
    await loadVerifiedKnowledgeRefs(
      normalized.knowledgeContributionIds,
      KnowledgeModel
    );

  const preview = {
    title: normalized.title,
    description: normalized.description,
    knowledgeRefs,
    requirements: normalized.requirements,
    acceptanceTests:
      normalized.acceptanceTests,
    evidenceRequired:
      normalized.evidenceRequired
  };

  const digest =
    digestDevelopmentRequest(preview);

  return {
    preview,
    digest,
    confirmation:
      `CONFERMA DEV ${digest.slice(0, 8)}`,
    persistent_write_performed: false,
    status: 'PREVIEW',
    next_status: 'DRAFT',
    bountyCreated: false,
    rewardCreated: false,
    paymentPerformed: false
  };
}

function assertConfirmedDevelopmentPreview({
  preview,
  digest,
  confirmation
}) {
  if (!preview || typeof preview !== 'object') {
    throw new Error(
      'DevelopmentRequest preview mancante'
    );
  }

  const expectedDigest =
    digestDevelopmentRequest(preview);

  if (clean(digest, 128) !== expectedDigest) {
    throw new Error(
      'Digest DevelopmentRequest non valido o preview modificata'
    );
  }

  const expectedConfirmation =
    `CONFERMA DEV ${expectedDigest.slice(0, 8)}`;

  if (
    clean(confirmation, 128) !==
    expectedConfirmation
  ) {
    throw new Error(
      'Conferma DevelopmentRequest non valida'
    );
  }

  return {
    preview,
    digest: expectedDigest,
    confirmation: expectedConfirmation
  };
}

async function revalidateKnowledgeSnapshot({
  knowledgeRefs,
  KnowledgeModel = KnowledgeContribution
}) {
  const current =
    await loadVerifiedKnowledgeRefs(
      knowledgeRefs.map(
        item => item.contributionId
      ),
      KnowledgeModel
    );

  const expectedById =
    new Map(
      knowledgeRefs.map(item => [
        item.contributionId,
        item
      ])
    );

  for (const item of current) {
    const expected =
      expectedById.get(item.contributionId);

    if (
      !expected ||
      expected.contentHash !== item.contentHash ||
      Number(expected.version) !==
        Number(item.version)
    ) {
      throw new Error(
        `Knowledge modificata dopo la preview: ${item.contributionId}`
      );
    }
  }

  return current;
}

async function findExisting({
  createdBy,
  requestHash,
  RequestModel
}) {
  if (
    typeof RequestModel.findOne !==
    'function'
  ) {
    return null;
  }

  return resolveQuery(
    RequestModel.findOne({
      createdBy,
      requestHash
    })
  );
}

async function commitDevelopmentRequest({
  createdBy,
  preview,
  digest,
  confirmation,
  RequestModel = DevelopmentRequest,
  KnowledgeModel = KnowledgeContribution
}) {
  const owner =
    clean(createdBy, 200);

  if (!owner) {
    throw new Error(
      'Utente autenticato obbligatorio'
    );
  }

  const confirmed =
    assertConfirmedDevelopmentPreview({
      preview,
      digest,
      confirmation
    });

  await revalidateKnowledgeSnapshot({
    knowledgeRefs:
      confirmed.preview.knowledgeRefs,
    KnowledgeModel
  });

  const requestHash =
    confirmed.digest;

  const existing =
    await findExisting({
      createdBy: owner,
      requestHash,
      RequestModel
    });

  if (existing) {
    return {
      request: existing,
      idempotent: true,
      persisted: true,
      bountyCreated: false,
      rewardCreated: false,
      paymentPerformed: false
    };
  }

  const requestId =
    `DEV-${crypto.randomUUID()
      .replace(/-/g, '')
      .slice(0, 20)}`;

  const document = {
    requestId,
    requestHash,
    createdBy: owner,

    title:
      confirmed.preview.title,

    description:
      confirmed.preview.description,

    knowledgeRefs:
      confirmed.preview.knowledgeRefs,

    requirements:
      confirmed.preview.requirements,

    acceptanceTests:
      confirmed.preview.acceptanceTests,

    evidenceRequired:
      confirmed.preview.evidenceRequired,

    status: 'DRAFT',

    bountyReference: null
  };

  try {
    const request =
      await RequestModel.create(document);

    return {
      request,
      idempotent: false,
      persisted: true,
      bountyCreated: false,
      rewardCreated: false,
      paymentPerformed: false
    };
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate =
        await findExisting({
          createdBy: owner,
          requestHash,
          RequestModel
        });

      if (duplicate) {
        return {
          request: duplicate,
          idempotent: true,
          persisted: true,
          bountyCreated: false,
          rewardCreated: false,
          paymentPerformed: false
        };
      }
    }

    throw error;
  }
}

function requireStatus(request, expected) {
  if (!request) {
    throw new Error(
      'DevelopmentRequest non trovato'
    );
  }

  if (request.status !== expected) {
    throw new Error(
      `DevelopmentRequest deve essere ${expected}`
    );
  }
}

async function openDevelopmentRequest(request) {
  requireStatus(request, 'DRAFT');

  request.status = 'OPEN';
  request.openedAt = new Date();

  await request.save();

  return request;
}

async function claimDevelopmentRequest(
  request,
  assigneeId
) {
  requireStatus(request, 'OPEN');

  const assignee =
    clean(assigneeId, 200);

  if (!assignee) {
    throw new Error(
      'Assignee autenticato obbligatorio'
    );
  }

  if (request.assigneeId) {
    throw new Error(
      'DevelopmentRequest già assegnato'
    );
  }

  request.assigneeId = assignee;
  request.claimedAt = new Date();
  request.status = 'IN_PROGRESS';

  await request.save();

  return request;
}

async function submitDevelopmentRequest({
  request,
  submittedBy,
  evidenceRefs,
  commitRefs,
  notes
}) {
  requireStatus(request, 'IN_PROGRESS');

  const actor =
    clean(submittedBy, 200);

  if (
    !actor ||
    String(request.assigneeId) !== actor
  ) {
    throw new Error(
      'Solo il contributor assegnato può inviare la delivery'
    );
  }

  const evidence =
    cleanList(evidenceRefs, 30, 500);

  const commits =
    cleanList(commitRefs, 30, 500);

  if (!evidence.length && !commits.length) {
    throw new Error(
      'La delivery richiede almeno una evidenza o commit reference'
    );
  }

  request.submission = {
    submittedBy: actor,
    evidenceRefs: evidence,
    commitRefs: commits,
    notes: clean(notes, 4000),
    submittedAt: new Date()
  };

  request.status = 'SUBMITTED';

  await request.save();

  return request;
}

async function reviewDevelopmentRequest({
  request,
  reviewerId,
  decision,
  notes
}) {
  requireStatus(request, 'SUBMITTED');

  const reviewer =
    clean(reviewerId, 200);

  const normalizedDecision =
    clean(decision, 20).toUpperCase();

  if (
    !['VERIFY', 'REJECT']
      .includes(normalizedDecision)
  ) {
    throw new Error(
      'Decisione review non valida'
    );
  }

  if (
    reviewer ===
      String(request.createdBy) ||
    reviewer ===
      String(request.assigneeId)
  ) {
    throw new Error(
      'La review deve essere indipendente'
    );
  }

  const submission =
    request.submission || {};

  const evidenceCount =
    Array.isArray(submission.evidenceRefs)
      ? submission.evidenceRefs.length
      : 0;

  const commitCount =
    Array.isArray(submission.commitRefs)
      ? submission.commitRefs.length
      : 0;

  if (
    normalizedDecision === 'VERIFY' &&
    evidenceCount + commitCount === 0
  ) {
    throw new Error(
      'Una delivery senza evidenze non può essere verificata'
    );
  }

  request.review = {
    reviewerId: reviewer,
    decision: normalizedDecision,
    notes: clean(notes, 4000),
    reviewedAt: new Date()
  };

  request.status =
    normalizedDecision === 'VERIFY'
      ? 'VERIFIED'
      : 'REJECTED';

  await request.save();

  return request;
}

function publicDevelopmentRequest(item = {}) {
  return {
    id:
      item._id
        ? String(item._id)
        : null,

    requestId:
      item.requestId || null,

    requestHash:
      item.requestHash || null,

    createdBy:
      item.createdBy || null,

    title:
      item.title || '',

    description:
      item.description || '',

    knowledgeRefs:
      Array.isArray(item.knowledgeRefs)
        ? item.knowledgeRefs
        : [],

    requirements:
      Array.isArray(item.requirements)
        ? item.requirements
        : [],

    acceptanceTests:
      Array.isArray(item.acceptanceTests)
        ? item.acceptanceTests
        : [],

    evidenceRequired:
      Array.isArray(item.evidenceRequired)
        ? item.evidenceRequired
        : [],

    status:
      item.status || null,

    assigneeId:
      item.assigneeId || null,

    submission:
      item.submission || null,

    review:
      item.review || null,

    bountyReference:
      item.bountyReference || null,

    createdAt:
      item.createdAt || null,

    updatedAt:
      item.updatedAt || null
  };
}

module.exports = {
  normalizeDevelopmentRequestInput,
  loadVerifiedKnowledgeRefs,
  digestDevelopmentRequest,
  previewDevelopmentRequest,
  assertConfirmedDevelopmentPreview,
  revalidateKnowledgeSnapshot,
  commitDevelopmentRequest,
  openDevelopmentRequest,
  claimDevelopmentRequest,
  submitDevelopmentRequest,
  reviewDevelopmentRequest,
  publicDevelopmentRequest
};
