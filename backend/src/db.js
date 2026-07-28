import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text, params) => pool.query(text, params);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lista de entidades gerada automaticamente a partir do código do frontend e
// das functions (base44.entities.X). Ver scripts/gerar-entidades.sh.
// 'User' é tratado à parte (tabela auth_users), então é removido daqui.
export const ENTITIES = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'entities.list.json'), 'utf8'),
).filter((n) => n !== 'User');

const VALID = new Set([...ENTITIES, 'User']);

// Nome da tabela: entity_<nome em minúsculas>. A geração da lista valida que
// não há colisão de nomes que diferem só por maiúsculas/minúsculas.
export const entityTable = (name) => {
  if (!VALID.has(name)) {
    throw Object.assign(new Error(`Unknown entity: ${name}`), { status: 404 });
  }
  return `entity_${name.toLowerCase()}`;
};
