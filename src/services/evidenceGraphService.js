const crypto = require('crypto');

const GRAPH_SCHEMA = 'myzubster.evidence-graph.v1';

const NODE_TYPES = Object.freeze([
  'person',
  'claim',
  'knowledge-card',
  'evidence',
  'artifact',
  'canonical-payload',
  'digest',
  'attestation',
  'credential',
  'contribution',
  'bounty',
  'settlement'
]);

const RELATIONS = Object.freeze([
  'CLAIMS',
  'DESCRIBED_BY',
  'SUPPORTED_BY',
  'PRODUCED',
  'CANONICALIZED_AS',
  'HASHED_AS',
  'ATTESTED_BY',
  'CREDENTIALED_BY',
  'CONTRIBUTED_TO',
  'ACCEPTED_AS',
  'SETTLED_AS'
]);

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value).sort().reduce((out, key) => {
    if (value[key] !== undefined) out[key] = stableObject(value[key]);
    return out;
  }, {});
}

function digest(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableObject(value)))
    .digest('hex');
}

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function createNode(input = {}) {
  const type = clean(input.type);
  const label = clean(input.label);

  if (!NODE_TYPES.includes(type)) {
    throw new Error(`Unsupported evidence graph node type: ${type}`);
  }

  if (!label) throw new Error('Evidence graph node label is required');

  const metadata = stableObject(input.metadata || {});
  const id = clean(input.id) || `${type}:${digest({ type, label, metadata }).slice(0, 24)}`;

  return stableObject({
    id,
    type,
    label,
    metadata
  });
}

function createEdge(input = {}) {
  const from = clean(input.from);
  const to = clean(input.to);
  const relation = clean(input.relation).toUpperCase();

  if (!from || !to) throw new Error('Evidence graph edge requires from and to');
  if (!RELATIONS.includes(relation)) {
    throw new Error(`Unsupported evidence graph relation: ${relation}`);
  }

  return stableObject({
    from,
    to,
    relation,
    evidenceClass: clean(input.evidenceClass) || null,
    verificationStatus: clean(input.verificationStatus) || null,
    metadata: stableObject(input.metadata || {})
  });
}

function buildEvidenceGraph(input = {}) {
  const nodes = (Array.isArray(input.nodes) ? input.nodes : []).map(createNode);
  const edges = (Array.isArray(input.edges) ? input.edges : []).map(createEdge);

  const ids = new Set();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`Duplicate evidence graph node id: ${node.id}`);
    ids.add(node.id);
  }

  for (const edge of edges) {
    if (!ids.has(edge.from)) {
      throw new Error(`Evidence graph edge references missing from node: ${edge.from}`);
    }
    if (!ids.has(edge.to)) {
      throw new Error(`Evidence graph edge references missing to node: ${edge.to}`);
    }

    if (edge.relation === 'SETTLED_AS') {
      const bounty = nodes.find(node => node.id === edge.from);
      const settlement = nodes.find(node => node.id === edge.to);

      if (!bounty || bounty.type !== 'bounty') {
        throw new Error(
          'SETTLED_AS requires a bounty source node'
        );
      }

      if (
        !settlement ||
        settlement.type !== 'settlement' ||
        settlement.metadata?.status !== 'paid' ||
        edge.verificationStatus !== 'confirmed'
      ) {
        throw new Error(
          'SETTLED_AS requires a confirmed paid settlement'
        );
      }

      if (!settlement.metadata?.txId) {
        throw new Error(
          'SETTLED_AS requires a paid settlement with txId'
        );
      }

      if (!settlement.metadata?.sourceReference) {
        throw new Error(
          'SETTLED_AS requires a paid settlement with sourceReference'
        );
      }
    }
  }

  const graph = stableObject({
    schema: GRAPH_SCHEMA,
    subject: clean(input.subject) || null,
    nodes,
    edges
  });

  return {
    graph,
    graphHash: digest(graph),
    algorithm: 'sha256'
  };
}

module.exports = {
  GRAPH_SCHEMA,
  NODE_TYPES,
  RELATIONS,
  stableObject,
  createNode,
  createEdge,
  buildEvidenceGraph
};

function projectKnowledgeEvidence(record = {}) {
  const payload = record.payload || {};
  const subject = clean(payload.subject);

  if (payload.schema !== 'myzubster.knowledge.evidence.v1') {
    throw new Error('Unsupported knowledge evidence schema');
  }

  if (!subject || !clean(payload.claim)) {
    throw new Error('Knowledge evidence subject and claim are required');
  }

  const personId = `person:${subject}`;
  const claimId = `claim:${digest({
    subject,
    domain: payload.domain,
    claim: payload.claim
  }).slice(0, 24)}`;

  const evidenceId = `evidence:${clean(record.evidenceHash) || digest(payload)}`;

  const nodes = [
    {
      id: personId,
      type: 'person',
      label: subject
    },
    {
      id: claimId,
      type: 'claim',
      label: clean(payload.claim),
      metadata: {
        domain: clean(payload.domain),
        evidenceLevel: clean(payload.evidenceLevel) || 'self-declared'
      }
    },
    {
      id: evidenceId,
      type: 'evidence',
      label: clean(record.commitment) || 'Knowledge evidence',
      metadata: {
        schema: payload.schema,
        algorithm: clean(record.algorithm) || 'sha256',
        evidenceHash: clean(record.evidenceHash),
        commitment: clean(record.commitment)
      }
    }
  ];

  const edges = [
    {
      from: personId,
      to: claimId,
      relation: 'CLAIMS',
      evidenceClass: clean(payload.evidenceLevel) || 'self-declared',
      verificationStatus: 'declared'
    },
    {
      from: claimId,
      to: evidenceId,
      relation: 'SUPPORTED_BY',
      evidenceClass: clean(payload.evidenceLevel) || 'self-declared',
      verificationStatus: clean(record.evidenceHash) ? 'integrity-hashed' : 'unverified'
    }
  ];

  for (const ref of Array.isArray(payload.evidenceRefs) ? payload.evidenceRefs : []) {
    const reference = clean(ref.reference);
    if (!reference) continue;

    const artifactId = `artifact:${digest({
      type: clean(ref.type) || 'reference',
      reference
    }).slice(0, 24)}`;

    nodes.push({
      id: artifactId,
      type: 'artifact',
      label: reference,
      metadata: {
        type: clean(ref.type) || 'reference',
        reference
      }
    });

    edges.push({
      from: evidenceId,
      to: artifactId,
      relation: 'SUPPORTED_BY',
      evidenceClass: 'artifact',
      verificationStatus: 'referenced'
    });
  }

  return buildEvidenceGraph({
    subject,
    nodes,
    edges
  });
}

module.exports.projectKnowledgeEvidence = projectKnowledgeEvidence;

function appendIntegrityChain(graphInput = {}, record = {}) {
  const graph = graphInput.graph || graphInput;
  const nodes = Array.isArray(graph.nodes) ? [...graph.nodes] : [];
  const edges = Array.isArray(graph.edges) ? [...graph.edges] : [];

  const payload = record.payload;
  const evidenceHash = clean(record.evidenceHash).toLowerCase();
  const algorithm = clean(record.algorithm).toLowerCase() || 'sha256';

  if (!payload || typeof payload !== 'object') {
    throw new Error('Integrity chain requires an evidence payload');
  }

  if (!/^[a-f0-9]{64}$/.test(evidenceHash)) {
    throw new Error('Integrity chain requires a 32-byte evidence hash');
  }

  const computedHash = digest(payload);
  if (computedHash !== evidenceHash) {
    throw new Error('Integrity chain evidence hash does not match canonical payload');
  }

  const evidenceNode = nodes.find(node =>
    node.type === 'evidence' &&
    clean(node.metadata && node.metadata.evidenceHash).toLowerCase() === evidenceHash
  );

  if (!evidenceNode) {
    throw new Error('Integrity chain could not find matching evidence node');
  }

  const canonicalPayload = stableObject(payload);
  const payloadId = `canonical-payload:${digest(canonicalPayload).slice(0, 24)}`;
  const digestId = `digest:${algorithm}:${evidenceHash}`;

  nodes.push(createNode({
    id: payloadId,
    type: 'canonical-payload',
    label: `${clean(payload.schema) || 'evidence'} canonical payload`,
    metadata: {
      schema: clean(payload.schema),
      canonicalization: 'recursive-key-sort-v1',
      serialization: 'json'
    }
  }));

  nodes.push(createNode({
    id: digestId,
    type: 'digest',
    label: `${algorithm.toUpperCase()} ${evidenceHash}`,
    metadata: {
      algorithm,
      value: evidenceHash,
      commitment: clean(record.commitment)
    }
  }));

  edges.push(createEdge({
    from: evidenceNode.id,
    to: payloadId,
    relation: 'CANONICALIZED_AS',
    evidenceClass: 'integrity',
    verificationStatus: 'reproducible'
  }));

  edges.push(createEdge({
    from: payloadId,
    to: digestId,
    relation: 'HASHED_AS',
    evidenceClass: 'cryptographic',
    verificationStatus: 'reproducible'
  }));

  const anchor = record.anchor || {};
  const anchorStatus = clean(anchor.status).toUpperCase();

  if (anchorStatus === 'CONFIRMED') {
    const txId = clean(anchor.txId);
    const network = clean(anchor.network);

    if (!txId || !network) {
      throw new Error('Confirmed anchor requires txId and network');
    }

    const attestationId = `attestation:${digest({
      network,
      txId
    }).slice(0, 24)}`;

    nodes.push(createNode({
      id: attestationId,
      type: 'attestation',
      label: `${network} ${txId}`,
      metadata: {
        provider: 'blockchain-anchor',
        network,
        chainId: anchor.chainId == null ? null : String(anchor.chainId),
        txId,
        blockNumber: anchor.blockNumber == null ? null : String(anchor.blockNumber),
        anchoredAt: anchor.anchoredAt ? new Date(anchor.anchoredAt).toISOString() : null,
        confirmedAt: anchor.confirmedAt ? new Date(anchor.confirmedAt).toISOString() : null,
        explorerUrl: clean(anchor.explorerUrl) || null,
        status: anchorStatus
      }
    }));

    edges.push(createEdge({
      from: digestId,
      to: attestationId,
      relation: 'ATTESTED_BY',
      evidenceClass: 'blockchain-anchor',
      verificationStatus: 'confirmed'
    }));
  }

  return buildEvidenceGraph({
    subject: graph.subject,
    nodes,
    edges
  });
}

module.exports.appendIntegrityChain = appendIntegrityChain;

function attachKnowledgeCard(graphInput = {}, cardInput = {}) {
  const graph = graphInput.graph || graphInput;
  const nodes = Array.isArray(graph.nodes) ? [...graph.nodes] : [];
  const edges = Array.isArray(graph.edges) ? [...graph.edges] : [];

  const cardId = clean(cardInput.id);
  const title = clean(cardInput.title);
  const url = clean(cardInput.url);

  if (!cardId) {
    throw new Error('Knowledge card id is required');
  }

  if (!title) {
    throw new Error('Knowledge card title is required');
  }

  const claimNodes = nodes.filter(node => node.type === 'claim');
  const evidenceNodes = nodes.filter(node => node.type === 'evidence');

  if (claimNodes.length !== 1) {
    throw new Error('Knowledge card composition requires exactly one claim node');
  }

  if (evidenceNodes.length !== 1) {
    throw new Error('Knowledge card composition requires exactly one evidence node');
  }

  const claimNode = claimNodes[0];
  const evidenceNode = evidenceNodes[0];
  const knowledgeCardNodeId = `knowledge-card:${cardId}`;

  if (nodes.some(node => node.id === knowledgeCardNodeId)) {
    throw new Error('Knowledge card node already exists');
  }

  nodes.push(createNode({
    id: knowledgeCardNodeId,
    type: 'knowledge-card',
    label: title,
    metadata: {
      cardId,
      url: url || null
    }
  }));

  /*
   * DESCRIBED_BY means the claim is represented/described by this
   * referenced Knowledge Card. It does not independently verify the claim.
   */
  edges.push(createEdge({
    from: claimNode.id,
    to: knowledgeCardNodeId,
    relation: 'DESCRIBED_BY',
    evidenceClass: 'knowledge-card',
    verificationStatus: 'referenced'
  }));

  /*
   * The card references the already-existing evidence record.
   * This composition does not alter the evidence payload or evidenceHash.
   */
  edges.push(createEdge({
    from: knowledgeCardNodeId,
    to: evidenceNode.id,
    relation: 'SUPPORTED_BY',
    evidenceClass: 'evidence',
    verificationStatus: 'referenced'
  }));

  return buildEvidenceGraph({
    subject: graph.subject,
    nodes,
    edges
  });
}

module.exports.attachKnowledgeCard = attachKnowledgeCard;

function projectContributorEvidence(input = {}) {
  const contribution = input.contribution || {};
  const github = input.github || {};
  const bounty = input.bounty || {};

  const subject = clean(contribution.authorId);
  const contributionId = clean(contribution.contributionId);
  const title = clean(contribution.title);
  const reference = clean(contribution.reference);

  if (!subject) {
    throw new Error('Contributor evidence requires contribution.authorId');
  }

  if (!contributionId) {
    throw new Error('Contributor evidence requires contribution.contributionId');
  }

  const personId = `person:${subject}`;
  const contributionNodeId = `contribution:${contributionId}`;

  const nodes = [
    {
      id: personId,
      type: 'person',
      label: subject,
      metadata: {
        provider: 'github'
      }
    },
    {
      id: contributionNodeId,
      type: 'contribution',
      label: title || contributionId,
      metadata: {
        contributionId,
        type: clean(contribution.type),
        status: clean(contribution.status),
        reference: reference || null,
        rewardId: clean(contribution.rewardId) || null,
        ledgerReference: clean(contribution.ledgerReference) || null
      }
    }
  ];

  const edges = [
    {
      from: personId,
      to: contributionNodeId,
      relation: 'CONTRIBUTED_TO',
      evidenceClass: 'github',
      verificationStatus: 'referenced'
    }
  ];

  const repository = clean(github.repository);
  const pullRequest = github.pullRequest == null
    ? null
    : Number(github.pullRequest);
  const githubState = clean(github.state).toUpperCase();

  if (repository && Number.isInteger(pullRequest) && pullRequest > 0) {
    const artifactId = `artifact:github:${digest({
      repository,
      pullRequest
    }).slice(0, 24)}`;

    nodes.push({
      id: artifactId,
      type: 'artifact',
      label: `GitHub PR #${pullRequest}`,
      metadata: {
        provider: 'github',
        repository,
        pullRequest,
        state: githubState || null,
        reference: reference || null
      }
    });

    if (github.merged === true && githubState === 'MERGED') {
      edges.push({
        from: contributionNodeId,
        to: artifactId,
        relation: 'ACCEPTED_AS',
        evidenceClass: 'github',
        verificationStatus: 'merged'
      });
    }
  }

  const components = Array.isArray(bounty.rewardComponents)
    ? bounty.rewardComponents
    : [];

  const bountyId = clean(bounty.id);

  if (bountyId && components.length > 0) {
    const bountyNodeId = `bounty:${bountyId}`;

    nodes.push({
      id: bountyNodeId,
      type: 'bounty',
      label: clean(bounty.title) || bountyId,
      metadata: {
        status: clean(bounty.status) || null
      }
    });

    for (const component of components) {
      const status = clean(component.status).toLowerCase();

      if (status !== 'paid') continue;

      const asset = clean(component.asset);
      const txId = clean(component.txId);
      const sourceReference = clean(component.sourceReference);

      if (!txId) {
        throw new Error(`paid ${asset || 'reward'} settlement requires txId`);
      }

      if (!sourceReference) {
        throw new Error(`paid ${asset || 'reward'} settlement requires sourceReference`);
      }

      const settlementId = `settlement:${digest({
        bountyId,
        asset,
        txId
      }).slice(0, 24)}`;

      nodes.push({
        id: settlementId,
        type: 'settlement',
        label: `${asset || 'reward'} settlement`,
        metadata: {
          asset: asset || null,
          amount: clean(component.amount) || null,
          network: clean(component.network) || null,
          status: 'paid',
          txId,
          sourceReference
        }
      });

      edges.push({
        from: bountyNodeId,
        to: settlementId,
        relation: 'SETTLED_AS',
        evidenceClass: 'blockchain',
        verificationStatus: 'confirmed'
      });
    }
  }

  return buildEvidenceGraph({
    subject,
    nodes,
    edges
  });
}

module.exports.projectContributorEvidence = projectContributorEvidence;
