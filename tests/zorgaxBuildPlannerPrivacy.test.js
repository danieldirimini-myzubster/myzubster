'use strict';

const {
  createBuildPlan,
  sourceComponents
} = require('../src/services/zorgaxBuildPlanner');

describe('Zorgax Build Planner privacy boundary', () => {
  const originalFetch = global.fetch;
  const originalBrave = process.env.BRAVE_SEARCH_API_KEY;
  const originalTavily = process.env.TAVILY_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;

    if (originalBrave === undefined) {
      delete process.env.BRAVE_SEARCH_API_KEY;
    } else {
      process.env.BRAVE_SEARCH_API_KEY = originalBrave;
    }

    if (originalTavily === undefined) {
      delete process.env.TAVILY_API_KEY;
    } else {
      process.env.TAVILY_API_KEY = originalTavily;
    }

    jest.restoreAllMocks();
  });

  test('sensitive goal performs zero external provider calls', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-brave';
    process.env.TAVILY_API_KEY = 'test-tavily';

    global.fetch = jest.fn(() => {
      throw new Error('external fetch must not execute');
    });

    const plan = createBuildPlan(
      'Costruire un robot per mario.rossi@example.com'
    );

    const sourcing = await sourceComponents(plan, {
      live: true,
      limit: 3
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(sourcing.privacy.external_egress_allowed).toBe(false);
    expect(sourcing.privacy.classification).toBe('PII');
  });

  test('secret-bearing goal performs zero external provider calls', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-brave';
    process.env.TAVILY_API_KEY = 'test-tavily';

    global.fetch = jest.fn(() => {
      throw new Error('external fetch must not execute');
    });

    const plan = createBuildPlan(
      'Costruire un robot password=super-private-value'
    );

    const sourcing = await sourceComponents(plan, {
      live: true,
      limit: 3
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(sourcing.privacy.external_egress_allowed).toBe(false);
    expect(sourcing.privacy.classification).toBe('CONFIDENTIAL');
  });

  test('blocked live egress still returns generated marketplace links', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-brave';
    process.env.TAVILY_API_KEY = 'test-tavily';

    global.fetch = jest.fn(() => {
      throw new Error('external fetch must not execute');
    });

    const plan = createBuildPlan(
      'Costruire un robot per mario.rossi@example.com'
    );

    const sourcing = await sourceComponents(plan, {
      live: true,
      limit: 3
    });

    const urls = sourcing.components
      .flatMap(component => component.results)
      .map(result => result.url);

    expect(urls.some(url => url.includes('amazon.it'))).toBe(true);
    expect(urls.some(url => url.includes('google.com/search'))).toBe(true);
  });
});
