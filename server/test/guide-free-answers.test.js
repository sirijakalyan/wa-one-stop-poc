import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';
import { blankCard } from '../src/intake.js';

const turn = (app, body) => app.call('POST', '/api/intake/turn', body);

// Opens a chat, confirms what the guide heard, and sets the structure by tapping, so the next question is a yes or no one.
async function atQuestion(app, { tapStructure = true } = {}) {
  const a = await turn(app, { message: 'I want to open a food truck in Spokane and hire two people.', card: blankCard() });
  const b = await turn(app, { action: 'confirm', card: a.body.card });
  if (!tapStructure) return { card: b.body.card, ask: b.body.ask };
  const c = await turn(app, { action: 'set', field: 'structure', value: 'sole', card: b.body.card });
  return { card: c.body.card, ask: c.body.ask };
}

test('an answer in free wording is read as yes when the model says so', async () => {
  let seen;
  const app = await startApp({ generalLlm: async (a) => { seen = a; return 'yes'; } });
  try {
    const { card, ask } = await atQuestion(app);
    const field = ask?.field;
    assert.ok(['subs', 'salestax', 'income', 'tradename'].includes(field), `asking ${field}`);
    const r = await turn(app, { message: 'i am thinking to pay in future', card, asking: field });
    assert.equal(r.status, 200);
    assert.equal(r.body.card.status[field], 'confirmed');
    assert.equal(r.body.card.values[field], 'yes');
    assert.match(seen.system, /only that id/);
    assert.match(seen.user, /ANSWER IDS: yes, no, unsure/);
  } finally { await app.stop(); }
});

test('an unusable model reply leaves the guide asking again', async () => {
  const app = await startApp({ generalLlm: async () => 'I think they probably mean something else entirely' });
  try {
    const { card, ask } = await atQuestion(app);
    assert.ok(ask && ask.field !== 'structure');
    const r = await turn(app, { message: 'blah blah purple', card, asking: ask.field });
    assert.notEqual(r.body.card.status[ask.field], 'confirmed');
  } finally { await app.stop(); }
});

test('without a model the guide behaves as before', async () => {
  const app = await startApp({ generalLlm: null });
  try {
    const { card, ask } = await atQuestion(app);
    assert.ok(ask && ask.field !== 'structure');
    const r = await turn(app, { message: 'i am thinking to pay in future', card, asking: ask.field });
    assert.notEqual(r.body.card.status[ask.field], 'confirmed');
  } finally { await app.stop(); }
});

test('a business set-up said in free wording is read as one of the listed set-ups', async () => {
  let seen;
  const app = await startApp({ generalLlm: async (a) => { seen = a; return 'llc'; } });
  try {
    const { card, ask } = await atQuestion(app, { tapStructure: false });
    assert.equal(ask.field, 'structure');
    const r = await turn(app, { message: 'the kind that protects my house if we ever get sued', card, asking: 'structure' });
    assert.equal(r.body.card.values.structure, 'llc');
    assert.equal(r.body.card.status.structure, 'confirmed');
    assert.match(seen.user, /ANSWER IDS: sole, gp/);
  } finally { await app.stop(); }
});

test('an id that is not on the list is never used', async () => {
  const app = await startApp({ generalLlm: async () => 'yes' });
  try {
    const { card } = await atQuestion(app, { tapStructure: false });
    const r = await turn(app, { message: 'hmm let me think about how to put it', card, asking: 'structure' });
    assert.notEqual(r.body.card.status.structure, 'confirmed');
  } finally { await app.stop(); }
});
