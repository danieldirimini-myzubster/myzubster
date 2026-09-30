'use strict';

const {
  getLocalOllamaConfig,
  isLoopbackHostname,
  assertLocalOllamaUrl,
  askLocalOllama
} = require('../src/services/zorgaxLocalAIService');

const originalFetch = global.fetch;
const originalOllamaUrl = process.env.OLLAMA_URL;
const originalOllamaModel = process.env.OLLAMA_MODEL;

afterEach(() => {
  global.fetch = originalFetch;

  if (originalOllamaUrl === undefined) {
    delete process.env.OLLAMA_URL;
  } else {
    process.env.OLLAMA_URL = originalOllamaUrl;
  }

  if (originalOllamaModel === undefined) {
    delete process.env.OLLAMA_MODEL;
  } else {
    process.env.OLLAMA_MODEL = originalOllamaModel;
  }

  jest.restoreAllMocks();
});

describe('Zorgax local AI service', () => {
  test('defaults to loopback Ollama', () => {
    delete process.env.OLLAMA_URL;
    delete process.env.OLLAMA_MODEL;

    expect(getLocalOllamaConfig()).toEqual({
      url: 'http://127.0.0.1:11434',
      model: 'qwen2.5:3b'
    });
  });

  test('recognizes only explicit loopback hostnames as local', () => {
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('localhost')).toBe(true);
    expect(isLoopbackHostname('::1')).toBe(true);

    expect(isLoopbackHostname('10.0.0.5')).toBe(false);
    expect(isLoopbackHostname('192.168.1.20')).toBe(false);
    expect(isLoopbackHostname('myzubster-gateway.vercel.app')).toBe(false);
  });

  test('rejects a public Ollama endpoint from LOCAL_OLLAMA mode', () => {
    expect(() =>
      assertLocalOllamaUrl('https://example.com')
    ).toThrow(/requires a loopback/i);
  });

  test('rejects a private-network host from LOCAL_OLLAMA mode', () => {
    expect(() =>
      assertLocalOllamaUrl('http://192.168.1.50:11434')
    ).toThrow(/requires a loopback/i);
  });

  test('sends local request only to loopback Ollama', async () => {
    process.env.OLLAMA_URL = 'http://127.0.0.1:11434';
    process.env.OLLAMA_MODEL = 'qwen2.5:3b';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: {
          content: 'Local response'
        }
      })
    });

    const result = await askLocalOllama({
      message: 'Internal company architecture'
    });

    expect(result).toEqual({
      text: 'Local response',
      provider: 'local-ollama',
      model: 'qwen2.5:3b'
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = global.fetch.mock.calls[0];

    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);

    expect(body.model).toBe('qwen2.5:3b');
    expect(body.stream).toBe(false);
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: 'Internal company architecture'
      }
    ]);
  });

  test('refuses remote configuration before fetch executes', async () => {
    process.env.OLLAMA_URL = 'https://remote-ai.example.com';

    global.fetch = jest.fn();

    await expect(
      askLocalOllama({
        message: 'Confidential acquisition plan'
      })
    ).rejects.toThrow(/requires a loopback/i);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
