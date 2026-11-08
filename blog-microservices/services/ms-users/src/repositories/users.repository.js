// src/repositories/users.repository.js
// -----------------------------------------------------------------------------
// Único lugar do ms-users que conhece SQL.
//
// Responsabilidades:
//   - executar as consultas;
//   - converter linhas do banco (snake_case) para objetos da aplicação (camelCase);
//   - traduzir erros do banco em erros da aplicação.
//
// Todos os métodos devolvem Promises. O better-sqlite3 é síncrono, mas manter
// a mesma assinatura assíncrona permite trocar de banco no futuro sem alterar
// os services, e também faz os stubs dos testes terem o mesmo formato.
// -----------------------------------------------------------------------------

import { ConflictError } from '../errors/app-error.js';

const UNIQUE_VIOLATION_CODE = 'SQLITE_CONSTRAINT_UNIQUE';

function toUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function translateDatabaseError(error) {
  if (error.code === UNIQUE_VIOLATION_CODE) {
    // Segunda barreira contra e-mails duplicados: mesmo que dois cadastros
    // passem pela checagem do service ao mesmo tempo, o banco recusa o segundo.
    return new ConflictError('E-mail já cadastrado');
  }
  return error;
}

export function createUsersRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO users (name, email, password_hash, created_at)
    VALUES (@name, @email, @passwordHash, @createdAt)
  `);

  const findByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const findByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const listStmt = db.prepare('SELECT * FROM users ORDER BY id ASC');

  // COALESCE: quando o parâmetro é NULL, mantém o valor que já está no banco.
  const updateStmt = db.prepare(`
    UPDATE users
       SET name          = COALESCE(@name, name),
           email         = COALESCE(@email, email),
           password_hash = COALESCE(@passwordHash, password_hash)
     WHERE id = @id
  `);

  const deleteStmt = db.prepare('DELETE FROM users WHERE id = ?');

  return {
    async create({ name, email, passwordHash }) {
      try {
        const result = insertStmt.run({
          name,
          email,
          passwordHash,
          createdAt: new Date().toISOString(),
        });
        return toUser(findByIdStmt.get(result.lastInsertRowid));
      } catch (error) {
        throw translateDatabaseError(error);
      }
    },

    async findById(id) {
      return toUser(findByIdStmt.get(id));
    },

    async findByEmail(email) {
      return toUser(findByEmailStmt.get(email));
    },

    async list() {
      return listStmt.all().map(toUser);
    },

    async update(id, { name = null, email = null, passwordHash = null } = {}) {
      try {
        updateStmt.run({ id, name, email, passwordHash });
      } catch (error) {
        throw translateDatabaseError(error);
      }
      return toUser(findByIdStmt.get(id));
    },

    async delete(id) {
      return deleteStmt.run(id).changes > 0;
    },
  };
}
