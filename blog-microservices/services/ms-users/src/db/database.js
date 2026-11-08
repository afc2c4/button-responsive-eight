// src/db/database.js
// -----------------------------------------------------------------------------
// Abre a conexão com o SQLite e garante que o esquema existe.
//
// - Para ':memory:', o banco vive apenas na memória do processo (usado nos testes).
// - Para um caminho de arquivo, a pasta é criada se ainda não existir.
// -----------------------------------------------------------------------------

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

const IN_MEMORY = ':memory:';

// CREATE TABLE IF NOT EXISTS: seguro para ser executado a cada inicialização.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL
  );
`;

export function openDatabase(filePath) {
  const isInMemory = filePath === IN_MEMORY;

  if (!isInMemory) {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');

  if (!isInMemory) {
    // WAL permite leituras concorrentes enquanto uma escrita acontece.
    db.pragma('journal_mode = WAL');
  }

  db.exec(SCHEMA);
  return db;
}
