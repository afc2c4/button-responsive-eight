// src/validation/posts.validation.js
// -----------------------------------------------------------------------------
// Regras de formato dos dados de um post.
//
// Estas funções são puras: recebem um objeto e devolvem dados limpos, ou lançam
// ValidationError com `details` indicando o erro de cada campo. Não dependem de
// banco, rede ou HTTP, por isso são as regras mais baratas de testar.
//
// Regras de NEGÓCIO (o autor existe? ele é o dono do post?) não estão aqui.
// Elas ficam no service, porque dependem de dados externos.
// -----------------------------------------------------------------------------

import { ValidationError } from '../errors/app-error.js';

export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 120;
export const CONTENT_MIN_LENGTH = 10;
export const CONTENT_MAX_LENGTH = 10000;

function assertObject(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('O corpo da requisição deve ser um objeto JSON');
  }
}

// Regra: título vazio, ou feito só de espaços, é inválido.
// O título é trimado antes de medir, para que "    " não passe como título.
function readTitle(value, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.title = 'Título é obrigatório';
    return undefined;
  }

  const title = value.trim();
  if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    errors.title = `Título deve ter entre ${TITLE_MIN_LENGTH} e ${TITLE_MAX_LENGTH} caracteres`;
    return undefined;
  }

  return title;
}

function readContent(value, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.content = 'Conteúdo é obrigatório';
    return undefined;
  }

  const content = value.trim();
  if (content.length < CONTENT_MIN_LENGTH || content.length > CONTENT_MAX_LENGTH) {
    errors.content = `Conteúdo deve ter entre ${CONTENT_MIN_LENGTH} e ${CONTENT_MAX_LENGTH} caracteres`;
    return undefined;
  }

  return content;
}

function failIfAnyError(errors) {
  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Dados inválidos', errors);
  }
}

/** Criação: título e conteúdo são obrigatórios. */
export function validateNewPost(input) {
  assertObject(input);

  const errors = {};
  const data = {
    title: readTitle(input.title, errors),
    content: readContent(input.content, errors),
  };

  failIfAnyError(errors);
  return data;
}

/** Atualização parcial: só os campos enviados são validados. */
export function validatePostUpdate(input) {
  assertObject(input);

  const errors = {};
  const changes = {};

  if (input.title !== undefined) changes.title = readTitle(input.title, errors);
  if (input.content !== undefined) changes.content = readContent(input.content, errors);

  failIfAnyError(errors);

  if (Object.keys(changes).length === 0) {
    throw new ValidationError('Informe ao menos um campo para atualizar');
  }

  return changes;
}
