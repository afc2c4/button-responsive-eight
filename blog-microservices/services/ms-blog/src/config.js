// src/config.js
// -----------------------------------------------------------------------------
// Lê e valida as variáveis de ambiente do ms-blog.
//
// Assim como no ms-users, a função recebe o ambiente como parâmetro, o que
// permite testar a validação sem alterar process.env.
//
// Duas configurações são críticas:
//   - JWT_SECRET: precisa ser o MESMO valor do ms-users, porque é com ele
//     que o token é verificado. Sem ele, o blog não reconhece quem está logado.
//   - USERS_SERVICE_URL: endereço do ms-users. Validado aqui, na inicialização,
//     para que um endereço malformado não apareça só na primeira requisição.
// -----------------------------------------------------------------------------

const DEFAULT_PORT = 3002;
const DEFAULT_DB_PATH = './data/ms-blog.sqlite';
const DEFAULT_USERS_SERVICE_URL = 'http://localhost:3001';
const DEFAULT_USERS_TIMEOUT_MS = 3000;
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

function parseHttpUrl(rawValue, name) {
  let url;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(`${name} não é uma URL válida (valor recebido: "${rawValue}")`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} deve usar http:// ou https://`);
  }

  // Remove a barra final para que `${baseUrl}/users/1` nunca vire `//users/1`.
  return url.href.replace(/\/+$/, '');
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
    port: parsePositiveInteger(env.BLOG_SERVICE_PORT, 'BLOG_SERVICE_PORT', DEFAULT_PORT),
    dbPath: env.BLOG_DB_PATH || DEFAULT_DB_PATH,
    usersService: Object.freeze({
      baseUrl: parseHttpUrl(env.USERS_SERVICE_URL || DEFAULT_USERS_SERVICE_URL, 'USERS_SERVICE_URL'),
      timeoutMs: parsePositiveInteger(
        env.USERS_SERVICE_TIMEOUT_MS,
        'USERS_SERVICE_TIMEOUT_MS',
        DEFAULT_USERS_TIMEOUT_MS,
      ),
    }),
    jwt: Object.freeze({
      secret: jwtSecret,
    }),
  });
}
