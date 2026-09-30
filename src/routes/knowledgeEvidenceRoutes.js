const express = require('express');
const {
  createKnowledgeEvidence,
  verifyKnowledgeEvidence
} = require('../services/knowledgeEvidenceService');
const { buildGithubWorkEvidence, verifyGithubWorkEvidence } = require('../services/githubWorkEvidenceService');
const { anchorMarketplaceEvidenceOnBase } = require('../services/baseMarketplaceAnchorService');
const {
  projectKnowledgeEvidence,
  appendIntegrityChain
} = require('../services/evidenceGraphService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const anchor = req.body?.anchor === true;
    const result = await createKnowledgeEvidence(req.body || {}, { anchor });
    const code = result.anchor?.status === 'FAILED' ? 502 : 201;
    return res.status(code).json({ success: result.anchor?.status !== 'FAILED', ...result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/graph', (req, res) => {
  try {
    const record = req.body || {};
    const { payload, evidenceHash } = record;

    if (!payload || !evidenceHash) {
      return res.status(400).json({
        success: false,
        error: 'payload and evidenceHash are required'
      });
    }

    if (payload.schema !== 'myzubster.knowledge.evidence.v1') {
      return res.status(400).json({
        success: false,
        error: 'Unsupported knowledge evidence schema'
      });
    }

    if (!verifyKnowledgeEvidence(payload, evidenceHash)) {
      return res.status(409).json({
        success: false,
        status: 'MISMATCH',
        error: 'Evidence hash does not match canonical payload'
      });
    }

    const projected = projectKnowledgeEvidence(record);
    const result = appendIntegrityChain(projected, record);

    return res.json({
      success: true,
      persisted: false,
      publication_performed: false,
      independently_verified: false,
      graph: result.graph,
      graphHash: result.graphHash,
      algorithm: result.algorithm
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/verify', (req, res) => {
  try {
    const { payload, evidenceHash } = req.body || {};
    if (!payload || !evidenceHash) {
      return res.status(400).json({ success: false, error: 'payload and evidenceHash are required' });
    }
    const match = verifyKnowledgeEvidence(payload, evidenceHash);
    return res.status(match ? 200 : 409).json({
      success: match,
      status: match ? 'MATCH' : 'MISMATCH',
      algorithm: 'sha256',
      evidenceHash
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/github-work', async (req, res) => {
  try {
    const result = buildGithubWorkEvidence(req.body || {});
    let anchor = { status: 'NOT_REQUESTED' };
    if (req.body?.anchor === true) {
      try {
        anchor = await anchorMarketplaceEvidenceOnBase(result.evidenceHash);
      } catch (error) {
        anchor = { status: 'FAILED', error: error.message };
      }
    }
    const code = anchor.status === 'FAILED' ? 502 : 201;
    return res.status(code).json({ success: anchor.status !== 'FAILED', ...result, anchor });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/github-work/verify', (req, res) => {
  try {
    const { payload, evidenceHash } = req.body || {};
    if (!payload || !evidenceHash) return res.status(400).json({ success:false, error:'payload and evidenceHash are required' });
    const match = verifyGithubWorkEvidence(payload, evidenceHash);
    return res.status(match ? 200 : 409).json({ success:match, status:match?'MATCH':'MISMATCH', algorithm:'sha256', evidenceHash });
  } catch (error) {
    return res.status(400).json({ success:false, error:error.message });
  }
});

module.exports = router;
