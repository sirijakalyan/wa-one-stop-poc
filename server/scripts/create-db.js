// Creates the app database if it does not exist yet. Run once on a new PostgreSQL server.
//
//   Windows PowerShell:
//     $env:ADMIN_DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres"
//     npm run db:create -w server
//
// Optional: DB_NAME (default checklist_app). Your password stays on your computer.
import pg from 'pg';

const adminUrl = process.env.ADMIN_DATABASE_URL?.trim();
const name = process.env.DB_NAME?.trim() || 'checklist_app';

if (!adminUrl) {
  console.error('Set ADMIN_DATABASE_URL to a connection string for the "postgres" database, then run again.');
  process.exit(1);
}
if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) {
  console.error('DB_NAME may only use lowercase letters, numbers and underscores.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const exists = (await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])).rowCount > 0;
  if (exists) console.log(`Database "${name}" already exists. Nothing to do.`);
  else {
    await client.query(`CREATE DATABASE "${name}"`);
    console.log(`Created database "${name}".`);
  }
  console.log(`Next: set DATABASE_URL to the same server with /${name} at the end, then run: npm run dev`);
} catch (err) {
  console.error(`Could not create the database: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
