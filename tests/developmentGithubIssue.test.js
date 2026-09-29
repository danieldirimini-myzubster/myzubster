'use strict';
const express = require('express');
const supertest = require('supertest');
const { materialize, issueBody, createGitHubClient } = require('../src/services/developmentGithubIssueService');
const { createDevelopmentRequestRouter } = require('../src/routes/developmentRequestRoutes');

function fixture() {
  const request = { requestId: 'dev-123', status: 'OPEN', title: 'Build the pilot', description: 'Work description',
    knowledgeRefs: [{ contributionId: 'k-1', version: '2026-09-28', contentHash: 'abc123' }], githubIssues: [] };
  const model = {
    findOne: jest.fn(async ({ requestId }) => requestId === request.requestId ? request : null),
    findOneAndUpdate: jest.fn(async (query, update) => {
      if (query.requestId !== request.requestId) return null;
      if (update.$push) {
        if (request.status !== 'OPEN' || request.githubIssues.some(item => item.repository === query['githubIssues.repository'].$ne)) return null;
        request.githubIssues.push(update.$push.githubIssues);
      } else if (update.$set) {
        const item = request.githubIssues.find(issue => issue.repository === query.githubIssues.$elemMatch.repository && issue.state === 'PENDING');
        if (!item) return null;
        for (const [key, value] of Object.entries(update.$set)) item[key.slice('githubIssues.$.'.length)] = value;
      }
      return request;
    })
  };
  const client = { visibility: jest.fn().mockResolvedValue('private'),
    create: jest.fn().mockResolvedValue({ number: 42 }), find: jest.fn().mockResolvedValue(null) };
  const input = { RequestModel: model, requestId: request.requestId, repository: 'MyZubster-Ecosystem/private-pilot',
    client, allowedRepositories: 'MyZubster-Ecosystem/private-pilot' };
  return { request, model, client, input };
}

test('materializes once, records provenance, and replays without another POST', async () => {
  const { request, client, input } = fixture();
  const first = await materialize(input);
  const second = await materialize(input);
  expect(first.replay).toBe(false);
  expect(second.replay).toBe(true);
  expect(client.create).toHaveBeenCalledTimes(1);
  expect(client.create.mock.calls[0][2]).toContain('myz-development-request:dev-123');
  expect(issueBody(request)).toContain('k-1 (version: 2026-09-28; sha256: abc123)');
  expect(request.githubIssues[0]).toEqual(expect.objectContaining({ repository: input.repository,
    issueNumber: 42, url: 'https://github.com/MyZubster-Ecosystem/private-pilot/issues/42' }));
});

test('refuses public or unauthorized targets without reserving or writing', async () => {
  const { client, input, request } = fixture();
  client.visibility.mockResolvedValue('public');
  await expect(materialize(input)).rejects.toMatchObject({ status: 403 });
  await expect(materialize({ ...input, allowedRepositories: 'another/repo' })).rejects.toMatchObject({ status: 403 });
  expect(request.githubIssues).toHaveLength(0);
  expect(client.create).not.toHaveBeenCalled();
});

test('uncertain POST leaves a reservation and retry does not duplicate; reconciliation saves a found issue', async () => {
  const { request, client, input } = fixture();
  client.create.mockRejectedValueOnce(new Error('connection reset after POST'));
  await expect(materialize(input)).rejects.toThrow('connection reset');
  expect(request.githubIssues[0].state).toBe('PENDING');
  await expect(materialize(input)).rejects.toMatchObject({ status: 409 });
  expect(client.create).toHaveBeenCalledTimes(1);
  client.find.mockResolvedValueOnce({ number: 43 });
  const reconciled = await materialize(input);
  expect(reconciled.issue.issueNumber).toBe(43);
  expect(client.create).toHaveBeenCalledTimes(1);
});

test('GitHub transport sends no bounty labels and uses the existing GitHub headers', async () => {
  const http = { post: jest.fn().mockResolvedValue({ data: { number: 8 } }) };
  const client = createGitHubClient({ http, token: () => 'configured' });
  await client.create('org/repo', 'Title', 'Body');
  expect(http.post.mock.calls[0][1]).toEqual({ title: 'Title', body: 'Body', labels: [] });
  expect(http.post.mock.calls[0][2].headers.Accept).toBe('application/vnd.github+json');
});

test('the materialization endpoint requires an authenticated admin', async () => {
  const app = express(); app.use(express.json());
  const githubIssues = { materialize: jest.fn().mockResolvedValue({ issue: { issueNumber: 42 }, replay: false }) };
  app.use('/api/zorgax/development', createDevelopmentRequestRouter({ githubIssues,
    auth: (req, res, next) => {
      if (!req.headers['x-user']) return res.sendStatus(401);
      req.userId = req.headers['x-user']; req.userRole = req.headers['x-role']; next();
    },
    admin: (req, res, next) => req.userRole === 'admin' ? next() : res.sendStatus(403)
  }));
  const url = '/api/zorgax/development/requests/dev-123/github-issues';
  await supertest(app).post(url).send({ repository: 'org/repo' }).expect(401);
  await supertest(app).post(url).set('x-user', 'worker').send({ repository: 'org/repo' }).expect(403);
  await supertest(app).post(url).set('x-user', 'admin').set('x-role', 'admin')
    .send({ repository: 'org/repo' }).expect(201);
  expect(githubIssues.materialize).toHaveBeenCalledTimes(1);
});
