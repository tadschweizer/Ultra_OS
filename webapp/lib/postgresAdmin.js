import { Pool } from 'pg';

let pool = null;

export function getAdminPool() {
  const connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    throw new Error('Missing SUPABASE_DB_URL for server-side admin access.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }

  return pool;
}
