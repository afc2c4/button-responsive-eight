// src/services/auth.service.js
// -----------------------------------------------------------------------------
// Autenticação: troca e-mail + senha por um access token JWT.
//
// Regras de segurança aplicadas aqui:
//   1. A mensagem de erro é SEMPRE a mesma, quer o e-mail não exista,
//      quer a senha esteja errada. Assim ninguém descobre quais contas existem.
//   2. A verificação de senha SEMPRE acontece, mesmo quando o usuário não
//      existe (usando um hash de referência). Assim o tempo de resposta
//      também não revela a existência da conta.
// -----------------------------------------------------------------------------

import { UnauthorizedError } from '../errors/app-error.js';
import { DUMMY_PASSWORD_HASH } from '../security/password.js';
import { validateCredentials } from '../validation/users.validation.js';

export const INVALID_CREDENTIALS_MESSAGE = 'Credenciais inválidas';

export function createAuthService({
  usersRepository,
  passwordHasher,
  tokenIssuer,
  tokenExpiresInSeconds,
}) {
  return {
    async login(input) {
      const { email, password } = validateCredentials(input);
      const user = await usersRepository.findByEmail(email);

      const hashToCompare = user ? user.passwordHash : DUMMY_PASSWORD_HASH;
      const passwordMatches = await passwordHasher.verify(password, hashToCompare);

      if (!user || !passwordMatches) {
        throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
      }

      const accessToken = tokenIssuer.sign({
        sub: String(user.id),
        email: user.email,
      });

      return {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: tokenExpiresInSeconds,
      };
    },
  };
}
