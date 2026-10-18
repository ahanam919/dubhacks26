import pg from "pg";

// Reads DATABASE_URL from the environment. Tiger needs SSL, and the URL's
// sslmode=require handles it. If you get a certificate error, tell me.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 300_000,
  keepAlive: true,
});