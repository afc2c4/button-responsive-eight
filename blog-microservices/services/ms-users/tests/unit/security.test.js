// tests/unit/security.test.js
// -----------------------------------------------------------------------------
// Testes unitários dos módulos de segurança: hash de senha e tokens JWT.
//
// Diferente dos outros arquivos de teste unitário, AQUI não usamos stubs.
// Hash e JWT são funções puras (entrada → saída, sem banco nem rede), então
// testamos a implementação real. Isso garante que a criptografia de fato
// rejeita o que deve rejeitar.
// -----------------------------------------------------------------------------

import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { createTokenIssuer } from '../../src/security/token.js';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from '../../src/security/password.js';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';

function codificar(objeto) {
  return Buffer.from(JSON.stringify(objeto)).toString('base64url');
}

describe('password · hash com scrypt', () => {
  it('gera o hash no formato scrypt:<salt>:<hash>', async () => {
    const hash = await hashPassword('senha-forte-123');

    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it('nunca guarda a senha em texto puro', async () => {
    const hash = await hashPassword('senha-forte-123');

    expect(hash).not.toContain('senha-forte-123');
  });

  it('gera salts diferentes para a mesma senha', async () => {
    const primeiro = await hashPassword('mesma-senha-123');
    const segundo = await hashPassword('mesma-senha-123');

    expect(primeiro).not.toBe(segundo);
  });

  it('confere a senha correta', async () => {
    const hash = await hashPassword('senha-forte-123');

    await expect(verifyPassword('senha-forte-123', hash)).resolves.toBe(true);
  });

  it('recusa a senha incorreta', async () => {
    const hash = await hashPassword('senha-forte-123');

    await expect(verifyPassword('senha-errada-999', hash)).resolves.toBe(false);
  });

  it('recusa um hash malformado sem lançar exceção', async () => {
    await expect(verifyPassword('qualquer-senha', 'isto-nao-e-um-hash')).resolves.toBe(false);
  });

  it('o hash de referência do login nunca confere com senha comum', async () => {
    await expect(verifyPassword('123456789', DUMMY_PASSWORD_HASH)).resolves.toBe(false);
    await expect(verifyPassword('senha-forte-123', DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });
});

describe('token · JWT assinado com HS256', () => {
  it('assina e verifica o próprio token, preservando o payload', () => {
    const emissor = createTokenIssuer({ secret: SEGREDO, expiresInSeconds: 3600 });

    const token = emissor.sign({ sub: '1', email: 'ana@exemplo.com' });
    const payload = emissor.verify(token);

    expect(payload.sub).toBe('1');
    expect(payload.email).toBe('ana@exemplo.com');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('rejeita token com payload adulterado', () => {
    const emissor = createTokenIssuer({ secret: SEGREDO, expiresInSeconds: 3600 });
    const [cabecalho, , assinatura] = emissor.sign({ sub: '1', email: 'ana@exemplo.com' }).split('.');

    // Um atacante troca o id por outro e mantém a assinatura original.
    const tokenAdulterado = `${cabecalho}.${codificar({ sub: '999', email: 'x@exemplo.com' })}.${assinatura}`;

    expect(() => emissor.verify(tokenAdulterado)).toThrow();
  });

  it('rejeita token assinado com outro segredo', () => {
    const atacante = createTokenIssuer({
      secret: 'outro-segredo-que-o-atacante-conhece-123',
      expiresInSeconds: 3600,
    });
    const emissor = createTokenIssuer({ secret: SEGREDO, expiresInSeconds: 3600 });

    const tokenForjado = atacante.sign({ sub: '1', email: 'ana@exemplo.com' });

    expect(() => emissor.verify(tokenForjado)).toThrow();
  });

  it('rejeita token com algoritmo "none" (ataque clássico)', () => {
    const emissor = createTokenIssuer({ secret: SEGREDO, expiresInSeconds: 3600 });

    // Token sem assinatura, declarando alg "none". Se a verificação aceitasse
    // qualquer algoritmo declarado no cabeçalho, este token passaria.
    const tokenSemAssinatura = `${codificar({ alg: 'none', typ: 'JWT' })}.${codificar({ sub: '1' })}.`;

    expect(() => emissor.verify(tokenSemAssinatura)).toThrow();
  });

  it('rejeita token expirado', () => {
    const emissor = createTokenIssuer({ secret: SEGREDO, expiresInSeconds: 3600 });
    const expirado = jwt.sign(
      { sub: '1', exp: Math.floor(Date.now() / 1000) - 60 },
      SEGREDO,
      { algorithm: 'HS256' },
    );

    expect(() => emissor.verify(expirado)).toThrow(/expired/);
  });

  it('não permite criar o emissor sem segredo', () => {
    expect(() => createTokenIssuer({ secret: '', expiresInSeconds: 3600 })).toThrow(
      'O segredo do JWT é obrigatório',
    );
  });
});
