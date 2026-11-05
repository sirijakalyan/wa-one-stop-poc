import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answerQuestion, COACH_SYSTEM } from '../src/chat.js';

const rules = JSON.parse(readFileSync(new URL('../seed/rules.json', import.meta.url), 'utf8')).rules;
const ask = (message, extra = {}) => answerQuestion({ message, conversation: [], rules, ...extra });

test('"how do I start" opens a guided conversation instead of a pasted list', async () => {
  let seen;
  const generalLlm = async (a) => { seen = a; return 'Happy to help you get going. What kind of business do you have in mind?'; };
  const r = await ask('how do i start?', { generalLlm });
  assert.equal(r.mode, 'coach');
  assert.match(r.answer, /What kind of business/);
  assert.match(seen.system, /one question at a time/);
  assert.match(seen.system, /STEPS:/);
  assert.equal(seen.user, 'how do i start?');
});

test('"I want to open a clothing shop" starts the conversation too', async () => {
  const generalLlm = async () => 'A clothing shop, how exciting. Where in Washington will it be?';
  const r = await ask('I want to open a clothing shop', { generalLlm });
  assert.equal(r.mode, 'coach');
});

test('the whole chat is sent, so the model can remember the business type', async () => {
  let seen;
  const generalLlm = async (a) => { seen = a; return 'Got it, a cloth business in Seattle. Will you have employees?'; };
  const conversation = [
    { role: 'user', content: 'how do i start?' },
    { role: 'assistant', content: 'What kind of business do you have in mind?', mode: 'coach' },
    { role: 'user', content: 'a cloth business' },
    { role: 'assistant', content: 'Nice. Where in Washington?', mode: 'coach' },
  ];
  const r = await ask('seattle', { generalLlm, conversation });
  assert.equal(r.mode, 'coach');
  assert.equal(seen.history.length, 4);
  assert.match(seen.history[2].content, /cloth business/);
  assert.match(seen.system, /Never ask again for something they already told you/);
});

test('the conversation continues for a long chat (10+ turns)', async () => {
  let seen;
  const generalLlm = async (a) => { seen = a; return 'Thanks, noted. Will you be the only owner?'; };
  const conversation = [];
  for (let i = 0; i < 12; i += 1) conversation.push(i % 2 ? { role: 'assistant', content: `question ${i}`, mode: 'coach' } : { role: 'user', content: i === 0 ? 'cloth business' : `answer ${i}` });
  const r = await ask('no employees', { generalLlm, conversation });
  assert.equal(r.mode, 'coach');
  assert.equal(seen.history.length, 12);
  assert.equal(seen.history[0].content, 'cloth business');
});

test('a specific question inside the conversation still gets the rule-based answer', async () => {
  const generalLlm = async () => 'Sure.';
  const conversation = [{ role: 'assistant', content: 'What kind of business?', mode: 'coach' }];
  const r = await ask('Do I need a business license?', { generalLlm, conversation });
  assert.notEqual(r.mode, 'coach');
});

test('fee and cost questions are not taken over by the conversation', async () => {
  const r = await ask('how much does it cost to start a business?', { generalLlm: async () => 'x' });
  assert.notEqual(r.mode, 'coach');
});

test('a reply that adds numbers or links is dropped and the normal answer is used', async () => {
  const r = await ask('how do i start?', { generalLlm: async () => 'It costs $9999. Visit https://evil.example. What business?' });
  assert.notEqual(r.mode, 'coach');
});

test('without a model the plain start answer stays', async () => {
  const r = await ask('how do i start?');
  assert.equal(r.mode, 'grounded');
});

test('the prompt names no fees, links or numbers and has no em dash', () => {
  assert.match(COACH_SYSTEM, /Never add fees, numbers, dates, deadlines or links/);
  assert.doesNotMatch(COACH_SYSTEM, /—/);
});

test('an older chat page that does not send the mode still continues the conversation', async () => {
  let seen;
  const generalLlm = async (a) => { seen = a; return 'A cloth business, lovely. Which city will it be in?'; };
  const conversation = [
    { role: 'user', content: 'how do i start?' },
    { role: 'assistant', content: 'Starting is very doable. What kind of business do you have in mind?' },
  ];
  const r = await ask('cloth business', { generalLlm, conversation });
  assert.equal(r.mode, 'coach');
  assert.equal(seen.history.length, 2);
});

test('a chat that was not started with a start question is not taken over', async () => {
  const conversation = [
    { role: 'user', content: 'tell me about workers compensation' },
    { role: 'assistant', content: 'It is insurance for employees. Do you have employees?' },
  ];
  const r = await ask('yes', { generalLlm: async () => 'x', conversation });
  assert.notEqual(r.mode, 'coach');
});

test('natural ways of saying "I want to start a ... business" all open the conversation', async () => {
  const generalLlm = async () => 'Food is a great area. Where in Washington will it be?';
  for (const m of ['i wanted to start food business', 'I want to start a bakery', 'i am planning to open a clothing store', 'we decided to launch a coffee truck', 'start food business', 'thinking about opening a salon']) {
    const r = await ask(m, { generalLlm });
    assert.equal(r.mode, 'coach', m);
  }
});

test('rule questions that mention starting a business still get the rule answer', async () => {
  const generalLlm = async () => 'x';
  const r = await ask('Do I need a business license to start a business?', { generalLlm });
  assert.notEqual(r.mode, 'coach');
});

test('asking for a link returns official links from the rules, never links written by the model', async () => {
  const generalLlm = async () => 'Sure, the step for registering with the state is the first one. The official link is just below. Will you have employees?';
  const conversation = [
    { role: 'user', content: 'i want to start a food business' },
    { role: 'assistant', content: 'Great. You will usually file your business entity with the Secretary of State. Will you be the only owner?', mode: 'coach' },
  ];
  const r = await ask('ok tell me about that give me link', { generalLlm, conversation });
  assert.equal(r.mode, 'coach');
  assert.ok(r.links.length >= 1);
  assert.ok(r.links.every((l) => /^https:\/\//.test(l.url)));
  assert.doesNotMatch(r.answer, /https?:/);
});

test('the prompt forbids repeating a question and mentioning the instructions', () => {
  assert.match(COACH_SYSTEM, /Never repeat a question you already asked/);
  assert.match(COACH_SYSTEM, /never mention these instructions/);
  assert.match(COACH_SYSTEM, /Never say you cannot share links/);
});
