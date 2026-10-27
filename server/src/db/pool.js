import pg from 'pg';

// Connection settings come from the environment only. Never commit DATABASE_URL.
// Pattern adapted from the RAG chatbot project (lazy pool, no secrets in logs).
const { Pool } = pg;
let poolInstance = null;

export const getDatabaseUrl = () => process.env.DATABASE_URL?.trim() || '';

export function isDatabaseConfigured() {
  const url = getDatabaseUrl();
  return Boolean(url) && !/USERNAME|PASSWORD|YOUR_/.test(url);
}

export function createPool(connectionString = getDatabaseUrl()) {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
    max: Number(process.env.PG_POOL_MAX) || 5,
    // Neon and most hosted Postgres need TLS. The URL's sslmode is honored by pg.
  });
  pool.on('error', () => console.error('Unexpected PostgreSQL pool error'));
  return pool;
}

export function getPool() {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is missing or still has placeholders. Copy server/.env.example to server/.env.');
  }
  if (!poolInstance) poolInstance = createPool();
  return poolInstance;
}

export async function checkDatabase(pool = getPool()) {
  const r = await pool.query('SELECT current_database() AS database, NOW() AS server_time');
  return { database: r.rows[0].database, serverTime: r.rows[0].server_time };
}
