// src/app.js
// -----------------------------------------------------------------------------
// Monta a aplicação Express do ms-blog e a DEVOLVE, sem abrir porta.
//
// Recebe os services e o verificador de token por parâmetro. Assim, o servidor
// real (server.js) e os testes de integração usam exatamente a mesma montagem.
// -----------------------------------------------------------------------------

import express from 'express';
import { NotFoundError } from './errors/app-error.js';
import { createPostsController } from './controllers/posts.controller.js';
import { createAuthenticate } from './middlewares/authenticate.js';
import { errorHandler } from './middlewares/error-handler.js';
import { createPostsRouter } from './routes/posts.routes.js';

export function createApp({ postsService, tokenVerifier }) {
  const app = express();
  const authenticate = createAuthenticate({ tokenVerifier });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ms-blog' });
  });

  app.use(
    '/posts',
    createPostsRouter({
      postsController: createPostsController({ postsService }),
      authenticate,
    }),
  );

  app.use((req, res, next) => {
    next(new NotFoundError('Rota não encontrada'));
  });

  app.use(errorHandler);

  return app;
}
