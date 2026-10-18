// Runs a .sql file against DATABASE_URL, for machines without psql.
// Usage (from api/): npm run sql -- ../migrations_002_square.sql
// Supports the one psql variable the seed uses, :'square_location_id', filled
// from SQUARE_LOCATION_ID as an escaped literal. Never prints connection details.
import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
dotenv.config({ path: new URL('../../.env', import.meta.url) });

const file = process.argv[2];
if (!file) { console.error('Usage: npm run sql -- <file.sql>'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  let sql = await readFile(file, 'utf8');
  if (sql.includes(":'square_location_id'")) {
    if (!process.env.SQUARE_LOCATION_ID) throw new Error('Missing SQUARE_LOCATION_ID');
    sql = sql.replaceAll(":'square_location_id'", client.escapeLiteral(process.env.SQUARE_LOCATION_ID));
  }
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log(`Applied ${file}`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`Failed ${file}:`, err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
