// src/middlewares/error-handler.js
// -----------------------------------------------------------------------------
// Último middleware do app: transforma qualquer erro em uma resposta JSON padrão:
//   { "error": { "code": "...", "message": "...", "details"?: {...} } }
//
// O formato é o mesmo do ms-users, o que faz os dois serviços conversarem com
// o mesmo contrato de erro.
//
// Erros inesperados viram 500 genérico, e o detalhe real vai só para o log.
// -----------------------------------------------------------------------------

import { AppError } from '../errors/app-error.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    const body = { code: error.code, message: error.message };
    if (error.details) {
      body.details = error.details;
    }
    return res.status(error.statusCode).json({ error: body });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Corpo JSON inválido' },
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Corpo da requisição excede o limite permitido' },
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error(error);
  }

  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
  });
}
