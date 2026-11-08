// src/security/token.js
// -----------------------------------------------------------------------------
// Emissão e verificação de tokens JWT (JSON Web Token) assinados com HS256.
//
// O token carrega o identificador do usuário (claim `sub`) e o e-mail.
// Ele é assinado com um segredo que só o servidor conhece, então ninguém
// consegue alterar o conteúdo sem invalidar a assinatura.
// -----------------------------------------------------------------------------

import jwt from 'jsonwebtoken';

const ALGORITHM = 'HS256';

export function createTokenIssuer({ secret, expiresInSeconds }) {
  if (!secret) {
    throw new Error('O segredo do JWT é obrigatório');
  }

  return Object.freeze({
    sign(payload) {
      return jwt.sign(payload, secret, {
        algorithm: ALGORITHM,
        expiresIn: expiresInSeconds,
      });
    },

    verify(token) {
      // Lista explícita de algoritmos: impede o ataque em que o token
      // declara um algoritmo "none" ou outro que o servidor não usa.
      return jwt.verify(token, secret, { algorithms: [ALGORITHM] });
    },
  });
}
