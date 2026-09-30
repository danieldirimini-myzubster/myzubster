'use strict';

const fs = require('fs');
const path = require('path');

const servicePath = path.join(
  process.cwd(),
  'src',
  'services',
  'zorgaxBuildPlanner.js'
);

describe('Zorgax BuildPlanner external trust boundary', () => {
  let source;

  beforeAll(() => {
    source = fs.readFileSync(servicePath, 'utf8');
  });

  test('imports external minimization', () => {
    expect(source).toMatch(/\bminimizeForExternalProcessing\b/);
  });

  test('sourceComponents has a separate trusted external authorization option', () => {
    expect(source).toMatch(
      /const\s+externalProcessingAllowed\s*=\s*options\.externalProcessingAllowed\s*===\s*true/
    );
  });

  test('WEB_SEARCH policy receives the separate authorization signal', () => {
    expect(source).toMatch(
      /destination:\s*EGRESS\.WEB_SEARCH\s*,\s*externalProcessingAllowed/
    );
  });

  test('live mode alone is not the privacy authorization decision', () => {
    expect(source).toContain(
      'const externalEgressAllowed = live && webDecision.allowed'
    );

    expect(source).not.toMatch(
      /externalProcessingAllowed\s*=\s*live/
    );
  });

  test('derived component queries are minimized before Brave or Tavily', () => {
    expect(source).toMatch(
      /const\s+externalQuery\s*=\s*minimizeForExternalProcessing\(\s*item\.search_query/
    );

    expect(source).toMatch(
      /provider\(\s*externalQuery\.text\s*,\s*limit\s*\)/
    );

    expect(source).not.toMatch(
      /provider\(\s*item\.search_query\s*,\s*limit\s*\)/
    );
  });

  test('raw plan goal remains the input to classification and authorization', () => {
    expect(source).toMatch(
      /classifyData\(\{\s*content:\s*plan\?\.goal\s*\}\)/
    );

    expect(source).toMatch(
      /evaluateEgress\(\{\s*content:\s*plan\?\.goal/
    );
  });
});
