'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax direct research privacy boundary', () => {
  const routePath = path.join(
    __dirname,
    '..',
    'src',
    'routes',
    'zorgaxAssistantRoutes.js'
  );

  test('research route is protected by the shared privacy policy', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    expect(source).toContain("require('../services/zorgaxPrivacyPolicyService')");
    expect(source).toMatch(/classifyData/);
    expect(source).toMatch(/evaluateEgress/);
    expect(source).toMatch(/EGRESS\.WEB_SEARCH/);
  });

  test('research query is classified before searchWeb is called', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    const start = source.indexOf("router.get('/research'");
    expect(start).toBeGreaterThanOrEqual(0);

    const block = source.slice(start, start + 2600);
    const classify = block.indexOf('classifyData(');
    const decision = block.indexOf('evaluateEgress(');
    const search = block.indexOf('searchWeb(');

    expect(classify).toBeGreaterThanOrEqual(0);
    expect(decision).toBeGreaterThan(classify);
    expect(search).toBeGreaterThan(decision);
  });

  test('client cannot declare its own privacy classification', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    const start = source.indexOf("router.get('/research'");
    expect(start).toBeGreaterThanOrEqual(0);

    const block = source.slice(start, start + 2600);

    expect(block).not.toMatch(
      /req\.query\.(?:classification|privacyClassification)/
    );
  });

  test('sensitive research query is denied web egress', () => {
    const {
      EGRESS,
      PROCESSING_MODES,
      classifyData,
      evaluateEgress
    } = require('../src/services/zorgaxPrivacyPolicyService');

    const query = 'Cerca informazioni per mario.rossi@example.com';
    const classification = classifyData({ content: query });

    const decision = evaluateEgress({
      content: query,
      declaredClassification: classification.classification,
      destination: EGRESS.WEB_SEARCH
    });

    expect(classification.classification).toBe('PII');
    expect(decision.processingMode)
      .toBe(PROCESSING_MODES.LOCAL_ONLY);
    expect(decision.allowed).toBe(false);
  });
});
