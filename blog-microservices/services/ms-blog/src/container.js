// src/container.js
// -----------------------------------------------------------------------------
// "Composition root" do ms-blog: o único lugar que conhece as implementações
// concretas (banco, cliente HTTP, verificador de JWT).
//
// Os services e o app não importam nada disso diretamente. Recebem tudo pronto
// por parâmetro. Essa separação é o que permite testar cada peça isolada.
// -----------------------------------------------------------------------------

import { createApp } from './app.js';
import { createUsersClient } from './clients/users.client.js';
import { openDatabase } from './db/database.js';
import { createPostsRepository } from './repositories/posts.repository.js';
import { createPostsService } from './services/posts.service.js';
import { createTokenVerifier } from './security/token-verifier.js';

export function buildServer(config) {
  const db = openDatabase(config.dbPath);

  const postsRepository = createPostsRepository(db);
  const usersClient = createUsersClient({
    baseUrl: config.usersService.baseUrl,
    timeoutMs: config.usersService.timeoutMs,
  });
  const tokenVerifier = createTokenVerifier({ secret: config.jwt.secret });

  const postsService = createPostsService({ postsRepository, usersClient });
  const app = createApp({ postsService, tokenVerifier });

  return { app, db };
}
