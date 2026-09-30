'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax runtime external authorization boundary', () => {
  const servicePath = path.join(
    __dirname,
    '..',
    'src',
    'services',
    'zorgaxAssistantService.js'
  );

  test('answer exposes an explicit trusted external-processing authorization input', () => {
    const source = fs.readFileSync(servicePath, 'utf8');

    expect(source).toMatch(
      /async function answer\(\{[\s\S]*externalProcessingAllowed\s*=\s*false/
    );
  });

  test('all external egress decisions receive the trusted authorization', () => {
    const source = fs.readFileSync(servicePath, 'utf8');

    const externalDestinations = [
      'EGRESS.WEB_SEARCH',
      'EGRESS.OPENAI',
      'EGRESS.PUBLIC_AI_GATEWAY'
    ];

    for (const destination of externalDestinations) {
      const pattern = new RegExp(
        `evaluateEgress\\(\\{[\\s\\S]{0,350}?destination:\\s*${destination.replace('.', '\\.')}[\\s\\S]{0,180}?externalProcessingAllowed`,
        'g'
      );

      expect(source.match(pattern)?.length || 0).toBeGreaterThan(0);
    }
  });

  test('public chat route does not trust a client externalProcessingAllowed field', () => {
    const route = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'routes', 'zorgaxAssistantRoutes.js'),
      'utf8'
    );

    const start = route.indexOf("router.post('/chat'");
    const end = route.indexOf("router.get('/research'", start);
    const block = route.slice(start, end);

    expect(block).not.toMatch(
      /req\.body\??\.externalProcessingAllowed|req\.body\[['"]externalProcessingAllowed['"]\]/
    );
  });

  test('Telegram and Messenger do not silently opt into external processing', () => {
    for (const relative of [
      '../src/routes/myzubsterTelegramRoutes.js',
      '../src/routes/metaMessengerRoutes.js'
    ]) {
      const source = fs.readFileSync(
        path.join(__dirname, relative),
        'utf8'
      );

      expect(source).not.toMatch(/externalProcessingAllowed\s*:\s*true/);
    }
  });
});
