'use strict';

const {
  previewDevelopmentRequest,
  commitDevelopmentRequest,
  openDevelopmentRequest,
  claimDevelopmentRequest,
  submitDevelopmentRequest,
  reviewDevelopmentRequest
} = require(
  '../src/services/zorgaxDevelopmentRequestService'
);

function leanResult(value) {
  return {
    lean: jest.fn(
      async () => value
    )
  };
}

function verifiedKnowledge(overrides = {}) {
  return {
    contributionId: 'ZK-1',
    contentHash: 'a'.repeat(64),
    version: 2,
    title: 'Verified architecture',
    status: 'APPROVED',
    ...overrides
  };
}

function KnowledgeModelWith(items) {
  return {
    find: jest.fn(
      () => leanResult(items)
    )
  };
}

function requestDoc(overrides = {}) {
  return {
    requestId: 'DEV-1',
    createdBy: 'creator-1',
    status: 'DRAFT',
    assigneeId: null,
    submission: {},
    review: {},
    save:
      jest.fn()
        .mockResolvedValue(undefined),
    ...overrides
  };
}

describe(
  'Zorgax DevelopmentRequest v1',
  () => {
    test(
      'preview is non-persistent and derives only from verified knowledge',
      async () => {
        const KnowledgeModel =
          KnowledgeModelWith([
            verifiedKnowledge()
          ]);

        const result =
          await previewDevelopmentRequest({
            input: {
              title:
                'Build verified development workflow',

              description:
                'Turn verified knowledge into executable work.',

              knowledgeContributionIds:
                ['ZK-1'],

              requirements: [
                'Use verified Knowledge'
              ],

              acceptanceTests: [
                'Unreviewed Knowledge is rejected'
              ],

              evidenceRequired: [
                'Passing tests'
              ]
            },

            KnowledgeModel
          });

        expect(
          result.persistent_write_performed
        ).toBe(false);

        expect(result.next_status)
          .toBe('DRAFT');

        expect(
          result.preview.knowledgeRefs[0]
        ).toEqual(
          expect.objectContaining({
            contributionId: 'ZK-1',
            version: 2,
            contentHash:
              'a'.repeat(64)
          })
        );

        expect(result.bountyCreated)
          .toBe(false);

        expect(result.paymentPerformed)
          .toBe(false);
      }
    );

    test(
      'rejects missing or unverified knowledge',
      async () => {
        const KnowledgeModel =
          KnowledgeModelWith([]);

        await expect(
          previewDevelopmentRequest({
            input: {
              title:
                'Invalid development request',

              knowledgeContributionIds:
                ['ZK-missing'],

              requirements:
                ['Requirement'],

              acceptanceTests:
                ['Acceptance'],

              evidenceRequired:
                ['Evidence']
            },

            KnowledgeModel
          })
        ).rejects.toThrow(
          /non verificata o non trovata/
        );
      }
    );

    test(
      'commit creates only a DRAFT and no bounty or reward',
      async () => {
        const knowledge =
          verifiedKnowledge();

        const KnowledgeModel =
          KnowledgeModelWith([knowledge]);

        const prepared =
          await previewDevelopmentRequest({
            input: {
              title:
                'Development request draft',

              knowledgeContributionIds:
                ['ZK-1'],

              requirements:
                ['Requirement'],

              acceptanceTests:
                ['Acceptance'],

              evidenceRequired:
                ['Evidence']
            },

            KnowledgeModel
          });

        const create =
          jest.fn(async doc => ({
            _id: 'dev-1',
            ...doc
          }));

        const RequestModel = {
          findOne:
            jest.fn(
              () => leanResult(null)
            ),
          create
        };

        const result =
          await commitDevelopmentRequest({
            createdBy: 'creator-1',
            preview: prepared.preview,
            digest: prepared.digest,
            confirmation:
              prepared.confirmation,
            RequestModel,
            KnowledgeModel
          });

        expect(result.idempotent)
          .toBe(false);

        expect(
          create.mock.calls[0][0].status
        ).toBe('DRAFT');

        expect(
          create.mock.calls[0][0]
            .bountyReference
        ).toBeNull();

        expect(result.bountyCreated)
          .toBe(false);

        expect(result.rewardCreated)
          .toBe(false);

        expect(result.paymentPerformed)
          .toBe(false);
      }
    );

    test(
      'identical commit is idempotent',
      async () => {
        const KnowledgeModel =
          KnowledgeModelWith([
            verifiedKnowledge()
          ]);

        const prepared =
          await previewDevelopmentRequest({
            input: {
              title:
                'Idempotent request',

              knowledgeContributionIds:
                ['ZK-1'],

              requirements:
                ['Requirement'],

              acceptanceTests:
                ['Acceptance'],

              evidenceRequired:
                ['Evidence']
            },

            KnowledgeModel
          });

        const existing = {
          requestId: 'DEV-existing',
          createdBy: 'creator-1',
          requestHash:
            prepared.digest,
          status: 'DRAFT'
        };

        const create = jest.fn();

        const result =
          await commitDevelopmentRequest({
            createdBy: 'creator-1',
            preview: prepared.preview,
            digest: prepared.digest,
            confirmation:
              prepared.confirmation,

            RequestModel: {
              findOne:
                jest.fn(
                  () =>
                    leanResult(existing)
                ),
              create
            },

            KnowledgeModel
          });

        expect(result.idempotent)
          .toBe(true);

        expect(create)
          .not.toHaveBeenCalled();
      }
    );

    test(
      'admin-open lifecycle changes DRAFT to OPEN',
      async () => {
        const request = requestDoc();

        await openDevelopmentRequest(
          request
        );

        expect(request.status)
          .toBe('OPEN');

        expect(request.openedAt)
          .toBeInstanceOf(Date);

        expect(request.save)
          .toHaveBeenCalledTimes(1);
      }
    );

    test(
      'authenticated contributor can claim an OPEN request',
      async () => {
        const request =
          requestDoc({
            status: 'OPEN'
          });

        await claimDevelopmentRequest(
          request,
          'developer-1'
        );

        expect(request.status)
          .toBe('IN_PROGRESS');

        expect(request.assigneeId)
          .toBe('developer-1');
      }
    );

    test(
      'submission requires evidence and the assigned contributor',
      async () => {
        const request =
          requestDoc({
            status: 'IN_PROGRESS',
            assigneeId:
              'developer-1'
          });

        await expect(
          submitDevelopmentRequest({
            request,
            submittedBy:
              'developer-2',
            evidenceRefs:
              ['test:green']
          })
        ).rejects.toThrow(
          /contributor assegnato/
        );

        await expect(
          submitDevelopmentRequest({
            request,
            submittedBy:
              'developer-1',
            evidenceRefs: [],
            commitRefs: []
          })
        ).rejects.toThrow(
          /almeno una evidenza/
        );
      }
    );

    test(
      'submission is not verification',
      async () => {
        const request =
          requestDoc({
            status: 'IN_PROGRESS',
            assigneeId:
              'developer-1'
          });

        await submitDevelopmentRequest({
          request,
          submittedBy:
            'developer-1',
          evidenceRefs:
            ['test:green'],
          commitRefs:
            ['commit:abc123']
        });

        expect(request.status)
          .toBe('SUBMITTED');

        expect(request.status)
          .not.toBe('VERIFIED');
      }
    );

    test(
      'independent review can verify an evidenced submission',
      async () => {
        const request =
          requestDoc({
            status: 'SUBMITTED',
            createdBy:
              'creator-1',
            assigneeId:
              'developer-1',
            submission: {
              submittedBy:
                'developer-1',
              evidenceRefs:
                ['test:green'],
              commitRefs:
                ['commit:abc123']
            }
          });

        await reviewDevelopmentRequest({
          request,
          reviewerId:
            'admin-reviewer',
          decision: 'VERIFY',
          notes:
            'Acceptance criteria verified.'
        });

        expect(request.status)
          .toBe('VERIFIED');

        expect(
          request.review.reviewerId
        ).toBe('admin-reviewer');
      }
    );

    test(
      'creator or assignee cannot independently verify their own work',
      async () => {
        const request =
          requestDoc({
            status: 'SUBMITTED',
            createdBy:
              'creator-1',
            assigneeId:
              'developer-1',
            submission: {
              evidenceRefs:
                ['test:green']
            }
          });

        await expect(
          reviewDevelopmentRequest({
            request,
            reviewerId:
              'developer-1',
            decision: 'VERIFY'
          })
        ).rejects.toThrow(
          /indipendente/
        );

        await expect(
          reviewDevelopmentRequest({
            request,
            reviewerId:
              'creator-1',
            decision: 'VERIFY'
          })
        ).rejects.toThrow(
          /indipendente/
        );
      }
    );
  }
);
