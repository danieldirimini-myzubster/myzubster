'use strict';

const {
  previewKnowledge,
  commitKnowledgeCandidate
} = require('../src/services/zorgaxKnowledgeService');

function queryResult(value) {
  return {
    lean: jest.fn(async () => value)
  };
}

describe('Zorgax Knowledge provenance v1', () => {
  test('content hash identifies content while preview digest also protects provenance', () => {
    const a = previewKnowledge({
      title: 'Verified knowledge retrieval',
      description:
        'Only reviewed knowledge enters canonical context.',
      category: 'architecture',
      source: {
        type: 'engineering',
        reference: 'commit:46e179d4'
      },
      evidenceRefs: [
        'test:zorgaxKnowledgeService'
      ]
    });

    const b = previewKnowledge({
      title: 'Verified knowledge retrieval',
      description:
        'Only reviewed knowledge enters canonical context.',
      category: 'architecture',
      source: {
        type: 'engineering',
        reference: 'commit:46e179d4'
      },
      evidenceRefs: [
        'test:anotherEvidence'
      ]
    });

    expect(a.contentHash)
      .toMatch(/^[a-f0-9]{64}$/);

    expect(a.contentHash)
      .toBe(b.contentHash);

    expect(a.digest)
      .not.toBe(b.digest);
  });

  test('persists provenance and version 1 for a new candidate', async () => {
    const prepared = previewKnowledge({
      title: 'Knowledge provenance',
      description:
        'Canonical knowledge records their evidence.',
      source: {
        type: 'engineering',
        reference: 'commit:46e179d4'
      },
      evidenceRefs: [
        'test:zorgaxKnowledgeService',
        'test:zorgaxKnowledgeService',
        'commit:46e179d4'
      ]
    });

    const create = jest.fn(async doc => ({
      _id: 'k1',
      ...doc
    }));

    const findOne = jest.fn(
      () => queryResult(null)
    );

    const result =
      await commitKnowledgeCandidate({
        authorId: 'author-1',
        preview: prepared.preview,
        digest: prepared.digest,
        confirmation: prepared.confirmation,
        KnowledgeModel: {
          findOne,
          create
        }
      });

    expect(result.idempotent).toBe(false);

    const written = create.mock.calls[0][0];

    expect(written.contentHash)
      .toBe(prepared.contentHash);

    expect(written.version).toBe(1);

    expect(written.source).toEqual({
      type: 'engineering',
      reference: 'commit:46e179d4'
    });

    expect(written.evidenceRefs).toEqual([
      'test:zorgaxKnowledgeService',
      'commit:46e179d4'
    ]);

    expect(written.status)
      .toBe('PENDING_REVIEW');

    expect(written.visibility)
      .toBe('INTERNAL');
  });

  test('retrying identical content for the same author is idempotent', async () => {
    const prepared = previewKnowledge({
      title: 'Idempotent knowledge',
      description:
        'Retry must not create duplicate knowledge.'
    });

    const existing = {
      _id: 'existing-1',
      contributionId: 'ZK-existing',
      authorId: 'author-1',
      contentHash: prepared.contentHash,
      version: 1,
      status: 'PENDING_REVIEW',
      visibility: 'INTERNAL'
    };

    const create = jest.fn();

    const findOne = jest.fn(
      () => queryResult(existing)
    );

    const result =
      await commitKnowledgeCandidate({
        authorId: 'author-1',
        preview: prepared.preview,
        digest: prepared.digest,
        confirmation: prepared.confirmation,
        KnowledgeModel: {
          findOne,
          create
        }
      });

    expect(result.idempotent).toBe(true);
    expect(result.contribution)
      .toEqual(existing);

    expect(create)
      .not.toHaveBeenCalled();
  });

  test('a new version can supersede verified knowledge', async () => {
    const prepared = previewKnowledge({
      title: 'Architecture invariant v2',
      description:
        'Updated verified architecture invariant.',
      supersedesContributionId: 'ZK-v1',
      source: {
        type: 'engineering',
        reference: 'commit:new'
      }
    });

    const previous = {
      contributionId: 'ZK-v1',
      status: 'APPROVED',
      version: 1
    };

    const findOne = jest.fn(filter => {
      if (filter.contentHash) {
        return queryResult(null);
      }

      if (
        filter.contributionId === 'ZK-v1'
      ) {
        return queryResult(previous);
      }

      return queryResult(null);
    });

    const create = jest.fn(async doc => ({
      _id: 'v2',
      ...doc
    }));

    await commitKnowledgeCandidate({
      authorId: 'author-2',
      preview: prepared.preview,
      digest: prepared.digest,
      confirmation: prepared.confirmation,
      KnowledgeModel: {
        findOne,
        create
      }
    });

    const written = create.mock.calls[0][0];

    expect(written.version).toBe(2);

    expect(written.supersedesContributionId)
      .toBe('ZK-v1');
  });

  test('cannot supersede unreviewed knowledge', async () => {
    const prepared = previewKnowledge({
      title: 'Invalid version chain',
      description:
        'Pending knowledge cannot be canonical predecessor.',
      supersedesContributionId: 'ZK-pending'
    });

    const findOne = jest.fn(filter => {
      if (filter.contentHash) {
        return queryResult(null);
      }

      return queryResult({
        contributionId: 'ZK-pending',
        status: 'PENDING_REVIEW',
        version: 1
      });
    });

    await expect(
      commitKnowledgeCandidate({
        authorId: 'author-3',
        preview: prepared.preview,
        digest: prepared.digest,
        confirmation: prepared.confirmation,
        KnowledgeModel: {
          findOne,
          create: jest.fn()
        }
      })
    ).rejects.toThrow(
      /Solo conoscenza verificata/
    );
  });
});
