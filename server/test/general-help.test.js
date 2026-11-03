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
  for (const q of ['how do i file my b&o return online']) {
    const r = await answerQuestion({ message: q, rules });
    assert.notEqual(r.matched?.[0]?.title, 'Apply for your Washington business license', q);
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

test('checked FAQ answers: documents, tax due dates, UBI', async () => {
  const d = await answerQuestion({ message: 'do i need any documents to upload', rules });
  assert.match(d.answer, /does not list documents to upload/);
  assert.equal(d.links[0].url, 'https://dor.wa.gov/open-business/apply-business-license');
  const t = await answerQuestion({ message: 'when should i pay tax', rules });
  assert.match(t.answer, /25th/);
  assert.match(t.answer, /April 15/);
  const u = await answerQuestion({ message: 'what is a UBI number', rules });
  assert.match(u.answer, /Unified Business Identifier/);
});

test('"where to pay online or offline" gets the how-to-pay answer, not the fee page', async () => {
  const r = await answerQuestion({ message: 'i dont have idea where to pay online or offline', rules });
  assert.match(r.answer, /My DOR account/);
  assert.match(r.answer, /by mail, you send/i);
  const fee = await answerQuestion({ message: 'how much is the business license fee', rules });
  assert.match(fee.answer, /Fee:/);
});
