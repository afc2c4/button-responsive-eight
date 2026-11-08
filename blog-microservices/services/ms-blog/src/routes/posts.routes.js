// src/routes/posts.routes.js
// -----------------------------------------------------------------------------
// Mapa de rotas do recurso /posts. Só roteamento, sem lógica.
//
//   GET    /posts       → lista os posts (público)
//   GET    /posts/:id   → um post com os dados do autor (público)
//   POST   /posts       → cria um post (autenticado)
//   PATCH  /posts/:id   → altera um post do próprio usuário (autenticado, autor)
//   DELETE /posts/:id   → remove um post do próprio usuário (autenticado, autor)
// -----------------------------------------------------------------------------

import { Router } from 'express';

export function createPostsRouter({ postsController, authenticate }) {
  const router = Router();

  router.get('/', postsController.list);
  router.get('/:id', postsController.getById);
  router.post('/', authenticate, postsController.create);
  router.patch('/:id', authenticate, postsController.update);
  router.delete('/:id', authenticate, postsController.remove);

  return router;
}
