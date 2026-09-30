const fs = require('fs');
const path = require('path');

const servicePath = path.join(
  process.cwd(),
  'src',
  'services',
  'zorgaxAssistantService.js'
);

describe('Zorgax runtime external minimization boundary', () => {
  let source;

  beforeAll(() => {
    source = fs.readFileSync(servicePath, 'utf8');
  });

  test('assistant imports the external minimizer', () => {
    expect(source).toMatch(
      /\bminimizeForExternalProcessing\b/
    );
  });

  test('PUBLIC branch minimizes message only after local-only branch returns', () => {
    const localReturn = source.indexOf(
      "ai_fallback_reason: 'privacy_local_only'"
    );

    const minimization = source.indexOf(
      'const externalPayload = minimizeForExternalProcessing(text'
    );

    expect(localReturn).toBeGreaterThan(-1);
    expect(minimization).toBeGreaterThan(localReturn);
  });

  test('web search receives minimized content rather than raw user text', () => {
    expect(source).toContain(
      'await searchWeb(externalPayload.text, limit)'
    );

    expect(source).not.toContain(
      'await searchWeb(text, limit)'
    );
  });

  test('OpenAI runtime call receives minimized message and history', () => {
    expect(source).toMatch(
      /const\s+openaiResult\s*=\s*await\s+askOpenAI\(\s*externalPayload\.text\s*,\s*research\.sources\s*,\s*externalHistory\s*,\s*reservationUsd\s*\)/
    );
  });

  test('all three public gateway runtime calls receive minimized message and history', () => {
    const expected =
      'askGeneralAI(externalPayload.text, research.sources, externalHistory, useWeb)';

    const matches = source.split(expected).length - 1;

    expect(matches).toBe(3);

    expect(source).not.toContain(
      'askGeneralAI(text, research.sources, history, useWeb)'
    );
  });

  test('history entries are minimized before external egress', () => {
    expect(source).toMatch(
      /const\s+externalHistory\s*=\s*Array\.isArray\(history\)/
    );

    expect(source).toMatch(
      /minimizeForExternalProcessing\(\s*String\(item\?\.(?:content|message)/
    );

    expect(source).toContain('content: minimized.text');
    expect(source).toContain('message: minimized.text');
  });

  test('OpenAI budget calculation uses the minimized outbound message', () => {
    expect(source).toContain(
      'buildAssistantPrompt(externalPayload.text, research.sources)'
    );
  });
});
