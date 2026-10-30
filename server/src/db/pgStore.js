import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { migrate } from './migrate.js';
import { SEED_DIR } from '../store.js';

const iso = (v) => (v instanceof Date ? v.toISOString() : v);

// PostgreSQL implementation of the store interface used by service.js.
// Rules are shared. Checklists, notifications and settings are keyed by visitor id.
export function createPgStore(pool) {
  async function seedDoc() {
    return JSON.parse(await readFile(path.join(SEED_DIR, 'rules.json'), 'utf8'));
  }
  const hashOf = (doc) => createHash('sha256').update(JSON.stringify(doc)).digest('hex');

  async function insertSeed(client, doc) {
    await client.query('DELETE FROM rules');
    await client.query('DELETE FROM rule_changes');
    await client.query("INSERT INTO rule_meta (key, value) VALUES ('phases', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(doc.phases)]);
    await client.query("INSERT INTO rule_meta (key, value) VALUES ('seed_hash', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(hashOf(doc))]);
    let i = 0;
    for (const rule of doc.rules) {
      await client.query('INSERT INTO rules (id, position, data) VALUES ($1, $2, $3::jsonb)', [rule.id, i, JSON.stringify(rule)]);
      i += 1;
    }
  }

  // Create tables, then load the seed rules when the table is empty or the seed file changed
  // and nobody has published an admin change yet.
  async function init(log = () => {}) {
    await migrate(pool, log);
    const doc = await seedDoc();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(7340211)');
      const count = Number((await client.query('SELECT COUNT(*) AS n FROM rules')).rows[0].n);
      const changes = Number((await client.query('SELECT COUNT(*) AS n FROM rule_changes')).rows[0].n);
      const stored = (await client.query("SELECT value FROM rule_meta WHERE key = 'seed_hash'")).rows[0]?.value;
      if (count === 0 || (changes === 0 && stored !== hashOf(doc))) {
        await insertSeed(client, doc);
        log('Loaded seed rules');
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async function readRules() {
    const phases = (await pool.query("SELECT value FROM rule_meta WHERE key = 'phases'")).rows[0]?.value ?? {};
    const rules = (await pool.query('SELECT data FROM rules ORDER BY position')).rows.map((r) => r.data);
    const changes = (await pool.query('SELECT data FROM rule_changes ORDER BY at, id')).rows.map((r) => r.data);
    const questions = (await pool.query("SELECT value FROM rule_meta WHERE key = 'questions'")).rows[0]?.value ?? [];
    return { phases, rules, changes, questions };
  }

  async function writeRules(doc) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let i = 0;
      for (const rule of doc.rules) {
        await client.query(
          'INSERT INTO rules (id, position, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, data = EXCLUDED.data',
          [rule.id, i, JSON.stringify(rule)],
        );
        i += 1;
      }
      // A rule an admin removed is gone for good. The document always holds every rule, so anything missing was removed.
      await client.query('DELETE FROM rules WHERE id <> ALL($1::text[])', [doc.rules.map((r) => r.id)]);
      for (const c of doc.changes || []) {
        await client.query('INSERT INTO rule_changes (id, at, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING', [c.id, c.at, JSON.stringify(c)]);
      }
      if (Array.isArray(doc.questions)) {
        await client.query("INSERT INTO rule_meta (key, value) VALUES ('questions', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(doc.questions)]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async function resetRules() {
    const doc = await seedDoc();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await insertSeed(client, doc);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const rowToChecklist = (r) => ({
    id: r.visitor_id, answers: r.answers, label: r.label, done: r.done, renewals: r.renewals, savedAt: iso(r.saved_at),
  });

  return {
    kind: 'postgres',
    init,
    readRules,
    writeRules,
    resetRules,

    async getChecklist(v) {
      const r = await pool.query('SELECT * FROM checklists WHERE visitor_id = $1', [v]);
      return r.rows[0] ? rowToChecklist(r.rows[0]) : null;
    },
    async putChecklist(v, cl) {
      await pool.query(
        `INSERT INTO checklists (visitor_id, answers, label, done, renewals, saved_at, updated_at)
         VALUES ($1, $2::jsonb, $3, $4::jsonb, $5::jsonb, COALESCE($6::timestamptz, NOW()), NOW())
         ON CONFLICT (visitor_id) DO UPDATE SET answers = EXCLUDED.answers, label = EXCLUDED.label,
           done = EXCLUDED.done, renewals = EXCLUDED.renewals, saved_at = EXCLUDED.saved_at, updated_at = NOW()`,
        [v, JSON.stringify(cl.answers), cl.label || '', JSON.stringify(cl.done || {}), JSON.stringify(cl.renewals || {}), cl.savedAt || null],
      );
    },
    async deleteChecklist(v) {
      await pool.query('DELETE FROM checklists WHERE visitor_id = $1', [v]);
    },
    async listChecklists() {
      return (await pool.query('SELECT * FROM checklists')).rows.map(rowToChecklist);
    },

    async listNotifications(v) {
      const r = await pool.query('SELECT * FROM notifications WHERE visitor_id = $1 ORDER BY created_at, id', [v]);
      return r.rows.map((n) => ({ id: n.id, type: n.type, simulated: n.simulated, read: n.read, createdAt: iso(n.created_at), title: n.title, body: n.body }));
    },
    async addNotification(v, n) {
      await pool.query(
        'INSERT INTO notifications (id, visitor_id, type, simulated, read, created_at, title, body) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [n.id, v, n.type, n.simulated !== false, Boolean(n.read), n.createdAt, n.title, n.body],
      );
    },
    async markRead(v, id) {
      const r = await pool.query('UPDATE notifications SET read = TRUE WHERE id = $1 AND visitor_id = $2', [id, v]);
      return r.rowCount > 0;
    },

    async getSettings(v) {
      const r = await pool.query('SELECT email_opt_in, email, email_confirmed, email_token FROM visitor_settings WHERE visitor_id = $1', [v]);
      const row = r.rows[0] || {};
      return {
        emailOptIn: Boolean(row.email_opt_in), email: row.email || '', emailConfirmed: Boolean(row.email_confirmed), emailToken: row.email_token || '',
      };
    },
    async putSettings(v, s) {
      const cur = await this.getSettings(v);
      const next = { ...cur, ...s, emailOptIn: Boolean(s.emailOptIn) };
      await pool.query(
        `INSERT INTO visitor_settings (visitor_id, email_opt_in, email, email_confirmed, email_token) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (visitor_id) DO UPDATE SET email_opt_in = EXCLUDED.email_opt_in, email = EXCLUDED.email,
           email_confirmed = EXCLUDED.email_confirmed, email_token = EXCLUDED.email_token`,
        [v, next.emailOptIn, next.email || null, Boolean(next.emailConfirmed), next.emailToken || null],
      );
    },
    async findVisitorByToken(token) {
      if (!token) return null;
      const r = await pool.query('SELECT visitor_id FROM visitor_settings WHERE email_token = $1', [token]);
      return r.rows[0]?.visitor_id || null;
    },
    async listEmailSubscribers() {
      const r = await pool.query("SELECT visitor_id, email, email_token FROM visitor_settings WHERE email_opt_in AND email_confirmed AND email IS NOT NULL AND email <> ''");
      return r.rows.map((x) => ({ id: x.visitor_id, email: x.email, token: x.email_token }));
    },
    async hasReminderSent(v, key) {
      const r = await pool.query('SELECT 1 FROM reminder_log WHERE visitor_id = $1 AND reminder_key = $2', [v, key]);
      return r.rowCount > 0;
    },
    async recordReminder(v, key) {
      await pool.query('INSERT INTO reminder_log (visitor_id, reminder_key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [v, key]);
    },

    async resetVisitor(v) {
      await pool.query('DELETE FROM checklists WHERE visitor_id = $1', [v]);
      await pool.query('DELETE FROM notifications WHERE visitor_id = $1', [v]);
      await pool.query('DELETE FROM reminder_log WHERE visitor_id = $1', [v]);
      await pool.query('DELETE FROM visitor_settings WHERE visitor_id = $1', [v]);
    },

    async addSourceReview(r) {
      await pool.query(
        'INSERT INTO source_reviews (id, rule_id, source_url, reviewed_by, reviewed_at, result, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [r.id, r.ruleId, r.sourceUrl, r.reviewedBy, r.reviewedAt, r.result, r.notes || ''],
      );
    },
    async listSourceReviews({ ruleId, limit = 100 } = {}) {
      const r = await pool.query(
        'SELECT * FROM source_reviews WHERE ($1::text IS NULL OR rule_id = $1) ORDER BY reviewed_at DESC, id LIMIT $2',
        [ruleId || null, limit],
      );
      return r.rows.map((x) => ({ id: x.id, ruleId: x.rule_id, sourceUrl: x.source_url, reviewedBy: x.reviewed_by, reviewedAt: iso(x.reviewed_at), result: x.result, notes: x.notes }));
    },
    async upsertCountySource(c) {
      await pool.query(
        `INSERT INTO county_sources (county, official_url, reviewed_by, reviewed_at, status) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (county) DO UPDATE SET official_url = EXCLUDED.official_url, reviewed_by = EXCLUDED.reviewed_by,
           reviewed_at = EXCLUDED.reviewed_at, status = EXCLUDED.status`,
        [c.county, c.officialUrl, c.reviewedBy, c.reviewedAt, c.status],
      );
    },
    async listCountySources() {
      const r = await pool.query('SELECT * FROM county_sources ORDER BY county');
      return r.rows.map((x) => ({ county: x.county, officialUrl: x.official_url, reviewedBy: x.reviewed_by, reviewedAt: iso(x.reviewed_at), status: x.status }));
    },

    // Accounts and activity log. The account is one JSON document; email is a unique column.
    async createAccount(a) {
      const r = await pool.query('INSERT INTO accounts (id, email, created_at, data) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [a.id, a.email, a.createdAt, JSON.stringify(a)]);
      return r.rowCount === 1;
    },
    async getAccount(id) {
      return (await pool.query('SELECT data FROM accounts WHERE id = $1', [id])).rows[0]?.data || null;
    },
    async findAccountByEmail(email) {
      return (await pool.query('SELECT data FROM accounts WHERE email = $1', [email])).rows[0]?.data || null;
    },
    async findAccountBySession(hash) {
      const r = await pool.query('SELECT data FROM accounts WHERE data->\'sessions\' @> $1::jsonb', [JSON.stringify([{ hash }])]);
      const a = r.rows[0]?.data;
      return a && (a.sessions || []).some((x) => x.hash === hash && x.exp > Date.now()) ? a : null;
    },
    async findAccountByResetToken(hash) {
      const a = (await pool.query('SELECT data FROM accounts WHERE data->>\'resetHash\' = $1', [hash])).rows[0]?.data;
      return a && a.resetExp > Date.now() ? a : null;
    },
    async updateAccount(id, patch) {
      const cur = await this.getAccount(id);
      if (!cur) return null;
      const next = { ...cur, ...patch };
      await pool.query('UPDATE accounts SET data = $2 WHERE id = $1', [id, JSON.stringify(next)]);
      return next;
    },
    async listAccounts() {
      return (await pool.query('SELECT data FROM accounts ORDER BY created_at DESC')).rows.map((r) => r.data);
    },
    async addEvent(v, e) {
      await pool.query('INSERT INTO events (visitor_id, at, type, detail) VALUES ($1,$2,$3,$4)', [v, e.at, e.type, e.detail || '']);
    },
    async listEvents(v, limit = 200) {
      return (await pool.query('SELECT at, type, detail FROM events WHERE visitor_id = $1 ORDER BY at DESC, id DESC LIMIT $2', [v, limit])).rows.map((x) => ({ at: iso(x.at), type: x.type, detail: x.detail, visitorId: v }));
    },

    async counts() {
      const n = async (t) => Number((await pool.query(`SELECT COUNT(*) AS n FROM ${t}`)).rows[0].n);
      return { rules: await n('rules'), checklists: await n('checklists'), notifications: await n('notifications'), sourceReviews: await n('source_reviews'), countySources: await n('county_sources') };
    },
    async close() {
      await pool.end();
    },
  };
}
