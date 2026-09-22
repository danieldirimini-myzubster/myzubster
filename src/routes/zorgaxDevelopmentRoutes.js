'use strict';

const express = require('express');

const {
  authenticate,
  isAdmin
} = require('../middleware/auth');

const DevelopmentRequest =
  require('../models/DevelopmentRequest');

const {
  previewDevelopmentRequest,
  commitDevelopmentRequest,
  openDevelopmentRequest,
  claimDevelopmentRequest,
  submitDevelopmentRequest,
  reviewDevelopmentRequest,
  publicDevelopmentRequest
} = require('../services/zorgaxDevelopmentRequestService');

const router = express.Router();

router.post(
  '/preview',
  authenticate,
  async (req, res) => {
    try {
      const result =
        await previewDevelopmentRequest({
          input: req.body || {}
        });

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
  }
);

router.post(
  '/commit',
  authenticate,
  async (req, res) => {
    try {
      const result =
        await commitDevelopmentRequest({
          createdBy: req.userId,
          preview: req.body?.preview,
          digest: req.body?.digest,
          confirmation:
            req.body?.confirmation
        });

      return res
        .status(result.idempotent ? 200 : 201)
        .json({
          success: true,
          idempotent:
            result.idempotent === true,
          persisted: true,

          request:
            publicDevelopmentRequest(
              result.request
            ),

          bountyCreated: false,
          rewardCreated: false,
          paymentPerformed: false
        });
    } catch (error) {
      const status =
        error?.code === 11000
          ? 409
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }
);

router.get(
  '/mine',
  authenticate,
  async (req, res) => {
    try {
      const requests =
        await DevelopmentRequest.find({
          $or: [
            { createdBy: String(req.userId) },
            { assigneeId: String(req.userId) }
          ]
        })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();

      return res.json({
        success: true,
        requests:
          requests.map(
            publicDevelopmentRequest
          )
      });
    } catch (_error) {
      return res.status(500).json({
        success: false,
        message:
          'DevelopmentRequest non disponibili'
      });
    }
  }
);

router.patch(
  '/:id/open',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const request =
        await DevelopmentRequest.findById(
          req.params.id
        );

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            'DevelopmentRequest non trovato'
        });
      }

      await openDevelopmentRequest(
        request
      );

      return res.json({
        success: true,
        request:
          publicDevelopmentRequest(request),
        bountyCreated: false,
        rewardCreated: false,
        paymentPerformed: false
      });
    } catch (error) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
  }
);

router.patch(
  '/:id/claim',
  authenticate,
  async (req, res) => {
    try {
      const request =
        await DevelopmentRequest.findById(
          req.params.id
        );

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            'DevelopmentRequest non trovato'
        });
      }

      await claimDevelopmentRequest(
        request,
        req.userId
      );

      return res.json({
        success: true,
        request:
          publicDevelopmentRequest(request)
      });
    } catch (error) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
  }
);

router.patch(
  '/:id/submit',
  authenticate,
  async (req, res) => {
    try {
      const request =
        await DevelopmentRequest.findById(
          req.params.id
        );

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            'DevelopmentRequest non trovato'
        });
      }

      await submitDevelopmentRequest({
        request,
        submittedBy: req.userId,
        evidenceRefs:
          req.body?.evidenceRefs,
        commitRefs:
          req.body?.commitRefs,
        notes:
          req.body?.notes
      });

      return res.json({
        success: true,
        request:
          publicDevelopmentRequest(request),
        verified: false
      });
    } catch (error) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
  }
);

router.patch(
  '/:id/review',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const request =
        await DevelopmentRequest.findById(
          req.params.id
        );

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            'DevelopmentRequest non trovato'
        });
      }

      await reviewDevelopmentRequest({
        request,
        reviewerId: req.userId,
        decision: req.body?.decision,
        notes: req.body?.notes
      });

      return res.json({
        success: true,
        request:
          publicDevelopmentRequest(request),
        bountyCreated: false,
        rewardCreated: false,
        paymentPerformed: false
      });
    } catch (error) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
  }
);

module.exports = router;
