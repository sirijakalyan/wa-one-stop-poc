import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';
import { blankCard } from '../src/intake.js';

const restaurant = { structure: 'llc', desc: '', cats: ['food'], city: 'Bellevue', county: 'King', hiring: 'yes', subs: 'unsure', salestax: 'yes', income: 'yes', tradename: 'yes' };

// Every text field a visitor sees on a step card, except web addresses, source titles and agency page names.
function visible(item) {
  const g = item.guide || {};
  return [item.title, item.agency, item.reason, item.detail, item.fallback, item.noLink, item.apply?.label, g.meaning, ...(g.who || []), ...(g.conditions || []), ...(g.prepare || []), g.prepareNote, ...(g.steps || []).map((s) => s.text), g.pendingNote, g.whyExternal, ...(g.facts || []).flatMap((f) => [f.label, f.text])].filter(Boolean);
}
const ENGLISH = /\b(the|and|you|your|with|for|that|this|which|says|must)\b/i;

test('Spanish: the checklist, dashboard and phases come back in Spanish, with the same steps as English', async () => {
  const app = await startApp();
  try {
    await app.call('POST', '/api/checklist', { answers: restaurant });
    const en = (await app.call('GET', '/api/checklist')).body;
    const es = (await app.call('GET', '/api/checklist?lang=es')).body;
    assert.deepEqual(es.items.map((i) => i.id), en.items.map((i) => i.id));
    assert.deepEqual(es.items.map((i) => i.status), en.items.map((i) => i.status));
    assert.deepEqual(es.items.map((i) => i.verification.status), en.items.map((i) => i.verification.status));
    assert.equal(es.phases[1], 'Forme su negocio');
    for (const item of es.items) {
      for (const text of visible(item)) assert.doesNotMatch(text, ENGLISH, `${item.id}: ${text}`);
    }
    const sos = es.items.find((i) => i.id === 'sos');
    assert.match(sos.reason, /Usted eligió LLC\./);
    const dor = es.items.find((i) => i.id === 'dor');
    assert.match(dor.reason, /usted planea contratar personal en los próximos 90 días, usted vende algo que requiere cobrar impuesto sobre las ventas, usted espera ingresos brutos de \$12,000 al año o más y usted usa un nombre distinto/);
    const dorFacts = dor.guide.facts.map((f) => f.status);
    assert.deepEqual(dorFacts, en.items.find((i) => i.id === 'dor').guide.facts.map((f) => f.status));
    const found = es.items.find((i) => i.id === 'esd').foundLinks[0];
    assert.equal(found.label, 'Pasos de registro de empleadores del ESD');
    assert.equal(found.url, en.items.find((i) => i.id === 'esd').foundLinks[0].url);
    assert.match(es.items.find((i) => i.id === 'health').countyHealth.note, /^Página del permiso permanente/);
    const dash = (await app.call('GET', '/api/dashboard?lang=es')).body;
    assert.ok(dash.byPhase.some((p) => p.name === 'Forme su negocio'));
    // English stays English when no language is sent.
    assert.match(en.items.find((i) => i.id === 'sos').title, /File your business entity/);
  } finally {
    await app.stop();
  }
});

test('Spanish: left-out steps, the plan, the road and the rule-change simulation are in Spanish', async () => {
  const app = await startApp();
  try {
    await app.call('POST', '/api/checklist', { answers: { ...restaurant, structure: 'sole', hiring: 'no', subs: 'yes', cats: ['other'] } });
    const es = (await app.call('GET', '/api/checklist?lang=es')).body;
    const lni = es.skipped.find((s) => s.ruleId === 'lni-contractor');
    assert.match(lni.reason, /Se omite porque no eligió construcción y contratistas\. Usar subcontratistas no convierte/);
    for (const s of es.skipped) assert.doesNotMatch(`${s.title} ${s.reason}`, ENGLISH, s.ruleId);

    const card = blankCard();
    const confirm = (f, values) => { card.status[f] = 'confirmed'; Object.assign(card.values, values); };
    confirm('structure', { structure: 'llc' }); confirm('activity', { desc: 'restaurante', cats: ['food'] }); confirm('place', { city: 'Bellevue', county: 'King' });
    confirm('hiring', { hiring: 'yes' }); confirm('subs', { subs: 'no' }); confirm('salestax', { salestax: 'yes' }); confirm('income', { income: 'yes' }); confirm('tradename', { tradename: 'no' });
    const plan = (await app.call('POST', '/api/intake/plan?lang=es', { card })).body;
    assert.ok(plan.plan.items.length > 3);
    assert.equal(plan.plan.items.find((i) => i.id === 'sos').title, 'Presente su entidad comercial ante el Secretario de Estado');
    assert.match(plan.plan.items.find((i) => i.id === 'sos').trigger, /Usted eligió LLC/);
    assert.equal(plan.timeline.phases[0].name, 'Forme su negocio');
    assert.match(plan.timeline.estimate.note, /Basado en estimaciones publicadas por las agencias/);
    assert.equal(plan.timeline.estimate.basedOn[0].text.includes('días') || plan.timeline.estimate.basedOn[0].text.includes('semanas'), true);
    const sim = (await app.call('POST', '/api/simulate/rule-change?lang=es', { card })).body;
    assert.match(sim.notice.text, /La página de la fuente de "Solicite su licencia comercial de Washington" ahora muestra aproximadamente 15 días hábiles/);
    assert.match(sim.after.note, /Cambio inventado/);
    assert.match(sim.alert.title, /^Simulación:/);
    const enPlan = (await app.call('POST', '/api/intake/plan', { card })).body;
    assert.equal(enPlan.plan.items.find((i) => i.id === 'sos').title, 'File your business entity with the Secretary of State');
  } finally {
    await app.stop();
  }
});

test('Spanish: an admin edit to the English text is never hidden by the Spanish draft', async () => {
  const app = await startApp();
  try {
    const { localizeRules } = await import('../src/localize.js');
    const doc = JSON.parse((await import('node:fs')).readFileSync(new URL('../seed/rules.json', import.meta.url), 'utf8'));
    doc.rules.find((r) => r.id === 'sos').version = 2;
    doc.rules.find((r) => r.id === 'sos').title = 'Edited English title';
    const es = localizeRules(doc, 'es');
    assert.equal(es.rules.find((r) => r.id === 'sos').title, 'Edited English title');
    assert.match(es.rules.find((r) => r.id === 'dor').title, /^Solicite su licencia/);
  } finally {
    await app.stop();
  }
});
