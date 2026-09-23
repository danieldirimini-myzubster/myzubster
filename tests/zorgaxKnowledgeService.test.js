'use strict';

const {
  VERIFIED_STATUSES,
  previewKnowledge,
  digestKnowledgePreview,
  assertConfirmedPreview,
  commitKnowledgeCandidate,
  buildSearchFilter,
  buildPublicSearchFilter,
  searchVerifiedKnowledge,
  searchPublicKnowledge,
  buildKnowledgeContext
} = require('../src/services/zorgaxKnowledgeService');

describe('Zorgax verified internal knowledge', () => {
  test('creates a deterministic non-persistent internal preview', () => {
    const result = previewKnowledge({
      title: 'Cultural public API privacy',
      category: 'privacy',
      description: 'Public reads must not expose ownerId.'
    });

    expect(result.persistent_write_performed).toBe(false);
    expect(result.visibility).toBe('INTERNAL');
    expect(result.confirmation).toBe(
      `CONFERMA ${result.digest.slice(0, 8)}`
    );
    expect(digestKnowledgePreview(result.preview))
      .toBe(result.digest);
  });

  test('rejects a modified preview after confirmation', () => {
    const result = previewKnowledge({
      title: 'Payment verification',
      description:
        'Expected recipient comes from server-owned state.'
    });

    const tampered = {
      ...result.preview,
      description: 'Modified after preview'
    };

    expect(() => assertConfirmedPreview({
      preview: tampered,
      digest: result.digest,
      confirmation: result.confirmation
    })).toThrow(/Digest conoscenza non valido/);
  });

  test('commits only an INTERNAL pending-review candidate', async () => {
    const result = previewKnowledge({
      title: 'Kefir community contract',
      category: 'marketplace',
      description: 'Kefir culture listings are FREE-only.'
    });

    const create = jest.fn(async doc => ({
      _id: 'knowledge-1',
      ...doc
    }));

    const committed = await commitKnowledgeCandidate({
      authorId: 'user-1',
      preview: result.preview,
      digest: result.digest,
      confirmation: result.confirmation,
      KnowledgeModel: { create }
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].status)
      .toBe('PENDING_REVIEW');
    expect(create.mock.calls[0][0].visibility)
      .toBe('INTERNAL');

    expect(committed.rewardCreated).toBe(false);
    expect(committed.ledgerWritten).toBe(false);
    expect(committed.myzTransferred).toBe(false);
  });

  test('public explorer retrieval includes every explicit PUBLIC record', () => {
    const filter = buildPublicSearchFilter('privacy marketplace');

    expect(filter.visibility).toBe('PUBLIC');
    expect(filter.status).toBeUndefined();
    expect(filter.$and).toHaveLength(2);
  });

  test('verified retrieval remains restricted for trusted assistant context', () => {
    const filter = buildSearchFilter('privacy marketplace');

    expect(filter.status.$in).toEqual(VERIFIED_STATUSES);
    expect(filter.visibility).toBe('PUBLIC');

    expect(filter.status.$in)
      .not.toContain('PENDING_REVIEW');

    expect(filter.status.$in)
      .not.toContain('REJECTED');
  });

  test('internal retrieval may include legacy verified records', () => {
    const filter = buildSearchFilter(
      'architecture',
      { includeInternal: true }
    );

    expect(filter.status.$in).toEqual(VERIFIED_STATUSES);
    expect(filter.$or).toEqual(
      expect.arrayContaining([
        { visibility: { $exists: false } }
      ])
    );
  });

  test('assistant context fails closed for INTERNAL knowledge', () => {
    const items = [
      {
        status: 'APPROVED',
        visibility: 'INTERNAL',
        title: 'Internal architecture decision',
        description: 'Internal only.'
      },
      {
        status: 'APPROVED',
        visibility: 'PUBLIC',
        title: 'Public privacy invariant',
        description:
          'Public reads do not expose owner identity.',
        category: 'privacy'
      }
    ];

    const publicContext = buildKnowledgeContext(items);

    expect(publicContext)
      .toContain('Public privacy invariant');

    expect(publicContext)
      .not.toContain('Internal architecture decision');

    const internalContext = buildKnowledgeContext(
      items,
      { includeInternal: true }
    );

    expect(internalContext)
      .toContain('Internal architecture decision');
  });

  test('returns no knowledge immediately when Mongo is disconnected', async () => {
    const find = jest.fn();

    const verified = await searchVerifiedKnowledge({
      query: 'privacy',
      KnowledgeModel: {
        db: { readyState: 0 },
        find
      }
    });

    const publicItems = await searchPublicKnowledge({
      query: 'privacy',
      KnowledgeModel: {
        db: { readyState: 0 },
        find
      }
    });

    expect(verified).toEqual([]);
    expect(publicItems).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });
});
