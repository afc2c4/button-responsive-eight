// src/db/database.js
// -----------------------------------------------------------------------------
// Abre a conexão com o SQLite do ms-blog e garante que o esquema existe.
//
// Este banco pertence SOMENTE ao ms-blog. A tabela `posts` guarda apenas o
// `author_id`, e não o nome nem o e-mail do autor. Esses dados ficam no
// ms-users e são obtidos por HTTP quando necessário.
// -----------------------------------------------------------------------------

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

const IN_MEMORY = ':memory:';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    author_id   INTEGER NOT NULL,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );

  -- Índice para listar os posts de um autor sem varrer a tabela inteira.
  CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts (author_id);
`;

export function openDatabase(filePath) {
  const isInMemory = filePath === IN_MEMORY;

  if (!isInMemory) {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');

  if (!isInMemory) {
    db.pragma('journal_mode = WAL');
  }

  db.exec(SCHEMA);
  return db;
}
