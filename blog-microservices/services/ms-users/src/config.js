// src/config.js
// -----------------------------------------------------------------------------
// Lê e valida as variáveis de ambiente do ms-users.
//
// A função recebe o objeto de ambiente como parâmetro (padrão: process.env).
// Assim, o teste pode passar um objeto próprio, sem mexer no ambiente real.
// Se uma configuração obrigatória estiver errada, o processo para com uma
// mensagem clara, em vez de falhar mais tarde com um erro obscuro.
// -----------------------------------------------------------------------------

const DEFAULT_PORT = 3001;
const DEFAULT_DB_PATH = './data/ms-users.sqlite';
const DEFAULT_JWT_EXPIRES_IN_SECONDS = 3600;
const MIN_JWT_SECRET_LENGTH = 32;

function parsePositiveInteger(rawValue, name, fallback) {
  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo (valor recebido: "${rawValue}")`);
  }
  return value;
}

export function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET ?? '';

  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET é obrigatório e deve ter pelo menos ${MIN_JWT_SECRET_LENGTH} caracteres`,
    );
  }

  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'development',
    port: parsePositiveInteger(env.USERS_SERVICE_PORT, 'USERS_SERVICE_PORT', DEFAULT_PORT),
    dbPath: env.USERS_DB_PATH || DEFAULT_DB_PATH,
    jwt: Object.freeze({
      secret: jwtSecret,
      expiresInSeconds: parsePositiveInteger(
        env.JWT_EXPIRES_IN,
        'JWT_EXPIRES_IN',
        DEFAULT_JWT_EXPIRES_IN_SECONDS,
      ),
    }),
  });
}
