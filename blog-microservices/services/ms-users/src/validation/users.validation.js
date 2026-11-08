// src/validation/users.validation.js
// -----------------------------------------------------------------------------
// Validação e normalização dos dados recebidos pela API.
//
// Estas funções são puras: recebem um objeto, devolvem dados limpos ou lançam
// ValidationError com um mapa `details` indicando o erro de cada campo.
// Não dependem de banco, rede ou HTTP, por isso são fáceis de testar.
// -----------------------------------------------------------------------------

import { ValidationError } from '../errors/app-error.js';

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Regra de negócio: "Ana@Exemplo.com" e "ana@exemplo.com" são o MESMO e-mail.
// Normalizar antes de salvar e antes de comparar evita duplicatas disfarçadas.
export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function assertObject(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('O corpo da requisição deve ser um objeto JSON');
  }
}

function readName(value, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.name = 'Nome é obrigatório';
    return undefined;
  }

  const name = value.trim();
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    errors.name = `Nome deve ter entre ${NAME_MIN_LENGTH} e ${NAME_MAX_LENGTH} caracteres`;
    return undefined;
  }

  return name;
}

function readEmail(value, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.email = 'E-mail é obrigatório';
    return undefined;
  }

  const email = normalizeEmail(value);
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = 'E-mail inválido';
    return undefined;
  }

  return email;
}

function readPassword(value, errors) {
  if (typeof value !== 'string' || value.length === 0) {
    errors.password = 'Senha é obrigatória';
    return undefined;
  }

  // A senha NÃO é trimada: espaços no início ou no fim fazem parte da senha.
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Senha deve ter entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH} caracteres`;
    return undefined;
  }

  return value;
}

function failIfAnyError(errors) {
  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Dados inválidos', errors);
  }
}

/** Cadastro: todos os campos são obrigatórios. */
export function validateNewUser(input) {
  assertObject(input);

  const errors = {};
  const data = {
    name: readName(input.name, errors),
    email: readEmail(input.email, errors),
    password: readPassword(input.password, errors),
  };

  failIfAnyError(errors);
  return data;
}

/** Atualização parcial: só os campos enviados são validados. */
export function validateUserUpdate(input) {
  assertObject(input);

  const errors = {};
  const changes = {};

  if (input.name !== undefined) changes.name = readName(input.name, errors);
  if (input.email !== undefined) changes.email = readEmail(input.email, errors);
  if (input.password !== undefined) changes.password = readPassword(input.password, errors);

  failIfAnyError(errors);

  if (Object.keys(changes).length === 0) {
    throw new ValidationError('Informe ao menos um campo para atualizar');
  }

  return changes;
}

/** Login: valida apenas a presença dos campos. A regra de tamanho não se aplica aqui. */
export function validateCredentials(input) {
  assertObject(input);

  const errors = {};
  const email = typeof input.email === 'string' && input.email.trim().length > 0
    ? normalizeEmail(input.email)
    : undefined;
  const password = typeof input.password === 'string' && input.password.length > 0
    ? input.password
    : undefined;

  if (!email) errors.email = 'E-mail é obrigatório';
  if (!password) errors.password = 'Senha é obrigatória';

  failIfAnyError(errors);
  return { email, password };
}
