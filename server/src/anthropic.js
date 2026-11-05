// Optional general-help model for questions the written rules and guides do not cover.
// Leave ANTHROPIC_API_KEY empty and the chat keeps its plain "I don't have that" answer. The key is read from the environment only.
export function createAnthropicLlm({ apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', timeoutMs = Number(process.env.ANTHROPIC_TIMEOUT_MS) || 20000 } = {}) {
  if (!apiKey?.trim()) { console.log('General help model: off (ANTHROPIC_API_KEY is not set)'); return null; }
  console.log(`General help model: on (${model})`);
  return async function anthropicChat({ system, user, history = [], numPredict = 400 }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey.trim(), 'anthropic-version': '2023-06-01' },
        signal: controller.signal,
        // No temperature: newer models reject it (HTTP 400 "temperature is deprecated for this model").
        body: JSON.stringify({ model, max_tokens: numPredict, system, messages: [...history, { role: 'user', content: user }] }),
      });
      if (!res.ok) {
        let why = '';
        try { why = (await res.json())?.error?.message || ''; } catch { /* no body */ }
        throw new Error(`Model returned HTTP ${res.status}${why ? `: ${String(why).slice(0, 200)}` : ''}`);
      }
      const text = (await res.json())?.content?.map((b) => b.text || '').join('').trim();
      if (!text) throw new Error('Model returned an empty response');
      return text;
    } finally {
      clearTimeout(timer);
    }
  };
}
