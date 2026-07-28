import { pool, query, ENTITIES, entityTable } from './db.js';

const baseTable = (table) => `
  CREATE TABLE IF NOT EXISTS ${table} (
    id            TEXT PRIMARY KEY,
    data          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT
  );
  CREATE INDEX IF NOT EXISTS ${table}_data_gin ON ${table} USING GIN (data);
  CREATE INDEX IF NOT EXISTS ${table}_created_idx ON ${table} (created_date DESC);
  CREATE INDEX IF NOT EXISTS ${table}_updated_idx ON ${table} (updated_date DESC);
`;

export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name     TEXT,
      role          TEXT NOT NULL DEFAULT 'admin',
      data          JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_date  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  // Garante a coluna data mesmo se a tabela já existir de uma versão anterior.
  await query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;`);

  for (const name of ENTITIES) {
    await query(baseTable(entityTable(name)));
  }
  console.log(`[migrate] OK — ${ENTITIES.length} tabelas de entidade + auth_users`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
