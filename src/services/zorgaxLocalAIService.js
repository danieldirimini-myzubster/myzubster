'use strict';

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'qwen2.5:3b';

function getLocalOllamaConfig() {
  const url = String(process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL)
    .trim()
    .replace(/\/$/, '');

  const model = String(process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL).trim();

  return { url, model };
}

function isLoopbackHostname(hostname) {
  const normalized = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');

  return (
    normalized === '127.0.0.1' ||
    normalized === 'localhost' ||
    normalized === '::1'
  );
}

function assertLocalOllamaUrl(value) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch (_error) {
    throw new Error('Invalid OLLAMA_URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('OLLAMA_URL must use HTTP or HTTPS');
  }

  /*
   * Enterprise privacy invariant:
   * LOCAL_OLLAMA must actually resolve to an explicitly local endpoint.
   * A remote/private-network/public host must not silently inherit the
   * semantic guarantee "local".
   */
  if (!isLoopbackHostname(parsed.hostname)) {
    throw new Error(
      'LOCAL_OLLAMA requires a loopback OLLAMA_URL (127.0.0.1, localhost or ::1)'
    );
  }

  return parsed;
}

async function askLocalOllama({
  message,
  system = '',
  history = []
} = {}) {
  const cleanMessage = String(message || '').trim();

  if (!cleanMessage) {
    throw new Error('Local AI message required');
  }

  const { url, model } = getLocalOllamaConfig();
  assertLocalOllamaUrl(url);

  const messages = [];

  if (String(system || '').trim()) {
    messages.push({
      role: 'system',
      content: String(system).trim()
    });
  }

  if (Array.isArray(history)) {
    for (const item of history.slice(-12)) {
      if (!item || !['user', 'assistant'].includes(item.role)) continue;

      const content = String(item.content || item.message || '').trim();
      if (!content) continue;

      messages.push({
        role: item.role,
        content: content.slice(0, 12000)
      });
    }
  }

  messages.push({
    role: 'user',
    content: cleanMessage.slice(0, 24000)
  });

  const response = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Local Ollama HTTP ${response.status}`);
  }

  const text = String(
    data?.message?.content ||
    data?.response ||
    ''
  ).trim();

  if (!text) {
    throw new Error('Local Ollama returned an empty response');
  }

  return {
    text,
    provider: 'local-ollama',
    model
  };
}

module.exports = {
  DEFAULT_OLLAMA_URL,
  DEFAULT_OLLAMA_MODEL,
  getLocalOllamaConfig,
  isLoopbackHostname,
  assertLocalOllamaUrl,
  askLocalOllama
};
