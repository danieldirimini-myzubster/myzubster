'use strict';

describe('Zorgax Ollama route privacy boundary', () => {
  const originalOllamaUrl = process.env.OLLAMA_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    global.fetch = originalFetch;

    if (originalOllamaUrl === undefined) {
      delete process.env.OLLAMA_URL;
    } else {
      process.env.OLLAMA_URL = originalOllamaUrl;
    }
  });

  test('route source uses the shared local Ollama boundary', () => {
    const fs = require('fs');
    const path = require('path');

    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'routes', 'zorgaxRoutes.js'),
      'utf8'
    );

    expect(source).toContain("require('../services/zorgaxLocalAIService')");
    expect(source).toMatch(/assertLocalOllamaUrl|askLocalOllama/);
  });

  test('remote OLLAMA_URL is rejected by the shared boundary before fetch', async () => {
    process.env.OLLAMA_URL = 'https://remote-ai.example.com';

    global.fetch = jest.fn(() => {
      throw new Error('remote fetch must never execute');
    });

    const {
      getLocalOllamaConfig,
      assertLocalOllamaUrl
    } = require('../src/services/zorgaxLocalAIService');

    const config = getLocalOllamaConfig();

    expect(() => assertLocalOllamaUrl(config.url)).toThrow(/loopback/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
