'use strict';
const crypto = require('crypto');
class DevelopmentError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const approved = new Set(['APPROVED', 'REWARD_ELIGIBLE', 'REWARDED']);
function requiredText(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new DevelopmentError(`${name} must be a nonempty string of at most ${max} characters`);
  return value.trim();
}
async function preview({ KnowledgeModel, creatorId, title, description, knowledgeIds }) {
  title = requiredText(title, 'title', 160);
  description = requiredText(description, 'description', 5000);
  if (!Array.isArray(knowledgeIds) || !knowledgeIds.length || knowledgeIds.length > 20 ||
      knowledgeIds.some(id => typeof id !== 'string' || !id.trim() || id.length > 160) ||
      new Set(knowledgeIds).size !== knowledgeIds.length)
    throw new DevelopmentError('knowledgeIds must contain 1–20 unique identifiers');
  const refs = [];
  for (const contributionId of [...knowledgeIds].sort()) {
    const source = await KnowledgeModel.findOne({ contributionId });
    if (!source || !approved.has(source.status)) throw new DevelopmentError('Knowledge contribution is unavailable or unverified', 409);
    const content = { contributionId, authorId: source.authorId, type: source.type,
      title: source.title, description: source.description, reference: source.reference || null,
      pilotId: source.pilotId || null, category: source.category || null };
    const date = source.updatedAt || source.createdAt;
    if (!date || Number.isNaN(new Date(date).getTime())) throw new DevelopmentError('Knowledge version unavailable', 409);
    refs.push({ contributionId, version: new Date(date).toISOString(), contentHash: hash(content), title: source.title });
  }
  const digest = hash({ creatorId, title, description, refs });
  return { creatorId, title, description, knowledgeRefs: refs, digest, requiresConfirmation: true, externalActionPerformed: false };
}
async function confirm({ KnowledgeModel, RequestModel, creatorId, title, description, knowledgeIds, digest }) {
  const snapshot = await preview({ KnowledgeModel, creatorId, title, description, knowledgeIds });
  if (typeof digest !== 'string' || digest !== snapshot.digest) throw new DevelopmentError('Preview is stale; preview again', 409);
  const existing = await RequestModel.findOne({ digest });
  if (existing) return { request: existing, replay: true };
  try {
    const { requiresConfirmation, externalActionPerformed, ...record } = snapshot;
    return { request: await RequestModel.create(record), replay: false };
  } catch (error) {
    if (error.code === 11000) {
      const replay = await RequestModel.findOne({ digest });
      if (replay) return { request: replay, replay: true };
    }
    throw error;
  }
}
async function transition({ RequestModel, requestId, from, to, filter = {}, changes = {} }) {
  const request = await RequestModel.findOneAndUpdate({ requestId, status: from, ...filter },
    { $set: { status: to, ...changes } }, { new: true, runValidators: true });
  if (!request) throw new DevelopmentError(`Request is missing or cannot advance from ${from}`, 409);
  return request;
}
module.exports = { DevelopmentError, preview, confirm, transition, requiredText };
