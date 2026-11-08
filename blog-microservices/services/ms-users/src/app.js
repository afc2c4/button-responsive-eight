// src/app.js
// -----------------------------------------------------------------------------
// Monta a aplicação Express e a DEVOLVE, sem abrir nenhuma porta.
//
// Este arquivo NÃO sabe de onde vêm os services: eles chegam por parâmetro.
// Por isso o mesmo app pode ser usado pelo servidor real (server.js) e pelos
// testes de integração com Supertest, que sobe um servidor temporário sozinho.
// -----------------------------------------------------------------------------

import express from 'express';
import { NotFoundError } from './errors/app-error.js';
import { createAuthController } from './controllers/auth.controller.js';
import { createUsersController } from './controllers/users.controller.js';
import { createAuthenticate } from './middlewares/authenticate.js';
import { errorHandler } from './middlewares/error-handler.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createUsersRouter } from './routes/users.routes.js';

export function createApp({ usersService, authService, tokenIssuer }) {
  const app = express();
  const authenticate = createAuthenticate({ tokenIssuer });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ms-users' });
  });

  app.use(
    '/auth',
    createAuthRouter({
      authController: createAuthController({ authService, usersService }),
      authenticate,
    }),
  );

  app.use(
    '/users',
    createUsersRouter({
      usersController: createUsersController({ usersService }),
      authenticate,
    }),
  );

  app.use((req, res, next) => {
    next(new NotFoundError('Rota não encontrada'));
  });

  app.use(errorHandler);

  return app;
}
