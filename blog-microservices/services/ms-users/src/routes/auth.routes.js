// src/routes/auth.routes.js
// -----------------------------------------------------------------------------
// Mapa de rotas do recurso /auth.
//
//   POST /auth/login  → gera o access token (público)
//   GET  /auth/me     → perfil de quem está autenticado (autenticado)
// -----------------------------------------------------------------------------

import { Router } from 'express';

export function createAuthRouter({ authController, authenticate }) {
  const router = Router();

  router.post('/login', authController.login);
  router.get('/me', authenticate, authController.me);

  return router;
}
