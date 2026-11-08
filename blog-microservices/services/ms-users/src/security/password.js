// src/security/password.js
// -----------------------------------------------------------------------------
// Hash e verificação de senhas usando scrypt, do próprio Node.js.
//
// Nunca guardamos a senha em texto puro. O formato armazenado é:
//   scrypt:<salt em hex>:<hash derivado em hex>
//
// O salt é aleatório a cada cadastro, então duas pessoas com a mesma senha
// recebem hashes diferentes.
// -----------------------------------------------------------------------------

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const ALGORITHM = 'scrypt';
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export async function hashPassword(plainPassword) {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = await scrypt(plainPassword, salt, KEY_LENGTH);
  return `${ALGORITHM}:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(plainPassword, storedHash) {
  const [algorithm, salt, hashHex] = String(storedHash).split(':');
  const expected = Buffer.from(hashHex ?? '', 'hex');

  if (algorithm !== ALGORITHM || !salt || expected.length === 0) {
    return false;
  }

  const derived = await scrypt(plainPassword, salt, expected.length);
  // timingSafeEqual compara em tempo constante, o que evita vazar
  // informação pelo tempo de resposta.
  return timingSafeEqual(expected, derived);
}

// Objeto injetado nos services. Nos testes unitários ele é substituído por um stub.
export const passwordHasher = Object.freeze({
  hash: hashPassword,
  verify: verifyPassword,
});

// Hash de referência usado no login quando o e-mail não existe.
// Ele garante que a verificação leve o mesmo tempo nos dois casos, para que
// um atacante não descubra quais e-mails estão cadastrados medindo a resposta.
// Ele não corresponde a nenhuma senha real.
export const DUMMY_PASSWORD_HASH =
  'scrypt:47f6a7b79a3992c618741a30c19535d1:308403d0ee6f37e6046eab28f0a8c7060afcea06523e4e0e04294e613d67a776133ab75177778a98104b78e625c3bcae3ecb7e52c3c894d86ade343e3b8e6fd3';
