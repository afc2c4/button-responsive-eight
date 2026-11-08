// src/security/token-verifier.js
// -----------------------------------------------------------------------------
// Verificação de tokens JWT emitidos pelo ms-users.
//
// O ms-blog NÃO emite tokens. Ele só verifica a assinatura. Por isso este
// módulo tem apenas o método verify, diferente do emissor do ms-users.
//
// Esta é a parte de segurança que mais importa na comunicação entre serviços:
// o blog confia no token porque ele foi assinado com o segredo compartilhado
// (JWT_SECRET). Um token forjado com outro segredo é recusado aqui.
// -----------------------------------------------------------------------------

import jwt from 'jsonwebtoken';

const ALGORITHM = 'HS256';

export function createTokenVerifier({ secret }) {
  if (!secret) {
    throw new Error('O segredo do JWT é obrigatório');
  }

  return Object.freeze({
    verify(token) {
      // Lista explícita de algoritmos: impede a aceitação de "alg: none".
      return jwt.verify(token, secret, { algorithms: [ALGORITHM] });
    },
  });
}
