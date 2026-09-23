'use strict';

const express = require('express');
const {
  authenticate,
  optionalAuthenticate,
  isAdmin
} = require('../middleware/auth');

const KnowledgeContribution =
  require('../models/knowledgeContributionModel');

const {
  VERIFIED_STATUSES,
  previewKnowledge,
  commitKnowledgeCandidate,
  searchVerifiedKnowledge,
  searchPublicKnowledge,
  publicKnowledge
} = require('../services/zorgaxKnowledgeService');

const router = express.Router();

router.post('/preview', authenticate, (req, res) => {
  try {
    const result = previewKnowledge(req.body || {});

    return res.json({
      success: true,
      ...result,
      requires_human_confirmation: true
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/commit', authenticate, async (req, res) => {
  try {
    const result = await commitKnowledgeCandidate({
      authorId: req.userId,
      preview: req.body?.preview,
      digest: req.body?.digest,
      confirmation: req.body?.confirmation
    });

    return res.status(result.idempotent ? 200 : 201).json({
      success: true,
      persisted: true,
      idempotent: result.idempotent === true,
      contribution: publicKnowledge(result.contribution),
      digest: result.digest,
      contentHash: result.contentHash,
      status: result.contribution.status || 'PENDING_REVIEW',
      visibility: result.contribution.visibility || 'INTERNAL',
      rewardCreated: false,
      ledgerWritten: false,
      myzTransferred: false,
      requiresIndependentReview:
        result.contribution.status === 'PENDING_REVIEW'
    });
  } catch (error) {
    const status = error?.code === 11000 ? 409 : 400;

    return res.status(status).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/search', async (req, res) => {
  try {
    const items = await searchPublicKnowledge({
      query: req.query.q || '',
      limit: req.query.limit
    });

    return res.json({
      success: true,
      public_only: true,
      verified_only: false,
      scope: 'PUBLIC',
      items: items.map(publicKnowledge)
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: 'Knowledge pubblica non disponibile'
    });
  }
});

router.get('/verified-search', optionalAuthenticate, async (req, res) => {
  try {
    const includeInternal = req.userRole === 'admin';

    const items = await searchVerifiedKnowledge({
      query: req.query.q || '',
      limit: req.query.limit,
      includeInternal
    });

    return res.json({
      success: true,
      verified_only: true,
      scope: includeInternal ? 'INTERNAL' : 'PUBLIC',
      items: items.map(publicKnowledge)
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: 'Knowledge verificata non disponibile'
    });
  }
});

router.patch(
  '/:id/visibility',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const visibility =
        String(req.body?.visibility || '').trim().toUpperCase();

      if (!['INTERNAL', 'PUBLIC'].includes(visibility)) {
        return res.status(400).json({
          success: false,
          message: 'Visibility deve essere INTERNAL o PUBLIC'
        });
      }

      const contribution =
        await KnowledgeContribution.findById(req.params.id);

      if (!contribution) {
        return res.status(404).json({
          success: false,
          message: 'Conoscenza non trovata'
        });
      }

      if (
        visibility === 'PUBLIC' &&
        !VERIFIED_STATUSES.includes(contribution.status)
      ) {
        return res.status(409).json({
          success: false,
          message: 'Solo conoscenza verificata può essere pubblicata'
        });
      }

      const already =
        (contribution.visibility || 'INTERNAL') === visibility;

      contribution.visibility = visibility;

      if (visibility === 'PUBLIC') {
        contribution.publishedAt =
          contribution.publishedAt || new Date();
        contribution.publishedBy =
          contribution.publishedBy || String(req.userId);
      } else {
        contribution.publishedAt = null;
        contribution.publishedBy = null;
      }

      await contribution.save();

      return res.json({
        success: true,
        idempotent: already,
        contribution: publicKnowledge(contribution)
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

module.exports = router;
