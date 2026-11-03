import test from 'node:test';
import assert from 'node:assert/strict';
import { answerQuestion } from '../src/chat.js';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../seed/rules.json', import.meta.url), 'utf8')).rules;

test('a question outside the guides gets labeled general help, with no links or invented numbers', async () => {
  const generalLlm = async () => 'Dogs are usually fine in many shops but rules differ. See https://example.com/x for details. The fee is $50.';
  const r = await answerQuestion({ message: 'Can I bring my dog to my bakery on weekends?', rules, generalLlm });
  assert.equal(r.mode, 'general');
  assert.match(r.answer, /^General information, not an official rule/);
  assert.doesNotMatch(r.answer, /https?:/);
  assert.deepEqual(r.links, []);
});

test('without a general model the plain fallback stays', async () => {
  const r = await answerQuestion({ message: 'Can I bring my dog to my bakery on weekends?', rules });
  assert.equal(r.mode, 'fallback');
});

test('a covered question is still answered from the guides, not by the general model', async () => {
  let called = false;
  const r = await answerQuestion({ message: 'Do I need a business license?', rules, generalLlm: async () => { called = true; return 'x'; } });
  assert.notEqual(r.mode, 'general');
  assert.equal(called, false);
});

test('paying taxes is not matched to the license page', async () => {
  for (const q of ['when should i pay tax', 'When are my sales taxes due?']) {
    const r = await answerQuestion({ message: q, rules });
    assert.equal(r.mode, 'fallback', q);
  }
  const e = await answerQuestion({ message: 'How do I register for employer taxes?', rules });
  assert.equal(e.mode, 'grounded');
});

test('hello gets a warm model reply when a model is set, and the plain line otherwise', async () => {
  const warm = await answerQuestion({ message: 'hi', rules, generalLlm: async () => 'Hi! Happy to help with your checklist or any question.' });
  assert.match(warm.answer, /^Hi! Happy/);
  const plain = await answerQuestion({ message: 'hi', rules });
  assert.match(plain.answer, /^Hi there!/);
});
