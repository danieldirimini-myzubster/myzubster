'use strict';
const express = require('express');
const supertest = require('supertest');
const { createDevelopmentRequestRouter } = require('../src/routes/developmentRequestRoutes');

function setup() {
  const source = { contributionId: 'k-1', authorId: 'nicola', type: 'pilot', title: 'Kefir',
    description: 'Evidence', status: 'APPROVED', updatedAt: new Date('2026-09-28T12:00:00Z') };
  const records = [];
  const knowledge = { findOne: async ({ contributionId }) => contributionId === source.contributionId ? source : null };
  const matches = (record, query) => Object.entries(query).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(record, part));
    if (value && typeof value === 'object' && '$ne' in value) return record[key] !== value.$ne;
    return record[key] === value;
  });
  const requests = {
    findOne: async query => records.find(item => matches(item, query)) || null,
    create: async data => { const item = { ...data, requestId: 'dev-1', status: 'DRAFT' }; records.push(item); return item; },
    findOneAndUpdate: async (query, update) => {
      const item = records.find(record => matches(record, query));
      if (!item) return null;
      Object.assign(item, update.$set);
      return { ...item };
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/zorgax/development', createDevelopmentRequestRouter({ knowledge, requests,
    auth: (req, res, next) => {
      if (!req.headers['x-user']) return res.sendStatus(401);
      req.userId = req.headers['x-user']; req.userRole = req.headers['x-role'] || 'user'; next();
    },
    admin: (req, res, next) => req.userRole === 'admin' ? next() : res.sendStatus(403)
  }));
  const api = supertest(app);
  const as = (user, role) => ({ 'x-user': user, 'x-role': role || 'user' });
  return { api, source, records, as };
}
const draft = { title: 'Kefir pilot task', description: 'Implement traceability', knowledgeIds: ['k-1'] };

test('requires authentication and approved knowledge; stale previews cannot be confirmed', async () => {
  const { api, source, as } = setup();
  await api.post('/api/zorgax/development/preview').send(draft).expect(401);
  source.status = 'PENDING_REVIEW';
  await api.post('/api/zorgax/development/preview').set(as('creator')).send(draft).expect(409);
  source.status = 'APPROVED';
  const preview = await api.post('/api/zorgax/development/preview').set(as('creator')).send(draft).expect(200);
  expect(preview.body.preview.knowledgeRefs[0]).toEqual(expect.objectContaining({ version: expect.any(String), contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  source.description = 'Changed after preview';
  await api.post('/api/zorgax/development/requests').set(as('creator'))
    .send({ ...draft, digest: preview.body.preview.digest }).expect(409);
});

test('explicit confirmation is idempotent; only independent admin can review the claimant', async () => {
  const { api, records, as } = setup();
  const endpoint = '/api/zorgax/development';
  const digest = (await api.post(`${endpoint}/preview`).set(as('creator')).send(draft)).body.preview.digest;
  await api.post(`${endpoint}/requests`).set(as('creator')).send({ ...draft, digest }).expect(201);
  await api.post(`${endpoint}/requests`).set(as('creator')).send({ ...draft, digest }).expect(200);
  expect(records).toHaveLength(1);
  await api.post(`${endpoint}/requests/dev-1/open`).set(as('creator')).expect(403);
  await api.post(`${endpoint}/requests/dev-1/open`).set(as('admin', 'admin')).expect(200);
  await api.post(`${endpoint}/requests/dev-1/claim`).set(as('worker')).expect(200);
  await api.post(`${endpoint}/requests/dev-1/claim`).set(as('other')).expect(409);
  await api.post(`${endpoint}/requests/dev-1/submit`).set(as('other')).send({ evidence: 'work' }).expect(409);
  await api.post(`${endpoint}/requests/dev-1/submit`).set(as('worker')).send({ evidence: 'work' }).expect(200);
  await api.post(`${endpoint}/requests/dev-1/review`).set(as('worker', 'admin'))
    .send({ decision: 'VERIFIED', notes: 'Reviewed' }).expect(409);
  await api.post(`${endpoint}/requests/dev-1/review`).set(as('admin', 'admin'))
    .send({ decision: 'VERIFIED', notes: 'Reviewed' }).expect(200);
  expect(records[0].status).toBe('VERIFIED');
  await api.post(`${endpoint}/requests/dev-1/review`).set(as('admin', 'admin'))
    .send({ decision: 'REJECTED', notes: 'Again' }).expect(409);
});
