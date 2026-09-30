'use strict';

const fs = require('fs');
const path = require('path');

const routePath = path.join(
  process.cwd(),
  'src',
  'routes',
  'zorgaxBuildRoutes.js'
);

describe('Zorgax Build routes privacy trust boundary', () => {
  let source;

  beforeAll(() => {
    source = fs.readFileSync(routePath, 'utf8');
  });

  test('public build routes do not accept client external-processing authorization', () => {
    expect(source).not.toMatch(
      /req\.(?:body|query|params)\??\.externalProcessingAllowed/
    );

    expect(source).not.toMatch(
      /externalProcessingAllowed\s*:\s*req\./
    );
  });

  test('public build routes do not accept client privacy classification', () => {
    expect(source).not.toMatch(
      /req\.(?:body|query|params)\??\.(?:privacyClassification|classification)/
    );

    expect(source).not.toMatch(
      /(?:privacyClassification|classification)\s*:\s*req\./
    );
  });

  test('POST /plan passes feature controls but no privacy authorization', () => {
    expect(source).toMatch(
      /sourceComponents\(plan,\s*\{\s*live:\s*req\.body\?\.live\s*!==\s*false,\s*limit:\s*req\.body\?\.limit\s*\}\)/
    );
  });

  test('GET /search passes feature controls but no privacy authorization', () => {
    expect(source).toMatch(
      /sourceComponents\(plan,\s*\{\s*live:\s*req\.query\.live\s*!==\s*['"]false['"],\s*limit:\s*req\.query\.limit\s*\}\)/
    );
  });
});
