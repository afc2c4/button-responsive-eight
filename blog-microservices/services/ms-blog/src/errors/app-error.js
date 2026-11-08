// src/errors/app-error.js
// -----------------------------------------------------------------------------
// Hierarquia de erros do ms-blog.
//
// Cada erro carrega o status HTTP e um código estável. Os services lançam o
// erro certo e não sabem nada sobre HTTP: quem traduz é o middleware
// error-handler.js.
//
// Três erros são específicos deste serviço:
//   - UnprocessableEntityError (422): o formato está certo, mas o autor não existe.
//   - ServiceUnavailableError (503): o ms-users não respondeu.
//   - ForbiddenError (403): quem está autenticado não é o autor do post.
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

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Não foi possível processar os dados informados') {
    super(message, { statusCode: 422, code: 'UNPROCESSABLE_ENTITY' });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Serviço temporariamente indisponível') {
    super(message, { statusCode: 503, code: 'SERVICE_UNAVAILABLE' });
  }
}
