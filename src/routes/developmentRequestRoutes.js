'use strict';
const express = require('express');
const { authenticate, isAdmin } = require('../middleware/auth');
const RequestModel = require('../models/DevelopmentRequest');
const KnowledgeModel = require('../models/knowledgeContributionModel');
const service = require('../services/developmentRequestService');

function createDevelopmentRequestRouter({ auth = authenticate, admin = isAdmin, requests = RequestModel,
  knowledge = KnowledgeModel, operations = service } = {}) {
  const router = express.Router();
  router.use(auth);
  const handle = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Development request failed' }); }
  };
  const data = req => ({ KnowledgeModel: knowledge, RequestModel: requests, creatorId: String(req.userId),
    title: req.body?.title, description: req.body?.description, knowledgeIds: req.body?.knowledgeIds,
    digest: req.body?.digest });
  router.post('/preview', handle(async (req, res) => res.json({ success: true, preview: await operations.preview(data(req)) })));
  router.post('/requests', handle(async (req, res) => {
    const result = await operations.confirm(data(req));
    res.status(result.replay ? 200 : 201).json({ success: true, ...result });
  }));
  router.get('/requests/:requestId', handle(async (req, res) => {
    const query = { requestId: req.params.requestId };
    if (req.userRole !== 'admin') query.$or = [{ creatorId: String(req.userId) }, { claimantId: String(req.userId) }, { status: 'OPEN' }];
    const request = await requests.findOne(query);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, request });
  }));
  router.post('/requests/:requestId/open', admin, handle(async (req, res) => {
    const request = await operations.transition({ RequestModel: requests, requestId: req.params.requestId,
      from: 'DRAFT', to: 'OPEN', changes: { openedAt: new Date() } });
    res.json({ success: true, request });
  }));
  router.post('/requests/:requestId/claim', handle(async (req, res) => {
    const request = await operations.transition({ RequestModel: requests, requestId: req.params.requestId,
      from: 'OPEN', to: 'IN_PROGRESS', changes: { claimantId: String(req.userId), claimedAt: new Date() } });
    res.json({ success: true, request });
  }));
  router.post('/requests/:requestId/submit', handle(async (req, res) => {
    const evidence = operations.requiredText(req.body?.evidence, 'evidence', 4000);
    const request = await operations.transition({ RequestModel: requests, requestId: req.params.requestId,
      from: 'IN_PROGRESS', to: 'SUBMITTED', filter: { claimantId: String(req.userId) },
      changes: { deliveryEvidence: evidence, submittedAt: new Date() } });
    res.json({ success: true, request });
  }));
  router.post('/requests/:requestId/review', admin, handle(async (req, res) => {
    const decision = req.body?.decision;
    if (!['VERIFIED', 'REJECTED'].includes(decision)) throw new service.DevelopmentError('Invalid review decision');
    const notes = operations.requiredText(req.body?.notes, 'notes', 4000);
    const request = await operations.transition({ RequestModel: requests, requestId: req.params.requestId,
      from: 'SUBMITTED', to: decision, filter: { claimantId: { $ne: String(req.userId) } },
      changes: { reviewerId: String(req.userId), reviewNotes: notes, reviewedAt: new Date() } });
    res.json({ success: true, request });
  }));
  return router;
}
const router = createDevelopmentRequestRouter();
router.createDevelopmentRequestRouter = createDevelopmentRequestRouter;
module.exports = router;
