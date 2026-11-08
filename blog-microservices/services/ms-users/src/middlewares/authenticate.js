// src/middlewares/authenticate.js
// -----------------------------------------------------------------------------
// Middleware de autenticação para rotas protegidas.
//
// Lê o cabeçalho  Authorization: Bearer <token>, verifica a assinatura e a
// validade do token e, se estiver tudo certo, anexa o usuário em req.user.
//
// Qualquer problema vira UnauthorizedError (HTTP 401). A função usa next(erro)
// em vez de responder diretamente, para que o middleware de erro padronize
// a resposta.
// -----------------------------------------------------------------------------

import { UnauthorizedError } from '../errors/app-error.js';

export function createAuthenticate({ tokenIssuer }) {
  return function authenticate(req, res, next) {
    const header = req.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      return next(new UnauthorizedError('Token ausente ou mal formatado'));
    }

    // Só o trecho que verifica o token fica dentro do try.
    // O next() fica fora, para que um erro nas rotas seguintes não seja
    // confundido com um token inválido.
    let payload;
    try {
      payload = tokenIssuer.verify(token);
    } catch {
      return next(new UnauthorizedError('Token inválido ou expirado'));
    }

    const id = Number(payload.sub);
    if (!Number.isInteger(id)) {
      return next(new UnauthorizedError('Token inválido'));
    }

    req.user = { id, email: payload.email };
    return next();
  };
}
