// src/errors/app-error.js
// -----------------------------------------------------------------------------
// Hierarquia de erros da aplicação.
//
// Cada erro de negócio carrega o status HTTP e um código estável. O middleware
// de erro converte esses dados em uma resposta JSON padronizada. Assim, os
// services não precisam conhecer detalhes de HTTP: basta lançar o erro certo.
// -----------------------------------------------------------------------------

export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos', details) {
    super(message, { statusCode: 400, code: 'VALIDATION_ERROR', details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super(message, { statusCode: 401, code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, { statusCode: 403, code: 'FORBIDDEN' });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, { statusCode: 404, code: 'NOT_FOUND' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito com um recurso existente') {
    super(message, { statusCode: 409, code: 'CONFLICT' });
  }
}
