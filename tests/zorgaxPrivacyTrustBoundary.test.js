'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax privacy trust boundary', () => {
  const routeSource = fs.readFileSync(
    path.join(__dirname, '../src/routes/zorgaxAssistantRoutes.js'),
    'utf8'
  );

  test('public chat does not trust a client-supplied privacy classification', () => {
    expect(routeSource).not.toContain('req.body?.privacyClassification');
    expect(routeSource).not.toContain('req.body.privacyClassification');
    expect(routeSource).not.toContain('req.body?.classification');
    expect(routeSource).not.toContain('req.body.classification');
  });

  test('chat still delegates content to server-side privacy enforcement', () => {
    expect(routeSource).toContain(
      "answer({ message: req.body?.message || req.body?.prompt, useWeb, history: req.body?.history || [], limit })"
    );
  });
});
