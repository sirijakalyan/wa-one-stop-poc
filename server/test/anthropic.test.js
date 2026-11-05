import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnthropicLlm } from '../src/anthropic.js';

test('no key means no model', () => {
  assert.equal(createAnthropicLlm({ apiKey: '' }), null);
});

test('the request has no temperature, which newer models reject', async () => {
  const real = globalThis.fetch;
  let sent;
  globalThis.fetch = async (_url, init) => { sent = JSON.parse(init.body); return { ok: true, json: async () => ({ content: [{ text: 'Paris.' }] }) }; };
  try {
    const llm = createAnthropicLlm({ apiKey: 'test-key', model: 'm' });
    const out = await llm({ system: 's', user: 'q', temperature: 0.3 });
    assert.equal(out, 'Paris.');
    assert.equal('temperature' in sent, false);
    assert.equal(sent.model, 'm');
  } finally { globalThis.fetch = real; }
});

test('a model error names the status and message', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'bad request' } }) });
  try {
    const llm = createAnthropicLlm({ apiKey: 'test-key' });
    await assert.rejects(() => llm({ system: 's', user: 'q' }), /HTTP 400: bad request/);
  } finally { globalThis.fetch = real; }
});
