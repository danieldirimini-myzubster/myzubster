const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canPersistEvidence,
  canPrepareCommitment,
  canPubliclyAnchor
} = require('../src/services/evidenceClassificationPolicy');

test('missing classification fails closed', () => {
  assert.equal(canPersistEvidence({}).allowed, false);
  assert.equal(canPrepareCommitment({}).allowed, false);
  assert.equal(canPubliclyAnchor({}).allowed, false);
});

test('PUBLIC evidence can prepare a commitment', () => {
  assert.equal(
    canPrepareCommitment({
      evidenceClass: 'PUBLIC',
      publicAnchoringAllowed: false
    }).allowed,
    true
  );
});

test('PUBLIC evidence requires explicit permission for public anchoring', () => {
  assert.equal(
    canPubliclyAnchor({
      evidenceClass: 'PUBLIC',
      publicAnchoringAllowed: false
    }).allowed,
    false
  );

  assert.equal(
    canPubliclyAnchor({
      evidenceClass: 'PUBLIC',
      publicAnchoringAllowed: true
    }).allowed,
    true
  );
});

test('RESTRICTED evidence may have a private commitment but cannot be publicly anchored', () => {
  const classification = {
    evidenceClass: 'RESTRICTED',
    publicAnchoringAllowed: true
  };

  assert.equal(canPrepareCommitment(classification).allowed, true);
  assert.equal(canPubliclyAnchor(classification).allowed, false);
});

test('PARTICIPANT_ONLY evidence may have a private commitment but cannot be publicly anchored', () => {
  const classification = {
    evidenceClass: 'PARTICIPANT_ONLY',
    publicAnchoringAllowed: true
  };

  assert.equal(canPrepareCommitment(classification).allowed, true);
  assert.equal(canPubliclyAnchor(classification).allowed, false);
});

test('EPHEMERAL evidence cannot become persistent evidence or commitment', () => {
  const classification = {
    evidenceClass: 'EPHEMERAL',
    publicAnchoringAllowed: false
  };

  assert.equal(canPersistEvidence(classification).allowed, false);
  assert.equal(canPrepareCommitment(classification).allowed, false);
  assert.equal(canPubliclyAnchor(classification).allowed, false);
});
