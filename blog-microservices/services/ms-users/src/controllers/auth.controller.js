// src/controllers/auth.controller.js
// -----------------------------------------------------------------------------
// Camada HTTP da autenticação.
//
// - POST /auth/login → troca credenciais por um token (rota pública).
// - GET  /auth/me    → devolve o perfil de quem está autenticado (rota protegida).
// -----------------------------------------------------------------------------

export function createAuthController({ authService, usersService }) {
  return {
    async login(req, res) {
      const session = await authService.login(req.body);
      res.json(session);
    },

    async me(req, res) {
      // req.user foi preenchido pelo middleware authenticate.
      const user = await usersService.getOwnProfile(req.user.id);
      res.json(user);
    },
  };
}
