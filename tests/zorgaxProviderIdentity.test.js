'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax AI provider identity', () => {
  const servicePath = path.join(
    __dirname,
    '..',
    'src',
    'services',
    'zorgaxAssistantService.js'
  );

  test('public AI gateway is never labelled as Ollama', () => {
    const source = fs.readFileSync(servicePath, 'utf8');

    const publicGatewayCalls = [
      ...source.matchAll(/response\s*=\s*await askGeneralAI\([^;]+;/g)
    ];

    expect(publicGatewayCalls.length).toBeGreaterThan(0);

    for (const match of publicGatewayCalls) {
      const start = Math.max(0, match.index - 500);
      const end = Math.min(
        source.length,
        match.index + match[0].length + 500
      );
      const context = source.slice(start, end);

      expect(context).not.toMatch(
        /route\.provider\s*=\s*['"]ollama['"]/
      );
    }
  });

  test('public gateway has an explicit provider identity', () => {
    const source = fs.readFileSync(servicePath, 'utf8');

    expect(source).toMatch(
      /route\.provider\s*=\s*['"]public-ai-gateway['"]/
    );
  });

  test('public gateway must not advertise an Ollama model', () => {
    const source = fs.readFileSync(servicePath, 'utf8');

    const lines = source.split('\n');

    lines.forEach((line, index) => {
      if (line.includes("route.provider = 'public-ai-gateway'")) {
        const context = lines
          .slice(index, Math.min(lines.length, index + 5))
          .join('\n');

        expect(context).not.toMatch(
          /route\.model\s*=\s*process\.env\.OLLAMA_MODEL/
        );
      }
    });
  });
});
