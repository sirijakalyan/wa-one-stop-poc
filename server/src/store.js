import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDocStore } from './docStore.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SEED_DIR = path.resolve(here, '..', 'seed');
export const DEFAULT_DATA_DIR = path.resolve(here, '..', 'data');
export const DATA_FILES = ['rules', 'users', 'checklists', 'notifications', 'source_reviews', 'county_sources', 'accounts', 'events'];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

// JSON file store. Working copies live in dataDir and are created from seed/ on first use.
export function createStore(dataDir = DEFAULT_DATA_DIR) {
  const file = (name) => path.join(dataDir, `${name}.json`);
  async function ensure() {
    await mkdir(dataDir, { recursive: true });
    for (const name of DATA_FILES) {
      if (!(await exists(file(name)))) await copyFile(path.join(SEED_DIR, `${name}.json`), file(name));
    }
  }
  const store = createDocStore({
    async read(name) {
      await ensure();
      return JSON.parse(await readFile(file(name), 'utf8'));
    },
    async write(name, data) {
      await ensure();
      await writeFile(file(name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    },
    async seed(name) {
      return JSON.parse(await readFile(path.join(SEED_DIR, `${name}.json`), 'utf8'));
    },
  });
  return { ...store, kind: 'files', dataDir };
}
