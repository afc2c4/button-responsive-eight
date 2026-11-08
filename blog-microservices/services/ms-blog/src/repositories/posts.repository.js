// src/repositories/posts.repository.js
// -----------------------------------------------------------------------------
// Único lugar do ms-blog que conhece SQL.
//
// Assim como no ms-users, os métodos devolvem Promises. O better-sqlite3 é
// síncrono, mas manter a assinatura assíncrona deixa o repositório trocável
// e faz os stubs dos testes terem o mesmo formato do repositório real.
//
// Os nomes das colunas seguem snake_case no banco e camelCase na aplicação.
// A conversão acontece aqui, e em nenhum outro lugar.
// -----------------------------------------------------------------------------

function toPost(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    authorId: row.author_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPostsRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO posts (title, content, author_id, created_at, updated_at)
    VALUES (@title, @content, @authorId, @createdAt, @updatedAt)
  `);

  const findByIdStmt = db.prepare('SELECT * FROM posts WHERE id = ?');
  const listStmt = db.prepare('SELECT * FROM posts ORDER BY id DESC');

  // COALESCE: quando o parâmetro é NULL, mantém o valor que já está no banco.
  const updateStmt = db.prepare(`
    UPDATE posts
       SET title      = COALESCE(@title, title),
           content    = COALESCE(@content, content),
           updated_at = @updatedAt
     WHERE id = @id
  `);

  const deleteStmt = db.prepare('DELETE FROM posts WHERE id = ?');

  return {
    async create({ title, content, authorId }) {
      const now = new Date().toISOString();
      const result = insertStmt.run({
        title,
        content,
        authorId,
        createdAt: now,
        updatedAt: now,
      });
      return toPost(findByIdStmt.get(result.lastInsertRowid));
    },

    async findById(id) {
      return toPost(findByIdStmt.get(id));
    },

    async list() {
      return listStmt.all().map(toPost);
    },

    async update(id, { title = null, content = null } = {}) {
      updateStmt.run({
        id,
        title,
        content,
        updatedAt: new Date().toISOString(),
      });
      return toPost(findByIdStmt.get(id));
    },

    async delete(id) {
      return deleteStmt.run(id).changes > 0;
    },
  };
}
