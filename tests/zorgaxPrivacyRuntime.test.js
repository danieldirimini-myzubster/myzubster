'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../src/services/zorgaxAIUsageService', () => ({
  getAstraMonthlySpend: jest.fn(async () => 0),
  recordAstraUsage: jest.fn(),
  reserveAstraBudget: jest.fn(),
  settleAstraBudget: jest.fn(),
  releaseAstraBudget: jest.fn()
}));

const { answer } = require('../src/services/zorgaxAssistantService');

const originalFetch = global.fetch;
const originalOllamaUrl = process.env.OLLAMA_URL;
const originalAuditPath = process.env.ZORGAX_PRIVACY_AUDIT_PATH;

let auditDir;
let auditPath;

beforeEach(() => {
  auditDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'zorgax-runtime-audit-')
  );
  auditPath = path.join(auditDir, 'privacy.jsonl');
  process.env.ZORGAX_PRIVACY_AUDIT_PATH = auditPath;
});

afterEach(() => {
  global.fetch = originalFetch;

  if (originalOllamaUrl === undefined) {
    delete process.env.OLLAMA_URL;
  } else {
    process.env.OLLAMA_URL = originalOllamaUrl;
  }

  if (originalAuditPath === undefined) {
    delete process.env.ZORGAX_PRIVACY_AUDIT_PATH;
  } else {
    process.env.ZORGAX_PRIVACY_AUDIT_PATH = originalAuditPath;
  }

  if (auditDir) {
    fs.rmSync(auditDir, { recursive: true, force: true });
  }

  jest.clearAllMocks();
});

describe('Zorgax enterprise privacy runtime enforcement', () => {
  test('PII performs only loopback Ollama egress', async () => {
    process.env.OLLAMA_URL = 'http://127.0.0.1:11434';

    global.fetch = jest.fn(async input => {
      const url = String(input);

      if (url === 'http://127.0.0.1:11434/api/chat') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: {
              content: 'Risposta elaborata localmente'
            }
          })
        };
      }

      throw new Error(`External egress attempted: ${url}`);
    });

    const result = await answer({
      message: 'Analizza il contatto mario.rossi@example.com',
      useWeb: true
    });

    expect(result.ai_provider).toBe('local-ollama');
    expect(result.ai_fallback_reason).toBe('privacy_local_only');
    expect(result.sources).toEqual([]);
    expect(result.web_research_available).toBe(false);

    expect(result.privacy).toEqual(
      expect.objectContaining({
        classification: 'PII',
        processing_mode: 'LOCAL_ONLY',
        external_egress_allowed: false,
        web_research_performed: false
      })
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const urls = global.fetch.mock.calls.map(call => String(call[0]));

    expect(urls).toEqual([
      'http://127.0.0.1:11434/api/chat'
    ]);

    expect(
      urls.some(url =>
        url.includes('openai.com') ||
        url.includes('tavily.com') ||
        url.includes('brave.com') ||
        url.includes('wikipedia.org') ||
        url.includes('myzubster-gateway.vercel.app')
      )
    ).toBe(false);

    const storedAudit = fs.readFileSync(auditPath, 'utf8');
    const auditEvent = JSON.parse(storedAudit.trim());

    expect(auditEvent.classification).toBe('PII');
    expect(auditEvent.processingMode).toBe('LOCAL_ONLY');
    expect(auditEvent.destination).toBe('local-ollama');
    expect(auditEvent.allowed).toBe(true);
    expect(auditEvent.contentDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(storedAudit).not.toContain('mario.rossi@example.com');
    expect(storedAudit).not.toContain('Analizza il contatto');
    expect(storedAudit).not.toContain('"prompt"');
    expect(storedAudit).not.toContain('"history"');

    const auditMode = fs.statSync(auditPath).mode & 0o777;
    expect(auditMode).toBe(0o600);
  });

  test('history PII also forces the whole request to LOCAL_ONLY', async () => {
    process.env.OLLAMA_URL = 'http://127.0.0.1:11434';

    global.fetch = jest.fn(async input => {
      const url = String(input);

      if (url !== 'http://127.0.0.1:11434/api/chat') {
        throw new Error(`External egress attempted: ${url}`);
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          message: {
            content: 'Local history-safe response'
          }
        })
      };
    });

    const result = await answer({
      message: 'Riassumi quanto detto',
      history: [
        {
          role: 'user',
          content: 'La mia email è private.person@example.com'
        }
      ],
      useWeb: true
    });

    expect(result.privacy.classification).toBe('PII');
    expect(result.ai_provider).toBe('local-ollama');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('LOCAL_ONLY refuses a remotely configured Ollama before network egress', async () => {
    process.env.OLLAMA_URL = 'https://remote-ai.example.com';

    global.fetch = jest.fn();

    await expect(
      answer({
        message: 'Contatta private.person@example.com',
        useWeb: true
      })
    ).rejects.toThrow(/requires a loopback/i);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
