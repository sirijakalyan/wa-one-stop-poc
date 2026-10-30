import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let app;
before(async () => { app = await startApp({ adminKey: 'k-guideq' }); });
after(() => app.stop());

const adm = { 'x-admin-key': 'k-guideq' };
const turn = (body) => app.call('POST', '/api/intake/turn', body).then((r) => r.body);

// Answer every standard question by tapping, return the turn that follows.
async function answerStandard(card, lang = 'en') {
  let t = { card, ask: null };
  const taps = { structure: 'llc', activity: 'other', place: 'skip', hiring: 'no', subs: 'no', salestax: 'yes', income: 'yes', tradename: 'no' };
  for (const [field, value] of Object.entries(taps)) {
    if (!(t.card.status || {})[field] || field) t = await turn({ card: t.card, action: 'set', field, value: field === 'place' ? '' : value, lang });
  }
  return t;
}

test('questions an admin adds are asked in the chat after the standard ones, and the card is not complete until they are answered', async () => {
  const q1 = (await app.call('POST', '/api/questions', { text: 'Will you fly drones for work?', type: 'yesno' }, adm)).body.question;
  const q2 = (await app.call('POST', '/api/questions', { text: 'Which best describes your location?', type: 'choice', options: ['Storefront', 'Home based'] }, adm)).body.question;
  let t = await answerStandard({ values: {}, status: {} });
  assert.equal(t.complete, false);
  assert.equal(t.ask.field, `x:${q1.id}`);
  assert.match(t.reply, /fly drones for work/);
  // A typed answer counts as tapping.
  t = await turn({ card: t.card, message: 'yes we will', asking: t.ask.field });
  assert.equal(t.card.values.extra[q1.id], 'yes');
  assert.equal(t.card.status[`x:${q1.id}`], 'confirmed');
  assert.equal(t.ask.field, `x:${q2.id}`);
  assert.deepEqual(t.ask.chips.map((c) => c.label), ['Storefront', 'Home based', 'Not sure']);
  assert.equal(t.complete, false);
  t = await turn({ card: t.card, message: 'Storefront', asking: `x:${q2.id}` });
  assert.equal(t.complete, true);
  assert.equal(t.card.values.extra[q2.id], q2.options.find((o) => o.label === 'Storefront').value);
  assert.equal(t.card.status[`x:${q2.id}`], 'confirmed', 'a choice named like a business type is not also read as a business detail');
  // The plan only counts as complete when the added questions are answered too.
  const plan = await app.call('POST', '/api/intake/plan', { card: t.card });
  assert.equal(plan.body.complete, true);
  const partial = await app.call('POST', '/api/intake/plan', { card: { ...t.card, status: { ...t.card.status, [`x:${q2.id}`]: undefined } } });
  assert.equal(partial.body.complete, false);
});

test('an admin can reword and delete a standard question, and the guide follows', async () => {
  assert.equal((await app.call('DELETE', '/api/standard-questions/hiring', undefined)).status, 403);
  const list = (await app.call('GET', '/api/questions')).body.standard;
  assert.equal(list.length, 8);
  assert.equal(list[3].field, 'hiring');
  const put = await app.call('PUT', '/api/standard-questions/hiring', { label: 'Planning to hire', text: 'Do you plan to hire in the next three months?', es: { text: '¿Planea contratar en los próximos tres meses?' } }, adm);
  assert.equal(put.status, 200);
  let t = await turn({ card: { values: {}, status: { structure: 'confirmed', activity: 'confirmed', place: 'confirmed' } }, message: '' });
  assert.equal(t.ask.field, 'hiring');
  assert.equal(t.ask.question, 'Do you plan to hire in the next three months?');
  const es = await turn({ card: { values: {}, status: { structure: 'confirmed', activity: 'confirmed', place: 'confirmed' } }, message: '', lang: 'es' });
  assert.equal(es.ask.question, '¿Planea contratar en los próximos tres meses?');
  assert.equal((await app.call('GET', '/api/questions?lang=es')).body.standard[3].text, '¿Planea contratar en los próximos tres meses?');

  const del = await app.call('DELETE', '/api/standard-questions/subs', undefined, adm);
  assert.equal(del.status, 200);
  assert.equal((await app.call('GET', '/api/questions')).body.standard.find((s) => s.field === 'subs').hidden, true);
  t = await turn({ card: { values: {}, status: { structure: 'confirmed', activity: 'confirmed', place: 'confirmed', hiring: 'confirmed' } }, message: '' });
  assert.equal(t.ask.field, 'salestax', 'the deleted question is skipped');
  // Saying something about a deleted question does not put it on the card.
  const said = await turn({ card: t.card, message: 'we will use subcontractors', asking: 'salestax' });
  assert.notEqual(said.card.status.subs, 'heard');
  assert.equal((await app.call('POST', '/api/standard-questions/subs/restore', undefined, adm)).status, 200);
  assert.equal((await app.call('GET', '/api/questions')).body.standard.find((s) => s.field === 'subs').hidden, false);
});

test('the last visible standard question cannot be deleted, and over-long wording is refused', async () => {
  const fields = ['structure', 'activity', 'place', 'hiring', 'subs', 'salestax', 'income', 'tradename'];
  for (const f of fields.slice(0, 7)) assert.equal((await app.call('DELETE', `/api/standard-questions/${f}`, undefined, adm)).status, 200);
  const last = await app.call('DELETE', '/api/standard-questions/tradename', undefined, adm);
  assert.equal(last.status, 400);
  for (const f of fields.slice(0, 7)) await app.call('POST', `/api/standard-questions/${f}/restore`, undefined, adm);
  assert.equal((await app.call('PUT', '/api/standard-questions/income', { text: 'x'.repeat(201) }, adm)).status, 400);
  assert.equal((await app.call('PUT', '/api/standard-questions/nope', { text: 'x' }, adm)).status, 404);
});
