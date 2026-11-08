// src/routes/users.routes.js
// -----------------------------------------------------------------------------
// Mapa de rotas do recurso /users. Cada linha liga método + caminho a um
// handler do controller. Aqui só existe ROTEAMENTO, nenhuma lógica.
//
//   POST   /users       → cadastro (público)
//   GET    /users       → lista de perfis públicos (público)
//   GET    /users/:id   → perfil público de um usuário (público)
//   PATCH  /users/:id   → atualiza a própria conta (autenticado)
//   DELETE /users/:id   → remove a própria conta (autenticado)
// -----------------------------------------------------------------------------

import { Router } from 'express';

export function createUsersRouter({ usersController, authenticate }) {
  const router = Router();

  router.post('/', usersController.register);
  router.get('/', usersController.list);
  router.get('/:id', usersController.getById);
  router.patch('/:id', authenticate, usersController.update);
  router.delete('/:id', authenticate, usersController.remove);

  return router;
}
