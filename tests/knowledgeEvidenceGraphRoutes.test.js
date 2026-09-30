const express = require('express');
const request = require('supertest');

const knowledgeEvidenceRoutes = require('../src/routes/knowledgeEvidenceRoutes');
const {
  createKnowledgeEvidence
} = require('../src/services/knowledgeEvidenceService');

function appForTest() {
  const app = express();
  app.use(express.json());
  app.use('/api/knowledge-evidence', knowledgeEvidenceRoutes);
  return app;
}

describe('POST /api/knowledge-evidence/graph', () => {
  test('projects verified knowledge evidence without persistence or publication', async () => {
    const record = await createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Evidence Graph API test',
      evidenceRefs: [
        {
          type: 'repository',
          reference: 'https://example.invalid/repository'
        }
      ]
    });

    const response = await request(appForTest())
      .post('/api/knowledge-evidence/graph')
      .send(record);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.persisted).toBe(false);
    expect(response.body.publication_performed).toBe(false);
    expect(response.body.independently_verified).toBe(false);
    expect(response.body.algorithm).toBe('sha256');
    expect(response.body.graph.schema).toBe('myzubster.evidence-graph.v1');

    expect(
      response.body.graph.nodes.some(node => node.type === 'digest')
    ).toBe(true);

    expect(
      response.body.graph.nodes.some(node => node.type === 'attestation')
    ).toBe(false);
  });

  test('rejects payload/hash mismatch', async () => {
    const record = await createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Original API claim'
    });

    record.payload.claim = 'Tampered API claim';

    const response = await request(appForTest())
      .post('/api/knowledge-evidence/graph')
      .send(record);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.status).toBe('MISMATCH');
  });

  test('rejects incomplete evidence record', async () => {
    const response = await request(appForTest())
      .post('/api/knowledge-evidence/graph')
      .send({
        payload: {
          schema: 'myzubster.knowledge.evidence.v1'
        }
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('preserves a confirmed anchor as attestation without creating a transaction', async () => {
    const record = await createKnowledgeEvidence({
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Previously anchored API claim'
    });

    record.anchor = {
      status: 'CONFIRMED',
      txId: '0x' + 'ef'.repeat(32),
      network: 'base-sepolia',
      chainId: 84532,
      blockNumber: 123456,
      anchoredAt: '2026-09-29T08:00:00.000Z',
      confirmedAt: '2026-09-29T08:01:00.000Z',
      explorerUrl: 'https://sepolia.basescan.org/tx/example'
    };

    const response = await request(appForTest())
      .post('/api/knowledge-evidence/graph')
      .send(record);

    expect(response.status).toBe(200);

    const attestation = response.body.graph.nodes.find(
      node => node.type === 'attestation'
    );

    expect(attestation).toBeTruthy();
    expect(attestation.metadata.network).toBe('base-sepolia');
    expect(attestation.metadata.txId).toBe(record.anchor.txId);

    expect(
      response.body.graph.edges.some(
        edge =>
          edge.relation === 'ATTESTED_BY' &&
          edge.verificationStatus === 'confirmed'
      )
    ).toBe(true);
  });
});

describe('POST /api/knowledge-evidence/graph schema boundary', () => {
  test('rejects evidence from an unsupported schema', async () => {
    const crypto = require('crypto');

    const payload = {
      schema: 'myzubster.unrelated.evidence.v1',
      subject: 'N4K48',
      domain: 'software-development',
      claim: 'Unrelated schema'
    };

    const evidenceHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    const response = await request(appForTest())
      .post('/api/knowledge-evidence/graph')
      .send({
        payload,
        evidenceHash,
        algorithm: 'sha256'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/unsupported knowledge evidence schema/i);
  });
});
