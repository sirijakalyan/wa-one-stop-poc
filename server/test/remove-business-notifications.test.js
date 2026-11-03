import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocStore } from '../src/docStore.js';

test('removing a business removes its renewal notifications and no one else\'s', async () => {
  const docs = { notifications: { notifications: [] } };
  const store = createDocStore({ read: async (n) => docs[n], write: async (n, d) => { docs[n] = d; }, seed: async () => {} });
  const add = (id, biz, title, v = 'v1') => store.addNotification(v, { id, type: 'renewal', biz, read: false, createdAt: '2026-01-01', title, body: '' });
  await add('a', 'main', 'Renewal reminder: License');
  await add('b', 'abc123', 'Renewal reminder: License (Cafe)');
  await add('c', undefined, 'Renewal reminder: Filing (Cafe)'); // older, no tag
  await add('d', 'abc123', 'Renewal reminder: License (Cafe)', 'v2');
  const n = await store.removeBusinessNotifications('v1', 'abc123', { label: 'Cafe' });
  assert.equal(n, 2);
  assert.deepEqual((await store.listNotifications('v1')).map((x) => x.id), ['a']);
  assert.equal((await store.listNotifications('v2')).length, 1);
  assert.equal(await store.removeBusinessNotifications('v1', 'main', { none: true }), 1);
});
