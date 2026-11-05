import test from 'node:test';
import assert from 'node:assert/strict';
import { answerQuestion } from '../src/chat.js';

const rules = [{ id: 'health', title: 'County health permit', agency: 'County', status: 'pending', guide: {}, keywords: ['restaurant', 'food'] }];

test('a structure suggestion question gets a real suggestion from the model, not a nearby rule', async () => {
  let seen;
  const generalLlm = async (a) => { seen = a; return 'For a restaurant, many owners pick an LLC because it protects your personal money. A sole proprietor is simpler. Will you have partners?'; };
  const r = await answerQuestion({ message: 'tell me the food restaurant comes under what business structure please suggest me', conversation: [], rules, generalLlm });
  assert.equal(r.mode, 'general');
  assert.match(r.answer, /LLC/);
  assert.match(seen.system, /real suggestion/);
});
