// src/container.js
// -----------------------------------------------------------------------------
// "Composition root": o ÚNICO lugar que conhece as implementações concretas.
//
// Aqui o banco real, o hasher real e o emissor real de JWT são conectados
// aos services. Nenhum outro módulo de regra de negócio faz essa ligação.
// Essa centralização é o que permite trocar uma peça sem reescrever o resto.
// -----------------------------------------------------------------------------

import { createApp } from './app.js';
import { openDatabase } from './db/database.js';
import { createUsersRepository } from './repositories/users.repository.js';
import { createAuthService } from './services/auth.service.js';
import { createUsersService } from './services/users.service.js';
import { passwordHasher } from './security/password.js';
import { createTokenIssuer } from './security/token.js';

export function buildServer(config) {
  const db = openDatabase(config.dbPath);

  const usersRepository = createUsersRepository(db);
  const tokenIssuer = createTokenIssuer({
    secret: config.jwt.secret,
    expiresInSeconds: config.jwt.expiresInSeconds,
  });

  const usersService = createUsersService({ usersRepository, passwordHasher });
  const authService = createAuthService({
    usersRepository,
    passwordHasher,
    tokenIssuer,
    tokenExpiresInSeconds: config.jwt.expiresInSeconds,
  });

  const app = createApp({ usersService, authService, tokenIssuer });

  return { app, db };
}
