// src/middlewares/error-handler.js
// -----------------------------------------------------------------------------
// Middleware de erro: o ÚLTIMO middleware registrado no app.
//
// Transforma qualquer erro em uma resposta JSON com o formato:
//   { "error": { "code": "...", "message": "...", "details"?: {...} } }
//
// Erros conhecidos (AppError) recebem o status definido na própria classe.
// Erros desconhecidos viram 500, e a mensagem interna NUNCA é exposta ao cliente.
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

  // Erros gerados pelo body-parser do express.json()
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
