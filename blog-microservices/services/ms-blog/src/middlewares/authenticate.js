// src/middlewares/authenticate.js
// -----------------------------------------------------------------------------
// Protege as rotas que exigem login (criar, alterar e remover posts).
//
// Lê o cabeçalho  Authorization: Bearer <token>, verifica a assinatura e a
// validade com o tokenVerifier e anexa o usuário em req.user.
//
// Qualquer falha vira UnauthorizedError (401), e o next(erro) deixa o
// error-handler padronizar a resposta.
// -----------------------------------------------------------------------------

import { UnauthorizedError } from '../errors/app-error.js';

export function createAuthenticate({ tokenVerifier }) {
  return function authenticate(req, res, next) {
    const header = req.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      return next(new UnauthorizedError('Token ausente ou mal formatado'));
    }

    // Só a verificação fica dentro do try. O next() fica fora, para que um erro
    // de uma rota não seja confundido com um token inválido.
    let payload;
    try {
      payload = tokenVerifier.verify(token);
    } catch {
      return next(new UnauthorizedError('Token inválido ou expirado'));
    }

    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0) {
      return next(new UnauthorizedError('Token inválido'));
    }

    req.user = { id, email: payload.email };
    return next();
  };
}
