const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const routes = fs.readFileSync(path.join(__dirname, '../src/routes/marketplaceHandoverRoutes.js'), 'utf8');
const model = fs.readFileSync(path.join(__dirname, '../src/models/MarketplaceHandover.js'), 'utf8');
const pilot = fs.readFileSync(path.join(__dirname, '../src/routes/kefirPilotRoutes.js'), 'utf8');

test('free kefir handover is mounted in the pilot API', () => {
  assert.match(pilot, /router\.use\('\/handover', marketplaceHandoverRoutes\)/);
  assert.match(routes, /kefir_culture_donation/);
  assert.match(routes, /listing\.currency !== 'FREE'/);
  assert.match(routes, /listing\.exchangeMode !== 'gift'/);
});

test('handover states advance only through explicit confirmations', () => {
  assert.match(model, /'ACCEPTED', 'HANDED_OVER', 'RECEIVED', 'RECORDED'/);
  assert.match(routes, /handover\.state !== 'ACCEPTED'/);
  assert.match(routes, /handover\.state !== 'HANDED_OVER'/);
  assert.match(routes, /handover\.state !== 'RECEIVED'/);
});

test('donor and recipient confirmations are separated', () => {
  assert.match(routes, /Solo il donatore può confermare la consegna/);
  assert.match(routes, /Solo il destinatario può confermare la ricezione/);
  assert.match(routes, /Il donatore non può accettare il proprio annuncio/);
});

test('free handover never implies payment or blockchain evidence', () => {
  assert.match(routes, /paymentRequired: false/);
  assert.match(routes, /onchainRecorded: false/);
  assert.doesNotMatch(routes, /transactionId|txHash|charge|checkout|conversion/);
});

test('kefir handover defaults to participant-only non-research evidence', () => {
  assert.match(model, /evidenceClassification/);
  assert.match(model, /default: 'PARTICIPANT_ONLY'/);
  assert.match(model, /default: 'kefir_hand_delivery_evidence'/);
  assert.match(model, /researchEligible:[\s\S]*?default: false/);
  assert.match(model, /publicAnchoringAllowed:[\s\S]*?default: false/);
});

test('commitment preparation is governed by evidence classification', () => {
  assert.match(routes, /canPrepareCommitment/);
  assert.match(routes, /handover\.evidenceClassification/);
  assert.match(routes, /if \(!commitmentPolicy\.allowed\)/);
  assert.match(routes, /code: commitmentPolicy\.code/);
});
