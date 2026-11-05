// One-time local setup: creates server/.env from .env.example so the server can read your settings.
// If a real ANTHROPIC_API_KEY was typed into .env.example by mistake, it is moved into .env and removed from the example file.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = new URL('../', import.meta.url);
const example = fileURLToPath(new URL('.env.example', dir));
const env = fileURLToPath(new URL('.env', dir));

const lines = readFileSync(example, 'utf8').split(/\r?\n/);
const keyLine = lines.find((l) => /^ANTHROPIC_API_KEY=\S+/.test(l));
const clean = lines.filter((l) => l !== keyLine);

if (keyLine) {
  writeFileSync(example, clean.join('\n'));
  console.log('Removed the key from server/.env.example so it cannot be committed.');
}
if (!existsSync(env)) {
  writeFileSync(env, `${clean.join('\n').trimEnd()}\n`);
  console.log('Created server/.env from the example.');
}
if (keyLine) {
  const body = readFileSync(env, 'utf8').split(/\r?\n/).filter((l) => !/^#?\s*ANTHROPIC_API_KEY=/.test(l));
  writeFileSync(env, `${body.join('\n').trimEnd()}\n${keyLine}\n`);
  console.log('Saved your ANTHROPIC_API_KEY in server/.env.');
}
if (!/^REQUIRE_LOGIN=/m.test(readFileSync(env, 'utf8'))) {
  writeFileSync(env, `${readFileSync(env, 'utf8').trimEnd()}\nREQUIRE_LOGIN=false\n`);
  console.log('Set REQUIRE_LOGIN=false for local testing.');
}
console.log('Done. Restart "npm run dev".');
