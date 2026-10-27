// Optional Ollama client. Adapted from the RAG chatbot project (services/ollama.js).
// Leave OLLAMA_BASE_URL empty on the free host: the chat then answers from the rule records only.
const DEFAULT_MODEL = 'llama3.2:3b';

export const isOllamaConfigured = () => Boolean(process.env.OLLAMA_BASE_URL?.trim());

export function createOllamaLlm({ baseUrl = process.env.OLLAMA_BASE_URL, model = process.env.OLLAMA_MODEL || DEFAULT_MODEL, timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || 20000 } = {}) {
  if (!baseUrl?.trim()) return null;
  const base = baseUrl.trim().replace(/\/$/, '');
  return async function ollamaChat({ system, user, history = [], temperature = 0.2, numPredict = 360 }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model, stream: false, options: { temperature, num_predict: numPredict },
          messages: [...(system ? [{ role: 'system', content: system }] : []), ...history, { role: 'user', content: user }],
        }),
      });
      if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
      const content = (await res.json())?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('Ollama returned an empty response');
      return content.trim();
    } finally {
      clearTimeout(timer);
    }
  };
}

export async function checkOllama(baseUrl = process.env.OLLAMA_BASE_URL, model = process.env.OLLAMA_MODEL || DEFAULT_MODEL) {
  if (!baseUrl?.trim()) return { configured: false, ok: false, model };
  try {
    const res = await fetch(`${baseUrl.trim().replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { configured: true, ok: false, model };
    const names = ((await res.json()).models || []).map((m) => m.name);
    return { configured: true, ok: names.some((n) => n === model || n.startsWith(model.split(':')[0])), model };
  } catch {
    return { configured: true, ok: false, model };
  }
}
