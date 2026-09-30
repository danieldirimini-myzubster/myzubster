const {
  GRAPH_SCHEMA,
  buildEvidenceGraph
} = require('../src/services/evidenceGraphService');

describe('Evidence Graph v1', () => {
  function fixture() {
    return {
      subject: 'N4K48',
      nodes: [
        {
          id: 'person:n4k48',
          type: 'person',
          label: 'N4K48'
        },
        {
          id: 'card:docker-ai',
          type: 'knowledge-card',
          label: 'Docker and AI project evidence'
        },
        {
          id: 'artifact:github-commit',
          type: 'artifact',
          label: 'GitHub commit',
          metadata: {
            provider: 'github',
            reference: 'commit:example'
          }
        },
        {
          id: 'digest:proof-v2',
          type: 'digest',
          label: 'Proof v2 SHA-256',
          metadata: {
            algorithm: 'sha256'
          }
        }
      ],
      edges: [
        {
          from: 'person:n4k48',
          to: 'card:docker-ai',
          relation: 'DESCRIBED_BY',
          evidenceClass: 'self-declared',
          verificationStatus: 'published'
        },
        {
          from: 'card:docker-ai',
          to: 'artifact:github-commit',
          relation: 'SUPPORTED_BY',
          evidenceClass: 'artifact',
          verificationStatus: 'inspectable'
        },
        {
          from: 'artifact:github-commit',
          to: 'digest:proof-v2',
          relation: 'HASHED_AS',
          evidenceClass: 'cryptographic',
          verificationStatus: 'reproducible'
        }
      ]
    };
  }

  test('builds a deterministic typed evidence graph', () => {
    const first = buildEvidenceGraph(fixture());
    const second = buildEvidenceGraph(fixture());

    expect(first.graph.schema).toBe(GRAPH_SCHEMA);
    expect(first.graph.nodes).toHaveLength(4);
    expect(first.graph.edges).toHaveLength(3);
    expect(first.graphHash).toMatch(/^[a-f0-9]{64}$/);
    expect(second.graphHash).toBe(first.graphHash);
  });

  test('rejects edges pointing to missing nodes', () => {
    const input = fixture();
    input.edges.push({
      from: 'person:n4k48',
      to: 'attestation:missing',
      relation: 'ATTESTED_BY'
    });

    expect(() => buildEvidenceGraph(input))
      .toThrow(/missing to node/);
  });

  test('rejects unknown semantic relations', () => {
    const input = fixture();
    input.edges[0].relation = 'PROVES_TRUTH';

    expect(() => buildEvidenceGraph(input))
      .toThrow(/Unsupported evidence graph relation/);
  });
});

describe('Knowledge Evidence -> Evidence Graph projection', () => {
  test('projects myzubster.knowledge.evidence.v1 without changing its hash', () => {
    const { createKnowledgeEvidence } = require('../src/services/knowledgeEvidenceService');
    const { projectKnowledgeEvidence } = require('../src/services/evidenceGraphService');

    return createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Contributed improvements to the MyZubster knowledge ingestion flow',
      evidenceLevel: 'artifact-backed',
      evidenceRefs: [
        {
          type: 'github-commit',
          reference: 'https://github.com/example/myzubster/commit/example'
        }
      ]
    }).then(record => {
      const projected = projectKnowledgeEvidence(record);

      expect(projected.graph.schema).toBe('myzubster.evidence-graph.v1');
      expect(projected.graph.subject).toBe('N4K48');

      const evidenceNode = projected.graph.nodes.find(node => node.type === 'evidence');
      expect(evidenceNode.metadata.evidenceHash).toBe(record.evidenceHash);
      expect(evidenceNode.metadata.commitment).toBe(record.commitment);

      expect(projected.graph.nodes.some(node => node.type === 'artifact')).toBe(true);

      expect(projected.graph.edges.some(edge =>
        edge.relation === 'CLAIMS'
      )).toBe(true);

      expect(projected.graph.edges.some(edge =>
        edge.relation === 'SUPPORTED_BY'
      )).toBe(true);
    });
  });

  test('rejects unrelated evidence schemas', () => {
    const { projectKnowledgeEvidence } = require('../src/services/evidenceGraphService');

    expect(() => projectKnowledgeEvidence({
      payload: {
        schema: 'something.else.v1',
        subject: 'N4K48',
        claim: 'Example'
      }
    })).toThrow(/Unsupported knowledge evidence schema/);
  });
});

describe('Evidence Graph integrity and attestation chain', () => {
  test('projects canonical payload and digest without inventing an attestation', async () => {
    const { createKnowledgeEvidence } = require('../src/services/knowledgeEvidenceService');
    const {
      projectKnowledgeEvidence,
      appendIntegrityChain
    } = require('../src/services/evidenceGraphService');

    const record = await createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Example integrity claim'
    });

    const baseGraph = projectKnowledgeEvidence(record);
    const result = appendIntegrityChain(baseGraph, record);

    expect(result.graph.nodes.some(node => node.type === 'canonical-payload')).toBe(true);

    const digestNode = result.graph.nodes.find(node => node.type === 'digest');
    expect(digestNode.metadata.value).toBe(record.evidenceHash);

    expect(result.graph.edges.some(edge => edge.relation === 'CANONICALIZED_AS')).toBe(true);
    expect(result.graph.edges.some(edge => edge.relation === 'HASHED_AS')).toBe(true);

    expect(result.graph.nodes.some(node => node.type === 'attestation')).toBe(false);
    expect(result.graph.edges.some(edge => edge.relation === 'ATTESTED_BY')).toBe(false);
  });

  test('adds ATTESTED_BY only for a confirmed blockchain anchor', async () => {
    const { createKnowledgeEvidence } = require('../src/services/knowledgeEvidenceService');
    const {
      projectKnowledgeEvidence,
      appendIntegrityChain
    } = require('../src/services/evidenceGraphService');

    const record = await createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Example anchored claim'
    });

    record.anchor = {
      status: 'CONFIRMED',
      txId: '0x' + 'ab'.repeat(32),
      network: 'base-sepolia',
      chainId: 84532,
      blockNumber: 123456,
      anchoredAt: new Date('2026-09-29T08:00:00.000Z'),
      confirmedAt: new Date('2026-09-29T08:01:00.000Z'),
      explorerUrl: 'https://sepolia.basescan.org/tx/example'
    };

    const result = appendIntegrityChain(
      projectKnowledgeEvidence(record),
      record
    );

    const attestation = result.graph.nodes.find(node => node.type === 'attestation');

    expect(attestation).toBeTruthy();
    expect(attestation.metadata.network).toBe('base-sepolia');
    expect(attestation.metadata.chainId).toBe('84532');
    expect(attestation.metadata.txId).toBe(record.anchor.txId);

    const edge = result.graph.edges.find(edge => edge.relation === 'ATTESTED_BY');
    expect(edge).toBeTruthy();
    expect(edge.verificationStatus).toBe('confirmed');
  });

  test('does not treat SUBMITTED anchor as confirmed attestation', async () => {
    const { createKnowledgeEvidence } = require('../src/services/knowledgeEvidenceService');
    const {
      projectKnowledgeEvidence,
      appendIntegrityChain
    } = require('../src/services/evidenceGraphService');

    const record = await createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Pending anchor claim'
    });

    record.anchor = {
      status: 'SUBMITTED',
      txId: '0x' + 'cd'.repeat(32),
      network: 'external'
    };

    const result = appendIntegrityChain(
      projectKnowledgeEvidence(record),
      record
    );

    expect(result.graph.nodes.some(node => node.type === 'attestation')).toBe(false);
    expect(result.graph.edges.some(edge => edge.relation === 'ATTESTED_BY')).toBe(false);
  });
});

describe('Evidence Graph integrity hardening', () => {
  test('rejects a digest that does not match the canonical payload', async () => {
    const { createKnowledgeEvidence } = require('../src/services/knowledgeEvidenceService');
    const {
      projectKnowledgeEvidence,
      appendIntegrityChain
    } = require('../src/services/evidenceGraphService');

    const record = await createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Original claim'
    });

    const graph = projectKnowledgeEvidence(record);

    record.payload = {
      ...record.payload,
      claim: 'Tampered claim'
    };

    expect(() => appendIntegrityChain(graph, record))
      .toThrow(/evidence hash does not match canonical payload/);
  });
});

describe('Knowledge Card -> Evidence Graph composition', () => {
  test('links an explicit knowledge card between claim and evidence without changing evidence hash', async () => {
    const { createKnowledgeEvidence } = require('../src/services/knowledgeEvidenceService');
    const {
      projectKnowledgeEvidence,
      attachKnowledgeCard
    } = require('../src/services/evidenceGraphService');

    const record = await createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Contributed improvements to a knowledge ingestion workflow',
      evidenceLevel: 'artifact-backed'
    });

    const originalHash = record.evidenceHash;
    const projected = projectKnowledgeEvidence(record);

    const result = attachKnowledgeCard(projected, {
      id: '6abaaefb3a7460c4574a45fd',
      title: 'Docker and AI project evidence',
      url: 'https://www.myzubster.com/knowledge-card?id=6abaaefb3a7460c4574a45fd'
    });

    expect(record.evidenceHash).toBe(originalHash);

    const card = result.graph.nodes.find(node => node.type === 'knowledge-card');
    const claim = result.graph.nodes.find(node => node.type === 'claim');
    const evidence = result.graph.nodes.find(node => node.type === 'evidence');

    expect(card).toBeTruthy();
    expect(card.id).toBe('knowledge-card:6abaaefb3a7460c4574a45fd');
    expect(card.metadata.url).toBe(
      'https://www.myzubster.com/knowledge-card?id=6abaaefb3a7460c4574a45fd'
    );

    expect(result.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: claim.id,
          to: card.id,
          relation: 'DESCRIBED_BY',
          verificationStatus: 'referenced'
        }),
        expect.objectContaining({
          from: card.id,
          to: evidence.id,
          relation: 'SUPPORTED_BY',
          verificationStatus: 'referenced'
        })
      ])
    );
  });

  test('rejects an incomplete knowledge card reference', async () => {
    const { createKnowledgeEvidence } = require('../src/services/knowledgeEvidenceService');
    const {
      projectKnowledgeEvidence,
      attachKnowledgeCard
    } = require('../src/services/evidenceGraphService');

    const record = await createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Example claim'
    });

    const projected = projectKnowledgeEvidence(record);

    expect(() => attachKnowledgeCard(projected, {
      title: 'Missing stable card id'
    })).toThrow(/knowledge card id/i);
  });
});

describe('Knowledge Card full integrity path', () => {
  test('composes card and canonical integrity chain deterministically', async () => {
    const { createKnowledgeEvidence } = require('../src/services/knowledgeEvidenceService');
    const {
      projectKnowledgeEvidence,
      attachKnowledgeCard,
      appendIntegrityChain
    } = require('../src/services/evidenceGraphService');

    const record = await createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Contributed improvements to a knowledge ingestion workflow',
      evidenceLevel: 'artifact-backed'
    });

    const card = {
      id: '6abaaefb3a7460c4574a45fd',
      title: 'Docker and AI project evidence',
      url: 'https://www.myzubster.com/knowledge-card?id=6abaaefb3a7460c4574a45fd'
    };

    const build = () => {
      const projected = projectKnowledgeEvidence(record);
      const withCard = attachKnowledgeCard(projected, card);
      return appendIntegrityChain(withCard, record);
    };

    const first = build();
    const second = build();

    expect(second.graphHash).toBe(first.graphHash);

    const claim = first.graph.nodes.find(node => node.type === 'claim');
    const knowledgeCard = first.graph.nodes.find(node => node.type === 'knowledge-card');
    const evidence = first.graph.nodes.find(node => node.type === 'evidence');
    const canonicalPayload = first.graph.nodes.find(node => node.type === 'canonical-payload');
    const digest = first.graph.nodes.find(node => node.type === 'digest');

    expect(claim).toBeTruthy();
    expect(knowledgeCard).toBeTruthy();
    expect(evidence).toBeTruthy();
    expect(canonicalPayload).toBeTruthy();
    expect(digest).toBeTruthy();

    expect(first.graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        from: claim.id,
        to: knowledgeCard.id,
        relation: 'DESCRIBED_BY'
      }),
      expect.objectContaining({
        from: knowledgeCard.id,
        to: evidence.id,
        relation: 'SUPPORTED_BY'
      }),
      expect.objectContaining({
        from: evidence.id,
        to: canonicalPayload.id,
        relation: 'CANONICALIZED_AS'
      }),
      expect.objectContaining({
        from: canonicalPayload.id,
        to: digest.id,
        relation: 'HASHED_AS'
      })
    ]));

    expect(
      first.graph.nodes.some(node => node.type === 'attestation')
    ).toBe(false);

    expect(
      first.graph.edges.some(edge => edge.relation === 'ATTESTED_BY')
    ).toBe(false);
  });
});
