'use strict';
const axios = require('axios');
const { githubHeaders, normalizeVisibility } = require('./githubBountySyncService');
const { DevelopmentError } = require('./developmentRequestService');

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const marker = requestId => `myz-development-request:${requestId}`;

function createGitHubClient({ http = axios, token = () => process.env.GITHUB_TOKEN } = {}) {
  const config = () => {
    if (!token()) throw new DevelopmentError('GitHub integration is not configured', 503);
    return { headers: githubHeaders(), timeout: 10000 };
  };
  return {
    async visibility(repository) {
      const response = await http.get(`https://api.github.com/repos/${repository}`, config());
      return normalizeVisibility(response.data);
    },
    async create(repository, title, body) {
      const response = await http.post(`https://api.github.com/repos/${repository}/issues`,
        { title, body, labels: [] }, config());
      return response.data;
    },
    async find(repository, requestId) {
      const response = await http.get('https://api.github.com/search/issues', {
        ...config(), params: { q: `repo:${repository} is:issue in:body "${marker(requestId)}"`, per_page: 100 }
      });
      return (response.data.items || []).find(issue => issue.pull_request === undefined &&
        String(issue.body || '').includes(`<!-- ${marker(requestId)} -->`)) || null;
    }
  };
}

function issueBody(request) {
  const refs = request.knowledgeRefs.map(ref =>
    `- ${ref.contributionId} (version: ${ref.version}; sha256: ${ref.contentHash})`).join('\n');
  return `${request.description}\n\nDevelopmentRequest: ${request.requestId}\nKnowledge snapshots:\n${refs}\n\n<!-- ${marker(request.requestId)} -->`;
}

async function materialize({ RequestModel, requestId, repository, client = createGitHubClient(),
  allowedRepositories = process.env.GITHUB_DEVELOPMENT_REPOSITORIES || '' }) {
  if (!repositoryPattern.test(repository || '') || repository.includes('..'))
    throw new DevelopmentError('Invalid repository');
  const allowed = new Set(String(allowedRepositories).split(',').map(item => item.trim()).filter(Boolean));
  if (!allowed.size) throw new DevelopmentError('Development repositories are not configured', 503);
  if (!allowed.has(repository)) throw new DevelopmentError('Repository is not approved for DevelopmentRequests', 403);

  // KnowledgeContribution has no visibility field yet. Refuse public targets until
  // each source can be explicitly classified for publication.
  const visibility = await client.visibility(repository);
  if (!['private', 'internal'].includes(visibility))
    throw new DevelopmentError('Public GitHub target requires knowledge visibility review', 403);

  const reserved = await RequestModel.findOneAndUpdate(
    { requestId, status: 'OPEN', 'githubIssues.repository': { $ne: repository } },
    { $push: { githubIssues: { repository, state: 'PENDING', reservedAt: new Date() } } },
    { new: true, runValidators: true }
  );
  if (!reserved) {
    const existing = await RequestModel.findOne({ requestId });
    if (!existing) throw new DevelopmentError('DevelopmentRequest not found', 404);
    const item = (existing.githubIssues || []).find(issue => issue.repository === repository);
    if (!item) throw new DevelopmentError('Only OPEN requests can create GitHub issues', 409);
    if (item.state === 'CREATED') return { issue: item, replay: true };
    // A previous attempt may have succeeded before the local record was updated.
    // Search once; never POST again while a reservation is unresolved.
    const remote = await client.find(repository, requestId);
    if (!remote) throw new DevelopmentError('GitHub issue reservation pending reconciliation', 409);
    return { issue: await saveIssue(RequestModel, requestId, repository, remote), replay: true };
  }

  // No GitHub write occurs in preview or request confirmation. This is the sole POST.
  const remote = await client.create(repository, reserved.title, issueBody(reserved));
  return { issue: await saveIssue(RequestModel, requestId, repository, remote), replay: false };
}

async function saveIssue(RequestModel, requestId, repository, remote) {
  const number = remote?.number;
  if (!Number.isSafeInteger(number) || number < 1)
    throw new DevelopmentError('GitHub response needs manual reconciliation', 502);
  const url = `https://github.com/${repository}/issues/${number}`;
  const record = await RequestModel.findOneAndUpdate(
    { requestId, githubIssues: { $elemMatch: { repository, state: 'PENDING' } } },
    { $set: { 'githubIssues.$.state': 'CREATED', 'githubIssues.$.issueNumber': number,
      'githubIssues.$.url': url, 'githubIssues.$.createdAt': new Date() } },
    { new: true, runValidators: true }
  );
  if (!record) throw new DevelopmentError('GitHub issue requires local reconciliation', 409);
  return record.githubIssues.find(issue => issue.repository === repository);
}

module.exports = { createGitHubClient, materialize, issueBody, marker };
