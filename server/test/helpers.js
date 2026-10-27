import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';

// Start the Express app on a random port. Pass app options (adminKey, llm, store).
export async function startApp(options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'wa-poc-'));
  const app = createApp({ dataDir: dir, ...options });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  return { call, base, service: app.service, async stop() { server.close(); await rm(dir, { recursive: true, force: true }); } };
}

export const ANSWERS = { structure: 'llc', desc: '', cats: ['food'], city: 'Bellevue', county: 'King', hiring: 'yes', subs: 'no', salestax: 'yes', income: 'yes', tradename: 'yes' };
